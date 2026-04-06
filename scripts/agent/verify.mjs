/**
 * L5 Codex verifier module for the autonomous crawl agent.
 *
 * Calls `codex exec` CLI as a subprocess to independently verify extracted
 * automotive cases against original thread text.
 *
 * Usage:
 *   import { verifyCase, verifyBatch } from './verify.mjs';
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { assertCodexNotQuotaError } from './quota.mjs';

const execFile = promisify(execFileCb);

const DEFAULT_TIMEOUT_MS = 120_000;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(threadText, extractedCase) {
  // Support both raw extractor field names (brand_raw) and resolved names (vehicle_brand)
  const brand    = extractedCase.vehicle_brand || extractedCase.brand_raw   || 'unknown';
  const model    = extractedCase.vehicle_model || extractedCase.model_raw   || 'unknown';
  const engine   = extractedCase.engine_power  || extractedCase.engine_raw  || '';
  const symptoms = (extractedCase.symptoms || []).join(', ') || 'none';
  const codes    = (extractedCase.obd_codes || []).join(', ') || 'none';
  const desc     = extractedCase.description     || '';
  const reso     = extractedCase.resolution      || '';

  return [
    'You are a quality auditor for an automotive diagnostic database.',
    'Your ONLY job is to verify that the extracted case below accurately reflects what is written in the original forum thread.',
    '',
    'ORIGINAL THREAD:',
    '---',
    threadText,
    '---',
    '',
    'EXTRACTED CASE:',
    `  Vehicle: ${brand} ${model} ${engine}`.trimEnd(),
    `  Symptoms: ${symptoms}`,
    `  OBD Codes: ${codes}`,
    `  Description: ${desc}`,
    `  Resolution: ${reso}`,
    '',
    'VERIFY each claim against the thread text above. Answer with EXACTLY one line:',
    '',
    'PASS — if ALL of the following are true:',
    '  1. The resolution was actually performed (not just suggested or planned)',
    '  2. The same person or a later reply confirms it fixed the problem',
    '  3. The vehicle info matches what is discussed in the thread',
    '  4. The symptoms accurately reflect the original complaint',
    '  5. The resolution is specific enough to be actionable',
    '',
    'NOTE: "OBD Codes: none" means no codes were extracted — this is acceptable if the',
    'thread does not explicitly mention specific OBD/DTC codes. Do NOT fail for this alone.',
    '',
    'FAIL: {specific reason} — if ANY condition above is violated.',
    '',
    'Your response must be exactly one line starting with PASS or FAIL.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Parse Codex output
// ---------------------------------------------------------------------------

function parseVerdict(raw) {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.startsWith('PASS')) {
      return { verdict: 'PASS', reason: 'Verified by Codex' };
    }
    if (line.startsWith('FAIL')) {
      const reason = line.replace(/^FAIL[:\s—–-]*/, '').trim() || 'No reason provided';
      return { verdict: 'FAIL', reason };
    }
  }
  return { verdict: 'FAIL', reason: 'Codex output did not contain a PASS/FAIL verdict' };
}

// ---------------------------------------------------------------------------
// Single-case verification
// ---------------------------------------------------------------------------

/**
 * Verify a single extracted case against the original thread text using
 * Codex CLI.
 *
 * @param {string} threadText - The original forum thread text
 * @param {object} extractedCase - The extracted case object with fields:
 *   vehicle_brand, vehicle_model, engine_power, symptoms[], obd_codes[],
 *   description, resolution
 * @param {object} [options] - Optional settings
 * @param {number} [options.timeoutMs=120000] - Timeout in ms
 * @returns {Promise<{ verdict: 'PASS'|'FAIL', reason: string }>}
 */
export async function verifyCase(threadText, extractedCase, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const id = randomUUID().slice(0, 8);
  const promptFile = join(tmpdir(), `codex-verify-prompt-${id}.txt`);
  const outFile    = join(tmpdir(), `codex-verify-out-${id}.txt`);

  try {
    // Write full prompt to temp file (thread text can be 10K+)
    const prompt = buildPrompt(threadText, extractedCase);
    await writeFile(promptFile, prompt, 'utf-8');

    // Call codex exec, piping prompt via stdin redirect
    // Shell form: codex exec --sandbox read-only --ephemeral -o <outfile> < <promptfile>
    await execFile('bash', [
      '-c',
      `codex exec --sandbox read-only --ephemeral -o "${outFile}" < "${promptFile}"`,
    ], {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,  // 10 MB
    });

    // Read and parse the output file
    const raw = await readFile(outFile, 'utf-8');
    // Check for quota exhaustion in output before parsing verdict
    assertCodexNotQuotaError(raw);
    return parseVerdict(raw);
  } catch (err) {
    const isTimeout = err.killed || err.code === 'ETIMEDOUT';
    return {
      verdict: 'FAIL',
      reason: isTimeout
        ? 'Codex timeout'
        : `Codex error: ${err.message || String(err)}`,
    };
  } finally {
    // Cleanup temp files (best-effort)
    await unlink(promptFile).catch(() => {});
    await unlink(outFile).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Batch verification with concurrency control
// ---------------------------------------------------------------------------

/**
 * Verify multiple cases, with concurrency limit.
 *
 * @param {Array<{ threadText: string, case: object }>} items
 * @param {object} [options]
 * @param {number} [options.concurrency=1] - Max parallel Codex calls
 * @param {number} [options.timeoutMs=120000]
 * @returns {Promise<Array<{ case: object, verdict: 'PASS'|'FAIL', reason: string }>>}
 */
export async function verifyBatch(items, options = {}) {
  const concurrency = options.concurrency ?? 1;
  const timeoutMs   = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      const item = items[idx];
      const { verdict, reason } = await verifyCase(
        item.threadText,
        item.case,
        { timeoutMs },
      );
      results[idx] = { case: item.case, verdict, reason };
    }
  }

  // Launch `concurrency` workers in parallel
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return results;
}
