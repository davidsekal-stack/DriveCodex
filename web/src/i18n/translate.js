// ── DriveCodex i18n — pure JS helpers (no React, no JSX) ──────────────────────
// Used by ai.js, validation.js, ErrorBoundary, and unit tests.

import { strings as cs } from './cs.js'
import { strings as en } from './en.js'
import { strings as de } from './de.js'

export const allStrings = { cs, en, de }

/** Non-React helper — returns the full string dictionary for a lang */
export function getStrings(lang) {
  const l = lang || (typeof localStorage !== 'undefined' && localStorage.getItem('gb-lang')) || 'cs'
  return allStrings[l] || cs
}

/** Non-React translate helper — for ai.js, validation.js etc. */
export function translate(key, params, lang) {
  const l = lang || (typeof localStorage !== 'undefined' && localStorage.getItem('gb-lang')) || 'cs'
  const dict = allStrings[l] || cs
  let str = dict[key] ?? cs[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, String(v))
    }
  }
  return str
}
