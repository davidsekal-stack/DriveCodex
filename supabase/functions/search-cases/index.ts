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
      .eq('status', 'approved')
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

    const results = scored
      .filter((x: any) => x.passes)
      .sort((a: any, b: any) =>
        b.score - a.score ||
        (a.isOwn && !b.isOwn ? -1 : !a.isOwn && b.isOwn ? 1 : 0)
      )
      .slice(0, 5)
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
