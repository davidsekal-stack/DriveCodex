/**
 * manual-refs.js — helpers for workshop manual reference filtering
 *
 * `match_tier` values from the manual-lookup edge function:
 *   '1a' — full match: model + engine + component
 *   '1b' — model dropped, engine + component matched
 *   '1c' — engine dropped, model + component matched
 *   '1d' — component only (both model and engine dropped) → NOT vehicle-specific
 *   '2'  — fulltext fallback                              → NOT vehicle-specific
 *   '3'  — repair-group browse                            → NOT vehicle-specific
 *   '4'  — generic vehicle chapter list                   → NOT vehicle-specific
 *
 * Only tiers 1a/1b/1c have at least one vehicle dimension constrained and are
 * safe to show as "relevant to this vehicle". Everything else may point to a
 * completely different car's manual.
 */

export const RELEVANT_TIERS = new Set(['1a', '1b', '1c'])

/**
 * Filter manual refs to only vehicle-constrained tiers.
 *
 * @param {Array|null} refs  - raw results from manual-lookup (may be null while loading)
 * @returns {Array|null}     - filtered list, or null when input is null
 */
export function filterManualRefs(refs) {
  if (refs === null || refs === undefined) return null
  return refs.filter(r => RELEVANT_TIERS.has(r.match_tier))
}
