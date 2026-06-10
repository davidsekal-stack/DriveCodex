/**
 * claude-cli.mjs — Headless Claude Code CLI runner.
 *
 * Spawns `claude -p --output-format json` with the prompt on stdin and parses
 * the structured JSON result envelope. Used for all Claude-routed LLM tasks
 * (classification, extraction, calibration, diary — see llm.mjs).
 *
 * Auth comes from the user's Claude subscription login (`claude` in a plain
 * terminal, one-time). No API key is needed or used.
 */

import { spawnManaged, terminateProcessTree } from './process-utils.mjs';
import { QuotaError, isClaudeLimitMessage, parseClaudeResetAt } from './quota.mjs';

// Generous: CLI cold start + Sonnet generation over a 150K-char thread.
// Transient timeouts no longer bury threads (one retry, see orchestrator).
const DEFAULT_TIMEOUT_MS = 300_000;

// Env vars injected by a parent Claude Code session. When the crawler is
// started from inside a Claude Code conversation (CLAUDECODE=1), these
// redirect the child CLI to the session's proxy and break its own auth —
// strip them so behavior matches a clean Task Scheduler run.
const SESSION_ENV_VARS = [
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'CLAUDECODE',
  'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_CODE_EXECPATH',
  'CLAUDE_CODE_SDK_HAS_HOST_AUTH_REFRESH',
  'CLAUDE_CODE_SDK_HAS_OAUTH_REFRESH',
  'CLAUDE_CODE_EMIT_TOOL_USE_SUMMARIES',
  'CLAUDE_CODE_ENABLE_ASK_USER_QUESTION_TOOL',
  'CLAUDE_CODE_DISABLE_CRON',
  'CLAUDE_AGENT_SDK_VERSION',
  'CLAUDE_EFFORT',
  'BAGGAGE',
  'AI_AGENT',
];

export function buildChildEnv(baseEnv = process.env) {
  // Only sanitize when actually nested inside a Claude Code session;
  // a normal scheduled-task environment is left untouched.
  if (!baseEnv.CLAUDECODE && !baseEnv.ANTHROPIC_BASE_URL) {
    return { ...baseEnv };
  }
  const env = { ...baseEnv };
  for (const key of SESSION_ENV_VARS) delete env[key];
  return env;
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function buildClaudeRunSpec({ model, platform = process.platform }) {
  if (!model) throw new Error('buildClaudeRunSpec requires a model');

  if (platform === 'win32') {
    // Three encodings must all be UTF-8 (BOM-less) for Czech text to survive:
    // $OutputEncoding governs the `$prompt | claude` pipe INTO the native exe
    // (WinPS 5.1 default is US-ASCII → diacritics become '?'), InputEncoding
    // decodes our stdin, OutputEncoding decodes the CLI's stdout. The Console
    // setters can throw on exotic console states, so they are best-effort.
    const script =
      `$OutputEncoding = New-Object System.Text.UTF8Encoding $false; ` +
      `try { [Console]::InputEncoding = New-Object System.Text.UTF8Encoding $false; [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false } catch {}; ` +
      `$prompt = [Console]::In.ReadToEnd(); $prompt | claude -p --output-format json --model ${psQuote(model)}`;
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

  return {
    command: 'claude',
    args: ['-p', '--output-format', 'json', '--model', model],
  };
}

/**
 * Parse the CLI's JSON result envelope from stdout.
 * Expected shape: { type: "result", is_error, result, usage, total_cost_usd, ... }
 */
export function parseClaudeEnvelope(stdout) {
  const text = (stdout ?? '').toString().trim();
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && parsed.type === 'result') return parsed;
  } catch { /* fall through to line scan */ }

  // Robustness: scan lines from the end for the envelope (warnings may precede it)
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith('{')) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === 'object' && parsed.type === 'result') return parsed;
    } catch { /* keep scanning */ }
  }
  return null;
}

/**
 * Inspect a parsed envelope for errors. Throws QuotaError on usage limits
 * (with resetAt when parseable), a regular Error on other CLI failures.
 * Returns the envelope when it represents a successful result.
 */
export function assertClaudeEnvelopeOk(envelope) {
  if (!envelope) throw new Error('claude CLI returned no parseable JSON result');

  if (envelope.is_error) {
    const message = (envelope.result ?? '').toString();
    if (envelope.api_error_status === 429 || isClaudeLimitMessage(message)) {
      throw new QuotaError('Claude', message.slice(0, 200), {
        resetAt: parseClaudeResetAt(message),
      });
    }
    if (envelope.api_error_status === 401) {
      throw new Error(
        'claude CLI is not authenticated (401). Open a plain terminal, run `claude`, and log in once.'
      );
    }
    throw new Error(`claude CLI error: ${message.slice(0, 300) || envelope.subtype || 'unknown'}`);
  }

  return envelope;
}

function spawnWithInput(command, args, input, timeoutMs, env) {
  return new Promise((resolve, reject) => {
    const child = spawnManaged(command, args, { stdio: ['pipe', 'pipe', 'pipe'], env });
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      terminateProcessTree(child);
    }, timeoutMs);

    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', err => {
      clearTimeout(timer);
      err.stdout = stdout;
      err.stderr = stderr;
      reject(err);
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (timedOut) {
        const err = new Error(`claude CLI timed out after ${timeoutMs}ms`);
        err.code = 'ETIMEDOUT';
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
        return;
      }
      // Nonzero exit still usually carries a JSON envelope on stdout
      // (e.g. is_error results) — let the caller parse it either way.
      resolve({ code, stdout, stderr });
    });

    // EPIPE when the child exits before draining a large prompt (timeout kill,
    // CLI startup failure) — the close handler reports the real failure
    child.stdin.on('error', () => {});
    child.stdin.end(input, 'utf-8');
  });
}

/**
 * Run a single prompt through the Claude Code CLI.
 *
 * @param {string} prompt
 * @param {object} options
 * @param {string} options.model - 'haiku' | 'sonnet' | 'opus' | full model id
 * @param {number} [options.timeoutMs]
 * @returns {Promise<{ text: string, usage: object|null, costUsd: number|null }>}
 * @throws {QuotaError} on subscription usage limits
 */
export async function runClaudePrompt(prompt, { model, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!model) throw new Error('runClaudePrompt requires a model');

  const spec = buildClaudeRunSpec({ model });
  const env = buildChildEnv();
  const { code, stdout, stderr } = await spawnWithInput(spec.command, spec.args, prompt, timeoutMs, env);

  const envelope = parseClaudeEnvelope(stdout);
  if (!envelope) {
    // Without an envelope, stdout/stderr is pure CLI diagnostics (model output
    // only ever exists inside an envelope's result field with --output-format
    // json), so limit detection on the raw text is false-positive-safe here.
    const combined = `${stderr || ''}\n${stdout || ''}`;
    if (isClaudeLimitMessage(combined)) {
      throw new QuotaError('Claude', combined.trim().slice(0, 200), {
        resetAt: parseClaudeResetAt(combined),
      });
    }
    const detail = combined.trim().slice(0, 300);
    throw new Error(
      detail
        ? `claude CLI produced no JSON result (exit ${code}): ${detail}`
        : `claude CLI produced no JSON result (exit ${code})`
    );
  }

  assertClaudeEnvelopeOk(envelope);
  return {
    text: (envelope.result ?? '').toString(),
    usage: envelope.usage ?? null,
    costUsd: envelope.total_cost_usd ?? null,
  };
}
