import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG, smoothedYield, daysBetween, addDays, alignNights,
  planPriority, planCooldown, planRecalProposal, planForum, planNight,
} from '../scripts/agent/coach-adapt.mjs';

// Pure Phase 2 planner. No DB, no clock inside decisions — `now`/`todayStr` are passed,
// so every case is deterministic. Locks the adapt rules, guardrails, precedence,
// circuit-breaker and global cap against regression.

const TODAY = '2026-06-19';
const NOW = new Date('2026-06-19T05:00:00Z');
const D = ['2026-06-17', '2026-06-18', '2026-06-19']; // 3 dense nights, newest = today

const night = (date, o = {}) => ({
  date, good: 0, rejected: 0, processed: 0, extracted: 0, transient: 0, tooFew: 0, ...o,
});

// ── helpers ──────────────────────────────────────────────────────────────────
assert.equal(daysBetween('2026-06-01', '2026-06-19'), 18);
assert.equal(addDays('2026-06-19', -10), '2026-06-09');
assert.ok(Math.abs(smoothedYield(0, 0) - 0.1) < 1e-9, 'prior mean = 1/10');

// ── alignNights: anchored on forum_processed; nights lacking it are dropped ──
{
  const aligned = alignNights({
    forum_good: [{ date: '2026-06-17', value: 5 }, { date: '2026-06-18', value: 6 }, { date: '2026-06-19', value: 7 }],
    forum_processed: [{ date: '2026-06-18', value: 40 }, { date: '2026-06-19', value: 42 }], // 06-17 has no processed → dropped
    forum_extracted: [{ date: '2026-06-19', value: 7 }],
  });
  assert.deepEqual(aligned.map(n => n.date), ['2026-06-18', '2026-06-19'], 'pre-deploy night without processed excluded');
  assert.equal(aligned[1].good, 7);
  assert.equal(aligned[0].extracted, 0, 'missing metric defaults to 0');
}

// ── PRIORITY ─────────────────────────────────────────────────────────────────
const activeForum = (over = {}) => ({ id: 'f', name: 'F', status: 'active', priority_score: 0, ...over });

{ // RISING: clamped by DELTA_MAX
  const nights = [night(D[0], { good: 8, rejected: 2, processed: 40 }), night(D[1], { good: 9, rejected: 1, processed: 42 }), night(D[2], { good: 10, rejected: 1, processed: 45 })];
  const d = planPriority(activeForum({ priority_score: 0 }), nights, TODAY, DEFAULT_CONFIG);
  assert.ok(d, 'rising fires');
  assert.equal(d.knob, 'priority'); assert.equal(d.direction, 'up');
  assert.equal(d.newFields.priority_score, 15, 'step clamped to +DELTA_MAX from 0');
}

{ // DEADBAND skip: target barely above current
  const nights = [night(D[0], { good: 2, rejected: 1, processed: 40 }), night(D[1], { good: 2, processed: 42 }), night(D[2], { good: 2, processed: 45 })];
  // current ≈ target → within deadband → no action
  const d = planPriority(activeForum({ priority_score: 5 }), nights, TODAY, DEFAULT_CONFIG);
  assert.equal(d, null, 'move inside deadband → skip');
}

{ // FLAP GUARD: 3-night avg up but recent 2 nights below current → skip
  const nights = [night(D[0], { good: 40, processed: 40 }), night(D[1], { good: 2, processed: 40 }), night(D[2], { good: 2, processed: 40 })];
  const d = planPriority(activeForum({ priority_score: 25 }), nights, TODAY, DEFAULT_CONFIG);
  assert.equal(d, null, 'recent decline blocks acting on stale-high 3-night average');
}

{ // STALENESS: newest aligned night 22 days before today → skip
  const stale = ['2026-05-26', '2026-05-27', '2026-05-28'];
  const nights = [night(stale[0], { good: 8, rejected: 2, processed: 40 }), night(stale[1], { good: 9, rejected: 1, processed: 42 }), night(stale[2], { good: 10, rejected: 1, processed: 45 })];
  assert.equal(planPriority(activeForum(), nights, TODAY, DEFAULT_CONFIG), null, 'stale window → no archaeology');
}

{ // MIN-VOLUME
  const thin = [night(D[0], { good: 1, rejected: 1, processed: 6 }), night(D[1], { good: 1, rejected: 1, processed: 6 }), night(D[2], { good: 1, rejected: 1, processed: 6 })];
  assert.equal(planPriority(activeForum(), thin, TODAY, DEFAULT_CONFIG), null, 'P<20 → skip');
  const fewOutcomes = [night(D[0], { good: 1, processed: 40 }), night(D[1], { processed: 42 }), night(D[2], { good: 1, processed: 45 })];
  assert.equal(planPriority(activeForum(), fewOutcomes, TODAY, DEFAULT_CONFIG), null, 'G+R<5 → skip');
}

{ // status gate: a disqualified forum is never reprioritised
  const nights = [night(D[0], { good: 8, rejected: 2, processed: 40 }), night(D[1], { good: 9, rejected: 1, processed: 42 }), night(D[2], { good: 10, rejected: 1, processed: 45 })];
  assert.equal(planPriority(activeForum({ status: 'calibration_failed' }), nights, TODAY, DEFAULT_CONFIG), null);
}

{ // transient guard: an outage-dominated night in the window blocks a priority move
  const nights = [night(D[0], { good: 8, rejected: 2, processed: 40 }), night(D[1], { good: 9, rejected: 1, processed: 42 }), night(D[2], { good: 10, rejected: 1, processed: 2, transient: 18 })];
  assert.equal(planPriority(activeForum(), nights, TODAY, DEFAULT_CONFIG), null, 'outage night (share≥0.30) → do not read as quality');
}

// ── COOLDOWN ─────────────────────────────────────────────────────────────────
const longParked = (over = {}) => ({
  id: 'f', name: 'F', status: 'active', new_threads_last_batch: 12,
  cooldown_tier_hours: 168, cooldown_set_at: '2026-06-18T22:00:00Z',
  cooldown_until: '2026-06-26T00:00:00Z', ...over,
});
const shortParked = (over = {}) => ({
  id: 'f', name: 'F', status: 'active', new_threads_last_batch: 5,
  cooldown_tier_hours: 24, cooldown_set_at: '2026-06-18T22:00:00Z',
  cooldown_until: '2026-06-19T20:00:00Z', ...over,
});

{ // SHORTEN 168h→24h
  const nights = [night(D[1], { good: 3, processed: 15 }), night(D[2], { good: 4, processed: 15 })];
  const d = planCooldown(longParked(), nights, [], NOW, TODAY, DEFAULT_CONFIG);
  assert.ok(d, 'shorten fires'); assert.equal(d.direction, 'shorten');
  assert.equal(d.newFields.cooldown_tier_hours, 24);
  const until = new Date(d.newFields.cooldown_until).getTime();
  assert.ok(until > NOW.getTime() && until <= NOW.getTime() + 24.5 * 3600e3, 'new cooldown ≈ now+24h');
  assert.ok(d.newFields.cooldown_until < longParked().cooldown_until, 'genuinely sooner');
}

{ // EXHAUSTED / 0-new locks
  const nights = [night(D[1], { good: 5, processed: 15 }), night(D[2], { good: 5, processed: 15 })];
  assert.equal(planCooldown(longParked({ status: 'exhausted' }), nights, [], NOW, TODAY, DEFAULT_CONFIG), null, 'exhausted lock');
  assert.equal(planCooldown(longParked({ new_threads_last_batch: 0 }), nights, [], NOW, TODAY, DEFAULT_CONFIG), null, '0-new lock');
}

{ // anchor missing → skip (no last_crawled_at reconstruction)
  const nights = [night(D[1], { good: 5, processed: 15 }), night(D[2], { good: 5, processed: 15 })];
  assert.equal(planCooldown(longParked({ cooldown_tier_hours: null }), nights, [], NOW, TODAY, DEFAULT_CONFIG), null);
  assert.equal(planCooldown(longParked({ cooldown_set_at: null }), nights, [], NOW, TODAY, DEFAULT_CONFIG), null);
}

{ // EXTEND 24h→168h
  const nights = [night(D[1], { good: 0, processed: 12 }), night(D[2], { good: 0, processed: 14 })];
  const d = planCooldown(shortParked(), nights, [], NOW, TODAY, DEFAULT_CONFIG);
  assert.ok(d, 'extend fires'); assert.equal(d.direction, 'extend');
  assert.equal(d.newFields.cooldown_tier_hours, 168);
  assert.ok(d.newFields.cooldown_until > shortParked().cooldown_until, 'genuinely later');
}

{ // transient guard: a phantom-metric night (mostly transient) blocks cooldown
  const nights = [night(D[1], { good: 0, processed: 12 }), night(D[2], { good: 0, processed: 2, transient: 18 })];
  assert.equal(planCooldown(shortParked(), nights, [], NOW, TODAY, DEFAULT_CONFIG), null, 'transient share ≥0.30 → skip');
}

{ // cross-night anti-flap: a recent opposite-direction change blocks the reverse
  const nights = [night(D[1], { good: 0, processed: 12 }), night(D[2], { good: 0, processed: 14 })];
  const recentShorten = [{ date: addDays(TODAY, -4), direction: 'shorten' }];
  assert.equal(planCooldown(shortParked(), nights, recentShorten, NOW, TODAY, DEFAULT_CONFIG), null, 'extend blocked within 10d of a shorten');
  const oldShorten = [{ date: addDays(TODAY, -11), direction: 'shorten' }];
  assert.ok(planCooldown(shortParked(), nights, oldShorten, NOW, TODAY, DEFAULT_CONFIG), 'beyond the lock window it is allowed');
}

// ── RE-CALIBRATION (shadow proposal only) ───────────────────────────────────
const calForum = (over = {}) => ({ id: 'f', name: 'F', status: 'active', calibration_status: 'calibrated', ...over });

{ // STUCK → shadow proposal (mutates nothing)
  const nights = [night(D[0], { processed: 12, tooFew: 2 }), night(D[1], { processed: 12, tooFew: 2 }), night(D[2], { processed: 12, tooFew: 2 })];
  const d = planRecalProposal(calForum(), nights, TODAY, DEFAULT_CONFIG);
  assert.ok(d, 'stuck → proposal'); assert.equal(d.kind, 'proposal'); assert.equal(d.knob, 'recalibrate_proposal');
}

{ // soft-block exclusion: too_few dominates → NOT a structure break
  const nights = [night(D[0], { processed: 12, tooFew: 10 }), night(D[1], { processed: 12, tooFew: 10 }), night(D[2], { processed: 12, tooFew: 10 })];
  assert.equal(planRecalProposal(calForum(), nights, TODAY, DEFAULT_CONFIG), null, 'thin content, not a parser break');
}

{ // any extraction → not stuck
  const nights = [night(D[0], { processed: 12, extracted: 1 }), night(D[1], { processed: 12 }), night(D[2], { processed: 12 })];
  assert.equal(planRecalProposal(calForum(), nights, TODAY, DEFAULT_CONFIG), null);
  // transient-tainted night → not stuck
  const tainted = [night(D[0], { processed: 12 }), night(D[1], { processed: 12 }), night(D[2], { processed: 12, transient: 5 })];
  assert.equal(planRecalProposal(calForum(), tainted, TODAY, DEFAULT_CONFIG), null, 'transient >20% night blocks recal');
  // not calibrated / blocked status
  assert.equal(planRecalProposal(calForum({ calibration_status: 'pending' }), [night(D[0], { processed: 12 }), night(D[1], { processed: 12 }), night(D[2], { processed: 12 })], TODAY, DEFAULT_CONFIG), null);
}

// ── PRECEDENCE: recal proposal pre-empts cooldown ───────────────────────────
{
  // A stuck forum that is ALSO a cooldown-extend candidate → planForum returns the proposal only.
  const nights = [night(D[0], { processed: 15 }), night(D[1], { good: 0, processed: 15 }), night(D[2], { good: 0, processed: 15 })];
  const forum = calForum({ cooldown_tier_hours: 24, cooldown_set_at: '2026-06-18T22:00:00Z', cooldown_until: '2026-06-19T20:00:00Z', new_threads_last_batch: 5 });
  const d = planForum({ forum, nights, recentCooldownJournal: [], now: NOW, todayStr: TODAY, config: DEFAULT_CONFIG });
  assert.equal(d.kind, 'proposal', 'recalibration wins precedence and suppresses cooldown');
}

// ── planNight: circuit breaker, cap, already-changed ────────────────────────
const risingNights = () => [night(D[0], { good: 8, rejected: 2, processed: 40 }), night(D[1], { good: 9, rejected: 1, processed: 42 }), night(D[2], { good: 10, rejected: 1, processed: 45 })];
const thinEvaluable = () => [night(D[1], { good: 1, rejected: 1, processed: 6 }), night(D[2], { good: 1, rejected: 1, processed: 6 })]; // 2 nights, below min-volume

{ // circuit breaker: > 50% of evaluable forums would change → apply none
  const forums = [], nightsByForum = {};
  for (let i = 0; i < 6; i++) { const id = `up${i}`; forums.push({ id, name: id, status: 'active', priority_score: 0 }); nightsByForum[id] = risingNights(); }
  for (let i = 0; i < 4; i++) { const id = `thin${i}`; forums.push({ id, name: id, status: 'active', priority_score: 0 }); nightsByForum[id] = thinEvaluable(); }
  const plan = planNight({ forums, nightsByForum, now: NOW, todayStr: TODAY, config: DEFAULT_CONFIG });
  assert.equal(plan.circuitTripped, true, '6 of 10 evaluable → tripped');
  assert.equal(plan.applied.length, 0, 'nothing applied on a tripped night');
}

{ // global cap: strongest first, rest deferred (circuit disabled via config)
  const cfg = { ...DEFAULT_CONFIG, GLOBAL_CIRCUIT_PCT: 2, MAX_ACTIONS_PER_NIGHT: 3 }; // breaker off (ratio can't exceed 1)
  const forums = [], nightsByForum = {};
  for (let i = 0; i < 5; i++) { const id = `up${i}`; forums.push({ id, name: id, status: 'active', priority_score: 0 }); nightsByForum[id] = risingNights(); }
  const plan = planNight({ forums, nightsByForum, now: NOW, todayStr: TODAY, config: cfg });
  assert.equal(plan.circuitTripped, false);
  assert.equal(plan.applied.length, 3, 'cap honoured');
  assert.equal(plan.deferred.length, 2, 'overflow deferred');
  assert.equal(plan.capHit, true);
}

{ // already-changed forums are skipped (1/forum/day idempotency on re-run)
  const forums = [{ id: 'x', name: 'x', status: 'active', priority_score: 0 }];
  const plan = planNight({ forums, nightsByForum: { x: risingNights() }, alreadyChangedForumIds: new Set(['x']), now: NOW, todayStr: TODAY, config: DEFAULT_CONFIG });
  assert.equal(plan.applied.length, 0, 'forum already changed today → skipped');
  assert.equal(plan.evaluable, 0, 'already-changed forum is skipped BEFORE the evaluable count (circuit-breaker denominator not inflated)');
}

console.log('agent-coach-adapt.test.js passed');
