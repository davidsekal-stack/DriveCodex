/**
 * pause.mjs — Agent-wide usage-limit pause + success heartbeat.
 *
 * Subscription limits reset on their own, so on a QuotaError the agent pauses
 * itself (persisted to the agent_meta table AND a plain-text fast-path file the
 * PowerShell wrapper can read without starting node) and scheduled runs resume
 * automatically once the window passes. A clean run writes a last-success
 * heartbeat the wrapper uses to detect an abnormal stall.
 *
 * Extracted from orchestrator.mjs so the date/serialization logic is unit
 * testable (orchestrator.mjs runs main() at import time).
 */

import { writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __agentDir = dirname(fileURLToPath(import.meta.url));

export const PAUSE_FILE = join(__agentDir, 'pause-until.txt');
export const LAST_SUCCESS_FILE = join(__agentDir, 'last-success.txt');

export const PAUSE_FALLBACK_MS = 60 * 60_000;          // unknown reset → retry hourly
export const DEEPSEEK_PAUSE_FALLBACK_MS = 6 * 3600_000; // prepaid balance needs a human; don't burn Claude every hour
export const PAUSE_GRACE_MS = 5 * 60_000;              // run a bit after the promised reset
export const PAUSE_MAX_MS = 8 * 24 * 3600_000;         // weekly limit + margin
export const QUOTA_EXIT_CODE = 75;                     // distinct LastTaskResult in Task Scheduler

/**
 * Compute when the agent should resume, clamped to a sane window.
 * @param {Date|null} resetAt - parsed reset time, if any
 * @param {Date} [now]
 * @param {number} [fallbackMs] - pause length when resetAt is unknown
 */
export function computePauseUntil(resetAt, now = new Date(), fallbackMs = PAUSE_FALLBACK_MS) {
  const target = resetAt instanceof Date && !Number.isNaN(resetAt.getTime())
    ? resetAt.getTime() + PAUSE_GRACE_MS
    : now.getTime() + fallbackMs;
  const clamped = Math.min(
    Math.max(target, now.getTime() + PAUSE_GRACE_MS),
    now.getTime() + PAUSE_MAX_MS,
  );
  return new Date(clamped);
}

export function enterQuotaPause(state, err, opts = {}) {
  const pauseFile = opts.pauseFile ?? PAUSE_FILE;
  // DeepSeek balance does not self-reset; a 1h pause would just re-burn Claude
  const fallbackMs = err.service === 'DeepSeek' ? DEEPSEEK_PAUSE_FALLBACK_MS : PAUSE_FALLBACK_MS;
  const pauseUntil = computePauseUntil(err.resetAt, opts.now ?? new Date(), fallbackMs);
  state.setMeta('pause_until', pauseUntil.toISOString());
  state.setMeta('pause_reason', (err.message ?? '').slice(0, 300));
  try {
    writeFileSync(pauseFile, `${pauseUntil.toISOString()}\n${(err.message ?? '').slice(0, 300)}\n`, 'utf-8');
  } catch (writeErr) {
    // SQLite is the source of truth; the file is only a wrapper fast path.
    // Log so a silent divergence (e.g. AV lock) is at least diagnosable.
    try { state.log('warn', `Could not write pause file: ${writeErr.message}`, 'quota'); } catch { /* ignore */ }
  }
  return pauseUntil;
}

export function clearQuotaPause(state, opts = {}) {
  const pauseFile = opts.pauseFile ?? PAUSE_FILE;
  state.deleteMeta('pause_until');
  state.deleteMeta('pause_reason');
  try { unlinkSync(pauseFile); } catch { /* may not exist */ }
}

export function recordSuccessHeartbeat(state, opts = {}) {
  const lastSuccessFile = opts.lastSuccessFile ?? LAST_SUCCESS_FILE;
  const now = (opts.now ?? new Date()).toISOString();
  state.setMeta('last_success_at', now);
  try {
    writeFileSync(lastSuccessFile, `${now}\n`, 'utf-8');
  } catch { /* best-effort */ }
}

/**
 * Return { until, reason } if a pause is currently active, else null.
 * Invalid or past timestamps are treated as "no pause" (fail-open).
 */
export function getActivePause(state, now = new Date()) {
  const raw = state.getMeta('pause_until');
  if (!raw) return null;
  const until = new Date(raw);
  if (Number.isNaN(until.getTime()) || until <= now) return null;
  return { until, reason: state.getMeta('pause_reason') || 'usage limit' };
}
