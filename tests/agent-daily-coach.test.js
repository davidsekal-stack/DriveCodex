import assert from 'node:assert/strict';

// Pure-logic coverage of the daily coach. The module guards main() to run only
// when invoked directly, so importing it here is side-effect free.
const { bucketDiscardReason, aggregateNight, buildReport } = await import('../scripts/agent/daily-coach.mjs');

// ── bucketDiscardReason ─────────────────────────────────────────────────────
assert.equal(bucketDiscardReason('Too few posts'), 'too_few_posts');
assert.equal(bucketDiscardReason('Classifier rejected: unresolved thread'), 'classifier_reject');
assert.equal(bucketDiscardReason('Extractor returned no cases'), 'extractor_empty');
assert.equal(bucketDiscardReason('transient: HTTP 429'), 'transient');
assert.equal(bucketDiscardReason('something else'), 'other');
assert.equal(bucketDiscardReason(null), 'other');

// ── aggregateNight ──────────────────────────────────────────────────────────
const agg = aggregateNight({
  runs: [
    { threads_processed: 10, cases_extracted: 3, cases_verified: 2, cases_imported: 2 },
    { threads_processed: 5, cases_extracted: 1, cases_verified: 1, cases_imported: 1 },
  ],
  threads: [
    { id: 't1', forum_id: 'f1', status: 'discarded', discard_reason: 'Too few posts' },
    { id: 't2', forum_id: 'f1', status: 'discarded', discard_reason: 'Classifier rejected: x' },
    { id: 't3', forum_id: 'f2', status: 'extracted' },
  ],
  cases: [
    { id: 'c1', thread_id: 't3', status: 'verified', review_note: 'Verifier: PASS' },
    { id: 'c2', thread_id: 't3', status: 'verify_rejected', review_note: 'Verifier: failed:is_genuine_fault — x' },
    { id: 'c3', thread_id: 'tX', status: 'imported', review_note: null },
  ],
  forums: [{ id: 'f1', name: 'Forum One' }, { id: 'f2', name: 'Forum Two' }],
});

assert.equal(agg.metrics.threads_processed, 15, 'runs summed');
assert.equal(agg.metrics.cases_extracted, 4);
assert.equal(agg.metrics.cases_verified, 3);
assert.equal(agg.metrics.cases_imported, 3);
assert.equal(agg.metrics.threads_discarded, 2);
assert.equal(agg.metrics['discarded:too_few_posts'], 1);
assert.equal(agg.metrics['discarded:classifier_reject'], 1);
assert.equal(agg.metrics.verify_rejected, 1);
assert.equal(agg.metrics['verify_reject:is_genuine_fault'], 1);
assert.equal(agg.metrics.yield_rate, +(4 / 15).toFixed(3));
assert.equal(agg.metrics.verify_pass_rate, 0.75); // 3 / (3+1)
assert.equal(agg.metrics.import_rate, 0.75);      // 3 / 4
// per-forum: only f2 has cases (c1 good, c2 rejected); c3's thread tX not in window threads → skipped
assert.deepEqual(agg.byForum, [{ forum: 'Forum Two', forumId: 'f2', good: 1, rejected: 1 }]);

// empty night
const empty = aggregateNight({});
assert.equal(empty.metrics.threads_processed, 0);
assert.equal(empty.metrics.yield_rate, 0, 'no divide-by-zero');
assert.deepEqual(empty.byForum, []);

// ── buildReport ─────────────────────────────────────────────────────────────
const report = buildReport(agg, { date: '2026-06-18', windowHours: 12 });
assert.match(report, /Noční report crawleru — 2026-06-18/);
assert.match(report, /Zpracovaná vlákna: \*\*15\*\*/);
assert.match(report, /Vytěžené případy: \*\*4\*\*/);
assert.match(report, /zamítl klasifikátor: 1/);
assert.match(report, /málo příspěvků: 1/);
assert.match(report, /Forum Two: 1 ✓ \/ 1 ✕/);

// degenerate night → short warning, no funnel
const deg = buildReport({ metrics: {}, byForum: [], rejectConditions: {}, discardBuckets: {} }, { date: '2026-06-18', windowHours: 12, degenerate: 'Noční běh skončil předčasně (quota).' });
assert.match(deg, /skončil předčasně/);
assert.doesNotMatch(deg, /Co se vytěžilo/);

console.log('agent-daily-coach.test.js passed');
