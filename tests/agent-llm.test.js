import assert from 'node:assert/strict';
import { resolveRoute } from '../scripts/agent/llm.mjs';
import { isClaudeLimitMessage, parseClaudeResetAt, QuotaError, formatQuotaMessage } from '../scripts/agent/quota.mjs';

function testDefaultRoutes() {
  assert.deepEqual(resolveRoute('classify', {}), { provider: 'claude', model: 'haiku' });
  assert.deepEqual(resolveRoute('extract', {}), { provider: 'claude', model: 'sonnet' });
  assert.deepEqual(resolveRoute('verify', {}), { provider: 'deepseek', model: 'deepseek-chat' });
  assert.deepEqual(resolveRoute('calibrate', {}), { provider: 'claude', model: 'sonnet' });
  assert.deepEqual(resolveRoute('diary', {}), { provider: 'claude', model: 'haiku' });
}

function testEnvOverrides() {
  const env = { AGENT_LLM_VERIFY: 'claude:opus', AGENT_LLM_CLASSIFY: 'deepseek:deepseek-chat' };
  assert.deepEqual(resolveRoute('verify', env), { provider: 'claude', model: 'opus' });
  assert.deepEqual(resolveRoute('classify', env), { provider: 'deepseek', model: 'deepseek-chat' });
  // Provider without model → model null (provider default applies later)
  assert.deepEqual(resolveRoute('diary', { AGENT_LLM_DIARY: 'claude' }), { provider: 'claude', model: null });
}

function testInvalidRoutes() {
  assert.throws(() => resolveRoute('nonexistent-task', {}), /Unknown LLM task/);
  assert.throws(() => resolveRoute('verify', { AGENT_LLM_VERIFY: 'openai:gpt' }), /Unknown LLM provider/);
}

function testLimitMessageDetection() {
  assert.equal(isClaudeLimitMessage("You've reached your usage limit. Your limit will reset at 10pm."), true);
  assert.equal(isClaudeLimitMessage('Claude AI usage limit reached|1735689600'), true);
  assert.equal(isClaudeLimitMessage('5-hour limit reached'), true);
  assert.equal(isClaudeLimitMessage('Failed to authenticate. API Error: 401'), false);
  assert.equal(isClaudeLimitMessage('Invalid model name'), false);
}

function testResetTimeParsing() {
  const now = new Date('2026-06-10T14:00:00');

  // Epoch (seconds)
  const epoch = Math.floor(new Date('2026-06-10T20:00:00').getTime() / 1000);
  const fromEpoch = parseClaudeResetAt(`usage limit reached|${epoch}`, now);
  assert.equal(fromEpoch?.getTime(), epoch * 1000);

  // Epoch in the past → rejected
  assert.equal(parseClaudeResetAt('usage limit reached|946684800', now), null);

  // Clock time later today
  const pm = parseClaudeResetAt('Your limit will reset at 10pm.', now);
  assert.equal(pm?.getHours(), 22);
  assert.equal(pm?.getDate(), now.getDate());

  // Clock time already past today → tomorrow
  const am = parseClaudeResetAt('Your limit will reset at 9am.', now);
  assert.equal(am?.getHours(), 9);
  assert.equal(am > now, true);

  // 24h format with minutes
  const hm = parseClaudeResetAt('resets at 16:30', now);
  assert.equal(hm?.getHours(), 16);
  assert.equal(hm?.getMinutes(), 30);

  // Nothing parseable
  assert.equal(parseClaudeResetAt('You have hit your usage limit.', now), null);
}

function testQuotaErrorShape() {
  const reset = new Date(Date.now() + 3600_000);
  const err = new QuotaError('Claude', 'usage limit reached', { resetAt: reset });
  assert.equal(err.service, 'Claude');
  assert.equal(err.resetAt, reset);
  assert.match(err.message, /Claude quota exhausted/);

  // resetAt optional / invalid dates normalized to null
  assert.equal(new QuotaError('DeepSeek', 'x').resetAt, null);
  assert.equal(new QuotaError('Claude', 'x', { resetAt: new Date('invalid') }).resetAt, null);

  // Console message mentions automatic resume
  const msg = formatQuotaMessage(err, reset);
  assert.match(msg, /resume automatically/);
  assert.match(msg, new RegExp(reset.toISOString().slice(0, 10)));
}

testDefaultRoutes();
testEnvOverrides();
testInvalidRoutes();
testLimitMessageDetection();
testResetTimeParsing();
testQuotaErrorShape();

console.log('agent-llm.test.js passed');
