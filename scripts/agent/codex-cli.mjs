import { readFile } from 'node:fs/promises';
import { spawnManaged, terminateProcessTree } from './process-utils.mjs';

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function buildCodexRunSpec({ outFile, sandbox = null, platform = process.platform }) {
  if (platform === 'win32') {
    const sandboxPart = sandbox ? ` --sandbox ${psQuote(sandbox)}` : '';
    const script = `$prompt = [Console]::In.ReadToEnd(); $prompt | codex exec${sandboxPart} --ephemeral -o ${psQuote(outFile)}`;
    return {
      command: 'powershell.exe',
      args: [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        script,
      ],
    };
  }

  const args = ['exec'];
  if (sandbox) args.push('--sandbox', sandbox);
  args.push('--ephemeral', '-o', outFile);
  return { command: 'codex', args };
}

function spawnWithInput(command, args, input, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawnManaged(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      terminateProcessTree(child);
    }, timeoutMs);

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.on('error', err => {
      clearTimeout(timer);
      err.stdout = stdout;
      err.stderr = stderr;
      reject(err);
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (timedOut) {
        const err = new Error(`Command timed out after ${timeoutMs}ms`);
        err.code = 'ETIMEDOUT';
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
        return;
      }
      if (code !== 0) {
        const detail = (stderr || stdout).trim().slice(0, 400);
        const err = new Error(
          detail
            ? `Command failed with exit code ${code}: ${detail}`
            : `Command failed with exit code ${code}`
        );
        err.code = code;
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
        return;
      }
      resolve(stdout + stderr);
    });

    child.stdin.end(input, 'utf-8');
  });
}

export async function runCodexPrompt(prompt, { outFile, timeoutMs = 120_000, sandbox = null } = {}) {
  if (!outFile) throw new Error('runCodexPrompt requires outFile');

  const spec = buildCodexRunSpec({ outFile, sandbox });

  try {
    const runnerOutput = await spawnWithInput(spec.command, spec.args, prompt, timeoutMs);
    const fileOutput = await readFile(outFile, 'utf-8').catch(() => '');
    return fileOutput || runnerOutput;
  } catch (err) {
    const fileOutput = await readFile(outFile, 'utf-8').catch(() => '');
    err.output = fileOutput || err.stderr || err.stdout || '';
    throw err;
  }
}
