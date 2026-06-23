import assert from 'node:assert/strict';

// Pure-logic coverage of the recall watchdog. The module guards its main() to
// run only when invoked directly, so importing it here is side-effect free.
const {
  failingCondition,
  summarizeConditions,
  parseAuditVerdict,
  shouldAlert,
  buildAuditPrompt,
} = await import('../scripts/agent/recall-watchdog.mjs');

// ── failingCondition ────────────────────────────────────────────────────────
assert.equal(failingCondition('Verifier: failed:is_genuine_fault — config menu'), 'is_genuine_fault');
assert.equal(failingCondition('Verifier: failed:vehicle_matches_cited_posts — A6 vs A4'), 'vehicle_matches_cited_posts');
assert.equal(failingCondition('Verifier: Pre-gate: out-of-scope vehicle category'), 'pre-gate');
assert.equal(failingCondition('Verifier: Verifier output was not valid JSON'), 'parse-fail');
assert.equal(failingCondition('Verifier: some old free-text reason'), 'other');
assert.equal(failingCondition(null), 'other');

// ── summarizeConditions ─────────────────────────────────────────────────────
const counts = summarizeConditions([
  { review_note: 'Verifier: failed:is_genuine_fault — x' },
  { review_note: 'Verifier: failed:is_genuine_fault — y' },
  { review_note: 'Verifier: failed:in_scope — moto' },
  { review_note: 'Verifier: Pre-gate: out-of-scope vehicle category' },
]);
assert.deepEqual(counts, { is_genuine_fault: 2, in_scope: 1, 'pre-gate': 1 });

// ── parseAuditVerdict ───────────────────────────────────────────────────────
assert.equal(parseAuditVerdict('{"wrongly_rejected":true,"confidence":"high","reason":"genuine alternator fault"}').wronglyRejected, true);
assert.equal(parseAuditVerdict('{"wrongly_rejected":false,"reason":"correctly rejected, it is a retrofit"}').wronglyRejected, false);
assert.equal(parseAuditVerdict('Sure: {"wrongly_rejected":true,"reason":"x"} done').wronglyRejected, true, 'tolerates surrounding prose');
const bad = parseAuditVerdict('not json');
assert.equal(bad.wronglyRejected, false, 'garbage fails closed to not-wrongly-rejected');
assert.equal(bad.parseFail, true);

// ── shouldAlert (rate AND minimum-count guard; parseFail/errored excluded) ──
const wr = (n) => Array.from({ length: n }, () => ({ wronglyRejected: true }));
const ok = (n) => Array.from({ length: n }, () => ({ wronglyRejected: false }));

let d = shouldAlert([...wr(3), ...ok(1)]); // 3/4 = 75% ≥30%, ≥3
assert.equal(d.alert, true);
assert.equal(d.wrong, 3); assert.equal(d.judged, 4);

d = shouldAlert([...wr(2), ...ok(8)]); // 2/10 = 20% < 30%
assert.equal(d.alert, false);

d = shouldAlert([...wr(2), ...ok(0)]); // 100% but only 2 < min 3 → no alarm (small-sample guard)
assert.equal(d.alert, false);

// parseFail / errored rows are excluded from the denominator
d = shouldAlert([...wr(3), { parseFail: true }, { errored: true }]);
assert.equal(d.judged, 3, 'unjudged rows excluded');
assert.equal(d.alert, true);

d = shouldAlert([]);
assert.equal(d.alert, false, 'no data → no alarm');

// custom thresholds honored
assert.equal(shouldAlert(wr(2), { min: 2, rate: 0.5 }).alert, true);

// ── buildAuditPrompt ────────────────────────────────────────────────────────
const prompt = buildAuditPrompt('POST 1 | author: bob:\nmy A3 alternator died', {
  brand_raw: 'Audi', model_raw: 'A3', symptoms: ['no charge'], description: 'alt dead', resolution: 'replaced alternator',
}, 'failed:is_genuine_fault — looked like coding');
assert.match(prompt, /VERIFIER'S STATED REJECT REASON: failed:is_genuine_fault/);
assert.match(prompt, /Audi A3/);
assert.match(prompt, /wrongly_rejected/);
assert.match(prompt, /passenger car, light van, or light pickup truck/, 'embeds the shared quality bar');

console.log('agent-recall-watchdog.test.js passed');
