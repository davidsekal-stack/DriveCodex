import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentState } from '../scripts/agent/state.mjs';

// Locks the crawl-selection ordering of getForumsToProcess against the
// priority_score tiebreaker added for the daily coach's auto-scheduling tier.
// The hot invariant: with DEFAULT priority (0) the ordering must be IDENTICAL to
// the pre-priority behaviour (never-crawled first, then oldest-crawled first),
// so turning the column on never silently reshuffles the crawl queue.

const dir = mkdtempSync(join(tmpdir(), 'agent-forum-priority-'));
const dbPath = join(dir, 'agent.db');

try {
  const state = new AgentState(dbPath);

  const mk = (url, lastCrawled, priority = 0) => {
    const id = state.addForum({ url });
    state.updateForum(id, { status: 'active', last_crawled_at: lastCrawled, priority_score: priority });
    return id;
  };

  // ── Case 1: all default priority (0) → must equal NULL-first then last_crawled ASC ──
  const fNever = mk('https://a.example/forum', null, 0);
  const fOld   = mk('https://b.example/forum', '2026-01-01 00:00:00', 0);
  const fNew   = mk('https://c.example/forum', '2026-01-02 00:00:00', 0);

  let order = state.getForumsToProcess(10).map(f => f.id);
  assert.deepEqual(order, [fNever, fOld, fNew],
    'default priority preserves legacy ordering: never-crawled, then oldest-crawled first');

  // ── Case 2: a priority boost moves a crawled forum up its tier (but not above never-crawled) ──
  state.updateForum(fNew, { priority_score: 5 }); // boost the most-recently-crawled one
  order = state.getForumsToProcess(10).map(f => f.id);
  assert.deepEqual(order, [fNever, fNew, fOld],
    'boosted forum jumps ahead of default-priority peers; never-crawled keeps its head start');

  // ── Case 3: negative priority sinks a forum within its tier ──
  state.updateForum(fNew, { priority_score: 0 });
  state.updateForum(fOld, { priority_score: -3 });
  order = state.getForumsToProcess(10).map(f => f.id);
  assert.deepEqual(order, [fNever, fNew, fOld],
    'de-prioritised forum sinks below same-tier peers');

  state.close();
  console.log('agent-forum-priority.test.js passed');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
