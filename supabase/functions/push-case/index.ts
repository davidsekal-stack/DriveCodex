/**
 * DriveCodex — Edge Function: push-case
 *
 * Přijme uzavřený případ, přeloží textová pole do angličtiny
 * a uloží do sdílené RAG databáze gearbrain_cases.
 *
 * Překlad zajišťuje jazykově nezávislé RAG vyhledávání —
 * všechny záznamy v DB jsou v angličtině bez ohledu na jazyk zadání.
 *
 * POST /functions/v1/push-case
 * Body: { local_id, user_id, skip_translation?, thread_url?, source_ref?, vehicle_brand?, vehicle_model,
 *         mileage?, engine_power?, symptoms, obd_codes, description?, resolution, closed_at? }
 * user_id accepts either a real UUID or the seed importer alias `ai_importer`,
 * which is resolved server-side via IMPORTER_USER_ID.
 */

import { optionsResponse } from '../_shared/cors.ts'
import { json } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/client.ts'

const IMPORTER_USER_ALIAS = 'ai_importer'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const RESOLUTION_MIN_LENGTH = 10
const RESOLUTION_MAX_LENGTH = 400

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const {
      local_id, user_id,
      skip_translation,
      thread_url,
      source_ref,
      vehicle_brand, vehicle_model,
      mileage, engine_power,
      symptoms, obd_codes, description, resolution, closed_at,
    } = await req.json()

    const resolvedUserId = resolveIncomingUserId(user_id)

    // ── Validace ───────────────────────────────────────────────────────────────
    if (resolvedUserId.error) {
      return json({ error: resolvedUserId.error }, 400)
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

    const apiKey = Deno.env.get('DEEPSEEK_API_KEY')
    if (apiKey && skip_translation !== true) {
      const hasContent = (
        translatedSymptoms.length > 0 ||
        translatedDescription.trim().length > 0 ||
        translatedResolution.trim().length > 0
      )

      if (hasContent) {
        try {
          const translateRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type':  'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model:      'deepseek-chat',
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
            const raw     = (data.choices?.[0]?.message?.content ?? '').trim()
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

    translatedDescription = normalizeImportText(translatedDescription)
    translatedResolution = clampResolutionForImport(translatedResolution)
    if (translatedResolution.length < RESOLUTION_MIN_LENGTH) {
      return json({ error: 'Popis opravy je příliš krátký.' }, 400)
    }

    // ── Uložení do gearbrain_cases ─────────────────────────────────────────────
    const supabase = getServiceClient()

    const row = {
      local_id:        local_id        ?? null,
      user_id:         resolvedUserId.userId,
      thread_url:      typeof thread_url === 'string' && thread_url.trim() ? thread_url.trim() : null,
      source_ref:      typeof source_ref === 'string' && source_ref.trim() ? source_ref.trim() : null,
      vehicle_brand:   vehicle_brand   ?? null,
      vehicle_model,
      mileage:         mileage         ?? null,
      engine_power:    engine_power    ?? null,
      symptoms:        translatedSymptoms,
      obd_codes:       obd_codes       ?? [],
      description:     translatedDescription || null,
      resolution:      translatedResolution,
      closed_at:       closed_at       ?? new Date().toISOString(),
      status:          'pending',
    }

    const { error } = await supabase
      .from('gearbrain_cases')
      .insert(row)

    if (error && error.code === '23505') {
      const patch: Record<string, unknown> = {
        vehicle_brand: row.vehicle_brand,
        vehicle_model: row.vehicle_model,
        mileage: row.mileage,
        engine_power: row.engine_power,
        symptoms: row.symptoms,
        obd_codes: row.obd_codes,
        description: row.description,
        resolution: row.resolution,
        closed_at: row.closed_at,
      }
      if (row.thread_url) patch.thread_url = row.thread_url
      if (row.source_ref) patch.source_ref = row.source_ref

      if (Object.keys(patch).length > 0) {
        const { error: updateError } = await supabase
          .from('gearbrain_cases')
          .update(patch)
          .eq('user_id', row.user_id)
          .eq('local_id', row.local_id)

        if (updateError) {
          return json({ error: updateError.message }, 500)
        }
      }

      return json({ ok: true, duplicate: true, updated: Object.keys(patch).length > 0 }, 200)
    }

    if (error) {
      return json({ error: error.message }, 500)
    }

    return json({ ok: true })

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: msg }, 500)
  }
})

function resolveIncomingUserId(value: unknown): { userId: string } | { error: string } {
  const raw = (value ?? '').toString().trim()
  if (!raw) return { error: 'Chybí user_id.' }

  if (raw === IMPORTER_USER_ALIAS) {
    const importerUserId = (Deno.env.get('IMPORTER_USER_ID') ?? '').trim()
    if (!importerUserId) {
      return { error: 'Alias ai_importer vyžaduje nastavený IMPORTER_USER_ID.' }
    }
    if (!UUID_RE.test(importerUserId)) {
      return { error: 'IMPORTER_USER_ID musí být validní UUID.' }
    }
    return { userId: importerUserId }
  }

  if (!UUID_RE.test(raw)) {
    return { error: 'user_id musí být validní UUID nebo alias ai_importer.' }
  }

  return { userId: raw }
}

function normalizeImportText(value: unknown): string {
  return (value ?? '')
    .toString()
    .replace(/\s+/g, ' ')
    .trim()
}

function clampResolutionForImport(value: unknown, maxLength = RESOLUTION_MAX_LENGTH): string {
  const text = normalizeImportText(value)
  if (text.length <= maxLength) return text

  const ellipsis = '...'
  const budget = Math.max(0, maxLength - ellipsis.length)
  if (budget === 0) return ellipsis.slice(0, maxLength)

  const sample = text.slice(0, budget + 1)
  const minBoundary = Math.max(0, Math.floor(budget * 0.6))
  const sentenceCuts = ['. ', '! ', '? ']
  const clauseCuts = ['; ', ': ', ', ']

  let cut = findPreferredCut(sample, sentenceCuts, minBoundary, 1)
  if (cut === -1) cut = findPreferredCut(sample, clauseCuts, minBoundary, 1)
  if (cut === -1) {
    const wordCut = sample.lastIndexOf(' ')
    if (wordCut >= minBoundary) cut = wordCut
  }
  if (cut === -1) cut = budget

  return `${sample.slice(0, cut).trimEnd()}${ellipsis}`
}

function findPreferredCut(sample: string, separators: string[], minBoundary: number, extraLength: number): number {
  for (const separator of separators) {
    const index = sample.lastIndexOf(separator)
    if (index >= minBoundary) return index + extraLength
  }
  return -1
}
