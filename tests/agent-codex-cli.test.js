import assert from 'node:assert/strict';
import { buildCodexRunSpec } from '../scripts/agent/codex-cli.mjs';

function testWindowsSpec() {
  const spec = buildCodexRunSpec({
    outFile: 'C:\\temp\\agent-output.txt',
    sandbox: 'read-only',
    platform: 'win32',
  });

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
  assert.match(spec.args[6], /codex exec/);
  assert.match(spec.args[6], /--sandbox 'read-only'/);
  assert.match(spec.args[6], /-o 'C:\\temp\\agent-output\.txt'/);
}

function testPosixSpec() {
  const spec = buildCodexRunSpec({
    outFile: '/tmp/agent-output.txt',
    sandbox: 'read-only',
    platform: 'linux',
  });

  assert.equal(spec.command, 'codex');
  assert.deepEqual(spec.args, [
    'exec',
    '--sandbox',
    'read-only',
    '--ephemeral',
    '-o',
    '/tmp/agent-output.txt',
  ]);
}

testWindowsSpec();
testPosixSpec();

console.log('agent-codex-cli.test.js passed');
