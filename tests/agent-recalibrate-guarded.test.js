import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentState } from '../scripts/agent/state.mjs';
import { revertCoachChanges } from '../scripts/agent/apply-proposal.mjs';
import { addDays, DEFAULT_CONFIG } from '../scripts/agent/coach-adapt.mjs';
import {
  shouldConsiderForum, decideKeep, isAlreadyYielding, makeBufferingState, hasNonEmptySections,
} from '../scripts/agent/recalibrate-guarded.mjs';

const TODAY = '2026-06-24';

// ── Pure: shouldConsiderForum (the stuck-signal gate + the guarded-recal guards) ──
function stuckNights() {
  // 3 fresh nights with real processed volume but ZERO extracted, no transient/too-few noise.
  return [addDays(TODAY, -2), addDays(TODAY, -1), TODAY].map((date) => ({
    date, good: 0, rejected: 5, processed: 15, extracted: 0, transient: 0, tooFew: 0,
  }));
}
const calibratedForum = { id: 'f1', url: 'https://x.example/forum', status: 'active', calibration_status: 'calibrated' };

assert.equal(
  shouldConsiderForum({ forum: calibratedForum, nights: stuckNights(), todayStr: TODAY, config: DEFAULT_CONFIG }),
  true, 'stuck calibrated forum is eligible',
);
assert.equal(
  shouldConsiderForum({ forum: calibratedForum, nights: stuckNights(), alreadyChangedToday: true, todayStr: TODAY, config: DEFAULT_CONFIG }),
  false, 'forum that already used its 1/day slot is skipped',
);
assert.equal(
  shouldConsiderForum({ forum: calibratedForum, nights: stuckNights(), hasProfile: true, todayStr: TODAY, config: DEFAULT_CONFIG }),
  false, 'authoritative-profile forum is never auto-recalibrated',
);
assert.equal(
  shouldConsiderForum({ forum: calibratedForum, nights: stuckNights(), recentRecalCount: 1, todayStr: TODAY, config: DEFAULT_CONFIG }),
  false, 'anti-flap: a recent recal attempt blocks another',
);
// A forum that is actually extracting is NOT stuck → not eligible.
const yieldingNights = stuckNights().map((n) => ({ ...n, extracted: 4, good: 3 }));
assert.equal(
  shouldConsiderForum({ forum: calibratedForum, nights: yieldingNights, todayStr: TODAY, config: DEFAULT_CONFIG }),
  false, 'a productive forum is not a recal candidate',
);

// ── Pure: decideKeep / isAlreadyYielding ──
assert.equal(decideKeep({ extractor_yield_rate: 0 }, { success: false, metrics: { extractor_yield_rate: 0.8 } }, DEFAULT_CONFIG), false, 'never keep a candidate that did not pass thresholds');
assert.equal(decideKeep({ extractor_yield_rate: 0 }, { success: true, metrics: { extractor_yield_rate: 0.4 } }, { RECAL_MIN_YIELD_GAIN: 0.2 }), true, 'keep a clear improvement over baseline');
assert.equal(decideKeep({ extractor_yield_rate: 0.3 }, { success: true, metrics: { extractor_yield_rate: 0.4 } }, { RECAL_MIN_YIELD_GAIN: 0.2 }), false, 'reject within-noise gains (margin not met)');
assert.equal(decideKeep({ extractor_yield_rate: 0.5 }, { success: true, metrics: { extractor_yield_rate: 0.4 } }, { RECAL_MIN_YIELD_GAIN: 0.2 }), false, 'never keep a candidate worse than baseline');
assert.equal(isAlreadyYielding({ extractor_yield_rate: 0.05 }), true);
assert.equal(isAlreadyYielding({ extractor_yield_rate: 0.0 }), false);

// ── Pure: hasNonEmptySections (the root-fallback regression guard) ──
assert.equal(hasNonEmptySections('["s1","s2"]'), true, 'real discovered sections → keepable');
assert.equal(hasNonEmptySections('[]'), false, 'empty list (root-URL fallback) → never overwrite real sections');
assert.equal(hasNonEmptySections(''), false);
assert.equal(hasNonEmptySections(null), false);
assert.equal(hasNonEmptySections('not json'), false);

// ── Temp DB: buffering shim isolates the real forum row + recalibrate revert round-trip ──
const dir = mkdtempSync(join(tmpdir(), 'agent-recal-guarded-'));
try {
  const state = new AgentState(join(dir, 'agent.db'));
  const f = state.addForum({ url: 'https://r.example/forum', name: 'R' });
  state.updateForum(f, { sections_json: '["s1"]', calibration_json: '{"parser":"phpbb"}', parser: 'phpbb', calibration_status: 'calibrated', status: 'active' });
  const orig = state.getForum(f);

  // The shim buffers writes and never touches the live row (proves a crash/quota mid-recal is safe).
  const shim = makeBufferingState(state, f);
  shim.updateForum(f, { sections_json: '[]', parser: 'xenforo' });
  assert.equal(state.getForum(f).sections_json, '["s1"]', 'real row untouched by shim write');
  assert.equal(state.getForum(f).parser, 'phpbb', 'real parser untouched');
  assert.equal(shim.getForum(f).sections_json, '[]', 'shim getForum reflects the overlay');
  assert.equal(shim.getForum(f).parser, 'xenforo');
  assert.equal(shim.getForum(f).name, 'R', 'shim merges real columns it did not override');
  assert.equal(shim.__overlay.parser, 'xenforo', 'overlay captured the candidate write');
  // Delegation: a non-overridden method still works through the proxy (private DB handle intact).
  assert.equal(typeof shim.getMeta, 'function');

  // A KEPT candidate is committed as one revertible multi-column forum change.
  const snap = { sections_json: orig.sections_json, calibration_json: orig.calibration_json, parser: orig.parser, calibration_status: orig.calibration_status, status: orig.status };
  const nw = { sections_json: '["s2","s3"]', calibration_json: '{"parser":"xenforo"}', parser: 'xenforo', calibration_status: 'calibrated', status: 'queued' };
  const r = state.applyCoachChange({ date: TODAY, forumId: f, forumName: 'R', knob: 'recalibrate', reasonCode: 'recal_improved', oldFields: snap, newFields: nw });
  assert.equal(r.ok, true);
  assert.equal(state.getForum(f).parser, 'xenforo', 'candidate applied');
  assert.equal(state.getForum(f).sections_json, '["s2","s3"]');

  const rev = await revertCoachChanges(state, { forumId: f, knob: 'recalibrate' });
  assert.equal(rev.reverted.length, 1);
  const back = state.getForum(f);
  assert.equal(back.parser, 'phpbb', 'parser restored on revert');
  assert.equal(back.sections_json, orig.sections_json, 'sections restored on revert');
  assert.equal(back.status, orig.status, 'status restored on revert');

  state.close();
  console.log('agent-recalibrate-guarded.test.js passed');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
