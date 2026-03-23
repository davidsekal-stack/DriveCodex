/**
 * RAG (Retrieval-Augmented Generation) modul
 *
 * Scoring logika sdílená s Edge Function search-cases/index.ts.
 * Při změnách VŽDY synchronizovat oba soubory!
 *
 * Značka + model = povinný pre-filtr na DB úrovni (nescoruji se).
 *
 * Scoring algoritmus:
 *   +3   shoda modelu
 *   +2   shoda výkonu motoru
 *   +2   nájezd ±30%  |  +1 nájezd ±50%
 *   +2   generický OBD kód (P0xxx, P2xxx)
 *   +5   specifický OBD kód (P1xxx, P3xxx, C/B/U)
 *   +1.5 shoda příznaku
 *   +0.3 klíčové slovo z textu (>4 znaky), max +2
 *
 * Podmínky zobrazení (obě musí platit):
 *   dynamicThreshold = min(8, inputMax × 0.7)
 *   F1 obousměrná míra shody ≥ 50%
 */

const SCORE_THRESHOLD = 8
const MATCH_RATIO_MIN = 0.5
const MAX_TEXT_SCORE  = 2

const W_MODEL        = 3
const W_ENGINE       = 2
const W_OBD_GENERIC  = 2
const W_OBD_SPECIFIC = 5
const W_SYM          = 1.5
const W_WORD         = 0.3
const W_MILEAGE_CLOSE = 2
const W_MILEAGE_FAR   = 1

/** Váha OBD kódu: generické (P0/P2) méně, specifické (P1/P3/C/B/U) více */
function obdWeight(code) {
  const c = (code ?? '').toUpperCase()
  if (c.startsWith('P0') || c.startsWith('P2')) return W_OBD_GENERIC
  return W_OBD_SPECIFIC
}

/** Skóre za podobnost nájezdu km */
function mileageScore(a, b) {
  const ma = parseInt(String(a ?? ''))
  const mb = parseInt(String(b ?? ''))
  if (isNaN(ma) || isNaN(mb) || ma <= 0 || mb <= 0) return 0
  const ratio = Math.min(ma, mb) / Math.max(ma, mb)
  if (ratio >= 0.7) return W_MILEAGE_CLOSE
  if (ratio >= 0.5) return W_MILEAGE_FAR
  return 0
}

/** Max možné skóre z pohledu vstupu */
export function computeInputMaxScore(input) {
  let max = 0
  if (input.vehicle?.model)       max += W_MODEL
  if (input.vehicle?.enginePower) max += W_ENGINE
  if (input.vehicle?.mileage)     max += W_MILEAGE_CLOSE
  for (const code of input.obdCodes ?? []) max += obdWeight(code)
  max += (input.symptoms?.length ?? 0) * W_SYM
  const wc = (input.text ?? '').split(/\s+/).filter((w) => w.length > 4).length
  max += Math.min(wc * W_WORD, MAX_TEXT_SCORE)
  return max
}

/** F1-style obousměrná míra shody */
export function f1Ratio(score, inputMax, candidateMax) {
  const fwd = inputMax > 0 ? score / inputMax : 0
  const rev = candidateMax > 0 ? score / candidateMax : 0
  if (fwd + rev === 0) return 0
  return 2 * fwd * rev / (fwd + rev)
}

export { SCORE_THRESHOLD, MATCH_RATIO_MIN }

/**
 * Vypočítá skóre podobnosti uzavřeného případu vůči aktuálnímu vstupu.
 * @param {Object} closed  - uzavřený případ (lokální nebo cloudový)
 * @param {Object} input   - { vehicle, symptoms, obdCodes, text }
 * @returns {number}
 */
export function computeSimilarity(closed, input) {
  const allText = closed.messages
    .filter((m) => m.type === 'input')
    .flatMap((m) => [...(m.symptoms ?? []), ...(m.obdCodes ?? []), m.text ?? ''])
    .join(' ')
    .toLowerCase()

  let score = 0

  if (input.vehicle?.model && closed.vehicle?.model === input.vehicle.model) score += W_MODEL
  if (input.vehicle?.enginePower && closed.vehicle?.enginePower === input.vehicle.enginePower) score += W_ENGINE
  score += mileageScore(input.vehicle?.mileage, closed.vehicle?.mileage)

  for (const code of input.obdCodes ?? []) {
    if (allText.includes(code.toLowerCase())) score += obdWeight(code)
  }
  for (const sym of input.symptoms ?? []) {
    if (allText.includes(sym.toLowerCase())) score += W_SYM
  }

  let textScore = 0
  for (const word of (input.text ?? '').toLowerCase().split(/\s+/).filter((w) => w.length > 4)) {
    if (allText.includes(word)) {
      textScore = Math.min(textScore + W_WORD, MAX_TEXT_SCORE)
      if (textScore >= MAX_TEXT_SCORE) break
    }
  }
  score += textScore

  return score
}

/**
 * Extrahuje unikátní příznaky a OBD kódy ze všech vstupních zpráv případu.
 * Používá se při sestavování RAG bloku v system promptu.
 * @param {Object} kase - případ
 * @returns {{ symptoms: string[], obdCodes: string[] }}
 */
export function extractSignals(kase) {
  const inputs = kase.messages.filter((m) => m.type === 'input')
  return {
    symptoms: [...new Set(inputs.flatMap((m) => m.symptoms ?? []))],
    obdCodes: [...new Set(inputs.flatMap((m) => m.obdCodes ?? []))],
  }
}
