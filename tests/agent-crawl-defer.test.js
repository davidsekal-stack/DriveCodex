import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { processThread, minThreadAgeMs } from '../scripts/agent/crawl.mjs';
import { parseWhenToDate, threadLastActivity } from '../scripts/agent/parsers/common.mjs';
import { AgentState } from '../scripts/agent/state.mjs';
import { classifyDiscardReason, selectRecoverable } from '../scripts/agent/recover-discarded.mjs';

const DAY = 24 * 60 * 60 * 1000;
const YEAR = minThreadAgeMs(); // the live age threshold (default 365d)

// ───────────────────────────────────────────────────────────────────────────
// parseWhenToDate — ISO + bare epoch only; localized/relative => null (unknown)
// ───────────────────────────────────────────────────────────────────────────
assert.equal(parseWhenToDate('2024-03-11T08:22:00+0000'), Date.parse('2024-03-11T08:22:00+0000'), 'ISO with numeric offset');
assert.equal(parseWhenToDate('2024-03-11T08:22:00.000Z'), Date.parse('2024-03-11T08:22:00.000Z'), 'ISO with Z + ms');
assert.equal(parseWhenToDate('2024-03-11'), Date.parse('2024-03-11'), 'ISO date-only');
assert.equal(parseWhenToDate('1710144120'), 1710144120 * 1000, '10-digit unix seconds → ms');
assert.equal(parseWhenToDate('1710144120000'), 1710144120000, '13-digit unix ms');
assert.equal(parseWhenToDate('vor 2 Stunden'), null, 'German relative → null');
assert.equal(parseWhenToDate('včera'), null, 'Czech relative → null');
assert.equal(parseWhenToDate('11 March 2024'), null, 'non-ISO absolute → null (safe: process now)');
assert.equal(parseWhenToDate('garbage'), null, 'garbage → null');
assert.equal(parseWhenToDate(''), null, 'empty → null');
assert.equal(parseWhenToDate(null), null, 'null → null');

// ───────────────────────────────────────────────────────────────────────────
// threadLastActivity — newest parseable date wins; unknowns ignored
// ───────────────────────────────────────────────────────────────────────────
assert.equal(
  threadLastActivity([
    { when: '2020-01-01T00:00:00Z' },
    { when: '2022-06-01T00:00:00Z' },
    { when: 'vor 2 Stunden' },
  ]),
  Date.parse('2022-06-01T00:00:00Z'),
  'returns the newest parseable post date'
);
assert.equal(threadLastActivity([{ when: '' }, { when: 'včera' }]), null, 'all-unknown → null');
assert.equal(threadLastActivity([]), null, 'no posts → null');

// ───────────────────────────────────────────────────────────────────────────
// processThread — the post-fetch age gate
// ───────────────────────────────────────────────────────────────────────────
const now = Date.parse('2026-06-25T12:00:00Z');

function mockPipeline(posts, spy = {}) {
  return {
    async fetchAndParse() {
      return { posts, threadText: 'THREAD', title: 'A title', html: '', pageCount: 1 };
    },
    async classify() { spy.classified = true; return { approved: true, reason: '' }; },
    async extract() { spy.extracted = true; return [{ description: 'fault', resolution: 'the fix' }]; },
    validate() { return { valid: true }; },
  };
}

// (a) Newest post younger than the threshold → DEFERRED, no LLM, revisit recorded.
{
  const newest = now - YEAR / 2;
  const spy = {};
  const r = await processThread('u', {}, mockPipeline([
    { when: new Date(now - 2 * YEAR).toISOString() }, // old opening post
    { when: new Date(newest).toISOString() },         // newest reply, still young
  ], spy), { now });
  assert.equal(r.deferred, true, 'thread whose newest post is <1yr is deferred');
  assert.equal(r.cases.length, 0, 'deferred thread yields no cases');
  assert.equal(spy.classified, undefined, 'deferred thread never reaches the classifier (no AI cost)');
  assert.equal(r.lastPostAt, new Date(newest).toISOString(), 'records the last-post date');
  assert.equal(r.revisitAfter, new Date(newest + YEAR).toISOString(), 'revisit = last post + 1 year');
}

// (b) Newest post older than the threshold → processed normally (classify+extract).
{
  const spy = {};
  const r = await processThread('u', {}, mockPipeline([
    { when: new Date(now - 3 * YEAR).toISOString() },
    { when: new Date(now - 2 * YEAR).toISOString() },
  ], spy), { now });
  assert.equal(r.deferred, undefined, 'matured thread (newest >1yr) is NOT deferred');
  assert.equal(spy.classified && spy.extracted, true, 'matured thread proceeds to classify + extract');
  assert.equal(r.cases.length, 1, 'matured thread can yield a case');
}

// (c) Unparseable/localized dates → unknown age → processed now (never silently dropped).
{
  const spy = {};
  const r = await processThread('u', {}, mockPipeline([
    { when: 'včera' },
    { when: '' },
  ], spy), { now });
  assert.equal(r.deferred, undefined, 'unknown-age thread is processed now, not deferred');
  assert.equal(spy.classified, true, 'unknown-age thread reaches the classifier');
}

// (d) Too-few-posts guard still wins over the age gate.
{
  const r = await processThread('u', {}, mockPipeline([{ when: new Date(now).toISOString() }]), { now });
  assert.equal(r.skipped, 'Too few posts', 'single-post thread short-circuits before the age gate');
  assert.equal(r.deferred, undefined);
}

// (e) MOVED-TRAP regression: a thread too-young at first contact matures and is then
//     processed IN PLACE — the resolution that lands later is captured, never buried.
{
  const lastPost = now - 0.8 * YEAR;            // young at first contact
  const first = await processThread('u', {}, mockPipeline([
    { when: new Date(now - 1.5 * YEAR).toISOString() },
    { when: new Date(lastPost).toISOString() },
  ]), { now });
  assert.equal(first.deferred, true, 'too-young at first contact → deferred');

  const dueMs = Date.parse(first.revisitAfter);
  const later = now + (dueMs - now) + DAY; // a day after it matures
  const spy = {};
  const r = await processThread('u', {}, mockPipeline([
    { when: new Date(lastPost).toISOString() },
    { when: new Date(lastPost).toISOString() }, // the now-present resolution post
  ], spy), { now: later });
  assert.equal(r.deferred, undefined, 'after maturing it is processed, not deferred again');
  assert.equal(spy.extracted, true, 'the matured thread is extracted — late resolution captured');
}

// ───────────────────────────────────────────────────────────────────────────
// state — defer status, revive-when-due, persistence, crawled-count exclusion
// ───────────────────────────────────────────────────────────────────────────
const dir = mkdtempSync(join(tmpdir(), 'agent-defer-test-'));
const dbPath = join(dir, 'agent.db');
try {
  let state = new AgentState(dbPath);
  const forumId = state.addForum({ url: 'https://defer.example/forum' });

  const past = new Date(Date.now() - DAY).toISOString();     // due → should revive
  const future = new Date(Date.now() + 30 * DAY).toISOString(); // not due → stays

  const tDue = state.addThread({ forumId, url: 'https://defer.example/t-due' });
  state.updateThread(tDue, { status: 'deferred', revisit_after: past });
  const tWait = state.addThread({ forumId, url: 'https://defer.example/t-wait' });
  state.updateThread(tWait, { status: 'deferred', revisit_after: future });
  const tDone = state.addThread({ forumId, url: 'https://defer.example/t-done' });
  state.updateThread(tDone, { status: 'extracted' });

  assert.equal(state.countDeferredThreads(forumId), 2, 'two deferred threads');
  assert.equal(state.countCrawledThreads(forumId), 1, 'only extracted counts as crawled (deferred excluded)');

  const revived = state.reviveDueDeferredThreads(forumId);
  assert.equal(revived, 1, 'only the past-due deferred thread is revived');
  assert.equal(state.getThread(tDue).status, 'pending', 'matured deferred thread → pending');
  assert.equal(state.getThread(tWait).status, 'deferred', 'not-yet-due deferred thread stays deferred');
  assert.equal(state.countPendingThreads(forumId), 1, 'revived thread is queued');
  assert.equal(state.countDeferredThreads(forumId), 1, 'one still waiting');

  // revisit_after must survive updateThread (allow-list) AND a reopen (#migrate/#repair).
  assert.equal(state.getThread(tWait).revisit_after, future, 'revisit_after persisted via updateThread');
  state.close();
  state = new AgentState(dbPath);
  assert.equal(state.getThread(tWait).revisit_after, future, 'revisit_after survives reopen + legacy repair');
  assert.equal(state.getThread(tWait).status, 'deferred', 'deferred status survives reopen');
  state.close();
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// ───────────────────────────────────────────────────────────────────────────
// recover-discarded — selection of previously-discarded threads to re-queue
// ───────────────────────────────────────────────────────────────────────────
assert.equal(classifyDiscardReason('Too few posts'), 'too_few');
assert.equal(classifyDiscardReason('Classifier rejected: Thread is a forum rules page, not a discussion'), 'terminal');
assert.equal(classifyDiscardReason('Classifier rejected: request for a service manual'), 'terminal');
assert.equal(classifyDiscardReason('Classifier rejected: Tool recommendation thread.'), 'terminal');
assert.equal(classifyDiscardReason('Extractor returned no cases'), 'recoverable');
assert.equal(classifyDiscardReason('Classifier rejected: Unresolved thread. user describes a genuine fault'), 'recoverable');
assert.equal(classifyDiscardReason('Classifier rejected: no confirmed resolution for any described fault'), 'recoverable');
assert.equal(classifyDiscardReason('something unexpected'), 'other');

{
  const rows = [
    { id: 'a', forum_id: 'f1', discard_reason: 'Too few posts' },
    { id: 'b', forum_id: 'f1', discard_reason: 'Extractor returned no cases' },
    { id: 'c', forum_id: 'f2', discard_reason: 'Classifier rejected: Unresolved thread' },
    { id: 'd', forum_id: 'f1', discard_reason: 'Classifier rejected: service manual request' },
  ];
  const r1 = selectRecoverable(rows, {});
  assert.deepEqual(r1.selected.map(x => x.id), ['b', 'c'], 'recoverable only by default');
  assert.equal(r1.buckets.too_few, 1);
  assert.equal(r1.buckets.terminal, 1);
  const r2 = selectRecoverable(rows, { includeTooFew: true });
  assert.deepEqual(r2.selected.map(x => x.id).sort(), ['a', 'b', 'c'], 'too_few included on opt-in');
  const r3 = selectRecoverable(rows, { forumId: 'f1' });
  assert.deepEqual(r3.selected.map(x => x.id), ['b'], 'forum filter restricts selection');
  assert.equal(r3.buckets.recoverable, 2, 'buckets count all rows regardless of forum filter');
  const r4 = selectRecoverable(rows, { limit: 1 });
  assert.equal(r4.selected.length, 1, 'limit caps selection');
}

console.log('agent-crawl-defer.test.js passed');
