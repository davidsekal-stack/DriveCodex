/**
 * classify.mjs — L2 DeepSeek classifier for the autonomous crawl agent.
 *
 * Calls DeepSeek API to determine if a forum thread contains at least one
 * extractable resolved automotive diagnostic case.
 *
 * Usage:
 *   import { classifyThread, isClassifierApproved } from './classify.mjs';
 */

import { assertDeepSeekNotQuotaError } from './quota.mjs';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const CLASSIFIER_MAX_TOKENS = 900;
const CLASSIFIER_TEMPERATURE = 0.2;

// ---------------------------------------------------------------------------
// DeepSeek API call
// ---------------------------------------------------------------------------

async function deepseekChat({ apiKey, model = 'deepseek-chat', prompt, maxTokens }) {
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: CLASSIFIER_TEMPERATURE,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return (data?.choices?.[0]?.message?.content ?? '').toString().trim();
    }

    // Retry on rate limit or server errors
    const body = await res.text().catch(() => '');

    // Check for quota/billing exhaustion BEFORE retry — these are permanent, not transient
    assertDeepSeekNotQuotaError(res.status, body);

    if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
      const wait = Math.min(2000 * Math.pow(2, attempt), 30_000);
      console.log(`  DeepSeek ${res.status}, retry in ${wait}ms...`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }

    throw new Error(`DeepSeek API error (${res.status}): ${body.slice(0, 300)}`);
  }
}

// ---------------------------------------------------------------------------
// Classifier prompt
// ---------------------------------------------------------------------------

// DeepSeek context is ~64K tokens ≈ ~200K chars. Leave room for prompt template + output.
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
- should_seed should focus on whether the thread contains at least one usable resolved case.
- has_required_fields means forum context plus thread text explicitly contain enough information for at least one case: brand, model, engine, symptoms, description, and confirmed resolution.
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
 * Classify a forum thread using DeepSeek.
 *
 * @param {string} threadText - Assembled thread text (POST 1 | ... format)
 * @param {object} [options]
 * @param {string} options.apiKey - DeepSeek API key (default: env DEEPSEEK_API_KEY)
 * @param {string} [options.model] - Model name (default: deepseek-chat)
 * @returns {Promise<{ approved: boolean, result: object, reason: string }>}
 */
export async function classifyThread(threadText, options = {}) {
  const apiKey = options.apiKey || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not set');

  const prompt = buildClassifierPrompt(threadText);
  const raw = await deepseekChat({
    apiKey,
    model: options.model || 'deepseek-chat',
    prompt,
    maxTokens: CLASSIFIER_MAX_TOKENS,
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
