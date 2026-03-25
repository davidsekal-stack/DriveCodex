/**
 * RAG (Retrieval-Augmented Generation) modul — frontend helpers
 *
 * Scoring logika žije VÝHRADNĚ v Edge Function search-cases/index.ts.
 * Tento soubor obsahuje jen pomocné funkce pro přípravu RAG vstupu.
 */

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
