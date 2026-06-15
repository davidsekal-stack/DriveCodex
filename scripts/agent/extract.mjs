/**
 * extract.mjs — L3 case extractor for the autonomous crawl agent.
 *
 * Extracts resolved automotive diagnostic cases from classified forum threads
 * using the routed LLM (default: Claude Sonnet via the Claude Code CLI — see
 * llm.mjs).
 *
 * Usage:
 *   import { extractCases } from './extract.mjs';
 */

import { runLlm } from './llm.mjs';

const EXTRACTOR_MAX_TOKENS = 2600;
const EXTRACTOR_TEMPERATURE = 0.2;

// Known brands for prompt hint
const KNOWN_BRANDS = [
  'Audi', 'BMW', 'Citroën', 'Dacia', 'Fiat', 'Ford', 'Honda', 'Hyundai',
  'Jeep', 'Kia', 'Mazda', 'Mercedes-Benz', 'Mitsubishi', 'Nissan', 'Opel',
  'Peugeot', 'Renault', 'Seat', 'Suzuki', 'Škoda', 'Toyota', 'Volkswagen', 'Volvo',
];

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
- VEHICLE IDENTIFICATION: the brand/model/engine is often stated in the THREAD TITLE or in a user's signature, NOT in the post body — on many forums the whole section is model-specific (e.g. a "1.9 TDi 81kW" subforum) or the title names the car. Read brand_raw/model_raw/engine_raw from the TITLE line and any signature text as valid EXPLICIT sources, not just the post body. This is not guessing — it is reading what is stated. Do not invent a vehicle that appears nowhere in the thread.
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
- symptoms must be SHORT (2–5 words each), standardized observable phenomena — what the driver sees, hears, feels, or smells. They are used as search tags, not prose.
  GOOD: ["knocking from front wheel", "noise on turns", "intermittent beep", "smoke near injector"]
  BAD:  ["Most noticeable around 80 km/h when going slightly into a turn", "rear parking sensor occasionally beeps"]
  Each symptom = one distinct observable thing. Strip context, conditions, and frequency — those belong in description.

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
 * Extract resolved cases from a classified forum thread using the routed LLM.
 *
 * @param {string} threadText - Assembled thread text
 * @param {object} classifierResult - Result from classifyThread()
 * @param {object} [options]
 * @param {string} [options.apiKey] - DeepSeek API key override (only used when
 *   the extract task is routed to DeepSeek)
 * @returns {Promise<Array<object>>} - Array of extracted case objects
 */
export async function extractCases(threadText, classifierResult, options = {}) {
  const evidencePosts = classifierResult?.evidence_post_numbers || [];
  const prompt = buildExtractorPrompt(threadText, evidencePosts);

  const raw = await runLlm('extract', prompt, {
    maxTokens: EXTRACTOR_MAX_TOKENS,
    temperature: EXTRACTOR_TEMPERATURE,
    apiKey: options.apiKey,
  });

  return parseExtractorResponse(raw);
}
