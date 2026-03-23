/**
 * RAG (Retrieval-Augmented Generation) modul
 *
 * computeSimilarity() — skórovací logika, sdílena s Edge Function search-cases
 * computeMaxScore()   — maximální možné skóre pro daný vstup (100% shoda)
 * extractSignals()    — pomocná funkce pro sestavení RAG bloku v system promptu
 *
 * Značka + model vozidla jsou POVINNÉ pre-filtry na DB úrovni.
 *
 * Scoring algoritmus (shodný s supabase/functions/search-cases/index.ts):
 *   +3   shoda modelu vozidla
 *   +2   shoda výkonu motoru
 *   +4   shoda OBD kódu  (nejsilnější diagnostický signál)
 *   +1.5 shoda příznaku
 *   +0.3 shoda klíčového slova z volného textu (>4 znaky), max +2 celkem
 *
 * Podmínky zobrazení (obě musí platit):
 *   SCORE_THRESHOLD = 8    — minimální absolutní skóre
 *   MATCH_RATIO_MIN = 0.5  — minimální míra shody (skóre / maxSkóre ≥ 50%)
 */

const SCORE_THRESHOLD = 8
const MATCH_RATIO_MIN = 0.5
const MAX_TEXT_SCORE  = 2

const W_MODEL  = 3
const W_ENGINE = 2
const W_OBD    = 4
const W_SYM    = 1.5
const W_WORD   = 0.3

/**
 * Maximální možné skóre pro daný vstup při 100% shodě.
 */
export function computeMaxScore(input) {
  let max = 0
  if (input.vehicle?.model)       max += W_MODEL
  if (input.vehicle?.enginePower) max += W_ENGINE
  max += (input.obdCodes?.length ?? 0) * W_OBD
  max += (input.symptoms?.length ?? 0) * W_SYM
  const wordCount = (input.text ?? '').split(/\s+/).filter((w) => w.length > 4).length
  max += Math.min(wordCount * W_WORD, MAX_TEXT_SCORE)
  return max
}

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

  for (const code of input.obdCodes ?? []) {
    if (allText.includes(code.toLowerCase())) score += W_OBD
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
