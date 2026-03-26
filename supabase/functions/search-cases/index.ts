/**
 * GearBrain — Edge Function: search-cases
 *
 * Přijme diagnostický vstup, provede RAG scoring nad gearbrain_cases
 * a vrátí max 5 nejrelevantnějších výsledků.
 *
 * Anon role nemá přímý SELECT na tabulku — veškerý přístup k datům
 * prochází touto funkcí která nikdy nevrátí více než 5 záznamů.
 *
 * POST /functions/v1/search-cases
 * Body: { vehicle, symptoms, obdCodes, text, userId }
 */

import { optionsResponse } from '../_shared/cors.ts'
import { json } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/client.ts'

// ── Scoring konstanty ──────────────────────────────────────────────────────────
// Značka = povinný pre-filtr na DB úrovni; model dává extra body ve scoringu
const SCORE_THRESHOLD   = 8     // Maximální absolutní práh (snižuje se dynamicky)
const MATCH_RATIO_MIN   = 0.5   // Minimální obousměrná míra shody (F1 ≥ 50%)
const MAX_TEXT_SCORE    = 2

const W_MODEL       = 3
const W_ENGINE      = 2
const W_OBD_GENERIC = 2     // P0xxx, P2xxx — SAE standardní kódy (generické)
const W_OBD_SPECIFIC = 5    // P1xxx, P3xxx, C/B/U — manufacturer-specific
const W_SYM         = 1.5
const W_WORD        = 0.3
const W_MILEAGE_CLOSE = 2   // nájezd ±30%
const W_MILEAGE_FAR   = 1   // nájezd ±50%

// ── Pomocné funkce ───────────────────────────────────────────────────────────

/** Váha OBD kódu: generické (P0/P2) méně, specifické (P1/P3/C/B/U) více */
function obdWeight(code: string): number {
  const c = (code ?? '').toUpperCase()
  if (c.startsWith('P0') || c.startsWith('P2')) return W_OBD_GENERIC
  return W_OBD_SPECIFIC
}

/** Skóre za podobnost nájezdu km */
function mileageScore(a: any, b: any): number {
  const ma = parseInt(String(a ?? ''))
  const mb = parseInt(String(b ?? ''))
  if (isNaN(ma) || isNaN(mb) || ma <= 0 || mb <= 0) return 0
  const ratio = Math.min(ma, mb) / Math.max(ma, mb)
  if (ratio >= 0.7) return W_MILEAGE_CLOSE
  if (ratio >= 0.5) return W_MILEAGE_FAR
  return 0
}

/** Max možné skóre z pohledu vstupu (co uživatel zadal) */
function computeInputMaxScore(input: any): number {
  let max = 0
  if (input.vehicle?.model)       max += W_MODEL
  if (input.vehicle?.enginePower) max += W_ENGINE
  if (input.vehicle?.mileage)     max += W_MILEAGE_CLOSE
  for (const code of input.obdCodes ?? []) max += obdWeight(code)
  max += (input.symptoms?.length ?? 0) * W_SYM
  const wc = (input.text ?? '').split(/\s+/).filter((w: string) => w.length > 4).length
  max += Math.min(wc * W_WORD, MAX_TEXT_SCORE)
  return max
}

/** Max možné skóre z pohledu kandidáta (co je v DB záznamu) */
function computeCandidateMaxScore(row: any): number {
  let max = 0
  if (row.vehicle_model) max += W_MODEL
  if (row.engine_power)  max += W_ENGINE
  if (row.mileage)       max += W_MILEAGE_CLOSE
  for (const code of row.obd_codes ?? []) max += obdWeight(code)
  max += (row.symptoms?.length ?? 0) * W_SYM
  const wc = (row.description ?? '').split(/\s+/).filter((w: string) => w.length > 4).length
  max += Math.min(wc * W_WORD, MAX_TEXT_SCORE)
  return max
}

/**
 * F1-style obousměrná míra shody.
 * forwardRatio  = "kolik z toho co hledám, má kandidát"
 * reverseRatio  = "kolik z kandidátova obsahu odpovídá mému vstupu"
 * F1 = harmonický průměr obou → penalizuje nesymetrické shody
 */
function f1Ratio(score: number, inputMax: number, candidateMax: number): number {
  const fwd = inputMax > 0 ? score / inputMax : 0
  const rev = candidateMax > 0 ? score / candidateMax : 0
  if (fwd + rev === 0) return 0
  return 2 * fwd * rev / (fwd + rev)
}

function computeSimilarity(row: any, input: any): number {
  const allText = [
    ...(row.symptoms  ?? []),
    ...(row.obd_codes ?? []),
    row.description ?? '',
  ].join(' ').toLowerCase()

  let score = 0

  if (input.vehicle?.model && row.vehicle_model === input.vehicle.model) score += W_MODEL
  if (input.vehicle?.enginePower && row.engine_power === input.vehicle.enginePower) score += W_ENGINE
  score += mileageScore(input.vehicle?.mileage, row.mileage)

  for (const code of input.obdCodes ?? []) {
    if (allText.includes(code.toLowerCase())) score += obdWeight(code)
  }
  for (const sym of input.symptoms ?? []) {
    if (allText.includes(sym.toLowerCase())) score += W_SYM
  }

  let textScore = 0
  for (const word of (input.text ?? '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 4)) {
    if (allText.includes(word)) {
      textScore = Math.min(textScore + W_WORD, MAX_TEXT_SCORE)
      if (textScore >= MAX_TEXT_SCORE) break
    }
  }
  score += textScore

  return score
}

function rowToCase(row: any) {
  return {
    id:             row.id,
    localId:        row.local_id,
    name:           `[Cloud] ${row.vehicle_brand ? row.vehicle_brand + ' ' : ''}${row.vehicle_model || 'Neznámý model'} | ${row.resolution.slice(0, 40)}`,
    status:         'uzavřený',
    createdAt:      row.created_at,
    closedAt:       row.closed_at,
    resolution:     row.resolution,
    fromCloud:      true,
    userId: row.user_id,
    vehicle: {
      brand:       row.vehicle_brand  || '',
      model:       row.vehicle_model  || '',
      mileage:     row.mileage?.toString() || '',
      enginePower: row.engine_power   || '',
    },
    messages: [{
      id:        row.id + '_input',
      type:      'input',
      symptoms:  row.symptoms  ?? [],
      obdCodes:  row.obd_codes ?? [],
      text:      row.description || '',
      timestamp: row.created_at,
    }],
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const { vehicle, symptoms, obdCodes, text, userId } = await req.json()

    // ── Normalizace dotazu do angličtiny ───────────────────────────────────────
    // DB záznamy jsou přeloženy do angličtiny při uložení (push-case).
    // Příznaky a volný text z dotazu musí být ve stejném jazyce pro string matching.
    // OBD kódy a vehicle (brand/model) jsou jazykově neutrální — nepřekládáme.
    let searchSymptoms: string[] = symptoms ?? []
    let searchText:     string   = text      ?? ''

    const needsNormalization = searchSymptoms.length > 0 || searchText.trim().length > 0
    const apiKey = Deno.env.get('DEEPSEEK_API_KEY')

    if (needsNormalization && apiKey) {
      try {
        const translateRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model:      'deepseek-chat',
            max_tokens: 300,
            messages: [{
              role:    'user',
              content: `Translate these automotive diagnostic fields to English. If already in English, return as-is. Return ONLY valid JSON.

Input: ${JSON.stringify({ symptoms: searchSymptoms, text: searchText })}
Return format: {"symptoms":["..."],"text":"..."}`,
            }],
          }),
        })

        if (translateRes.ok) {
          const data  = await translateRes.json()
          const raw   = (data.choices?.[0]?.message?.content ?? '').trim()
          const start = raw.indexOf('{')
          if (start !== -1) {
            const parsed = JSON.parse(raw.slice(start))
            if (Array.isArray(parsed.symptoms)) searchSymptoms = parsed.symptoms
            if (typeof parsed.text === 'string') searchText     = parsed.text
          }
        }
      } catch {
        // Překlad selhal — pokračujeme s originálními hodnotami
      }
    }

    // Service role klient — má přístup k tabulce i přes zakázaný anon SELECT
    const supabase = getServiceClient()

    // ── Validace povinných parametrů ──────────────────────────────────────────
    if (!vehicle?.brand) {
      return json({ cases: [], count: 0 })
    }

    // Předfiltrování na DB úrovni:
    // 1) Značka — povinný filtr
    // 2) Model — nepovinný (dává extra body ve scoringu)
    // 3) OBD kódy — doplňující filtr (overlaps)
    // (max 200 kandidátů, scoring proběhne zde)
    let query = supabase
      .from('gearbrain_cases')
      .select('*')
      .eq('status', 'approved')
      .eq('vehicle_brand', vehicle.brand)
      .order('closed_at', { ascending: false })
      .limit(200)

    if (obdCodes?.length > 0) {
      query = query.overlaps('obd_codes', obdCodes)
    }

    const { data: rows, error } = await query

    if (error) throw error

    // Scoring používá přeložené příznaky a text (ostatní jsou jazykově neutrální)
    const input = { vehicle, symptoms: searchSymptoms, obdCodes, text: searchText }
    const inputMax = computeInputMaxScore(input)

    // Dynamický práh: min(8, 70% maxSkóre)
    // → pro jednoduché dotazy (1 kód + model = max 5) se práh sníží na 3.5
    // → pro komplexní dotazy (5 kódů + model + engine = max 25+) zůstane 8
    const dynamicThreshold = Math.min(SCORE_THRESHOLD, inputMax * 0.7)

    // Scoring + filtrování + řazení
    // Kandidát musí splnit OBĚ podmínky:
    //   1) absolutní skóre ≥ dynamický práh
    //   2) F1 obousměrná míra shody ≥ 50%
    const scored = (rows ?? []).map((row: any) => {
      const score = computeSimilarity(row, input)
      const candidateMax = computeCandidateMaxScore(row)
      const matchRatio = f1Ratio(score, inputMax, candidateMax)
      return { row, score, matchRatio, passes: score >= dynamicThreshold && matchRatio >= MATCH_RATIO_MIN }
    })

    const results = scored
      .filter((x: any) => x.passes)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 5)
      .map((x: any) => ({ ...rowToCase(x.row), ragScore: x.score, ragMatchRatio: x.matchRatio }))

    return json({ cases: results, count: results.length })

  } catch (e: any) {
    // 200 i při chybě — aplikace tiše pokračuje bez RAG
    return json({ cases: [], count: 0, error: e.message })
  }
})
