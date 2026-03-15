import { translate } from '../i18n/translate.js'

/**
 * Sdílená validační logika pro resolution text.
 * Validuje délku, opakování znaků a rozmanitost slov.
 *
 * @param {string} resolutionRaw - text popisující provedenou opravu
 * @param {string} [lang] - jazyk pro lokalizované chybové hlášky
 * @returns {{ ok: boolean, reason: string|null }}
 */
export function validateResolution(resolutionRaw, lang) {
  const resolution = (resolutionRaw ?? '').trim()

  if (!resolution) {
    return { ok: false, reason: translate('validation.resolutionEmpty', null, lang) }
  }
  if (resolution.length < 10) {
    return { ok: false, reason: translate('validation.resolutionTooShort', { length: resolution.length, min: 10 }, lang) }
  }
  if (resolution.length > 200) {
    return { ok: false, reason: translate('validation.resolutionTooLong', { length: resolution.length, max: 200 }, lang) }
  }
  if (/(.)\1{6,}/.test(resolution)) {
    return { ok: false, reason: translate('validation.resolutionRepeating', null, lang) }
  }
  const uniqueWords = new Set(
    resolution.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  )
  if (uniqueWords.size < 2) {
    return { ok: false, reason: translate('validation.resolutionTerse', null, lang) }
  }

  return { ok: true, reason: null }
}
