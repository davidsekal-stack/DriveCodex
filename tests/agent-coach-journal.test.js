import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentState } from '../scripts/agent/state.mjs';
import { revertCoachChanges } from '../scripts/agent/apply-proposal.mjs';
import { resetForum } from '../scripts/agent/reset-forum.mjs';

// The cooldown tier-marker invariant: cooldown_tier_hours and cooldown_set_at are
// always set or cleared TOGETHER, and a non-null tier implies a non-null cooldown_until.
const tierInvariantHolds = (f) =>
  ((f.cooldown_tier_hours == null) === (f.cooldown_set_at == null)) &&
  (f.cooldown_tier_hours == null || f.cooldown_until != null);

// coach_journal: atomic apply, the 1-applied-change/forum/day lock, and the
// compare-and-swap revert (happy / superseded / idempotent). Exercises the real
// SQLite layer in a temp DB.

const dir = mkdtempSync(join(tmpdir(), 'agent-coach-journal-'));
const DATE = '2026-06-19';
try {
  const state = new AgentState(join(dir, 'agent.db'));
  const f1 = state.addForum({ url: 'https://a.example/forum', name: 'Forum A' });

  // ── priority apply ──
  const r1 = state.applyCoachChange({
    date: DATE, forumId: f1, forumName: 'Forum A', knob: 'priority', direction: 'up',
    reasonCode: 'rising_yield', signal: { good: 30, processed: 120 },
    oldFields: { priority_score: 0 }, newFields: { priority_score: 27 },
  });
  assert.equal(r1.ok, true);
  assert.equal(state.getForum(f1).priority_score, 27, 'forum mutated');

  // ── 1/forum/day lock + atomicity: 2nd applied change same forum/day is rejected
  //    AND its forum write is rolled back (insert throws on the partial UNIQUE → ROLLBACK).
  const r2 = state.applyCoachChange({
    date: DATE, forumId: f1, forumName: 'Forum A', knob: 'cooldown', direction: 'extend',
    oldFields: { cooldown_until: null }, newFields: { cooldown_until: '2026-06-26T00:00:00Z' },
  });
  assert.equal(r2.ok, false, '2nd applied change blocked by 1/forum/day lock');
  assert.equal(state.getForum(f1).cooldown_until, null, 'atomic rollback: cooldown not applied');
  assert.equal(state.getForum(f1).priority_score, 27, 'first change intact');

  // ── a SHADOW proposal (applied=0) for the same forum/day is still allowed ──
  const pid = state.recordCoachProposal({ date: DATE, forumId: f1, forumName: 'Forum A', knob: 'recalibrate_proposal', reasonCode: 'stuck_no_extract', signal: { nights: 3 } });
  assert.ok(pid > 0);
  const rows = state.getCoachJournalForDate(DATE);
  assert.equal(rows.filter(r => Number(r.applied) === 1).length, 1, 'exactly one applied row');
  assert.equal(rows.filter(r => Number(r.applied) === 0).length, 1, 'proposal coexists');

  // ── revert happy path + idempotency ──
  const res = revertCoachChanges(state, { forumId: f1 });
  assert.equal(res.reverted.length, 1);
  assert.equal(state.getForum(f1).priority_score, 0, 'priority restored');
  const again = revertCoachChanges(state, { forumId: f1 });
  assert.equal(again.total, 0, 'nothing left to revert (reverted_at filter)');

  // ── revert SUPERSEDED: an intervening write is never clobbered ──
  const f2 = state.addForum({ url: 'https://b.example/forum', name: 'Forum B' });
  state.applyCoachChange({ date: DATE, forumId: f2, forumName: 'Forum B', knob: 'priority', oldFields: { priority_score: 0 }, newFields: { priority_score: 30 } });
  state.updateForum(f2, { priority_score: 50 }); // engine/human moved it on
  const res2 = revertCoachChanges(state, { forumId: f2 });
  assert.equal(res2.reverted.length, 0);
  assert.equal(res2.superseded.length, 1);
  assert.equal(state.getForum(f2).priority_score, 50, 'newer value preserved, not clobbered');
  assert.equal(revertCoachChanges(state, { forumId: f2 }).total, 0, 'superseded row also closed out (idempotent)');

  // ── cooldown is multi-column and fully restored on revert ──
  const f3 = state.addForum({ url: 'https://c.example/forum', name: 'Forum C' });
  const oldCd = { cooldown_until: '2026-06-26T00:00:00Z', cooldown_tier_hours: 168, cooldown_set_at: '2026-06-18T22:00:00Z' };
  const newCd = { cooldown_until: '2026-06-20T05:00:00Z', cooldown_tier_hours: 24, cooldown_set_at: '2026-06-19T05:00:00Z' };
  state.updateForum(f3, oldCd);
  state.applyCoachChange({ date: DATE, forumId: f3, forumName: 'Forum C', knob: 'cooldown', direction: 'shorten', oldFields: oldCd, newFields: newCd });
  assert.equal(state.getForum(f3).cooldown_tier_hours, 24);
  assert.equal(state.getForum(f3).cooldown_until, newCd.cooldown_until);
  const res3 = revertCoachChanges(state, { forumId: f3 });
  assert.equal(res3.reverted.length, 1);
  const back = state.getForum(f3);
  assert.equal(back.cooldown_tier_hours, 168, 'tier restored');
  assert.equal(back.cooldown_until, oldCd.cooldown_until, 'until restored');
  assert.equal(back.cooldown_set_at, oldCd.cooldown_set_at, 'set_at restored');

  // ── filters: --knob / --date narrow the revert set ──
  assert.equal(state.getRevertableCoachChanges({ knob: 'cooldown' }).length, 0, 'all reverted already');

  // ── tier-marker invariant across coach-apply + reset paths ──
  // After a coach cooldown apply the markers are stamped and consistent.
  const f4 = state.addForum({ url: 'https://d.example/forum', name: 'Forum D' });
  state.updateForum(f4, { status: 'active', cooldown_until: '2026-06-26T00:00:00Z', cooldown_tier_hours: 168, cooldown_set_at: '2026-06-18T22:00:00Z' });
  state.applyCoachChange({
    date: DATE, forumId: f4, forumName: 'Forum D', knob: 'cooldown', direction: 'shorten',
    oldFields: { cooldown_until: '2026-06-26T00:00:00Z', cooldown_tier_hours: 168, cooldown_set_at: '2026-06-18T22:00:00Z' },
    newFields: { cooldown_until: '2026-06-20T05:00:00Z', cooldown_tier_hours: 24, cooldown_set_at: '2026-06-19T05:00:00Z' },
  });
  assert.ok(tierInvariantHolds(state.getForum(f4)), 'invariant holds after coach cooldown apply');
  // reset-forum clears the cooldown + both markers together (the seed-bug-class guard).
  resetForum(state, state.getForum(f4));
  const afterReset = state.getForum(f4);
  assert.equal(afterReset.cooldown_until, null);
  assert.equal(afterReset.cooldown_tier_hours, null);
  assert.equal(afterReset.cooldown_set_at, null);
  assert.equal(afterReset.status, 'discovered');
  assert.equal(afterReset.sections_json, '[]');
  assert.ok(tierInvariantHolds(afterReset), 'invariant holds after reset');

  state.close();
  console.log('agent-coach-journal.test.js passed');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
