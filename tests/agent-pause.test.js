import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  computePauseUntil,
  enterQuotaPause,
  clearQuotaPause,
  recordSuccessHeartbeat,
  getActivePause,
  PAUSE_GRACE_MS,
  PAUSE_MAX_MS,
  PAUSE_FALLBACK_MS,
  DEEPSEEK_PAUSE_FALLBACK_MS,
} from '../scripts/agent/pause.mjs';
import { QuotaError, AuthError } from '../scripts/agent/quota.mjs';

// Minimal in-memory AgentState stand-in
function fakeState() {
  const meta = new Map();
  return {
    meta,
    getMeta: k => (meta.has(k) ? meta.get(k) : null),
    setMeta: (k, v) => meta.set(k, v),
    deleteMeta: k => meta.delete(k),
    logs: [],
    log(level, msg, phase) { this.logs.push({ level, msg, phase }); },
  };
}

function testComputePauseUntil() {
  const now = new Date('2026-06-10T12:00:00Z');

  // Known reset → reset + grace
  const reset = new Date('2026-06-10T14:00:00Z');
  assert.equal(computePauseUntil(reset, now).getTime(), reset.getTime() + PAUSE_GRACE_MS);

  // No reset → now + fallback
  assert.equal(computePauseUntil(null, now).getTime(), now.getTime() + PAUSE_FALLBACK_MS);

  // DeepSeek-style longer fallback honored when passed
  assert.equal(
    computePauseUntil(null, now, DEEPSEEK_PAUSE_FALLBACK_MS).getTime(),
    now.getTime() + DEEPSEEK_PAUSE_FALLBACK_MS,
  );

  // Reset in the past → floored to now + grace (never a pause in the past)
  const past = new Date('2020-01-01T00:00:00Z');
  assert.equal(computePauseUntil(past, now).getTime(), now.getTime() + PAUSE_GRACE_MS);

  // Reset absurdly far out → clamped to now + 8 days
  const farFuture = new Date(now.getTime() + 30 * 24 * 3600_000);
  assert.equal(computePauseUntil(farFuture, now).getTime(), now.getTime() + PAUSE_MAX_MS);
}

function testGetActivePause() {
  const state = fakeState();
  const now = new Date('2026-06-10T12:00:00Z');

  assert.equal(getActivePause(state, now), null); // nothing set

  state.setMeta('pause_until', new Date(now.getTime() + 3600_000).toISOString());
  state.setMeta('pause_reason', 'Claude quota exhausted');
  const active = getActivePause(state, now);
  assert.ok(active);
  assert.equal(active.reason, 'Claude quota exhausted');

  // Expired pause → treated as no pause (fail-open)
  state.setMeta('pause_until', new Date(now.getTime() - 1000).toISOString());
  assert.equal(getActivePause(state, now), null);

  // Garbage timestamp → no pause, not a throw
  state.setMeta('pause_until', 'not-a-date');
  assert.equal(getActivePause(state, now), null);
}

function testEnterClearRoundTrip() {
  const dir = mkdtempSync(join(tmpdir(), 'agent-pause-test-'));
  const pauseFile = join(dir, 'pause-until.txt');
  const lastSuccessFile = join(dir, 'last-success.txt');
  try {
    const state = fakeState();
    const now = new Date('2026-06-10T12:00:00Z');

    // Claude quota with reset time
    const reset = new Date(now.getTime() + 2 * 3600_000);
    const until = enterQuotaPause(state, new QuotaError('Claude', 'limit', { resetAt: reset }), { pauseFile, now });
    assert.equal(until.getTime(), reset.getTime() + PAUSE_GRACE_MS);
    assert.equal(state.getMeta('pause_until'), until.toISOString());
    assert.ok(existsSync(pauseFile));
    // CONTRACT: first line is the ISO timestamp the PowerShell wrapper parses
    const firstLine = readFileSync(pauseFile, 'utf-8').split('\n')[0];
    assert.equal(firstLine, until.toISOString());
    assert.equal(new Date(firstLine).toISOString(), firstLine); // round-trips as a Date

    // DeepSeek without reset → 6h fallback, not 1h
    const ds = enterQuotaPause(state, new QuotaError('DeepSeek', 'insufficient balance'), { pauseFile, now });
    assert.equal(ds.getTime(), now.getTime() + DEEPSEEK_PAUSE_FALLBACK_MS);

    clearQuotaPause(state, { pauseFile });
    assert.equal(state.getMeta('pause_until'), null);
    assert.equal(existsSync(pauseFile), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function testHeartbeatFormat() {
  const dir = mkdtempSync(join(tmpdir(), 'agent-pause-hb-'));
  const lastSuccessFile = join(dir, 'last-success.txt');
  try {
    const state = fakeState();
    const now = new Date('2026-06-10T12:00:00Z');
    recordSuccessHeartbeat(state, { lastSuccessFile, now });
    assert.equal(state.getMeta('last_success_at'), now.toISOString());
    const firstLine = readFileSync(lastSuccessFile, 'utf-8').split('\n')[0];
    assert.equal(firstLine, now.toISOString());
    assert.equal(new Date(firstLine).toISOString(), firstLine);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function testPauseFileWriteFailureLogged() {
  const state = fakeState();
  // Point pauseFile at a path whose parent dir does not exist → writeFileSync throws
  const badPath = join(tmpdir(), 'no-such-dir-xyz', 'pause-until.txt');
  const until = enterQuotaPause(state, new QuotaError('Claude', 'limit'), { pauseFile: badPath, now: new Date() });
  // SQLite (meta) is still authoritative even though the file write failed
  assert.equal(state.getMeta('pause_until'), until.toISOString());
  assert.ok(state.logs.some(l => l.level === 'warn' && /pause file/i.test(l.msg)));
}

function testAuthErrorShape() {
  const err = new AuthError('Claude', 'not authenticated');
  assert.equal(err.name, 'AuthError');
  assert.equal(err.service, 'Claude');
  assert.match(err.message, /authentication failed/);
}

testComputePauseUntil();
testGetActivePause();
testEnterClearRoundTrip();
testHeartbeatFormat();
testPauseFileWriteFailureLogged();
testAuthErrorShape();

console.log('agent-pause.test.js passed');
