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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Scoring konstanty (shodné s src/lib/rag.js) ───────────────────────────────
// Značka vozidla se nepoužívá ke scoringu — slouží jako pre-filtr na DB úrovni
const OWN_THRESHOLD   = 5
const OTHER_THRESHOLD = 8
const MAX_TEXT_SCORE  = 2

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

function computeSimilarity(row: any, input: any): number {
  const allText = [
    ...(row.symptoms  ?? []),
    ...(row.obd_codes ?? []),
    row.description ?? '',
  ].join(' ').toLowerCase()

  let score = 0

  // Značka se nepoužívá ke scoringu — slouží jako pre-filtr na DB úrovni
  if (input.vehicle?.model && row.vehicle_model === input.vehicle.model) score += 3
  if (input.vehicle?.enginePower && row.engine_power === input.vehicle.enginePower) score += 2

  for (const code of input.obdCodes ?? []) {
    if (allText.includes(code.toLowerCase())) score += 4
  }
  for (const sym of input.symptoms ?? []) {
    if (allText.includes(sym.toLowerCase())) score += 1.5
  }

  let textScore = 0
  for (const word of (input.text ?? '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 4)) {
    if (allText.includes(word)) {
      textScore = Math.min(textScore + 0.3, MAX_TEXT_SCORE)
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
  // CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    )

    // Předfiltrování na DB úrovni:
    // 1) Značka — vždy, pokud je zadána
    // 2) Model — vždy, pokud je zadán (primárnější než OBD kódy)
    // 3) OBD kódy — doplňující filtr nad výsledky brand+model
    // (max 200 kandidátů, scoring proběhne zde)
    let query = supabase
      .from('gearbrain_cases')
      .select('*')
      .order('closed_at', { ascending: false })
      .limit(200)

    if (vehicle?.brand) {
      query = query.eq('vehicle_brand', vehicle.brand)
    }

    if (vehicle?.model) {
      query = query.eq('vehicle_model', vehicle.model)
    }

    if (obdCodes?.length > 0) {
      query = query.overlaps('obd_codes', obdCodes)
    }

    const { data: rows, error } = await query

    if (error) throw error

    // Scoring používá přeložené příznaky a text (ostatní jsou jazykově neutrální)
    const input = { vehicle, symptoms: searchSymptoms, obdCodes, text: searchText }

    // Scoring + filtrování + řazení
    const scored = (rows ?? []).map((row: any) => {
      const score     = computeSimilarity(row, input)
      const isOwn     = row.user_id === userId
      const threshold = isOwn ? OWN_THRESHOLD : OTHER_THRESHOLD
      return { row, score, isOwn, passes: score >= threshold }
    })

    const ranked = scored
      .filter((x: any) => x.passes)
      .filter((x: any) => !shouldSuppressRow(x.row))
      .sort((a: any, b: any) =>
        b.score - a.score ||
        (a.isOwn && !b.isOwn ? -1 : !a.isOwn && b.isOwn ? 1 : 0)
      )

    const deduped = new Map<string, any>()
    for (const item of ranked) {
      const key = makeCanonicalDedupKey(item.row)
      if (!deduped.has(key)) deduped.set(key, item)
      if (deduped.size >= 5) break
    }

    const results = [...deduped.values()]
      .map((x: any) => ({ ...rowToCase(x.row), ragScore: x.score, ragIsOwn: x.isOwn }))

    return new Response(
      JSON.stringify({ cases: results, count: results.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (e: any) {
    return new Response(
      JSON.stringify({ cases: [], count: 0, error: e.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      // 200 i při chybě — aplikace tiše pokračuje bez RAG
    )
  }
})
