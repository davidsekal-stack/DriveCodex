/**
 * recover-discarded.mjs — one-time recovery of threads discarded BEFORE the
 * thread-age defer gate shipped.
 *
 * Why: until the age gate, a thread the crawler opened too early (genuine fault,
 * no confirmed fix yet) was marked `discarded` and never looked at again — so a
 * resolution that landed later was lost forever. This tool re-queues the
 * recoverable ones (status discarded → pending) so the normal nightly crawl
 * re-fetches and re-judges them under the new age-aware pipeline:
 *   • a fix has since landed (and it has matured)  → extracted (recovered!)
 *   • still no fix but matured (>1yr quiet)         → discarded again (terminal)
 *   • still too young                               → deferred (waits to mature)
 *
 * It does NOT fetch or call any LLM itself — it only flips statuses. The actual
 * re-crawl rides the existing nightly batch (bounded, deduped, guard-railed).
 * Reversible: every apply writes a backup file; `--revert <file>` restores ids
 * that are still pending (it never clobbers one already re-processed).
 *
 * Usage:
 *   node --experimental-sqlite recover-discarded.mjs                 # dry-run report
 *   node --experimental-sqlite recover-discarded.mjs --apply         # flip selected
 *   node --experimental-sqlite recover-discarded.mjs --apply --limit 500 --forum skoda
 *   node --experimental-sqlite recover-discarded.mjs --include-too-few   # also retry <2-post threads
 *   node --experimental-sqlite recover-discarded.mjs --revert logs/recover-discarded-backup-<ts>.json
 */

import { fileURLToPath } from 'node:url';
import { realpathSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { AgentState } from './state.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Only UNAMBIGUOUSLY structural discards (never a fault discussion) are treated
// as terminal and skipped. We keep this narrow on purpose: bare words like "buy"
// or "manual" appear inside genuine fault narration ("…would buy a new coil and
// report back"), so over-broad terminal matching wrongly drops the very threads
// we want back. Anything else with a real discard reason is re-judged — the
// re-crawl + age gate + re-classify is the actual filter (a still-bad thread is
// just re-discarded, cheaply, no LLM until it re-passes the classifier).
const TERMINAL_RE = /forum rules|rules page|\badvertisement\b|\bspam\b|for sale\b|classified ad|sticky (?:thread|post)|pinned (?:thread|post)|table of contents|index thread|request for a (?:service|repair|owner.?s?) manual|service manual, not|manual request|tool recommendation/i;

/**
 * Bucket a discard_reason: 'too_few' | 'terminal' | 'recoverable' | 'other'.
 * Pure — unit-tested. Only 'recoverable' (and, opt-in, 'too_few') is re-queued.
 * Default-recover: any real (non-empty, non-too-few, non-structural) reason is
 * worth a second look now that we judge by thread age. Empty/null reason → 'other'
 * (no signal → don't spend a re-fetch).
 */
export function classifyDiscardReason(reason) {
  const r = (reason ?? '').toString().trim();
  if (!r) return 'other';
  if (/too few posts/i.test(r)) return 'too_few';
  if (TERMINAL_RE.test(r)) return 'terminal';
  return 'recoverable';
}

/**
 * Choose which discarded rows to re-queue. Pure — unit-tested.
 * @returns {{ selected: object[], buckets: Record<string, number> }}
 */
export function selectRecoverable(rows, { includeTooFew = false, forumId = null, limit = Infinity } = {}) {
  const buckets = { too_few: 0, terminal: 0, recoverable: 0, other: 0 };
  const selected = [];
  for (const row of rows) {
    // Forum filter first, so the bucket counts describe exactly the population
    // being acted on (no "recoverable: 1183 / selected: 40" confusion under --forum).
    if (forumId && row.forum_id !== forumId) continue;
    const bucket = classifyDiscardReason(row.discard_reason);
    buckets[bucket]++;
    const wanted = bucket === 'recoverable' || (includeTooFew && bucket === 'too_few');
    if (wanted && selected.length < limit) selected.push(row);
  }
  return { selected, buckets };
}

function parseArgs(argv) {
  // No cap by default (recover everything the dry-run reports); --limit throttles.
  const a = { apply: false, includeTooFew: false, limit: Infinity, forum: null, revert: null };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--apply') a.apply = true;
    else if (t === '--include-too-few') a.includeTooFew = true;
    else if (t === '--limit') a.limit = Math.max(1, Number(argv[++i]) || Infinity);
    else if (t === '--forum') a.forum = argv[++i] || null;
    else if (t === '--revert') a.revert = argv[++i] || null;
  }
  return a;
}

function resolveForumId(state, substr) {
  if (!substr) return null;
  const all = state.getAllForums();
  const match = all.find(f => (f.url || '').includes(substr) || (f.name || '').toLowerCase().includes(substr.toLowerCase()));
  if (!match) {
    console.error(`No forum matches "${substr}".`);
    process.exit(1);
  }
  console.log(`Forum filter: ${match.name || match.url} [${match.id}]`);
  return match.id;
}

function doRevert(state, file) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  // Newer backups carry rows [{id, discard_reason}]; older ones only ids.
  const rows = Array.isArray(data.rows) ? data.rows
    : (Array.isArray(data.ids) ? data.ids.map(id => ({ id, discard_reason: null })) : []);
  let restored = 0, skipped = 0;
  for (const { id, discard_reason } of rows) {
    const t = state.getThread(id);
    // CAS: only undo rows STILL pending (untouched since the flip). One that was
    // re-processed to extracted/deferred/discarded must not be clobbered.
    if (t && t.status === 'pending') {
      state.updateThread(id, { status: 'discarded', discard_reason: discard_reason ?? null });
      restored++;
    } else skipped++;
  }
  console.log(`Revert: restored ${restored} thread(s) to discarded; ${skipped} skipped (already re-processed or missing).`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = new AgentState();

  if (args.revert) { doRevert(state, args.revert); return; }

  const forumId = resolveForumId(state, args.forum);
  const rows = state.getThreadsByStatus('discarded');
  const { selected, buckets } = selectRecoverable(rows, {
    includeTooFew: args.includeTooFew,
    forumId,
    limit: args.limit,
  });

  const scope = forumId ? ' (this forum)' : '';
  const inScope = buckets.recoverable + buckets.too_few + buckets.terminal + buckets.other;
  console.log(`\nDiscarded threads${scope}: ${inScope}`);
  console.log(`  recoverable (real discard → re-judge): ${buckets.recoverable}`);
  console.log(`  too_few (<2 posts)                   : ${buckets.too_few}${args.includeTooFew ? ' [included]' : ' [excluded — use --include-too-few]'}`);
  console.log(`  terminal (rules/ads/manual request)  : ${buckets.terminal} [excluded]`);
  console.log(`  other (no reason recorded)           : ${buckets.other} [excluded]`);
  console.log(`\nSelected to re-queue: ${selected.length}${Number.isFinite(args.limit) && selected.length === args.limit ? ` (capped at --limit ${args.limit})` : ''}`);

  if (!args.apply) {
    console.log('\nDRY-RUN — nothing changed. Re-run with --apply to flip the selected threads to pending.');
    return;
  }

  // Write the backup BEFORE flipping, so a crash mid-flip still leaves a complete
  // undo record. We keep the original discard_reason too — revert restores it
  // (lossless). `ids` is kept for backward-compat with older backups.
  const rowsBackup = selected.map(r => ({ id: r.id, discard_reason: r.discard_reason ?? null }));
  const logsDir = join(__dirname, 'logs');
  try { mkdirSync(logsDir, { recursive: true }); } catch { /* exists */ }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = join(logsDir, `recover-discarded-backup-${stamp}.json`);
  writeFileSync(backup, JSON.stringify({
    ts: stamp, count: rowsBackup.length, forum: args.forum || null,
    ids: rowsBackup.map(r => r.id), rows: rowsBackup,
  }, null, 2));

  // Flip status → pending. We deliberately DO NOT null discard_reason: it is the
  // original verdict (revert needs it; daily-coach only buckets status='discarded'
  // rows; the orchestrator overwrites/clears it on the next verdict anyway).
  for (const { id } of rowsBackup) state.updateThread(id, { status: 'pending' });

  console.log(`\nRe-queued ${rowsBackup.length} thread(s) to pending. The nightly crawl will re-fetch + re-judge them.`);
  console.log(`Backup written: ${backup}`);
  console.log(`Undo with: node --experimental-sqlite recover-discarded.mjs --revert ${backup}`);
}

const invokedDirectly = (() => {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
if (invokedDirectly) main();
