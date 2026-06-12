import assert from 'node:assert/strict';
import { scoreResolutionSignal, pickCalibrationSample } from '../scripts/agent/resolution-signal.mjs';

// ── scoreResolutionSignal ──────────────────────────────────────────────────

// Czech resolution marker, diacritic-insensitive (both forms match).
assert.ok(scoreResolutionSignal('Vyřešeno: startér nenaskočil', 'cs') > 0, 'cs diacritics');
assert.ok(scoreResolutionSignal('VYRESENO startér', 'cs') > 0, 'cs folded form');
assert.ok(scoreResolutionSignal('[opraveno] alternátor', 'cs') > 0, 'cs bracket marker');

// German marker folds ö → o.
assert.ok(scoreResolutionSignal('Gelöst: Anlasser defekt', 'de') > 0, 'de gelöst');
assert.ok(scoreResolutionSignal('Problem behoben', 'de') > 0, 'de behoben');

// English markers always apply, regardless of forum language.
assert.ok(scoreResolutionSignal('SOLVED - bad ignition coil', 'cs') > 0, 'en marker on cs forum');
assert.ok(scoreResolutionSignal('Finally fixed my DPF', 'en') > 0, 'en fixed');

// No signal: plain questions / unanswered threads score 0.
assert.equal(scoreResolutionSignal('Jaký olej do motoru 1.6 TDI?', 'cs'), 0, 'cs question');
assert.equal(scoreResolutionSignal('Knocking noise at 80 km/h', 'en'), 0, 'en question');

// Whole-token matching: "fixed" inside "prefixed" must NOT match.
assert.equal(scoreResolutionSignal('Prefixed wiring diagram', 'en'), 0, 'no substring false positive');

// Robust to empty / missing titles.
assert.equal(scoreResolutionSignal('', 'cs'), 0, 'empty');
assert.equal(scoreResolutionSignal(undefined, 'cs'), 0, 'undefined');

// ── pickCalibrationSample ──────────────────────────────────────────────────

const links = [
  { url: 'u1', title: 'Knocking noise at 80 km/h' },      // 0
  { url: 'u2', title: 'Vyřešeno: startér' },              // signal (cs)
  { url: 'u3', title: 'Jaký olej?' },                     // 0
  { url: 'u4', title: 'SOLVED bad coil' },                // signal (en)
  { url: 'u5', title: 'New member intro' },               // 0
  { url: 'u6', title: 'Opraveno: alternátor vyřešeno' },  // signal x2 (cs) — highest
];

// Signal threads come first; highest score (u6, two markers) leads.
const picked = pickCalibrationSample(links, 3, 'cs');
assert.equal(picked.length, 3, 'returns exactly count');
assert.equal(picked[0].url, 'u6', 'highest-signal first');
assert.ok(picked.slice(0, 3).map(l => l.url).includes('u2'), 'includes a signal thread');
assert.ok(picked.slice(0, 3).map(l => l.url).includes('u4'), 'includes other signal thread');

// PRIOR not FILTER: when no thread has a signal, coverage is preserved (fills
// from the remainder in original order).
const noSignal = [
  { url: 'a', title: 'Question 1' },
  { url: 'b', title: 'Question 2' },
  { url: 'c', title: 'Question 3' },
];
const filled = pickCalibrationSample(noSignal, 2, 'cs');
assert.equal(filled.length, 2, 'fills to count even with no signal');
assert.deepEqual(filled.map(l => l.url), ['a', 'b'], 'preserves original order when no signal');

// Fewer links than count → returns all.
assert.equal(pickCalibrationSample(noSignal, 10, 'cs').length, 3, 'caps at available');

// Defensive: empty / zero count.
assert.deepEqual(pickCalibrationSample([], 5, 'cs'), [], 'empty links');
assert.deepEqual(pickCalibrationSample(links, 0, 'cs'), [], 'zero count');

console.log('agent-resolution-signal.test.js passed');
