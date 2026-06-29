/**
 * dedup-existing-threads.mjs — one-off, REVERSIBLE cleanup of same-thread
 * duplicate cases that were imported before the crawl-time dedup gate existed.
 *
 * Background: a single forum thread is one discussion. When several members
 * reported the SAME fault fixed the SAME way, the extractor emitted one case per
 * member — so the live DB and the owner's review queue carry the same card more
 * than once (and, sharing a thread `source_ref`, they add no corroboration). The
 * crawl pipeline now collapses these at extract time (dedup-thread-cases.mjs);
 * this script applies the SAME judgement to data already imported.
 *
 * It groups agent.db cases that are live (status 'imported') by thread, asks the
 * routed `dedupe` LLM which are the same fault+repair (CODE picks the richest
 * survivor), and flips the rest to rejected. Genuinely different repairs of the
 * same symptom are kept — exactly the crawl-time policy.
 *
 * For every duplicate it:
 *   1. gearbrain_cases  → status='rejected', review_reason='duplicate' (CAS-guarded
 *      on the expected prior status, so a human decision in the window is never
 *      clobbered),
 *   2. crawl_review_queue → resolves any open row (resolved_at, decision='rejected'),
 *      mirroring exactly what a human "Zamítnout" does,
 *   3. agent.db case → status 'crosscheck_dupe' (terminal; keeps local memory honest).
 *
 * REVERSIBLE: every change is recorded in a backup JSON; --revert <file> restores
 * the live status/review_reason/reviewed_at, re-opens the queue rows, and restores
 * the agent.db status.
 *
 * Usage (always dry-run unless --apply):
 *   node --env-file=scripts/agent/.env.local --experimental-sqlite \
 *     scripts/agent/dedup-existing-threads.mjs [--apply] [--limit N] [--thread <prefix>]
 *   node --env-file=scripts/agent/.env.local --experimental-sqlite \
 *     scripts/agent/dedup-existing-threads.mjs --revert <backup.json>
 */

import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { judgeDuplicateClusters, pickSurvivorIndex } from './dedup-thread-cases.mjs';
import { isStoppingError } from './quota.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'agent.db');
const BACKUP_DIR = join(__dirname, `.dedup-thread-backup-${new Date().toISOString().slice(0, 10)}`);

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nmvjthfezyjcwuzphiuu.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const H = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
const JSON_H = { ...H, 'Content-Type': 'application/json', Prefer: 'return=representation' };

const LIVE_FLIPPABLE = ['approved', 'pending']; // never touch already-rejected or other states

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : (process.argv[i + 1] ?? true);
}
const APPLY = process.argv.includes('--apply');
const REVERT_FILE = arg('--revert');
const LIMIT = arg('--limit') ? Number(arg('--limit')) : Infinity;
const THREAD = arg('--thread');

function snippet(s, n = 70) { return (s || '').toString().replace(/\s+/g, ' ').trim().slice(0, n); }

// ── live REST helpers ───────────────────────────────────────────────────────
async function liveLookupByLocalId(localId) {
  const u = `${SUPABASE_URL}/rest/v1/gearbrain_cases?local_id=eq.${encodeURIComponent(localId)}&select=id,status,review_reason,reviewed_at&limit=1`;
  const res = await fetch(u, { headers: H });
  if (!res.ok) throw new Error(`lookup HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function patchLiveCase(liveId, patch, expectStatuses) {
  let u = `${SUPABASE_URL}/rest/v1/gearbrain_cases?id=eq.${liveId}`;
  if (expectStatuses) u += `&status=in.(${expectStatuses.join(',')})`;
  const res = await fetch(u, { method: 'PATCH', headers: JSON_H, body: JSON.stringify(patch) });
  if (!res.ok) throw new Error(`patch HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows.length : 0; // rows actually changed
}

async function resolveQueueRow(localId, decision) {
  // Returns true if an OPEN row existed and was resolved (so revert can re-open it).
  const u = `${SUPABASE_URL}/rest/v1/crawl_review_queue?case_local_id=eq.${encodeURIComponent(localId)}&resolved_at=is.null`;
  const res = await fetch(u, { method: 'PATCH', headers: JSON_H, body: JSON.stringify({ resolved_at: new Date().toISOString(), decision }) });
  if (!res.ok) throw new Error(`queue patch HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

async function reopenQueueRow(localId) {
  const u = `${SUPABASE_URL}/rest/v1/crawl_review_queue?case_local_id=eq.${encodeURIComponent(localId)}`;
  const res = await fetch(u, { method: 'PATCH', headers: JSON_H, body: JSON.stringify({ resolved_at: null, decision: null }) });
  if (!res.ok) throw new Error(`queue reopen HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
}

// ── revert mode ───────────────────────────────────────────────────────────--
async function revert(file) {
  const backup = JSON.parse(readFileSync(file, 'utf8'));
  console.log(`Reverting ${backup.length} case(s) from ${file}\n`);
  const db = new DatabaseSync(DB_PATH);
  let live = 0, queue = 0, local = 0;
  for (const b of backup) {
    try {
      await patchLiveCase(b.live_id, { status: b.live_status, review_reason: b.review_reason, reviewed_at: b.reviewed_at }, null);
      live++;
      if (b.queue_was_open) { await reopenQueueRow(b.local_id); queue++; }
      if (b.agent_prev_status) {
        db.prepare(`UPDATE cases SET status=?, review_note=? WHERE id=?`).run(b.agent_prev_status, b.agent_prev_note ?? null, b.agent_id);
        local++;
      }
      console.log(`  ↩ ${b.local_id.slice(0, 10)} → ${b.live_status}`);
    } catch (e) { console.error(`  ✗ ${b.local_id?.slice(0, 10)}: ${e.message}`); }
  }
  db.close();
  console.log(`\nReverted: ${live} live, ${queue} queue rows re-opened, ${local} agent.db rows.`);
}

// ── main cleanup ─────────────────────────────────────────────────────────────
async function run() {
  if (!SERVICE_KEY) { console.error('SUPABASE_SERVICE_KEY not set (run with --env-file=scripts/agent/.env.local).'); process.exit(1); }

  const db = new DatabaseSync(DB_PATH, { readOnly: !APPLY });

  // Threads with >=2 live (imported) cases.
  let threadRows = db.prepare(`
    SELECT thread_id, COUNT(*) n FROM cases WHERE status='imported'
    GROUP BY thread_id HAVING n >= 2 ORDER BY n DESC
  `).all();
  if (THREAD) threadRows = threadRows.filter(r => r.thread_id.startsWith(THREAD));
  threadRows = threadRows.slice(0, LIMIT);

  console.log(`${APPLY ? 'APPLY' : 'DRY-RUN'} — ${threadRows.length} thread(s) with >=2 live cases to judge.\n`);

  const backup = [];
  let threadsWithDups = 0, casesToReject = 0, judgeErrors = 0;

  for (let t = 0; t < threadRows.length; t++) {
    const { thread_id } = threadRows[t];
    const rows = db.prepare(`SELECT id, payload_json FROM cases WHERE thread_id=? AND status='imported'`).all(thread_id);
    const cases = rows.map(r => ({ agentId: r.id, p: JSON.parse(r.payload_json) }));
    const payloads = cases.map(c => c.p);

    let clusters;
    try {
      clusters = await judgeDuplicateClusters(payloads);
    } catch (e) {
      if (isStoppingError(e)) { console.error(`\nStopping (quota/auth): ${e.message}`); break; }
      judgeErrors++; console.error(`  [${t + 1}/${threadRows.length}] judge failed for ${thread_id.slice(0, 10)}: ${e.message}`); continue;
    }
    if (!clusters.length) { process.stdout.write(`  [${t + 1}/${threadRows.length}] ${thread_id.slice(0, 10)} — distinct, kept all\r`); continue; }

    threadsWithDups++;
    const url = payloads[0].thread_url || '';
    console.log(`\n  [${t + 1}/${threadRows.length}] ${url || thread_id.slice(0, 12)}`);
    for (const cluster of clusters) {
      const survivor = pickSurvivorIndex(cluster, payloads);
      console.log(`    keep  [${payloads[survivor].case_author}] ${snippet(payloads[survivor].resolution)}`);
      for (const idx of cluster) {
        if (idx === survivor) continue;
        casesToReject++;
        const c = cases[idx];
        console.log(`    drop  [${c.p.case_author}] ${snippet(c.p.resolution)}`);
        if (APPLY) {
          try {
            const liveRow = await liveLookupByLocalId(c.agentId);
            if (!liveRow) { console.log(`          (not in live DB — agent.db only)`); }
            let changed = 0, queueWasOpen = false;
            if (liveRow) {
              changed = await patchLiveCase(liveRow.id, { status: 'rejected', review_reason: 'duplicate', reviewed_at: new Date().toISOString() }, LIVE_FLIPPABLE);
              if (changed > 0) queueWasOpen = await resolveQueueRow(c.agentId, 'rejected');
              else console.log(`          (live status was '${liveRow.status}' — skipped, not clobbered)`);
            }
            const agentRow = db.prepare(`SELECT status, review_note FROM cases WHERE id=?`).get(c.agentId);
            db.prepare(`UPDATE cases SET status='crosscheck_dupe', review_note=? WHERE id=?`)
              .run(`Same-thread duplicate (cleanup ${new Date().toISOString().slice(0, 10)})`, c.agentId);
            backup.push({
              local_id: c.agentId, agent_id: c.agentId,
              live_id: liveRow?.id ?? null,
              live_status: liveRow?.status ?? null, review_reason: liveRow?.review_reason ?? null, reviewed_at: liveRow?.reviewed_at ?? null,
              live_changed: changed, queue_was_open: queueWasOpen,
              agent_prev_status: agentRow?.status ?? null, agent_prev_note: agentRow?.review_note ?? null,
            });
          } catch (e) {
            if (isStoppingError(e)) throw e;
            console.error(`          ✗ apply failed: ${e.message}`);
          }
        }
      }
    }
  }

  console.log(`\n\n${'='.repeat(60)}`);
  console.log(`Threads judged:          ${threadRows.length}`);
  console.log(`Threads with duplicates: ${threadsWithDups}`);
  console.log(`Duplicate cases ${APPLY ? 'rejected' : 'to reject'}: ${casesToReject}`);
  if (judgeErrors) console.log(`Judge errors (skipped):  ${judgeErrors}`);

  if (APPLY && backup.length) {
    mkdirSync(BACKUP_DIR, { recursive: true });
    const file = join(BACKUP_DIR, 'dedup-thread-backup.json');
    writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log(`\nBackup written: ${file}`);
    console.log(`Revert with: node --env-file=scripts/agent/.env.local --experimental-sqlite scripts/agent/dedup-existing-threads.mjs --revert "${file}"`);
  } else if (!APPLY) {
    console.log(`\nDry-run only — no changes made. Re-run with --apply to reject the duplicates above.`);
  }
  db.close();
}

if (REVERT_FILE) await revert(REVERT_FILE);
else await run();
