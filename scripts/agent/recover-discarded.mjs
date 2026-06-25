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

// Clearly-terminal discards: re-fetching these will never produce a case, so we
// skip them by default to avoid wasting bandwidth on ads / off-topic / manuals.
const TERMINAL_RE = /forum rules|rules page|service manual|owner'?s? manual|tool recommendation|advertisement|\badvert\b|\bspam\b|not a (?:vehicle )?fault|not a discussion|not a description of a vehicle fault|off.?topic|out of scope|parking (?:procedure|question)|general question|how-?to|tutorial|buy|where to (?:buy|find)|for sale|wanted/i;

// "Fault present, fix not (yet) there" — the class the owner wants recovered.
const RECOVERABLE_RE = /no confirmed resolution|without confirmed resolution|unresolved|no resolution|returned no cases|troubleshooting|missing.*resolution|describes? a genuine|explicit(?:ly)? describes? .*fault/i;

/**
 * Bucket a discard_reason: 'too_few' | 'terminal' | 'recoverable' | 'other'.
 * Pure — unit-tested. Only 'recoverable' (and, opt-in, 'too_few') is re-queued.
 */
export function classifyDiscardReason(reason) {
  const r = (reason ?? '').toString();
  if (/too few posts/i.test(r)) return 'too_few';
  if (TERMINAL_RE.test(r)) return 'terminal';
  if (RECOVERABLE_RE.test(r)) return 'recoverable';
  return 'other';
}

/**
 * Choose which discarded rows to re-queue. Pure — unit-tested.
 * @returns {{ selected: object[], buckets: Record<string, number> }}
 */
export function selectRecoverable(rows, { includeTooFew = false, forumId = null, limit = Infinity } = {}) {
  const buckets = { too_few: 0, terminal: 0, recoverable: 0, other: 0 };
  const selected = [];
  for (const row of rows) {
    const bucket = classifyDiscardReason(row.discard_reason);
    buckets[bucket]++;
    if (forumId && row.forum_id !== forumId) continue;
    const wanted = bucket === 'recoverable' || (includeTooFew && bucket === 'too_few');
    if (wanted && selected.length < limit) selected.push(row);
  }
  return { selected, buckets };
}

function parseArgs(argv) {
  const a = { apply: false, includeTooFew: false, limit: 1000, forum: null, revert: null };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--apply') a.apply = true;
    else if (t === '--include-too-few') a.includeTooFew = true;
    else if (t === '--limit') a.limit = Math.max(1, Number(argv[++i]) || 1000);
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
  const ids = Array.isArray(data.ids) ? data.ids : [];
  let restored = 0, skipped = 0;
  for (const id of ids) {
    const t = state.getThread(id);
    // CAS: only undo rows STILL pending (untouched since the flip). One that was
    // re-processed to extracted/deferred/discarded must not be clobbered.
    if (t && t.status === 'pending') { state.updateThread(id, { status: 'discarded' }); restored++; }
    else skipped++;
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

  console.log(`\nDiscarded threads: ${rows.length}`);
  console.log(`  recoverable (fault, no fix yet) : ${buckets.recoverable}`);
  console.log(`  too_few (<2 posts)              : ${buckets.too_few}${args.includeTooFew ? ' [included]' : ' [excluded — use --include-too-few]'}`);
  console.log(`  terminal (ads/manuals/off-topic): ${buckets.terminal} [excluded]`);
  console.log(`  other                           : ${buckets.other} [excluded]`);
  console.log(`\nSelected to re-queue: ${selected.length}${selected.length === args.limit ? ` (capped at --limit ${args.limit})` : ''}`);

  if (!args.apply) {
    console.log('\nDRY-RUN — nothing changed. Re-run with --apply to flip the selected threads to pending.');
    return;
  }

  const ids = selected.map(r => r.id);
  for (const id of ids) state.updateThread(id, { status: 'pending', discard_reason: null });

  const logsDir = join(__dirname, 'logs');
  try { mkdirSync(logsDir, { recursive: true }); } catch { /* exists */ }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = join(logsDir, `recover-discarded-backup-${stamp}.json`);
  writeFileSync(backup, JSON.stringify({ ts: stamp, count: ids.length, forum: args.forum || null, ids }, null, 2));

  console.log(`\nRe-queued ${ids.length} thread(s) to pending. The nightly crawl will re-fetch + re-judge them.`);
  console.log(`Backup written: ${backup}`);
  console.log(`Undo with: node --experimental-sqlite recover-discarded.mjs --revert ${backup}`);
}

const invokedDirectly = (() => {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
if (invokedDirectly) main();
