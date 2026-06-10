/**
 * quota.mjs — Usage-limit / quota error detection and propagation.
 *
 * When DeepSeek or the Claude Code CLI runs out of credits/quota, the agent
 * stops the current phase cleanly, persists state, and pauses itself until
 * the limit window resets (Claude subscription limits reset automatically).
 * The next scheduled run after the reset resumes exactly where it left off.
 */

// ---------------------------------------------------------------------------
// QuotaError — thrown when a service has no remaining quota/credits
// ---------------------------------------------------------------------------

export class QuotaError extends Error {
  /**
   * @param {string} service - 'DeepSeek' | 'Claude' | ...
   * @param {string} detail - the matched error line
   * @param {object} [options]
   * @param {Date|null} [options.resetAt] - when the limit window resets, if known
   */
  constructor(service, detail = '', options = {}) {
    super(`${service} quota exhausted${detail ? ': ' + detail : ''}`);
    this.name = 'QuotaError';
    this.service = service;
    this.resetAt = options.resetAt instanceof Date && !Number.isNaN(options.resetAt.getTime())
      ? options.resetAt
      : null;
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
// Claude Code CLI usage-limit detection
// ---------------------------------------------------------------------------

// Patterns in the CLI's structured error result that indicate the subscription
// usage limit (5-hour window or weekly cap) was hit. These are matched ONLY
// against the parsed JSON envelope's error text — never against raw output
// that could echo forum content — to avoid false positives.
const CLAUDE_LIMIT_PATTERNS = [
  /usage limit reached/i,
  /you'?ve reached your usage limit/i,
  /hit your usage limit/i,
  /limit will reset/i,
  /5-hour limit/i,
  /weekly limit/i,
  /out of extra usage/i,
];

/**
 * Does this error text from the Claude CLI's JSON envelope describe a
 * subscription usage limit (as opposed to e.g. auth failure or a bad request)?
 */
export function isClaudeLimitMessage(text) {
  const t = (text ?? '').toString();
  return CLAUDE_LIMIT_PATTERNS.some(p => p.test(t));
}

const MAX_RESET_WINDOW_MS = 8 * 24 * 3600_000; // weekly limit + margin

/**
 * Extract the limit-reset time from a Claude usage-limit message, if present.
 * Supported forms (in priority order):
 *   1. Machine format: "...usage limit reached|1735689600" (unix epoch seconds or ms)
 *   2. Clock time: "Your limit will reset at 10:30pm" / "resets at 22:00"
 * Returns a Date strictly in the future and within 8 days, otherwise null.
 *
 * @param {string} text
 * @param {Date} [now] - injectable for tests
 * @returns {Date|null}
 */
export function parseClaudeResetAt(text, now = new Date()) {
  const t = (text ?? '').toString();

  const epochMatch = t.match(/\|(\d{9,13})\b/);
  if (epochMatch) {
    const n = Number(epochMatch[1]);
    const ms = n > 1e12 ? n : n * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime()) && d > now && d.getTime() - now.getTime() < MAX_RESET_WINDOW_MS) {
      return d;
    }
  }

  // Require HH:MM or an am/pm suffix — a bare number would also match phrases
  // like "reset 5 days from now" and mis-parse as 5 o'clock
  let hours = null;
  let minutes = 0;
  let meridiem = '';
  const hhmm = t.match(/reset(?:s)?\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (hhmm) {
    hours = Number(hhmm[1]);
    minutes = Number(hhmm[2]);
    meridiem = (hhmm[3] ?? '').toLowerCase();
  } else {
    const ampm = t.match(/reset(?:s)?\s+(?:at\s+)?(\d{1,2})\s*(am|pm)/i);
    if (ampm) {
      hours = Number(ampm[1]);
      meridiem = ampm[2].toLowerCase();
    }
  }

  if (hours !== null) {
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    if (hours <= 23 && minutes <= 59) {
      // Interpreted in machine-local time; the message's timezone is ignored,
      // which can over/under-shoot — bounded by the caller's clamp + the
      // hourly-retry fallback, and the epoch format takes priority anyway.
      const d = new Date(now);
      d.setHours(hours, minutes, 0, 0);
      // Wall-clock time already passed today → it means tomorrow
      if (d <= now) d.setDate(d.getDate() + 1);
      return d;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Console message
// ---------------------------------------------------------------------------

/**
 * Format a clear quota/limit message for the console.
 * @param {QuotaError} err
 * @param {Date|null} [pauseUntil] - when the agent will automatically resume
 */
export function formatQuotaMessage(err, pauseUntil = null) {
  const resume = pauseUntil
    ? `  Agent paused until ${pauseUntil.toISOString()} — it will`
    : '  Agent paused — it will';
  const lines = [
    '',
    '══════════════════════════════════════════════',
    `  ⚠  ${err.message}`,
    '',
    '  Agent state is fully preserved in SQLite.',
    resume,
    '  resume automatically on the next scheduled',
    '  run after the limit window resets.',
    '══════════════════════════════════════════════',
    '',
  ];
  return lines.join('\n');
}
