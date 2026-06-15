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

// ── Cache slugů taxonomie závad ───────────────────────────────────────────────
// Klasifikace případu do číselníku (canonical_fault_id) jede ve STEJNÉM
// DeepSeek volání jako překlad — žádná extra latence. Je fail-open: když
// taxonomie není dostupná (prázdná tabulka, výpadek), případ se uloží
// s canonical_fault_id = NULL a doklasifikuje ho pozdější běh
// scripts/agent/fault-taxonomy.mjs --classify.
const TAXONOMY_TTL_MS = 10 * 60_000
let taxonomyCache: { at: number; slugs: Set<string> } | null = null

async function getTaxonomySlugs(supabase: any): Promise<Set<string> | null> {
  if (taxonomyCache && Date.now() - taxonomyCache.at < TAXONOMY_TTL_MS) {
    return taxonomyCache.slugs.size ? taxonomyCache.slugs : null
  }
  try {
    const { data, error } = await supabase
      .from('gearbrain_fault_taxonomy')
      .select('id')
      .limit(1000)
    if (error) return null  // přechodná chyba: necachovat, zkusit příště
    // Cachuj i prázdný výsledek (před seedem) — jinak by se dotaz opakoval
    // při každém importovaném případu, dokud číselník nevznikne.
    const slugs = new Set<string>((data ?? []).map((r: { id: string }) => r.id))
    taxonomyCache = { at: Date.now(), slugs }
    return slugs.size ? slugs : null
  } catch {
    return null
  }
}

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

    // ── Překlad do angličtiny + lokalizované varianty opravy ────────────────────
    // `resolution` (kanonický) má být anglicky kvůli jazykově nezávislému RAG
    // (při úspěšném překladu = anglický překlad; fail-open při výpadku DeepSeeku).
    // Vedle toho ukládáme i resolution_cs / resolution_de pro panel „Známé
    // závady" — do jazyka shodného s originálem se nepřekládá, uloží se původní
    // text (autentický, bez zpětného překladu). resolution_lang = detekovaný
    // jazyk originálu (a značka „zpracováno" pro pozdější Claude backfill).
    // Předem ořízneme na importní délku (≤400 znaků) — DeepSeek pak lokalizuje
    // krátký text do 3 jazyků v rámci max_tokens (jinak hrozí oříznutá JSON
    // odpověď → parse spadne → do kanonického `resolution` by zůstal originál).
    const baseResolution: string = clampResolutionForImport(resolution)
    let translatedSymptoms:    string[] = symptoms    ?? []
    let translatedDescription: string   = description ?? ''
    let translatedResolution:  string   = baseResolution
    let canonicalFaultId:  string | null = null
    let resolutionCs:      string | null = null
    let resolutionDe:      string | null = null
    let resolutionLang:    string | null = null
    const originalResolution: string = baseResolution

    const supabase = getServiceClient()

    const apiKey = Deno.env.get('DEEPSEEK_API_KEY')
    if (apiKey && skip_translation !== true) {
      const hasContent = (
        translatedSymptoms.length > 0 ||
        translatedDescription.trim().length > 0 ||
        translatedResolution.trim().length > 0
      )

      if (hasContent) {
        const slugs = await getTaxonomySlugs(supabase)
        const faultInstruction = slugs
          ? `\nAdditionally classify the CONFIRMED ROOT CAUSE from the resolution into exactly one fault id from this taxonomy (or "other" if nothing fits, never invent ids):\n${[...slugs].filter(s => s !== 'other').join(', ')}\n`
          : ''
        const faultField = slugs ? ',"fault":"<taxonomy id or other>"' : ''

        try {
          const translateRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type':  'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model:      'deepseek-chat',
              max_tokens: 2000,
              messages: [{
                role:    'user',
                content: `Translate these automotive diagnostic fields to English. Keep OBD codes unchanged. If already in English, return as-is. Return ONLY valid JSON, no other text.
${faultInstruction}
Additionally for the "resolution" field:
- Detect its source language and return "lang": one of "cs", "en", "de", or "other".
- Provide the resolution ALSO in Czech ("resolution_cs") and German ("resolution_de"). If the resolution is already in that language, return its original text verbatim for that field.
Input:
${JSON.stringify({ symptoms: translatedSymptoms, description: translatedDescription, resolution: translatedResolution }, null, 2)}

Return format: {"symptoms":["..."],"description":"...","resolution":"...","resolution_cs":"...","resolution_de":"...","lang":"cs|en|de|other"${faultField}}`,
              }],
            }),
          })

          if (translateRes.ok) {
            const data    = await translateRes.json()
            const raw     = (data.choices?.[0]?.message?.content ?? '').trim()
            const start   = raw.indexOf('{')
            const end     = raw.lastIndexOf('}')
            if (start !== -1 && end > start) {
              const parsed = JSON.parse(raw.slice(start, end + 1))
              if (Array.isArray(parsed.symptoms))    translatedSymptoms    = parsed.symptoms
              if (parsed.description?.trim())        translatedDescription = parsed.description
              if (parsed.resolution?.trim())         translatedResolution  = parsed.resolution
              if (typeof parsed.resolution_cs === 'string' && parsed.resolution_cs.trim()) resolutionCs = parsed.resolution_cs
              if (typeof parsed.resolution_de === 'string' && parsed.resolution_de.trim()) resolutionDe = parsed.resolution_de
              if (typeof parsed.lang === 'string') {
                const l = parsed.lang.trim().toLowerCase()
                resolutionLang = (l === 'cs' || l === 'en' || l === 'de') ? l : 'other'
              }
              if (slugs && typeof parsed.fault === 'string' && slugs.has(parsed.fault)) {
                canonicalFaultId = parsed.fault
              }
            }
          }
        } catch {
          // Překlad selhal — pokračujeme s originálními texty
        }
      }
    }

    translatedDescription = normalizeImportText(translatedDescription)

    // Do jazyka shodného s originálem se nepřekládá — uloží se původní text
    // (autentický, bez zpětného překladu). Kanonický `resolution` zůstává VŽDY
    // anglickým překladem (parsed.resolution) — nikdy do něj nedáváme neanglický
    // originál (i kdyby model omylem detekoval cizí text jako 'en'); RAG na něm závisí.
    if (resolutionLang === 'cs') resolutionCs = originalResolution
    else if (resolutionLang === 'de') resolutionDe = originalResolution

    translatedResolution = clampResolutionForImport(translatedResolution)
    if (translatedResolution.length < RESOLUTION_MIN_LENGTH) {
      return json({ error: 'Popis opravy je příliš krátký.' }, 400)
    }
    // Lokalizované varianty jsou volitelné — při prázdném/selhalém překladu
    // zůstanou NULL a panel zobrazí angličtinu (fallback v localizeResolution).
    resolutionCs = resolutionCs && resolutionCs.trim() ? clampResolutionForImport(resolutionCs) : null
    resolutionDe = resolutionDe && resolutionDe.trim() ? clampResolutionForImport(resolutionDe) : null

    // ── Uložení do gearbrain_cases ─────────────────────────────────────────────
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
      resolution_cs:   resolutionCs,
      resolution_de:   resolutionDe,
      resolution_lang: resolutionLang,
      closed_at:       closed_at       ?? new Date().toISOString(),
      status:          'pending',
      ...(canonicalFaultId ? { canonical_fault_id: canonicalFaultId } : {}),
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
      if (canonicalFaultId) patch.canonical_fault_id = canonicalFaultId
      // Lokalizované varianty osvěž jen tím, co tenhle běh skutečně přeložil:
      // resolution_lang nastav (značka „zpracováno"), cs/de přepiš jen když mají
      // novou NEnulovou hodnotu. Bez téhle granularity by re-import s částečným/
      // žádným překladem (DeepSeek nedostupný / neúplná odpověď) smazal dříve
      // doplněné překlady na NULL. Nedoplněné dobere noční Claude backfill.
      if (resolutionLang) {
        patch.resolution_lang = row.resolution_lang
        if (resolutionCs) patch.resolution_cs = row.resolution_cs
        if (resolutionDe) patch.resolution_de = row.resolution_de
      }

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
