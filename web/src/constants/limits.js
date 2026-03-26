/**
 * Centralizované limity a magic numbers.
 * Jediný zdroj pravdy pro hodnoty rozeseté po lib/, hooks/, components/.
 */

// ── AI ──────────────────────────────────────────────────────────────────────────
export const CASE_TOKEN_LIMIT  = 100_000;  // max tokenů na případ
export const AI_MAX_TOKENS     = 4_000;    // max output tokenů per AI call
export const AI_MODEL          = "deepseek-reasoner";

// ── Diagnosis normalization ─────────────────────────────────────────────────────
export const MAX_REPAIR_STEPS  = 4;        // max kroků opravy per závada
export const MAX_REPAIR_LENGTH = 120;      // max znaků per krok opravy

// ── Validation ──────────────────────────────────────────────────────────────────
export const MIN_RESOLUTION_LENGTH = 10;   // min znaků resolution textu
export const MAX_RESOLUTION_LENGTH = 1000; // max znaků resolution textu

// ── Pagination / fetch limits ───────────────────────────────────────────────────
export const REVIEW_FETCH_LIMIT    = 50;   // max pending cases to fetch
export const ANALYTICS_TOP_USERS   = 10;   // top N users in analytics
