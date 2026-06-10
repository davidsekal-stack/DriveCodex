import assert from 'node:assert/strict';
import {
  buildClaudeRunSpec,
  buildChildEnv,
  parseClaudeEnvelope,
  assertClaudeEnvelopeOk,
} from '../scripts/agent/claude-cli.mjs';

function testWindowsSpec() {
  const spec = buildClaudeRunSpec({ model: 'haiku', platform: 'win32' });

  assert.equal(spec.command, 'powershell.exe');
  assert.deepEqual(spec.args.slice(0, 6), [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
  ]);
  assert.match(spec.args[6], /\[Console\]::In\.ReadToEnd\(\)/);
  assert.match(spec.args[6], /claude -p --output-format json --model 'haiku'/);
  // $OutputEncoding governs the pipe INTO the native exe — without BOM-less
  // UTF-8 here, WinPS 5.1 defaults to US-ASCII and Czech text becomes '?'
  assert.match(spec.args[6], /\$OutputEncoding = New-Object System\.Text\.UTF8Encoding \$false/);
  assert.match(spec.args[6], /\[Console\]::InputEncoding = New-Object System\.Text\.UTF8Encoding \$false/);
}

function testPosixSpec() {
  const spec = buildClaudeRunSpec({ model: 'sonnet', platform: 'linux' });

  assert.equal(spec.command, 'claude');
  assert.deepEqual(spec.args, ['-p', '--output-format', 'json', '--model', 'sonnet']);
}

function testModelRequired() {
  assert.throws(() => buildClaudeRunSpec({ platform: 'win32' }), /requires a model/);
}

function testChildEnvSanitization() {
  // Nested inside a Claude Code session → session vars must be stripped
  const nested = buildChildEnv({
    PATH: 'C:\\bin',
    CLAUDECODE: '1',
    ANTHROPIC_BASE_URL: 'http://localhost:1234',
    ANTHROPIC_API_KEY: 'sk-session',
    CLAUDE_CODE_SESSION_ID: 'abc',
    DEEPSEEK_API_KEY: 'ds-key',
  });
  assert.equal(nested.PATH, 'C:\\bin');
  assert.equal(nested.DEEPSEEK_API_KEY, 'ds-key');
  assert.equal(nested.CLAUDECODE, undefined);
  assert.equal(nested.ANTHROPIC_BASE_URL, undefined);
  assert.equal(nested.ANTHROPIC_API_KEY, undefined);
  assert.equal(nested.CLAUDE_CODE_SESSION_ID, undefined);

  // Clean scheduled-task environment → left untouched
  const clean = buildChildEnv({ PATH: 'C:\\bin', ANTHROPIC_API_KEY: 'sk-own' });
  assert.equal(clean.ANTHROPIC_API_KEY, 'sk-own');
}

function testParseEnvelope() {
  const ok = parseClaudeEnvelope(
    '{"type":"result","is_error":false,"result":"PASS","usage":{"output_tokens":5},"total_cost_usd":0.001}'
  );
  assert.equal(ok.result, 'PASS');

  // Envelope preceded by warning noise on earlier lines
  const noisy = parseClaudeEnvelope(
    'Warning: something\n{"type":"result","is_error":false,"result":"OK"}'
  );
  assert.equal(noisy.result, 'OK');

  assert.equal(parseClaudeEnvelope(''), null);
  assert.equal(parseClaudeEnvelope('not json at all'), null);
  // Non-result JSON (e.g. a bare error object) must not pass as an envelope
  assert.equal(parseClaudeEnvelope('{"error":{"message":"boom"}}'), null);
}

function testEnvelopeErrors() {
  // Success passes through
  const ok = { type: 'result', is_error: false, result: 'hello' };
  assert.equal(assertClaudeEnvelopeOk(ok), ok);

  // Usage limit → QuotaError with resetAt from epoch
  const futureEpoch = Math.floor(Date.now() / 1000) + 3600;
  try {
    assertClaudeEnvelopeOk({
      type: 'result',
      is_error: true,
      result: `Claude AI usage limit reached|${futureEpoch}`,
    });
    assert.fail('expected QuotaError');
  } catch (err) {
    assert.equal(err.name, 'QuotaError');
    assert.equal(err.service, 'Claude');
    assert.ok(err.resetAt instanceof Date);
    assert.equal(Math.floor(err.resetAt.getTime() / 1000), futureEpoch);
  }

  // 429 without recognizable text → still QuotaError
  try {
    assertClaudeEnvelopeOk({ type: 'result', is_error: true, api_error_status: 429, result: 'too many requests' });
    assert.fail('expected QuotaError');
  } catch (err) {
    assert.equal(err.name, 'QuotaError');
    assert.equal(err.resetAt, null);
  }

  // 401 → actionable auth error, NOT a quota error
  try {
    assertClaudeEnvelopeOk({ type: 'result', is_error: true, api_error_status: 401, result: 'Failed to authenticate' });
    assert.fail('expected Error');
  } catch (err) {
    assert.equal(err.name, 'Error');
    assert.match(err.message, /not authenticated/);
  }

  // Other errors → plain Error with detail
  try {
    assertClaudeEnvelopeOk({ type: 'result', is_error: true, result: 'something exploded' });
    assert.fail('expected Error');
  } catch (err) {
    assert.equal(err.name, 'Error');
    assert.match(err.message, /something exploded/);
  }

  // Forum text echoing limit-like words must NOT trip detection on success results
  const echo = { type: 'result', is_error: false, result: 'The user wrote: I hit my usage limit on the dyno...' };
  assert.equal(assertClaudeEnvelopeOk(echo), echo);
}

testWindowsSpec();
testPosixSpec();
testModelRequired();
testChildEnvSanitization();
testParseEnvelope();
testEnvelopeErrors();

console.log('agent-claude-cli.test.js passed');
