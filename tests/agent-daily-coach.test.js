import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentState } from '../scripts/agent/state.mjs';

// Pure-logic + state coverage of the daily coach. The module guards main() to run
// only when invoked directly, so importing it here is side-effect free.
const {
  bucketDiscardReason, aggregateNight, buildReport,
  nightCutoffUtc, gateDecision, detectDegenerate,
} = await import('../scripts/agent/daily-coach.mjs');

// ── bucketDiscardReason ─────────────────────────────────────────────────────
assert.equal(bucketDiscardReason('Too few posts'), 'too_few_posts');
assert.equal(bucketDiscardReason('Classifier rejected: unresolved thread'), 'classifier_reject');
assert.equal(bucketDiscardReason('Extractor returned no cases'), 'extractor_empty');
assert.equal(bucketDiscardReason('transient: HTTP 429'), 'transient');
assert.equal(bucketDiscardReason('something else'), 'other');
assert.equal(bucketDiscardReason(null), 'other');

// ── aggregateNight (cohort-based: threads + cases created in window) ─────────
const agg = aggregateNight({
  threads: [
    { id: 't1', forum_id: 'f1', status: 'discarded', discard_reason: 'Too few posts' },
    { id: 't2', forum_id: 'f1', status: 'discarded', discard_reason: 'Classifier rejected: x' },
    { id: 't3', forum_id: 'f2', status: 'extracted' },
    { id: 't4', forum_id: 'f2', status: 'pending' }, // in-flight → excluded from processed
  ],
  cases: [
    { id: 'c1', thread_id: 't3', forum_id: 'f2', status: 'verified', review_note: 'Verifier: PASS' },
    { id: 'c2', thread_id: 't3', forum_id: 'f2', status: 'verify_rejected', review_note: 'Verifier: failed:is_genuine_fault — x' },
    { id: 'c3', thread_id: 'tX', forum_id: 'f3', status: 'imported', review_note: null }, // thread outside window, but forum_id joined
  ],
  forums: [{ id: 'f1', name: 'Forum One' }, { id: 'f2', name: 'Forum Two' }, { id: 'f3', name: 'Forum Three' }],
});

assert.equal(agg.metrics.threads_processed, 3, 'pending thread excluded');
assert.equal(agg.metrics.threads_discarded, 2);
assert.equal(agg.metrics['discarded:too_few_posts'], 1);
assert.equal(agg.metrics['discarded:classifier_reject'], 1);
assert.equal(agg.metrics.cases_extracted, 3);
assert.equal(agg.metrics.cases_verified, 2, 'verified + imported both passed verify');
assert.equal(agg.metrics.cases_imported, 1);
assert.equal(agg.metrics.verify_rejected, 1);
assert.equal(agg.metrics['verify_reject:is_genuine_fault'], 1);
assert.equal(agg.metrics.verify_pass_rate, +(2 / 3).toFixed(3), 'one cohort: passed/(passed+rejected)');
assert.equal(agg.metrics.import_rate, +(1 / 3).toFixed(3));
// c3 counts in per-forum via joined forum_id even though its thread is outside the window
assert.deepEqual(agg.byForum, [
  { forum: 'Forum Two', forumId: 'f2', good: 1, rejected: 1 },
  { forum: 'Forum Three', forumId: 'f3', good: 1, rejected: 0 },
]);

const empty = aggregateNight({});
assert.equal(empty.metrics.threads_processed, 0);
assert.equal(empty.metrics.yield_rate, 0, 'no divide-by-zero');
assert.deepEqual(empty.byForum, []);

// ── buildReport ─────────────────────────────────────────────────────────────
const report = buildReport(agg, { date: '2026-06-18', windowLabel: '2026-06-17 21:00 → 2026-06-18 06:20 UTC (noční běh)' });
assert.match(report, /Noční report crawleru — 2026-06-18/);
assert.match(report, /Zpracovaná vlákna: \*\*3\*\*/);
assert.match(report, /Forum Two: 1 ✓ \/ 1 ✕/);
const deg = buildReport({ metrics: {}, byForum: [], rejectConditions: {}, discardBuckets: {} }, { date: '2026-06-18', degenerate: 'Noční běh skončil předčasně (quota).' });
assert.match(deg, /skončil předčasně/);
assert.doesNotMatch(deg, /Co se vytěžilo/);

// ── nightCutoffUtc (anchored to most-recent night start, not rolling) ───────
{
  const morning = new Date(2026, 5, 18, 6, 20);   // 06:20 local → night started yesterday 21:00
  const expectedMorning = new Date(2026, 5, 17, 21, 0, 0, 0).toISOString().slice(0, 19).replace('T', ' ');
  assert.equal(nightCutoffUtc(morning, 21), expectedMorning);
  const evening = new Date(2026, 5, 18, 22, 0);   // 22:00 local → tonight's start (today 21:00)
  const expectedEvening = new Date(2026, 5, 18, 21, 0, 0, 0).toISOString().slice(0, 19).replace('T', ' ');
  assert.equal(nightCutoffUtc(evening, 21), expectedEvening);
}

// ── gateDecision (closed morning window + once-per-day) ─────────────────────
assert.equal(gateDecision(new Date(2026, 5, 18, 6, 20), { lastDate: '2026-06-17', today: '2026-06-18' }).run, true);
assert.equal(gateDecision(new Date(2026, 5, 18, 21, 0), { lastDate: null, today: '2026-06-18' }).run, false, 'evening excluded');
assert.equal(gateDecision(new Date(2026, 5, 18, 3, 0), { lastDate: null, today: '2026-06-18' }).run, false, 'night excluded');
assert.equal(gateDecision(new Date(2026, 5, 18, 10, 0), { lastDate: '2026-06-18', today: '2026-06-18' }).run, false, 'already ran today');

// ── detectDegenerate (quota stop anywhere in window, or empty window) ───────
assert.match(detectDegenerate({ runs: [{ stop_reason: null }, { stop_reason: 'quota limit reached' }], threads: [{}], cases: [] }), /předčasně/);
assert.equal(detectDegenerate({ runs: [], threads: [], cases: [] }) === null, false, 'empty window is degenerate');
assert.equal(detectDegenerate({ runs: [{ stop_reason: null }], threads: [{ id: 't' }], cases: [] }), null, 'clean night');

// ── state: metrics upsert + windowed readers ────────────────────────────────
const dir = mkdtempSync(join(tmpdir(), 'agent-coach-state-'));
try {
  const state = new AgentState(join(dir, 'agent.db'));

  // recordMetric upsert + getMetricSeries ordering (oldest→newest)
  state.recordMetric('2026-06-16', 'cases_verified', 10);
  state.recordMetric('2026-06-17', 'cases_verified', 20);
  state.recordMetric('2026-06-17', 'cases_verified', 25); // upsert same key
  const series = state.getMetricSeries('cases_verified');
  assert.deepEqual(series.map(r => r.date), ['2026-06-16', '2026-06-17']);
  assert.equal(series[1].value, 25, 'ON CONFLICT upsert overwrote');
  assert.equal(state.getMetricsForDate('2026-06-17').cases_verified, 25);

  // windowed readers + forum_id join on cases
  const fid = state.addForum({ url: 'https://prio.example/forum', name: 'Prio' });
  const tid = state.addThread({ forumId: fid, url: 'https://prio.example/viewtopic.php?t=1' });
  state.addCase({ id: 'case-xyz', threadId: tid, payload: { brand_raw: 'Audi' } });
  state.updateCase('case-xyz', { status: 'verified' });

  const past = '2000-01-01 00:00:00';
  const future = '2999-01-01 00:00:00';
  assert.equal(state.getThreadsCreatedSince(past).length >= 1, true);
  assert.equal(state.getThreadsCreatedSince(future).length, 0, 'future cutoff → none');
  const cs = state.getCasesCreatedSince(past);
  assert.equal(cs.length, 1);
  assert.equal(cs[0].forum_id, fid, 'case carries joined forum_id');
  assert.equal(cs[0].status, 'verified');

  state.close();
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log('agent-daily-coach.test.js passed');
