/**
 * DriveCodex — Edge Function: known-faults
 *
 * Statistiky známých závad pro konkrétní vozidlo (panel „Známé závady tohoto
 * vozu" na obrazovce nového případu). Čistá DB agregace — žádné AI tokeny.
 *
 * Anon role nemá přímý SELECT na tabulky — data tečou jen touto funkcí.
 * Při jakékoliv chybě vrací 200 s prázdným výsledkem (panel je fail-quiet,
 * nikdy nesmí blokovat diagnostiku).
 *
 * POST /functions/v1/known-faults
 * Body: { brand, model, mode?: 'stats' | 'cases', faultId?, band?, gen?, limit? }
 *
 * mode 'stats'  → { ok, total, totalFamily, genUnknown, unclassified,
 *                   faults: [{ faultId, labelCs, labelEn, labelDe, category,
 *                              counts: { all, '0-100', '100-150', '150-200',
 *                                        '200+', unknown } }],
 *                   familyFaults: [...stejný tvar přes všechny generace...] }
 * mode 'cases'  → { ok, cases: [{ id, resolution, resolutionCs, resolutionDe,
 *                                 resolutionLang, mileage, closedAt, threadUrl,
 *                                 sourceRef, enginePower, vehicleModel,
 *                                 obdCodes }] }
 *                 (resolution = kanonická EN; výběr jazyka řeší klient přes
 *                  known-faults.js → localizeResolution, jako u pickFaultLabel)
 */

import { optionsResponse } from '../_shared/cors.ts'
import { json } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/client.ts'

const BANDS = ['0-100', '100-150', '150-200', '200+', 'unknown']

// ── In-memory TTL cache pro mode 'stats' ─────────────────────────────────────
// Best-effort (instance edge funkce jsou efemérní); chrání DB při opakovaných
// zobrazeních stejného vozidla.
const CACHE_TTL_MS = 5 * 60_000
const CACHE_MAX = 200
const statsCache = new Map<string, { at: number; payload: unknown }>()

function cacheGet(key: string): unknown | null {
  const hit = statsCache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    statsCache.delete(key)
    return null
  }
  return hit.payload
}

function cacheSet(key: string, payload: unknown) {
  if (statsCache.size >= CACHE_MAX) {
    const oldest = statsCache.keys().next().value
    if (oldest !== undefined) statsCache.delete(oldest)
  }
  statsCache.set(key, { at: Date.now(), payload })
}

// ── Reshape řádků z RPC na odpověď pro klienta ───────────────────────────────

type RpcRow = {
  fault_id: string | null
  label_cs: string | null
  label_en: string | null
  label_de: string | null
  category: string | null
  band: string
  gen_match: 'exact' | 'unknown' | 'other'
  cnt: number
}

function emptyCounts(): Record<string, number> {
  const counts: Record<string, number> = { all: 0 }
  for (const b of BANDS) counts[b] = 0
  return counts
}

/** Seskupí řádky (filtrované na požadované gen_match hodnoty) podle závady. */
function groupFaults(rows: RpcRow[], genMatches: Set<string>) {
  const byFault = new Map<string, any>()
  let unclassified = 0
  let total = 0

  for (const row of rows) {
    if (!genMatches.has(row.gen_match)) continue
    const cnt = Number(row.cnt) || 0
    total += cnt
    if (!row.fault_id || row.fault_id === 'other') {
      unclassified += cnt
      continue
    }
    if (!byFault.has(row.fault_id)) {
      byFault.set(row.fault_id, {
        faultId: row.fault_id,
        labelCs: row.label_cs ?? row.fault_id,
        labelEn: row.label_en ?? row.fault_id,
        labelDe: row.label_de ?? row.fault_id,
        category: row.category ?? 'other',
        counts: emptyCounts(),
      })
    }
    const fault = byFault.get(row.fault_id)
    fault.counts.all += cnt
    if (row.band in fault.counts) fault.counts[row.band] += cnt
  }

  const faults = [...byFault.values()].sort((a, b) => b.counts.all - a.counts.all)
  return { faults, unclassified, total }
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const { brand, model, mode, faultId, band, gen, limit } = await req.json()

    if (typeof brand !== 'string' || !brand.trim() || typeof model !== 'string' || !model.trim()) {
      return json({ ok: false, error: 'brand and model are required' })
    }

    const supabase = getServiceClient()

    if (mode === 'cases') {
      if (typeof faultId !== 'string' || !faultId.trim()) {
        return json({ ok: false, error: 'faultId is required for mode=cases', cases: [] })
      }
      const { data, error } = await supabase.rpc('known_fault_cases', {
        p_brand: brand,
        p_model: model,
        p_fault_id: faultId,
        p_band: typeof band === 'string' && BANDS.includes(band) ? band : null,
        p_gen: gen === 'family' ? 'family' : 'exact',
        p_limit: Number.isFinite(limit) ? limit : 10,
      })
      if (error) throw error

      const cases = (data ?? []).map((row: any) => ({
        id: row.id,
        resolution: row.resolution,
        resolutionCs: row.resolution_cs ?? null,
        resolutionDe: row.resolution_de ?? null,
        resolutionLang: row.resolution_lang ?? null,
        mileage: row.mileage,
        closedAt: row.closed_at,
        threadUrl: row.thread_url,
        sourceRef: row.source_ref,
        enginePower: row.engine_power,
        vehicleModel: row.vehicle_model,
        obdCodes: row.obd_codes ?? [],
      }))
      return json({ ok: true, cases })
    }

    // mode 'stats' (default)
    const cacheKey = `${brand}|${model}`
    const cached = cacheGet(cacheKey)
    if (cached) return json(cached)

    const { data, error } = await supabase.rpc('known_faults_for_vehicle', {
      p_brand: brand,
      p_model: model,
    })
    if (error) throw error

    const rows = (data ?? []) as RpcRow[]
    const exact = groupFaults(rows, new Set(['exact']))
    const family = groupFaults(rows, new Set(['exact', 'other', 'unknown']))
    const genUnknown = rows
      .filter((r) => r.gen_match === 'unknown')
      .reduce((sum, r) => sum + (Number(r.cnt) || 0), 0)

    const payload = {
      ok: true,
      total: exact.total,
      totalFamily: family.total,
      genUnknown,
      unclassified: exact.unclassified,
      familyUnclassified: family.unclassified,
      faults: exact.faults,
      familyFaults: family.faults,
    }
    cacheSet(cacheKey, payload)
    return json(payload)
  } catch (e: any) {
    // 200 i při chybě — panel tiše zmizí, aplikace běží dál
    return json({
      ok: false,
      error: e.message,
      total: 0,
      totalFamily: 0,
      genUnknown: 0,
      unclassified: 0,
      faults: [],
      familyFaults: [],
    })
  }
})
