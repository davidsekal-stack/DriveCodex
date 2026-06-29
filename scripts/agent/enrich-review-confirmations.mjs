/**
 * enrich-review-confirmations.mjs — assisted review helper.
 *
 * For disputable cases held back on clause (d) "repair not confirmed to have worked",
 * find a VERBATIM quote in the original thread that MIGHT confirm the fix worked, and
 * store it on the queue row (candidate_confirmation). The review screen surfaces it so
 * the owner decides at a glance instead of re-reading the whole thread.
 *
 * This NEVER approves anything — it only suggests a quote for the human to confirm. So a
 * lenient finder is acceptable (the human filters false candidates): we just must never
 * FABRICATE, hence the verbatim-substring check. Uses DeepSeek (fast, no Claude weekly
 * limit) — same vendor as the verifier, fine here because there is no auto-decision.
 *
 * Idempotent: only fills rows whose candidate_confirmation is still empty. Safe before the
 * 027 migration lands — the write degrades to a no-op (column missing → skipped) and the
 * review screen simply shows no candidate.
 *
 * Usage:
 *   node --env-file=scripts/agent/.env.local --experimental-sqlite \
 *     scripts/agent/enrich-review-confirmations.mjs [--apply] [--max N]
 */

import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { deepseekChat } from './llm.mjs';
import { promptField, promptList } from './prompt-sanitize.mjs';
import { fetchOpenReviewQueueRows } from './supabase-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'agent.db');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nmvjthfezyjcwuzphiuu.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const H = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
const MAX_THREAD_CHARS = 60_000;
const MIN_QUOTE_CHARS = 8;

const APPLY = process.argv.includes('--apply');
const MAX = (() => { const i = process.argv.indexOf('--max'); return i === -1 ? Infinity : Number(process.argv[i + 1]); })();

function norm(s) { return (s ?? '').toString().toLowerCase().replace(/\s+/g, ' ').trim(); }

function buildFinderPrompt(threadText, c) {
  const text = (threadText || '').length > MAX_THREAD_CHARS ? threadText.slice(0, MAX_THREAD_CHARS) + '\n[...]' : (threadText || '');
  return `Below is a forum thread and a repair case extracted from it. A reviewer wants to know if the thread shows the repair WORKED.

Find ONE short excerpt — by the car's OWNER or a later reply about the same car — that indicates the fault was GONE or the car WORKED AFTER the repair. It may be informal and in any language ("funguje", "už jezdím", "zase foukáme", "problém zmizel", "vyřešeno", "po oprave OK", "works now", "geht"). Do NOT return a plan or tentative line ("zkusím", "dám vědět", "ještě nevím", "čeká mě oprava") and do NOT invent anything — copy the excerpt EXACTLY from the thread.

CASE repair: ${promptField(c.resolution)}
Symptoms: ${promptList(c.symptoms)}

THREAD:
---
${text}
---

Respond with ONE JSON object only: {"quote":"<verbatim excerpt, or empty if none>"}`;
}

function parseQuote(raw) {
  const t = (raw || '').trim(); const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s === -1 || e <= s) return '';
  try { const o = JSON.parse(t.slice(s, e + 1)); return typeof o.quote === 'string' ? o.quote.trim() : ''; } catch { return ''; }
}

// Second, STRICT pass: judge the found quote ON ITS OWN. The finder is lenient and grabs
// any on-topic line (even failures or pending repairs); this gate keeps only an
// unambiguous success, so the surfaced "possible confirmation" is trustworthy. Fail-closed.
function buildSkepticPrompt(quote, c) {
  return `A reviewer is checking whether a car repair worked. Below is ONE quote from the thread. Decide STRICTLY whether this quote, on its own, says the fault was RESOLVED / the car WORKED AFTER the repair.

Answer false (NOT a confirmation) for any of: a plan or intention ("going to test", "uvidím", "idem testovať"), a pending/awaited repair ("čeká mě oprava"), a tentative/temporary workaround ("zatím to drží", "pouze zalepil"), a FAILURE or relapse ("spojka je ko", "rozbil se zase", "stále nefunguje"), merely DESCRIBING what was done WITHOUT an outcome, or anything ambiguous. Answer true ONLY for an unambiguous success ("funguje", "problém vyřešen", "už jezdím", "everything works good").

Repair done: ${promptField(c.resolution, 300)}
QUOTE: «${promptField(quote, 400)}»

Respond with ONE JSON object only: {"confirms": true|false}`;
}
function parseConfirms(raw) {
  const t = (raw || '').trim(); const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s === -1 || e <= s) return false;
  try { return JSON.parse(t.slice(s, e + 1)).confirms === true; } catch { return false; }
}

async function patchCandidate(localId, quote) {
  // Best-effort: if the 027 column does not exist yet, this 4xx's and we skip silently.
  const u = `${SUPABASE_URL}/rest/v1/crawl_review_queue?case_local_id=eq.${encodeURIComponent(localId)}&resolved_at=is.null`;
  const res = await fetch(u, { method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate_confirmation: quote }) });
  return res.ok;
}

async function run() {
  if (!SERVICE_KEY || !process.env.DEEPSEEK_API_KEY) { console.error('missing SUPABASE_SERVICE_KEY / DEEPSEEK_API_KEY'); process.exit(1); }
  const db = new DatabaseSync(DB_PATH, { readOnly: true });

  // Pull open clause-d rows; include candidate_confirmation if the column exists so we skip
  // already-filled ones (falls back to clause-only select pre-migration).
  let rows = [];
  let q = await fetchOpenReviewQueueRows({ supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, select: 'case_local_id,clause,candidate_confirmation' });
  if (!q.ok) q = await fetchOpenReviewQueueRows({ supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, select: 'case_local_id,clause' });
  if (!q.ok) { console.error('cannot read queue:', q.reason); process.exit(1); }
  rows = q.rows.filter(r => r.clause === 'd' && !r.candidate_confirmation);
  if (Number.isFinite(MAX)) rows = rows.slice(0, MAX);
  console.log(`${APPLY ? 'APPLY' : 'DRY-RUN'} — ${rows.length} clause-(d) cases to scan for a candidate confirmation.\n`);

  let found = 0, none = 0, stored = 0, noThread = 0;
  for (let i = 0; i < rows.length; i++) {
    const localId = rows[i].case_local_id;
    const agentCase = db.prepare(`SELECT thread_id FROM cases WHERE id=?`).get(localId);
    const thread = agentCase?.thread_id ? db.prepare(`SELECT thread_text FROM threads WHERE id=?`).get(agentCase.thread_id) : null;
    const threadText = thread?.thread_text || '';
    if (threadText.trim().length < 200) { noThread++; continue; }
    const live = await fetch(`${SUPABASE_URL}/rest/v1/gearbrain_cases?local_id=eq.${encodeURIComponent(localId)}&select=resolution,symptoms&limit=1`, { headers: H }).then(r => r.json()).then(a => a[0] || {});
    let quote = '';
    try {
      quote = parseQuote(await deepseekChat({ apiKey: process.env.DEEPSEEK_API_KEY, prompt: buildFinderPrompt(threadText, live), maxTokens: 200, temperature: 0 }));
    } catch (e) { console.error(`  ${localId.slice(0, 10)} error: ${e.message}`); continue; }

    const verbatim = quote && quote.length >= MIN_QUOTE_CHARS && norm(threadText).includes(norm(quote));
    let confirms = false;
    if (verbatim) {
      try { confirms = parseConfirms(await deepseekChat({ apiKey: process.env.DEEPSEEK_API_KEY, prompt: buildSkepticPrompt(quote, live), maxTokens: 60, temperature: 0 })); }
      catch (e) { console.error(`  ${localId.slice(0, 10)} skeptic error: ${e.message}`); confirms = false; }
    }
    if (verbatim && confirms) {
      found++;
      console.log(`  ✓ ${localId.slice(0, 10)}  «${norm(quote).slice(0, 120)}»`);
      if (APPLY) { if (await patchCandidate(localId, quote.slice(0, 500))) stored++; }
    } else {
      none++;
      if (verbatim && !confirms) console.log(`  ✗ ${localId.slice(0, 10)}  (skeptik zamítl) «${norm(quote).slice(0, 70)}»`);
    }
  }
  db.close();
  console.log(`\nscanned ${rows.length}: candidate found ${found}, none ${none}, no-thread ${noThread}${APPLY ? `, stored ${stored}` : ' (dry-run)'}`);
}

await run();
