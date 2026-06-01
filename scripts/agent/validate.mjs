/**
 * validate.mjs — L4 deterministic gates for the autonomous crawl agent.
 *
 * Pure validation logic: no API calls, no side effects.
 * Checks extracted case completeness and quality before Codex verification.
 *
 * Usage:
 *   import { validateCase, isCompleteRecord } from './validate.mjs';
 */

// ---------------------------------------------------------------------------
// Unresolved resolution patterns — future tense / planned actions
// ---------------------------------------------------------------------------

const UNRESOLVED_RESOLUTION_PATTERNS = [
  /\bnap[ií][sš]u\b.{0,50}\b(?:jak|az|až)\b.{0,40}\bdopadlo\b/i,
  /\b(?:z[ií]tra|tomorrow)\b.{0,60}\b(?:bude|by mělo být|should be|will be)\b.{0,20}\bok\b/i,
  /\b(?:dnes|today)\b.{0,60}\b(?:odvezl|odvezla|took it in|taken in)\b.{0,80}\b(?:opravu|repair)\b/i,
  /\b(?:pl[aá]nuj(?:i|e)|planning to|plan to)\b.{0,80}\b(?:servis|service|electrician|repair|opravu)\b/i,
  /\b(?:will|nap[ií][sš]u)\b.{0,40}\b(?:update|let you know|report back)\b/i,
];

function hasUnresolvedResolutionLanguage(resolution) {
  const text = (resolution ?? '').toString().trim();
  if (!text) return false;
  return UNRESOLVED_RESOLUTION_PATTERNS.some(pattern => pattern.test(text));
}

// ---------------------------------------------------------------------------
// Completeness check
// ---------------------------------------------------------------------------

/**
 * Check if a record has all required fields for import.
 */
export function isCompleteRecord(rec) {
  if (!rec) return false;

  const brand = (rec.brand_raw || rec.vehicle_brand || '').trim();
  const model = (rec.model_raw || rec.vehicle_model || '').trim();
  const symptoms = Array.isArray(rec.symptoms) ? rec.symptoms.filter(s => s && s.trim()) : [];
  const description = (rec.description || '').trim();
  const resolution = (rec.resolution || '').trim();

  return (
    brand.length > 0 &&
    model.length > 0 &&
    symptoms.length >= 1 &&
    description.length > 0 &&
    resolution.length > 0
  );
}

// ---------------------------------------------------------------------------
// Post-author consistency validation
// ---------------------------------------------------------------------------

function parsePostMetaFromThreadText(threadText) {
  const map = new Map();
  for (const line of (threadText ?? '').toString().split(/\r?\n/)) {
    const match = line.match(/^POST\s+(\d+)\s*\|\s*(.+):\s*$/);
    if (!match) continue;
    const postNumber = Number(match[1]);
    const meta = match[2] ?? '';
    const authorMatch = meta.match(/\bauthor:\s*([^|]+?)(?=\s*\||$)/i);
    const isThreadAuthorMatch = meta.match(/\bis_thread_author:\s*(true|false)/i);
    if (!Number.isInteger(postNumber) || postNumber <= 0) continue;
    map.set(postNumber, {
      author: authorMatch?.[1]?.trim() ?? '',
      is_thread_author: isThreadAuthorMatch?.[1] === 'true',
    });
  }
  return map;
}

function normalizeText(s) {
  return (s ?? '')
    .toString()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Validate that fault and resolution posts belong to the same author.
 */
function validateCaseAuthor(item, postMetaByNumber) {
  if (!Array.isArray(item.fault_post_numbers) || item.fault_post_numbers.length === 0) {
    return { valid: false, reason: 'Missing fault_post_numbers' };
  }
  if (!Array.isArray(item.resolution_post_numbers) || item.resolution_post_numbers.length === 0) {
    return { valid: false, reason: 'Missing resolution_post_numbers' };
  }

  // Determine expected author
  const caseAuthor = (item.case_author || '').trim();
  if (!caseAuthor) {
    return { valid: false, reason: 'Missing case_author' };
  }

  const normAuthor = normalizeText(caseAuthor);

  // Check fault posts
  for (const pn of item.fault_post_numbers) {
    const postNumber = Number(pn);
    if (!Number.isInteger(postNumber) || postNumber <= 0) {
      return { valid: false, reason: `Invalid fault post number: ${pn}` };
    }
    const meta = postMetaByNumber.get(postNumber);
    if (!meta) {
      return { valid: false, reason: `Fault post ${pn} not found in thread` };
    }
    if (meta && meta.author && normalizeText(meta.author) !== normAuthor) {
      return { valid: false, reason: `Fault post ${pn} author mismatch: expected "${caseAuthor}", got "${meta.author}"` };
    }
  }

  // Check resolution posts
  for (const pn of item.resolution_post_numbers) {
    const postNumber = Number(pn);
    if (!Number.isInteger(postNumber) || postNumber <= 0) {
      return { valid: false, reason: `Invalid resolution post number: ${pn}` };
    }
    const meta = postMetaByNumber.get(postNumber);
    if (!meta) {
      return { valid: false, reason: `Resolution post ${pn} not found in thread` };
    }
    if (meta && meta.author && normalizeText(meta.author) !== normAuthor) {
      return { valid: false, reason: `Resolution post ${pn} author mismatch: expected "${caseAuthor}", got "${meta.author}"` };
    }
  }

  return { valid: true, reason: '' };
}

// ---------------------------------------------------------------------------
// Main validation gate
// ---------------------------------------------------------------------------

/**
 * Validate a single extracted case against deterministic quality gates.
 *
 * @param {object} caseData - Extracted case from DeepSeek
 * @param {object} [options]
 * @param {string} [options.threadText] - Original thread text for author validation
 * @param {object} [options.classifierResult] - Classifier result for cross-check
 * @returns {{ valid: boolean, reason: string, warnings: string[] }}
 */
export function validateCase(caseData, options = {}) {
  const warnings = [];

  // Gate 1: Completeness
  if (!isCompleteRecord(caseData)) {
    const missing = [];
    if (!(caseData.brand_raw || caseData.vehicle_brand || '').trim()) missing.push('brand');
    if (!(caseData.model_raw || caseData.vehicle_model || '').trim()) missing.push('model');
    if (!Array.isArray(caseData.symptoms) || caseData.symptoms.filter(s => s?.trim()).length === 0) missing.push('symptoms');
    if (!(caseData.description || '').trim()) missing.push('description');
    if (!(caseData.resolution || '').trim()) missing.push('resolution');
    return { valid: false, reason: `Incomplete record: missing ${missing.join(', ')}`, warnings };
  }

  // Gate 2: Unresolved resolution language
  if (hasUnresolvedResolutionLanguage(caseData.resolution)) {
    return { valid: false, reason: 'Resolution contains future/planned language — not actually resolved', warnings };
  }

  // Gate 3: Resolution minimum quality
  const resolution = (caseData.resolution || '').trim();
  if (resolution.length < 15) {
    return { valid: false, reason: `Resolution too short (${resolution.length} chars)`, warnings };
  }

  // Gate 4: Description minimum quality
  const description = (caseData.description || '').trim();
  if (description.length < 15) {
    return { valid: false, reason: `Description too short (${description.length} chars)`, warnings };
  }

  // Gate 5: Author consistency (if thread text provided)
  if (options.threadText) {
    const postMeta = parsePostMetaFromThreadText(options.threadText);
    if (postMeta.size > 0) {
      const authorCheck = validateCaseAuthor(caseData, postMeta);
      if (!authorCheck.valid) {
        return { valid: false, reason: authorCheck.reason, warnings };
      }
    }
  }

  // Warnings (non-blocking)
  if (!Array.isArray(caseData.obd_codes) || caseData.obd_codes.length === 0) {
    warnings.push('No OBD codes extracted');
  }
  if (!caseData.mileage) {
    warnings.push('No mileage extracted');
  }
  if (!(caseData.engine_raw || '').trim()) {
    warnings.push('No engine info extracted');
  }

  return { valid: true, reason: '', warnings };
}
