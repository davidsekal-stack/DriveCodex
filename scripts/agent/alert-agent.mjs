/**
 * alert-agent.mjs — cautious agentic follow-up to the precision auditor's alarm.
 *
 * The precision auditor (precision-auditor.mjs) raises an alarm + a Desktop marker when
 * too many APPROVED cases look wrongly accepted, then stops — a human had to act. This
 * agent closes that loop CAUTIOUSLY, with a hard line between "reflect" and "touch the
 * gate":
 *
 *   REFLECT (report-only): read the structured labels of the flagged cases
 *     (logs/precision-labels.jsonl), cluster the failures into a pattern, and ask an
 *     INDEPENDENT model for a plain-Czech diagnosis + a concrete RECOMMENDATION (e.g.
 *     "tighten verifier clause d to require an explicit confirmation"). It writes that
 *     recommendation for the owner — it NEVER edits the verifier prompt or any gate
 *     threshold itself (that stays the deliberate Phase-4, human-approved boundary).
 *
 *   ACT (reversible, case-scoped): for the high-confidence wrongly-accepted cases it
 *     QUARANTINES them — flips the live gearbrain_cases row pending/approved → rejected
 *     (so it leaves search/review) and marks the local case 'quarantined'. Both are
 *     journaled (knob='quarantine') and fully reversible via apply-proposal.mjs
 *     --revert. The live write happens FIRST; only on success is the local status +
 *     journal committed, so a half-action can never claim success.
 *
 * Safety: case ids to quarantine come ONLY from the structured label log (never parsed
 * from model prose — injection-proof); all case text fed to the model is sanitized;
 * the quarantine acts only on confidence='high' labels; self-gates once/local-day; a
 * quota/auth stop aborts (exit 3) AFTER the quarantine (which needs no model) so the
 * safety action is never lost. Runs after the precision auditor in run-coach-batch.ps1.
 *
 * Usage:
 *   node --experimental-sqlite alert-agent.mjs [--force] [--dry-run]
 */

import { writeFileSync, appendFileSync, readFileSync, existsSync, mkdirSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { AgentState } from './state.mjs';
import { isStoppingError } from './quota.mjs';
import { QUALITY_BAR } from './quality-bar.mjs';
import { promptField } from './prompt-sanitize.mjs';
import { setLiveCaseStatusByLocalId, resolveSupabaseReadKey } from './supabase-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Independent vendor (Claude), separate from the DeepSeek verifier. Set BEFORE importing llm.mjs.
if (!process.env['AGENT_LLM_ALERT-AGENT']) process.env['AGENT_LLM_ALERT-AGENT'] = 'claude:haiku';
const { runLlm } = await import('./llm.mjs');

// ── Tunables (env-overridable) ──────────────────────────────────────────────
const EVAL_HOUR      = intEnv('ALERT_AGENT_HOUR', 6);
const EVAL_HOUR_END  = intEnv('ALERT_AGENT_HOUR_END', 21);
const POOL_DAYS      = intEnv('ALERT_AGENT_POOL_DAYS', 7);    // label window to reflect over
const MAX_QUARANTINE = intEnv('ALERT_MAX_QUARANTINE', 8);     // cap reversible auto-actions per run
const LLM_TIMEOUT_MS = 90_000;
const LLM_MAX_TOKENS = 600;

const META_KEY    = 'alert_agent_last_date';
const ALERT_FILE  = join(__dirname, 'precision-alert.txt');
const LOG_DIR     = join(__dirname, 'logs');
const LABELS_FILE = join(LOG_DIR, 'precision-labels.jsonl');
const REFLECTION_SENTINEL = '[REFLEXE-AGENT]';
const REPORT_SECTION = '## Reflexe (agent)';

// Local statuses a case can be quarantined FROM (passed the gate, live or heading there).
const APPROVED_STATUSES = new Set(['verified', 'import_ready', 'imported']);

// Map a precision quality-bar clause (a–e) to a gearbrain_cases review_reason code
// (migration 024) so the live rejection records WHY, feeding the Phase-4 gold-set.
// Approximate by nature (clause d spans no_repair+unconfirmed; we use the dominant one):
// a→not in scope, b/c→not a genuine fault repair, d→repair not confirmed, e→vehicle mismatch.
const REASON_BY_CLAUSE = { a: 'not_car', b: 'not_a_fault', c: 'not_a_fault', d: 'unconfirmed', e: 'vehicle_mismatch' };

const CLAUSE_LABEL = {
  a: '(a) není osobní auto/dodávka/lehký pick-up',
  b: '(b) není skutečná oprava závady',
  c: '(c) konfigurace/upgrade/„spravilo se samo"',
  d: '(d) oprava neprovedena/nepotvrzena, nebo závadu/vozidlo nepopsal majitel',
  e: '(e) vozidlo neodpovídá citovaným příspěvkům',
};

function intEnv(name, dflt) { const v = parseInt(process.env[name] ?? '', 10); return Number.isFinite(v) ? v : dflt; }
function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addLocalDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Pure helpers (exported for tests) ────────────────────────────────────────

/** Parse the precision-labels JSONL within a trailing window (oldest lines first). */
export function readLabelRows(text, today, days) {
  const cutoff = addLocalDays(today, -days); // exclusive lower bound → true trailing window
  const out = [];
  for (const line of (text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const o = JSON.parse(t);
      if (/^\d{4}-\d{2}-\d{2}$/.test(o.date || '') && o.date > cutoff) out.push(o);
    } catch { /* skip malformed */ }
  }
  return out;
}

/**
 * Cluster wrongly-accepted labels into a failure pattern. Dedupe keeps the genuinely
 * LATEST label per case across ALL verdicts (true OR false), so a later "correctly
 * accepted" re-judgement SUPERSEDES an earlier wrongly-accepted one — only cases whose
 * FINAL verdict is wrongly_accepted are clustered/quarantined. Returns the per-clause
 * breakdown, the dominant clause, and the HIGH-confidence case ids — the ONLY ids
 * eligible for the reversible quarantine.
 */
export function clusterFailures(rows) {
  // Latest label per case across EVERY verdict (not just the true ones), so an overturned
  // verdict (true→false on a later ts) correctly cancels the quarantine.
  const latest = new Map(); // case_id → newest label row, regardless of verdict
  for (const r of rows) {
    if (!r.case_id) continue;
    const prev = latest.get(r.case_id);
    if (!prev || String(r.ts || r.date) > String(prev.ts || prev.date)) latest.set(r.case_id, r);
  }
  const byClause = {};
  const highConf = [];
  let total = 0;
  for (const r of latest.values()) {
    if (r.wrongly_accepted !== true) continue; // only cases whose FINAL verdict is wrongly-accepted
    total++;
    const c = /^[a-e]$/.test(r.failed_condition) ? r.failed_condition : 'none';
    (byClause[c] || (byClause[c] = { count: 0, highConf: 0, reasons: [], caseIds: [] })).count++;
    byClause[c].caseIds.push(r.case_id);
    if (r.reason && byClause[c].reasons.length < 4) byClause[c].reasons.push(r.reason);
    if (r.confidence === 'high') { byClause[c].highConf++; highConf.push({ caseId: r.case_id, clause: c }); }
  }
  let dominantClause = null, dominantCount = 0;
  for (const [c, v] of Object.entries(byClause)) if (v.count > dominantCount) { dominantClause = c; dominantCount = v.count; }
  return { total, byClause, dominantClause, dominantCount, highConf };
}

/** Build the sanitized plain-Czech reflection prompt from STRUCTURED cluster data only
 *  (no raw thread text → minimal injection surface, no per-case model calls). */
export function buildReflectionPrompt(cluster) {
  const lines = [];
  for (const [c, v] of Object.entries(cluster.byClause).sort((a, b) => b[1].count - a[1].count)) {
    const label = CLAUSE_LABEL[c] || c;
    lines.push(`- ${label}: ${v.count} případů (z toho ${v.highConf} s vysokou jistotou)`);
    for (const reason of v.reasons) lines.push(`    • ${promptField(reason, 200)}`);
  }
  return `Jsi kontrolor kvality automobilové diagnostické databáze. Nezávislá kontrola (precision auditor) označila níže uvedené SCHVÁLENÉ případy jako pravděpodobně CHYBNĚ schválené — tedy špatné případy, které prosákly kontrolou. Každý je zařazen pod podmínku kvality (a–e), kterou poručuje.

${QUALITY_BAR}

ROZPAD NÁLEZŮ (za posledních ${POOL_DAYS} dní, ${cluster.total} případů):
${lines.join('\n')}

Tvůj úkol — POUZE analýza a doporučení, NEPROVÁDÍŠ žádnou změnu:
1. Najdi SYSTEMATICKÝ vzorec: která jedna třída chyb prosakuje nejvíc a proč (např. brána u podmínky d je moc měkká na „provizorní/nepotvrzené opravy").
2. Navrhni KONKRÉTNÍ zpřísnění (slovně, ne kód) verifikační brány, které by tento vzorec zachytilo, aniž by začalo zahazovat dobré případy.

Odpověz JEDNÍM JSON objektem, nic jiného:
{"diagnosis":"<2–4 věty česky, srozumitelně pro netechnika>","recommendation":"<1–3 věty: co konkrétně zpřísnit>","severity":"low|medium|high"}`;
}

/** Tolerant parse of the reflection verdict; falls back to using the raw text as diagnosis. */
export function parseReflection(raw) {
  const text = (raw || '').trim();
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s !== -1 && e > s) {
    try {
      const o = JSON.parse(text.slice(s, e + 1));
      return {
        diagnosis: (typeof o.diagnosis === 'string' ? o.diagnosis : '').trim() || text.slice(0, 600),
        recommendation: (typeof o.recommendation === 'string' ? o.recommendation : '').trim(),
        severity: /^(low|medium|high)$/.test(o.severity) ? o.severity : 'medium',
      };
    } catch { /* fall through */ }
  }
  return { diagnosis: text.slice(0, 600), recommendation: '', severity: 'medium' };
}

// ── Output (report + marker), idempotent on same-day re-run ──────────────────

function buildReflectionMd(today, cluster, reflection, quarantined, skipped) {
  const L = [`# Reflexe alarmu přesnosti — ${today}`, ''];
  if (reflection) {
    L.push('## Diagnóza', reflection.diagnosis || '_(model nevrátil diagnózu)_', '');
    if (reflection.recommendation) {
      L.push('## Doporučení (POUZE návrh — bránu sám neměním)', reflection.recommendation, '');
    }
  } else {
    L.push('_Diagnóza nedoběhla (limit/přihlášení) — níže je aspoň automatická akce._', '');
  }
  L.push('## Co jsem sám provedl (vratné)');
  if (quarantined.length > 0) {
    L.push(`Dal jsem do karantény ${quarantined.length} případů s vysokou jistotou (staženo z fronty/databáze, plně vratné):`);
    for (const q of quarantined) L.push(`- ${q.caseId.slice(0, 8)} — ${q.live === 'pulled' ? 'staženo z živé databáze' : q.live === 'not-live' ? 'ještě nebylo živé, zastaveno lokálně' : 'živý stav ponechán'}`);
  } else {
    L.push('_Nic jsem nestahoval (žádné případy s dostatečně vysokou jistotou, nebo už byly vyřešené)._');
  }
  if (skipped.length > 0) {
    L.push('', '### Přeskočeno');
    for (const s of skipped) L.push(`- ${s.caseId.slice(0, 8)}: ${s.why}`);
  }
  L.push('', `_Vše vratné: \`node --experimental-sqlite scripts/agent/apply-proposal.mjs --revert --knob quarantine\` (nebo \`--case <id>\`). Na verifikační bránu/prompty agent NIKDY sám nesahá — to je jen doporučení výše._`);
  return L.join('\n');
}

/** Append the reflection to the precision-audit report idempotently (replace any prior block). */
function appendToReport(today, reflection, quarantined) {
  const reportPath = join(LOG_DIR, `precision-audit-${today}.md`);
  if (!existsSync(reportPath)) return;
  let body = readFileSync(reportPath, 'utf8');
  const idx = body.indexOf(`\n${REPORT_SECTION}`);
  if (idx !== -1) body = body.slice(0, idx); // strip prior reflection block (idempotent re-run)
  const sec = [`\n${REPORT_SECTION}`];
  if (reflection?.diagnosis) sec.push('', reflection.diagnosis);
  if (reflection?.recommendation) sec.push('', `**Doporučení (jen návrh):** ${reflection.recommendation}`);
  sec.push('', `**Automatická akce:** do karantény dáno ${quarantined.length} případů (vratné).`);
  writeFileSync(reportPath, body.replace(/\s*$/, '') + '\n' + sec.join('\n') + '\n', 'utf8');
}

/** Enrich the Desktop alert marker with the diagnosis (the ps1 mirror copies this file). */
function enrichAlertFile(reflection, quarantinedCount) {
  if (!existsSync(ALERT_FILE)) return;
  const body = readFileSync(ALERT_FILE, 'utf8');
  if (body.includes(REFLECTION_SENTINEL)) return; // already enriched this cycle
  const extra = `\n\n${REFLECTION_SENTINEL}\nDiagnóza agenta: ${reflection?.diagnosis || '(nedoběhla)'}`
    + (reflection?.recommendation ? `\nDoporučení (návrh, neprovedeno): ${reflection.recommendation}` : '')
    + `\nAgent sám stáhl do karantény (vratné): ${quarantinedCount} případů.`;
  appendFileSync(ALERT_FILE, extra, 'utf8');
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const dryRun = args.includes('--dry-run');
  const now = new Date();
  const today = localDateStr(now);
  const state = new AgentState();
  let stopping = false;

  try {
    if (!force) {
      const h = now.getHours();
      if (h < EVAL_HOUR || h >= EVAL_HOUR_END) { console.log(`alert-agent: mimo ranní okno (${EVAL_HOUR}:00–${EVAL_HOUR_END}:00) — skip.`); return; }
      if (state.getMeta(META_KEY) === today) { console.log('alert-agent: už dnes proběhlo — skip.'); return; }
    }
    if (!existsSync(ALERT_FILE)) { console.log('alert-agent: žádný aktivní alarm přesnosti — nic k řešení.'); return; }

    const labels = existsSync(LABELS_FILE) ? readLabelRows(readFileSync(LABELS_FILE, 'utf8'), today, POOL_DAYS) : [];
    const cluster = clusterFailures(labels);
    console.log(`alert-agent: ${cluster.total} wrongly-accepted in ${POOL_DAYS}d; dominant=${cluster.dominantClause}(${cluster.dominantCount}); high-conf=${cluster.highConf.length}`);

    if (dryRun) {
      console.log(`alert-agent: dry-run — would quarantine up to ${Math.min(MAX_QUARANTINE, cluster.highConf.length)} high-conf case(s); no writes.`);
      return;
    }

    // 1) ACT FIRST (no model needed): quarantine high-confidence wrongly-accepted cases.
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = resolveSupabaseReadKey(process.env);
    const quarantined = [], skipped = [];
    for (const { caseId, clause } of cluster.highConf.slice(0, MAX_QUARANTINE)) {
      const c = state.getCase(caseId);
      if (!c) { skipped.push({ caseId, why: 'lokálně nenalezen' }); continue; }
      if (c.status === 'quarantined') { skipped.push({ caseId, why: 'už v karanténě' }); continue; }
      if (!APPROVED_STATUSES.has(c.status)) { skipped.push({ caseId, why: `stav ${c.status}` }); continue; }

      const reviewReason = REASON_BY_CLAUSE[clause] || 'other';
      let live = { ok: true, found: false };
      if (supabaseUrl && serviceKey) {
        live = await setLiveCaseStatusByLocalId({
          supabaseUrl, serviceKey, localId: caseId,
          patch: { status: 'rejected', review_reason: reviewReason, reviewed_at: now.toISOString() },
          expectStatuses: ['pending', 'approved'],
        });
      }
      if (!live.ok) { skipped.push({ caseId, why: `živý zápis selhal: ${live.reason}` }); continue; } // never journal a half-action

      const res = state.applyCaseChange({
        date: today, caseId, label: caseVehicle(c), knob: 'quarantine', reasonCode: `precision_${clause}`,
        signal: { live_pulled: !!live.updated, live_found: !!live.found, live_prev_status: live.previousStatus ?? null, failed_condition: clause, confidence: 'high' },
        oldFields: { status: c.status }, newFields: { status: 'quarantined' },
      });
      if (res.ok) {
        quarantined.push({ caseId, live: live.updated ? 'pulled' : (live.found ? 'kept' : 'not-live') });
      } else {
        skipped.push({ caseId, why: `deník: ${res.reason}` });
        // The live row was already pulled but the local journal write failed → there is
        // NO journal row, so --revert could never restore it. Compensate immediately by
        // un-rejecting the live row, so we never leave an unrecoverable live rejection.
        if (live.updated && supabaseUrl && serviceKey) {
          const back = await setLiveCaseStatusByLocalId({
            supabaseUrl, serviceKey, localId: caseId,
            patch: { status: live.previousStatus, review_reason: null, reviewed_at: null },
            expectStatuses: ['rejected'],
          });
          if (back.ok && back.updated) state.log('info', `alert-agent: compensated live rollback for ${caseId} after a failed local journal write`, 'coach');
          else state.log('warn', `alert-agent: ${caseId} left REJECTED in the live DB (local journal failed: ${res.reason}; compensation failed: ${back.reason || 'no-op'}) — needs manual restore`, 'coach');
        }
      }
    }
    console.log(`alert-agent: quarantined ${quarantined.length}, skipped ${skipped.length}`);

    // 2) REFLECT (best-effort; the safety action above does not depend on the model).
    let reflection = null;
    if (cluster.total > 0) {
      try {
        const raw = await runLlm('alert-agent', buildReflectionPrompt(cluster), { timeoutMs: LLM_TIMEOUT_MS, maxTokens: LLM_MAX_TOKENS, temperature: 0 });
        reflection = parseReflection(raw);
      } catch (err) {
        if (isStoppingError(err)) { stopping = true; state.log('warn', `alert-agent reflection stopped: ${err.message}`, 'coach'); }
        else state.log('warn', `alert-agent reflection error: ${err.message}`, 'coach');
      }
    }

    // 3) Outputs.
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    writeFileSync(join(LOG_DIR, `precision-reflection-${today}.md`), buildReflectionMd(today, cluster, reflection, quarantined, skipped), 'utf8');
    appendToReport(today, reflection, quarantined);
    enrichAlertFile(reflection, quarantined.length);

    state.setMeta(META_KEY, today); // claim the day: the quarantine (real work) completed
    state.log('info', `alert-agent ${today}: quarantined ${quarantined.length}, reflected=${!!reflection}${stopping ? ' (LLM stopped)' : ''}`, 'coach');
  } finally {
    state.close();
  }

  if (stopping) process.exitCode = 3; // tell the batch wrapper to short-circuit remaining LLM steps
}

function caseVehicle(c) {
  let p = {};
  try { p = JSON.parse(c.payload_json || '{}'); } catch { /* keep {} */ }
  return `${p.vehicle_brand || p.brand_raw || '?'} ${p.vehicle_model || p.model_raw || ''}`.trim();
}

const invokedDirectly = (() => {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
if (invokedDirectly) await main();
