/**
 * quota.mjs — Quota / rate-limit error detection and propagation.
 *
 * When DeepSeek or Codex runs out of credits/quota, the agent stops the
 * current phase cleanly, persists state, and prints a clear message.
 * The next run resumes exactly where it left off (SQLite state is intact).
 */

// ---------------------------------------------------------------------------
// QuotaError — thrown when a service has no remaining quota/credits
// ---------------------------------------------------------------------------

export class QuotaError extends Error {
  constructor(service, detail = '') {
    super(`${service} quota exhausted${detail ? ': ' + detail : ''}. Refill credits and re-run.`);
    this.name = 'QuotaError';
    this.service = service;
  }
}

// ---------------------------------------------------------------------------
// DeepSeek quota detection
// ---------------------------------------------------------------------------

// HTTP status codes that indicate quota/billing issues (not transient)
const DEEPSEEK_QUOTA_STATUSES = new Set([402, 403]);

// Patterns in error body that indicate quota/credit exhaustion
const DEEPSEEK_QUOTA_PATTERNS = [
  /insufficient.{0,20}balance/i,
  /quota.{0,20}exceeded/i,
  /out.{0,10}of.{0,10}credit/i,
  /billing.{0,20}limit/i,
  /account.{0,20}suspended/i,
  /usage.{0,20}limit.{0,20}reached/i,
];

/**
 * Check if a DeepSeek API response indicates quota exhaustion.
 * @param {number} status - HTTP status code
 * @param {string} body - Response body text
 * @throws {QuotaError} if quota is exhausted
 */
export function assertDeepSeekNotQuotaError(status, body) {
  if (DEEPSEEK_QUOTA_STATUSES.has(status)) {
    throw new QuotaError('DeepSeek', `HTTP ${status}: ${body.slice(0, 200)}`);
  }
  if (status >= 400 && DEEPSEEK_QUOTA_PATTERNS.some(p => p.test(body))) {
    throw new QuotaError('DeepSeek', body.slice(0, 200));
  }
}

// ---------------------------------------------------------------------------
// Codex quota detection
// ---------------------------------------------------------------------------

// Patterns in Codex stdout/stderr that indicate quota exhaustion
const CODEX_QUOTA_PATTERNS = [
  /quota.{0,20}exceeded/i,
  /rate.{0,10}limit.{0,20}reached/i,
  /insufficient.{0,20}quota/i,
  /you.{0,20}exceeded.{0,20}your.{0,20}current.{0,20}quota/i,
  /billing.{0,20}hard.{0,20}limit/i,
  /account.{0,20}has.{0,20}been.{0,20}suspended/i,
  /no.{0,10}credits.{0,10}remaining/i,
  /context_length_exceeded/i,  // also stops processing — token limit per call
  /you.{0,10}ve.{0,10}hit.{0,20}your.{0,20}usage.{0,20}limit/i,  // OpenAI/Codex usage limit message
  /hit.{0,20}usage.{0,20}limit/i,
  /purchase.{0,10}more.{0,10}credits/i,
];

/**
 * Check if Codex output indicates quota/credit exhaustion.
 * @param {string} output - Combined stdout+stderr from codex exec
 * @throws {QuotaError} if quota is exhausted
 */
export function assertCodexNotQuotaError(output) {
  const text = (output || '').toString();
  if (CODEX_QUOTA_PATTERNS.some(p => p.test(text))) {
    // Extract the relevant line for the error message
    const line = text.split('\n').find(l => CODEX_QUOTA_PATTERNS.some(p => p.test(l))) || '';
    throw new QuotaError('Codex', line.trim().slice(0, 200));
  }
}

// ---------------------------------------------------------------------------
// Quota backoff state helpers (stored in SQLite runs table metadata)
// ---------------------------------------------------------------------------

/**
 * Format a clear, actionable quota exhaustion message for the console.
 */
export function formatQuotaMessage(err) {
  const lines = [
    '',
    '══════════════════════════════════════════════',
    `  ⚠  ${err.message}`,
    '',
    '  Agent state is fully preserved in SQLite.',
    '  Re-run after refilling credits — it will',
    '  resume exactly where it stopped.',
    '══════════════════════════════════════════════',
    '',
  ];
  return lines.join('\n');
}
