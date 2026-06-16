/**
 * classify.mjs — L2 thread classifier for the autonomous crawl agent.
 *
 * Asks the routed LLM (default: Claude Haiku via the Claude Code CLI — see
 * llm.mjs) whether a forum thread contains at least one extractable resolved
 * automotive diagnostic case.
 *
 * Usage:
 *   import { classifyThread, isClassifierApproved } from './classify.mjs';
 */

import { runLlm } from './llm.mjs';

const CLASSIFIER_MAX_TOKENS = 900;
const CLASSIFIER_TEMPERATURE = 0.2;

// ---------------------------------------------------------------------------
// Classifier prompt
// ---------------------------------------------------------------------------

// Keep thread text within the smallest routed model's context (~64K tokens
// ≈ ~200K chars for deepseek-v4-flash; Claude models allow more). Leave room for
// the prompt template + output.
const MAX_THREAD_TEXT_CHARS = 150_000;

function buildClassifierPrompt(threadText) {
  const text = threadText.length > MAX_THREAD_TEXT_CHARS
    ? threadText.slice(0, MAX_THREAD_TEXT_CHARS) + '\n\n[... truncated — thread too long ...]'
    : threadText;

  return `You are an automotive forum thread classifier for seed data quality control.
Return ONLY one JSON object, no other text.

Rules:
- Do not guess or infer missing facts.
- Approve the thread if it contains at least one extractable resolved automotive case.
- A valid case means one forum user explicitly describes their own vehicle fault/symptoms and later confirms the successful repair for that same case.
- The confirming user does NOT need to be the original thread author.
- A thread may contain multiple independent resolved cases from different users. That is allowed.
- Ignore unresolved side discussions, guesses, or advice-only replies if at least one valid case exists.
- same_user_confirms_resolution must be true only if at least one valid case has the same reporting user and confirming user.

JSON schema:
{"should_seed":false,"is_relevant":false,"has_explicit_fault":false,"has_confirmed_resolution":false,"same_user_confirms_resolution":false,"has_required_fields":false,"reason":"","evidence_post_numbers":[]}

Definitions:
- should_seed should focus on whether the thread contains at least one usable resolved case. Do NOT set should_seed false solely because engine/displacement, mileage, or OBD codes are unstated — those are optional metadata, not part of the resolved-case requirement.
- has_required_fields means forum context plus thread text explicitly contain enough information for at least one case: brand, model, symptoms, description, and confirmed resolution. Engine/displacement is OPTIONAL: do NOT require it for faults that are independent of the engine (e.g. starter, battery, alternator, lighting, body/trim, central locking, windows, wipers, door locks, infotainment). Expect engine only when the fault is engine-related (e.g. misfire, oil/coolant consumption, turbo, DPF/EGR, timing).
- evidence_post_numbers should list the post numbers that support at least one valid case.

Forum thread text:
${text}`;
}

// ---------------------------------------------------------------------------
// Parse classifier response
// ---------------------------------------------------------------------------

function parseClassifierResponse(raw) {
  const text = (raw || '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Classifier approval gate
// ---------------------------------------------------------------------------

function normalizeEvidencePosts(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(v => (typeof v === 'string' ? parseInt(v, 10) : Number(v)))
    .filter(n => Number.isFinite(n) && n > 0);
}

/**
 * Deterministic check: did the classifier approve this thread?
 */
export function isClassifierApproved(result) {
  return !!(
    result &&
    result.should_seed === true &&
    result.is_relevant === true &&
    result.has_explicit_fault === true &&
    result.has_confirmed_resolution === true &&
    result.same_user_confirms_resolution === true &&
    normalizeEvidencePosts(result.evidence_post_numbers).length > 0
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify a forum thread using the routed LLM (see llm.mjs).
 *
 * @param {string} threadText - Assembled thread text (POST 1 | ... format)
 * @param {object} [options]
 * @param {string} [options.apiKey] - DeepSeek API key override (only used when
 *   the classify task is routed to DeepSeek)
 * @returns {Promise<{ approved: boolean, result: object, reason: string }>}
 */
export async function classifyThread(threadText, options = {}) {
  const prompt = buildClassifierPrompt(threadText);
  const raw = await runLlm('classify', prompt, {
    maxTokens: CLASSIFIER_MAX_TOKENS,
    temperature: CLASSIFIER_TEMPERATURE,
    apiKey: options.apiKey,
  });

  const result = parseClassifierResponse(raw);
  if (!result) {
    return { approved: false, result: null, reason: 'Failed to parse classifier response' };
  }

  const approved = isClassifierApproved(result);
  return {
    approved,
    result,
    reason: result.reason || (approved ? 'Approved' : 'Did not meet classifier gates'),
    evidence_post_numbers: normalizeEvidencePosts(result.evidence_post_numbers),
  };
}
