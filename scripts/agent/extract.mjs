/**
 * extract.mjs — L3 DeepSeek extractor for the autonomous crawl agent.
 *
 * Extracts resolved automotive diagnostic cases from classified forum threads.
 *
 * Usage:
 *   import { extractCases } from './extract.mjs';
 */

import { assertDeepSeekNotQuotaError } from './quota.mjs';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const EXTRACTOR_MAX_TOKENS = 2600;
const EXTRACTOR_TEMPERATURE = 0.2;

// Known brands for prompt hint
const KNOWN_BRANDS = [
  'Audi', 'BMW', 'Citroën', 'Dacia', 'Fiat', 'Ford', 'Honda', 'Hyundai',
  'Jeep', 'Kia', 'Mazda', 'Mercedes-Benz', 'Mitsubishi', 'Nissan', 'Opel',
  'Peugeot', 'Renault', 'Seat', 'Suzuki', 'Škoda', 'Toyota', 'Volkswagen', 'Volvo',
];

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
        temperature: EXTRACTOR_TEMPERATURE,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return (data?.choices?.[0]?.message?.content ?? '').toString().trim();
    }

    const body = await res.text().catch(() => '');

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
// Extractor prompt
// ---------------------------------------------------------------------------

const MAX_THREAD_TEXT_CHARS = 150_000;

function buildExtractorPrompt(threadText, evidencePostNumbers = []) {
  const text = threadText.length > MAX_THREAD_TEXT_CHARS
    ? threadText.slice(0, MAX_THREAD_TEXT_CHARS) + '\n\n[... truncated — thread too long ...]'
    : threadText;

  const evidenceHint = evidencePostNumbers.length > 0
    ? `Classifier evidence post numbers: ${evidencePostNumbers.join(', ')}`
    : '';

  return `You extract one or more high-confidence resolved automotive diagnostic cases from a forum thread.
Return ONLY a JSON array, no other text.

Rules:
- Do not guess or infer missing facts.
- Each case must belong to one forum user: the same user must explicitly describe the fault/symptoms and later confirm the successful repair for that same case.
- The case author does NOT need to be the original thread author.
- A thread may contain multiple independent resolved cases from different users. Return all qualifying cases.
- Ignore advice-only replies, guesses, or cases where another user suggests a fix but the reporting user never confirms it.
- Use classifier evidence posts as hints, but you may use other posts if they clearly form a valid same-user case.
- If any required field is ambiguous for one case, omit that case but continue extracting other clear cases.
- If there are no clear cases, return [].
- Translate symptoms, description, and resolution to English.
- If mileage is explicitly mentioned, extract it as an integer number of kilometers (e.g., 185000).
- Normalize OBD codes to uppercase format like P0401. If none are present, use [].

Output schema:
[{"case_author":"","fault_post_numbers":[],"resolution_post_numbers":[],"brand_raw":"","model_raw":"","engine_raw":"","engine_code_raw":"","mileage":null,"symptoms":[],"obd_codes":[],"description":"","resolution":"","closed_at":""}]

Notes:
- brand_raw should be one of these if possible: ${KNOWN_BRANDS.join(', ')}
- engine_raw can be something like '2.0 TDI CR' or include kW/hp if present.
- engine_code_raw can be codes like 'CUNA' if present, otherwise ''.
- closed_at should be the date of the resolving post if present, otherwise ''.
${evidenceHint ? `- ${evidenceHint}` : ''}

Forum thread text:
${text}`;
}

// ---------------------------------------------------------------------------
// Parse extractor response
// ---------------------------------------------------------------------------

function parseExtractorResponse(raw) {
  const text = (raw || '').trim();

  // Find JSON array
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return [];

  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => item && typeof item === 'object');
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract resolved cases from a classified forum thread.
 *
 * @param {string} threadText - Assembled thread text
 * @param {object} classifierResult - Result from classifyThread()
 * @param {object} [options]
 * @param {string} options.apiKey - DeepSeek API key
 * @param {string} [options.model] - Model name
 * @returns {Promise<Array<object>>} - Array of extracted case objects
 */
export async function extractCases(threadText, classifierResult, options = {}) {
  const apiKey = options.apiKey || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not set');

  const evidencePosts = classifierResult?.evidence_post_numbers || [];
  const prompt = buildExtractorPrompt(threadText, evidencePosts);

  const raw = await deepseekChat({
    apiKey,
    model: options.model || 'deepseek-chat',
    prompt,
    maxTokens: EXTRACTOR_MAX_TOKENS,
  });

  return parseExtractorResponse(raw);
}
