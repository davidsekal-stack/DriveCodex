/**
 * DriveCodex — Edge Function: search-cases
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

// Korroborace: kolik nezávislých případů potvrzuje stejnou (klasifikovanou) závadu.
// Bonus k řazení je OMEZENÝ a nasycený (match-kvalita zůstává hlavní): 1 případ → ×1.0,
// ≥CAP případů → ×(1+MAX_BOOST). Reálné top závady mají 5–11 potvrzení.
const CORROBORATION_CAP       = 8     // strop počtu potvrzení pro výpočet bonusu
const CORROBORATION_MAX_BOOST = 0.12  // max +12 % k matchRatio za plnou korroboraci

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

const BULLETIN_PROSE_PREFIX_PATTERNS = [
  /^(?:some|certain|various|affected|these)\b/i,
  /^(?:the following|vehicles listed|for vehicles listed)\b/i,
]

const BULLETIN_PROSE_BODY_PATTERNS = [
  /\bequipped with\b/i,
  /\bbuilt on\b/i,
  /\bproduced from\b/i,
  /\bthrough\b/i,
  /\bmodel statement above\b/i,
  /\bthis bulletin provides\b/i,
  /\bthis service bulletin provides\b/i,
  /\b\d{4}(?:[-–]\d{4}|my)\b/i,
]

function cleanText(value: any): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function looksLikeBulletinProse(text: any): boolean {
  const normalized = cleanText(text)
  if (!normalized) return false
  if (normalized.length >= 135 && BULLETIN_PROSE_PREFIX_PATTERNS.some((pattern) => pattern.test(normalized))) return true
  if (normalized.length >= 160 && BULLETIN_PROSE_BODY_PATTERNS.some((pattern) => pattern.test(normalized))) return true
  return false
}

function isNhtsaBulletinCase(row: any): boolean {
  return typeof row?.thread_url === 'string' && row.thread_url.includes('static.nhtsa.gov/odi/tsbs/')
}

function shouldSuppressRow(row: any): boolean {
  if (!isNhtsaBulletinCase(row)) return false
  if (looksLikeBulletinProse(row.description)) return true
  if (Array.isArray(row.symptoms) && row.symptoms.some((symptom: string) => looksLikeBulletinProse(symptom))) return true
  return false
}

function makeCanonicalDedupKey(row: any): string {
  return [
    cleanText(row.source_ref).toLowerCase(),
    cleanText(row.vehicle_brand).toLowerCase(),
    cleanText(row.vehicle_model).toLowerCase(),
    [...new Set((row.obd_codes ?? []).map((code: string) => cleanText(code).toUpperCase()).filter(Boolean))].sort().join(','),
    cleanText(row.description).toLowerCase(),
    cleanText(row.resolution).toLowerCase(),
  ].join('||')
}

// Pomocné funkce pro výběr kandidátů. Edge fn nemá lokální Deno unit testy —
// ověřuje se živě integračními testy search-cases (tests/supabase-live/suites/edge-functions.js).
/** První token názvu modelu jako prefix pro shodu rodiny modelu (napříč generacemi). */
function modelFamilyPrefix(model: any): string {
  if (typeof model !== 'string') return ''
  const first = model.trim().split(/\s+/)[0] ?? ''
  return first.replace(/[%_]/g, '')   // odstranění zástupných znaků ILIKE z uživatelského vstupu
}

/** Sjednocení výsledků dílčích dotazů + deduplikace podle row.id (zachová první výskyt). */
function buildCandidateRows(results: any[]): any[] {
  const seen = new Set<string>()
  const out: any[] = []
  for (const data of results) {
    if (!Array.isArray(data)) continue
    for (const row of data) {
      if (row?.id != null && !seen.has(row.id)) {
        seen.add(row.id)
        out.push(row)
      }
    }
  }
  return out
}

/** Klíč klasifikované závady pro korroboraci/sloučení; NULL/'other' → null (neklasifikováno). */
function faultKeyOf(row: any): string | null {
  const id = row?.canonical_fault_id
  return (typeof id === 'string' && id && id !== 'other') ? `f:${id}` : null
}

/** Omezený, nasycený bonus za korroboraci: 1 případ → 1.0, ≥CAP → 1+MAX_BOOST. */
function corroborationBoost(count: number): number {
  const capped = Math.min(Math.max(count ?? 1, 1), CORROBORATION_CAP)
  const normalized = (capped - 1) / (CORROBORATION_CAP - 1)
  return 1 + normalized * CORROBORATION_MAX_BOOST
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
    threadUrl:      row.thread_url ?? null,
    sourceRef:      row.source_ref ?? null,
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

    // Předfiltrování na DB úrovni — výběr kandidátů podle SÍLY SIGNÁLU, ne podle stáří.
    // Sjednocení až tří paralelních dotazů (každý krytý existujícím indexem), dedup podle id:
    //   A) překryv OBD kódů (jen jsou-li zadány) — GIN(obd_codes), řazeno dle data jen jako tiebreak
    //   B) rodina modelu (jen je-li model) — ilike prefix na vehicle_model, napříč generacemi
    //   C) nejnovější případy značky (VŽDY) — záchytná síť pro dotazy bez silného signálu
    // Limity jsou vázané na signál, takže starší vysoce relevantní případ se do množiny
    // dostane bez ohledu na to, kolik je novějších (dřív ho strop „200 nejnovějších" tiše zahodil).
    // Značka je povinný filtr; model i OBD jsou nepovinné. Scoring + brány + řazení dle F1 +
    // dedup zůstávají beze změny níže — jen dostanou lepší množinu kandidátů (max ~450 řádků).
    const baseFilter = () => supabase
      .from('gearbrain_cases')
      .select('*')
      .eq('status', 'approved')
      .eq('vehicle_brand', vehicle.brand)

    // C) záchytná síť dle data (vždy) — zachovává dosavadní chování jako spodní hranici
    const queries: any[] = [
      baseFilter().order('closed_at', { ascending: false }).limit(200),
    ]
    // A) OBD překryv — filtrem je OBD kód (ne stáří všech případů značky), takže relevantní
    //    starší shody přežijí; řazení dle data je jen deterministický tiebreak při překročení limitu.
    if (obdCodes?.length > 0) {
      queries.push(baseFilter().overlaps('obd_codes', obdCodes).order('closed_at', { ascending: false }).limit(150))
    }
    // B) rodina modelu (např. „Octavia") — pokrývá stejný model napříč generacemi;
    //    řazení dle data opět jen deterministický tiebreak při překročení limitu.
    const modelPrefix = modelFamilyPrefix(vehicle.model)
    if (modelPrefix) {
      queries.push(baseFilter().ilike('vehicle_model', `${modelPrefix}%`).order('closed_at', { ascending: false }).limit(100))
    }

    const settled = await Promise.all(queries)
    // Chyba kteréhokoli dílčího dotazu MUSÍ shodit — jinak by se recall tiše zhoršil
    // (přesně ta třída chyby, kterou opravujeme).
    for (const r of settled) {
      if (r.error) throw r.error
    }
    const rows = buildCandidateRows(settled.map((r: any) => r.data))

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

    const ranked = scored
      .filter((x: any) => x.passes)
      .filter((x: any) => !shouldSuppressRow(x.row))
      // Řazení podle normalizované F1 shody (0–1), absolutní skóre jen jako tiebreak.
      // F1 je nezávislé na bohatosti dotazu, takže pořadí je stabilní napříč scénáři.
      .sort((a: any, b: any) => (b.matchRatio - a.matchRatio) || (b.score - a.score))

    // ── Korroborace ───────────────────────────────────────────────────────────
    // Kolik NEZÁVISLÝCH prošlých případů potvrzuje stejnou KLASIFIKOVANOU závadu.
    // Počítáme nad PROŠLÝMI kandidáty (ranked), dedup přes source_ref (fan-out
    // nenafoukne — zrcadlí known_faults_for_vehicle). Neklasifikované (NULL/'other')
    // = vlastní singleton: count 1, žádný bonus, nikdy se neslučují → nulová regrese.
    const corroborationSources = new Map<string, Set<string>>()
    for (const item of ranked as any[]) {
      const fk = faultKeyOf(item.row)
      if (!fk) continue
      const src = (item.row.source_ref && String(item.row.source_ref).trim()) || String(item.row.id)
      let set = corroborationSources.get(fk)
      if (!set) { set = new Set(); corroborationSources.set(fk, set) }
      set.add(src)
    }
    for (const item of ranked as any[]) {
      const fk = faultKeyOf(item.row)
      item.corroboration = fk ? (corroborationSources.get(fk)?.size ?? 1) : 1
    }

    // Přeřazení: match-kvalita zůstává HLAVNÍ, korroborace jen omezený bonus (max +12 %).
    // Příklad: 0.95×1.0 (1 případ) > 0.80×1.12 (8 případů) → slabší shoda nikdy nepřebije lepší.
    const rankedBoosted = [...ranked].sort((a: any, b: any) =>
      (b.matchRatio * corroborationBoost(b.corroboration) - a.matchRatio * corroborationBoost(a.corroboration))
      || (b.score - a.score))

    // Dedup: původní kanonická dedup + sloučení stejné KLASIFIKOVANÉ závady do jednoho
    // zástupce (zbylé se „složí" do počtu potvrzení). Neklasifikované se neslučují podle
    // závady (fk = null) → chovají se přesně jako dřív.
    const deduped = new Map<string, any>()
    const seenFaults = new Set<string>()
    for (const item of rankedBoosted as any[]) {
      const key = makeCanonicalDedupKey(item.row)
      if (deduped.has(key)) continue
      const fk = faultKeyOf(item.row)
      if (fk && seenFaults.has(fk)) continue
      deduped.set(key, item)
      if (fk) seenFaults.add(fk)
      if (deduped.size >= 5) break
    }

    const results = [...deduped.values()]
      .map((x: any) => ({ ...rowToCase(x.row), ragScore: x.score, ragMatchRatio: x.matchRatio, ragCorroboration: x.corroboration }))

    return json({ cases: results, count: results.length })

  } catch (e: any) {
    // 200 i při chybě — aplikace tiše pokračuje bez RAG
    return json({ cases: [], count: 0, error: e.message })
  }
})
