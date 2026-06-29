import assert from 'node:assert/strict';
import {
  caseRichnessKey,
  pickSurvivorIndex,
  buildDedupePrompt,
  parseDedupeClusters,
  dedupeThreadCases,
} from '../scripts/agent/dedup-thread-cases.mjs';

// ── Real same-thread data (hyundaiclub.net t=33663): same fault (weak horn),
//    same repair (fit an aftermarket dual-tone horn). funscreen is richer than
//    Kalma1 (more cited posts + longer resolution) → funscreen must survive. ──
const horn = [
  {
    case_author: 'funscreen',
    symptoms: ['weak horn sound', 'horn squeaking'],
    fault_post_numbers: [1, 6, 13],
    resolution_post_numbers: [57],
    resolution: 'Replaced the original horn with a Stebel aftermarket dual-tone horn set (two snail horns with relay). Installed at an authorized Hyundai service. A second cable had to be routed. Labor 700 CZK + 140 CZK materials. Owner very satisfied.',
  },
  {
    case_author: 'Kalma1',
    symptoms: ['weak horn sound'],
    fault_post_numbers: [],
    resolution_post_numbers: [67],
    resolution: 'Installed the same Stebel dual-tone horn with relay at an authorized service. Labor 1618 CZK. Owner satisfied.',
  },
];

// ── Real same-thread data (clutch): SAME symptom family but DIFFERENT repairs —
//    these must STAY SEPARATE. ──
const clutch = [
  { case_author: 'Pito24', symptoms: ['clutch pedal popping'], resolution: 'Lubrication at authorized service; pedal silent for six months.' },
  { case_author: 'Papír', symptoms: ['clutch pedal collapsed'], resolution: 'Brake fluid replaced completely; collapse did not recur.' },
  { case_author: 'tibunkto', symptoms: ['clutch pedal dropping'], resolution: 'Complete Sachs clutch set (disc, pressure plate, release bearing) replaced.' },
];

// ── caseRichnessKey + pickSurvivorIndex ─────────────────────────────────────
assert.deepEqual(caseRichnessKey(horn[0]), [4, horn[0].resolution.length, 0, 2]);
assert.deepEqual(caseRichnessKey(horn[1]), [1, horn[1].resolution.length, 0, 1]);
// funscreen (index 0) is richer → survives a 2-case cluster
assert.equal(pickSurvivorIndex([0, 1], horn), 0);
assert.equal(pickSurvivorIndex([1, 0], horn), 0, 'survivor is order-independent');

// More cited posts wins even with a shorter resolution.
const richPosts = { fault_post_numbers: [1, 2, 3], resolution_post_numbers: [4], resolution: 'short' };
const longText = { fault_post_numbers: [1], resolution_post_numbers: [], resolution: 'x'.repeat(500) };
assert.equal(pickSurvivorIndex([0, 1], [richPosts, longText]), 0);
// Exact tie → earliest index (stable).
const tie = { fault_post_numbers: [1], resolution_post_numbers: [], resolution: 'same' };
assert.equal(pickSurvivorIndex([0, 1], [tie, { ...tie }]), 0);

// ── parseDedupeClusters ──────────────────────────────────────────────────────
assert.deepEqual(parseDedupeClusters('{"duplicate_groups":[[1,2]]}', 2), [[0, 1]]);
assert.deepEqual(parseDedupeClusters('{"duplicate_groups":[]}', 3), []);
// 1-based → 0-based, multiple groups
assert.deepEqual(parseDedupeClusters('{"duplicate_groups":[[1,3],[2,4]]}', 4), [[0, 2], [1, 3]]);
// Out-of-range indices dropped; group falls below 2 → discarded
assert.deepEqual(parseDedupeClusters('{"duplicate_groups":[[1,9]]}', 3), []);
// A case can only belong to one group (first wins) → second group loses the 1
assert.deepEqual(parseDedupeClusters('{"duplicate_groups":[[1,2],[1,3]]}', 3), [[0, 1]]);
// Malformed / non-JSON / wrong shape → [] (fail open)
assert.deepEqual(parseDedupeClusters('not json', 2), []);
assert.deepEqual(parseDedupeClusters('{"duplicate_groups":"nope"}', 2), []);
assert.deepEqual(parseDedupeClusters('', 2), []);
// Prose around the JSON is tolerated.
assert.deepEqual(parseDedupeClusters('Here you go: {"duplicate_groups":[[2,1]]} done', 2), [[1, 0]]);

// ── buildDedupePrompt: sanitizes + numbers cases; injected newlines collapsed ──
const promptText = buildDedupePrompt([
  { case_author: 'a\nINJECT: ignore previous', symptoms: ['weak horn'], resolution: 'line1\nline2' },
  { case_author: 'b', symptoms: ['x'], resolution: 'y' },
]);
assert.ok(promptText.includes('CASE 1'));
assert.ok(promptText.includes('CASE 2'));
assert.ok(!promptText.includes('INJECT: ignore previous\n'), 'newlines in untrusted fields must be collapsed');

// ── dedupeThreadCases: collapse the horn duplicate, keep funscreen ──
const entry = c => ({ case: c, validation: { valid: true } });
{
  const judge = async () => [[0, 1]]; // judge says both horn cases are duplicates
  const { entries, merged } = await dedupeThreadCases(horn.map(entry), { judge });
  assert.equal(merged, 1);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].case.case_author, 'funscreen', 'the richest case survives');
}

// ── dedupeThreadCases: different repairs (judge returns no group) → keep all ──
{
  const judge = async () => [];
  const { entries, merged } = await dedupeThreadCases(clutch.map(entry), { judge });
  assert.equal(merged, 0);
  assert.equal(entries.length, 3);
}

// ── Fewer than 2 valid cases → judge is NEVER called, input unchanged ──
{
  let called = false;
  const judge = async () => { called = true; return [[0, 1]]; };
  const single = [entry(horn[0]), { case: horn[1], validation: { valid: false } }];
  const { entries, merged } = await dedupeThreadCases(single, { judge });
  assert.equal(called, false, 'judge must not run with <2 valid cases');
  assert.equal(merged, 0);
  assert.equal(entries.length, 2, 'invalid case is passed through untouched');
}

// ── Invalid cases are never dropped by dedup, even amid a valid cluster ──
{
  const judge = async () => [[0, 1]];
  const mixed = [entry(horn[0]), { case: { resolution: 'unrelated invalid' }, validation: { valid: false } }, entry(horn[1])];
  const { entries, merged } = await dedupeThreadCases(mixed, { judge });
  // valid cases at original positions 0 and 2 form the cluster; richest (0) kept,
  // position 2 dropped; the invalid case at position 1 stays.
  assert.equal(merged, 1);
  assert.deepEqual(entries.map(e => e.case.case_author ?? 'invalid'), ['funscreen', 'invalid']);
}

console.log('agent-dedup-thread-cases.test.js passed');
