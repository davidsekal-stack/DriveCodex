/**
 * GearBrain — Edge Function: push-case
 *
 * Přijme uzavřený případ, přeloží textová pole do angličtiny
 * a uloží do sdílené RAG databáze gearbrain_cases.
 *
 * Překlad zajišťuje jazykově nezávislé RAG vyhledávání —
 * všechny záznamy v DB jsou v angličtině bez ohledu na jazyk zadání.
 *
 * POST /functions/v1/push-case
 * Body: { local_id, installation_id, user_id?, vehicle_brand?, vehicle_model,
 *         mileage?, engine_power?, symptoms, obd_codes, description?, resolution, closed_at? }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      local_id, installation_id, user_id,
      vehicle_brand, vehicle_model,
      mileage, engine_power,
      symptoms, obd_codes, description, resolution, closed_at,
    } = await req.json()

    // ── Validace ───────────────────────────────────────────────────────────────
    if (!installation_id) {
      return json({ error: 'Chybí installation_id.' }, 400)
    }
    if (!vehicle_model) {
      return json({ error: 'Chybí model vozidla.' }, 400)
    }
    if (!resolution?.trim()) {
      return json({ error: 'Chybí popis opravy.' }, 400)
    }

    // ── Překlad do angličtiny ──────────────────────────────────────────────────
    let translatedSymptoms:    string[] = symptoms    ?? []
    let translatedDescription: string   = description ?? ''
    let translatedResolution:  string   = resolution

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (anthropicKey) {
      const hasContent = (
        translatedSymptoms.length > 0 ||
        translatedDescription.trim().length > 0 ||
        translatedResolution.trim().length > 0
      )

      if (hasContent) {
        try {
          const translateRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type':      'application/json',
              'x-api-key':         anthropicKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model:      'claude-haiku-4-5-20251001',
              max_tokens: 600,
              messages: [{
                role:    'user',
                content: `Translate these automotive diagnostic fields to English. Keep OBD codes unchanged. If already in English, return as-is. Return ONLY valid JSON, no other text.

Input:
${JSON.stringify({ symptoms: translatedSymptoms, description: translatedDescription, resolution: translatedResolution }, null, 2)}

Return format: {"symptoms":["..."],"description":"...","resolution":"..."}`,
              }],
            }),
          })

          if (translateRes.ok) {
            const data    = await translateRes.json()
            const raw     = (data.content?.[0]?.text ?? '').trim()
            const start   = raw.indexOf('{')
            if (start !== -1) {
              const parsed = JSON.parse(raw.slice(start))
              if (Array.isArray(parsed.symptoms))    translatedSymptoms    = parsed.symptoms
              if (parsed.description?.trim())        translatedDescription = parsed.description
              if (parsed.resolution?.trim())         translatedResolution  = parsed.resolution
            }
          }
        } catch {
          // Překlad selhal — pokračujeme s originálními texty
        }
      }
    }

    // ── Uložení do gearbrain_cases ─────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    const row = {
      local_id:        local_id        ?? null,
      installation_id,
      user_id:         user_id         ?? null,
      vehicle_brand:   vehicle_brand   ?? null,
      vehicle_model,
      mileage:         mileage         ?? null,
      engine_power:    engine_power    ?? null,
      symptoms:        translatedSymptoms,
      obd_codes:       obd_codes       ?? [],
      description:     translatedDescription || null,
      resolution:      translatedResolution,
      closed_at:       closed_at       ?? new Date().toISOString(),
    }

    const { error } = await supabase
      .from('gearbrain_cases')
      .insert(row)

    // Duplicita = případ byl již uložen dříve — to je OK
    if (error && error.code !== '23505') {
      return json({ error: error.message }, 500)
    }

    return json({ ok: true }, 200)

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: msg }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
