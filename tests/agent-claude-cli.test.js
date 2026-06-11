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

function testAllowedTools() {
  // POSIX: --allowedTools passed as a joined arg
  const posix = buildClaudeRunSpec({ model: 'sonnet', platform: 'linux', allowedTools: ['WebSearch', 'WebFetch'] });
  const idx = posix.args.indexOf('--allowedTools');
  assert.ok(idx !== -1);
  assert.equal(posix.args[idx + 1], 'WebSearch,WebFetch');

  // win32: embedded in the PS command string
  const win = buildClaudeRunSpec({ model: 'sonnet', platform: 'win32', allowedTools: ['WebSearch'] });
  assert.match(win.args[6], /--allowedTools 'WebSearch'/);

  // No tools → no flag
  const none = buildClaudeRunSpec({ model: 'haiku', platform: 'linux' });
  assert.equal(none.args.includes('--allowedTools'), false);

  // Injection-shaped tool names are dropped (closed vocabulary)
  const dirty = buildClaudeRunSpec({ model: 'haiku', platform: 'linux', allowedTools: ["WebSearch'; rm -rf /", 'Bad Tool', 'WebFetch'] });
  const di = dirty.args.indexOf('--allowedTools');
  assert.equal(dirty.args[di + 1], 'WebFetch', 'only the clean tool name survives');
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

  // 401/403 → AuthError (agent-stopping, needs human re-login), NOT quota
  for (const status of [401, 403]) {
    try {
      assertClaudeEnvelopeOk({ type: 'result', is_error: true, api_error_status: status, result: 'Failed to authenticate' });
      assert.fail('expected AuthError');
    } catch (err) {
      assert.equal(err.name, 'AuthError');
      assert.equal(err.service, 'Claude');
    }
  }

  // Auth detected from message text even without a status
  try {
    assertClaudeEnvelopeOk({ type: 'result', is_error: true, result: 'Invalid API key - run /login' });
    assert.fail('expected AuthError');
  } catch (err) {
    assert.equal(err.name, 'AuthError');
  }

  // 5xx / overloaded → transient-marked Error (so isTransientCrawlerError matches HTTP 5xx)
  try {
    assertClaudeEnvelopeOk({ type: 'result', is_error: true, api_error_status: 529, result: 'Overloaded' });
    assert.fail('expected Error');
  } catch (err) {
    assert.equal(err.name, 'Error');
    assert.match(err.message, /HTTP 529/);
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
testAllowedTools();
testChildEnvSanitization();
testParseEnvelope();
testEnvelopeErrors();

console.log('agent-claude-cli.test.js passed');
