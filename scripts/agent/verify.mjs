/**
 * L5 independent verifier module for the autonomous crawl agent.
 *
 * Audits extracted automotive cases against the original thread text using
 * the routed LLM (default: DeepSeek — deliberately a different vendor than
 * the Claude-based extractor, so the second opinion has independent blind
 * spots; see llm.mjs).
 *
 * Usage:
 *   import { verifyCase } from './verify.mjs';
 */

import { runLlm } from './llm.mjs';

const DEFAULT_TIMEOUT_MS = 120_000;
const VERIFIER_MAX_TOKENS = 300;

// Same cap as classify/extract: keeps the prompt inside the smallest routed
// model's context window. Previously verify embedded the thread untruncated,
// which could blow the context limit on long threads.
const MAX_THREAD_TEXT_CHARS = 150_000;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(threadText, extractedCase) {
  const text = threadText.length > MAX_THREAD_TEXT_CHARS
    ? threadText.slice(0, MAX_THREAD_TEXT_CHARS) + '\n\n[... truncated — thread too long ...]'
    : threadText;

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
    text,
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
// Parse verifier output
// ---------------------------------------------------------------------------

function parseVerdict(raw) {
  const lines = (raw || '').split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.startsWith('PASS')) {
      return { verdict: 'PASS', reason: 'Verified by independent AI auditor' };
    }
    if (line.startsWith('FAIL')) {
      const reason = line.replace(/^FAIL[:\s—–-]*/, '').trim() || 'No reason provided';
      return { verdict: 'FAIL', reason };
    }
  }
  return { verdict: 'FAIL', reason: 'Verifier output did not contain a PASS/FAIL verdict' };
}

// ---------------------------------------------------------------------------
// Single-case verification
// ---------------------------------------------------------------------------

/**
 * Verify a single extracted case against the original thread text.
 *
 * @param {string} threadText - The original forum thread text
 * @param {object} extractedCase - The extracted case object with fields:
 *   vehicle_brand, vehicle_model, engine_power, symptoms[], obd_codes[],
 *   description, resolution
 * @param {object} [options] - Optional settings
 * @param {number} [options.timeoutMs=120000] - Timeout in ms
 * @returns {Promise<{ verdict: 'PASS'|'FAIL', reason: string }>}
 * @throws {QuotaError} when the verifier's quota is exhausted; other errors
 *   also propagate so the orchestrator can mark the case verify_error
 *   (retryable) instead of permanently rejecting it.
 */
export async function verifyCase(threadText, extractedCase, options = {}) {
  const prompt = buildPrompt(threadText, extractedCase);
  const raw = await runLlm('verify', prompt, {
    maxTokens: VERIFIER_MAX_TOKENS,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
  return parseVerdict(raw);
}
