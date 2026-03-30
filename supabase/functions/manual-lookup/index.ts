/**
 * GearBrain — Edge Function: manual-lookup
 *
 * General-purpose workshop manual lookup via Neo4j graph.
 * Accepts raw vehicle + fault data, normalizes server-side, queries graph.
 * Works for any manufacturer's manuals stored in the graph.
 *
 * POST body:
 *   brand:        string          "Volkswagen"
 *   model:        string          "Passat B6 (2006–2010)"
 *   engine_power: string          "77 kW – 1.9 TDI"
 *   components:   string[]        ["turbodmychadlo"] — any language
 *   fault_names:  string[]        ["Závada turbodmychadla"] — any language
 */

import { optionsResponse } from '../_shared/cors.ts'
import { json } from '../_shared/response.ts'
import { getAuthUser } from '../_shared/auth.ts'

const NEO4J_URI  = Deno.env.get('NEO4J_URI') ?? ''
const NEO4J_USER = Deno.env.get('NEO4J_USERNAME') ?? ''
const NEO4J_PASS = Deno.env.get('NEO4J_PASSWORD') ?? ''
const NEO4J_DB   = Deno.env.get('NEO4J_DATABASE') ?? ''

// ── Neo4j Query API v2 ──────────────────────────────────────────────────────

function queryUrl(): string {
  const host = NEO4J_URI.replace(/^neo4j\+s?:\/\//, '')
  return `https://${host}/db/${NEO4J_DB}/query/v2`
}

async function cypher(
  statement: string,
  parameters: Record<string, unknown> = {},
): Promise<Record<string, unknown>[]> {
  const res = await fetch(queryUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${btoa(`${NEO4J_USER}:${NEO4J_PASS}`)}`,
    },
    body: JSON.stringify({ statement, parameters }),
  })
  if (!res.ok) throw new Error(`Neo4j ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const body = await res.json()
  if (body.errors?.length) throw new Error(body.errors[0].message)
  const { fields = [], values = [] } = body.data ?? {}
  return values.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {}
    fields.forEach((f: string, i: number) => { obj[f] = row[i] })
    return obj
  })
}

// ── Normalization ───────────────────────────────────────────────────────────

/** Strip generation tags, years, parenthetical from catalog labels.
 *  "Passat B6 (2006–2010)" → "Passat"
 *  "Golf Plus 2005"        → "Golf Plus"
 *  "Octavia III (2012–)"   → "Octavia"
 */
function normalizeModel(raw: string): string {
  return raw
    .replace(/\s*\(.*?\)/g, '')            // (2006–2010), (US)
    .replace(/\s+B\d\b/g, '')              // B5, B6, B8
    .replace(/\s+Mk\s*\d+/ig, '')          // Mk5
    .replace(/\s+[IVX]{1,4}\b/g, '')       // III, IV
    .replace(/\s+\d{4}\s*[–-]?\s*\d{0,4}/g, '') // 2005, 2006–2010
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** "77 kW – 1.9 TDI" → structured engine hints */
function parseEngine(raw: string): { kw: number | null; displacement: number | null; fuelHint: string | null } {
  const kwM   = raw.match(/(\d+)\s*kW/i)
  const dispM = raw.match(/(\d)[.,](\d)/)
  const kw   = kwM   ? parseInt(kwM[1])                           : null
  const disp = dispM ? parseFloat(`${dispM[1]}.${dispM[2]}`)      : null

  const up = raw.toUpperCase()
  const fuelHint =
    /TDI|SDI|CDI|HDI|CRDI|dCi|JTD|CDTI|D4D/.test(up) ? 'diesel' :
    /TSI|TFSI|FSI|MPI|VTEC|GDI|T-GDI|MIVEC/.test(up) ? 'petrol' :
    null

  return { kw, displacement: disp, fuelHint }
}

// ── Component translation (CS / DE / common abbreviations → EN) ─────────

const TRANSLATIONS: Record<string, string> = {
  // Czech
  turbodmychadlo: 'turbocharger', turbína: 'turbocharger', turbo: 'turbocharger',
  'olejové čerpadlo': 'oil pump', 'olejový filtr': 'oil filter', 'olejová vana': 'oil sump',
  'hlava válců': 'cylinder head', 'hlavy válců': 'cylinder head',
  'vodní čerpadlo': 'water pump', 'vodní pumpa': 'water pump',
  termostat: 'thermostat',
  chladič: 'radiator', mezichladič: 'intercooler', 'chladič oleje': 'oil cooler',
  'rozvodový řemen': 'timing belt', rozvody: 'timing belt',
  'klikový hřídel': 'crankshaft', 'kliková hřídel': 'crankshaft',
  'vačkový hřídel': 'camshaft',
  vstřikovač: 'injector', vstřikovače: 'injector',
  'žhavicí svíčka': 'glow plug', 'žhavicí svíčky': 'glow plug',
  'zapalovací svíčka': 'spark plug', 'zapalovací svíčky': 'spark plug',
  'palivový filtr': 'fuel filter', 'palivové čerpadlo': 'fuel pump',
  spojka: 'clutch', setrvačník: 'flywheel', 'dvouhmotový setrvačník': 'dual-mass flywheel',
  výfuk: 'exhaust', katalyzátor: 'catalytic converter', 'lambda sonda': 'lambda probe',
  klimatizace: 'air conditioning', alternátor: 'alternator', startér: 'starter',
  řízení: 'steering', brzdy: 'brakes', 'brzdové destičky': 'brake pads',
  'egr ventil': 'EGR valve',
  // German
  turbolader: 'turbocharger', ölpumpe: 'oil pump', ölfilter: 'oil filter',
  zylinderkopf: 'cylinder head', wasserpumpe: 'water pump',
  kühler: 'radiator', ladeluftkühler: 'intercooler',
  zahnriemen: 'timing belt', kurbelwelle: 'crankshaft', nockenwelle: 'camshaft',
  einspritzdüse: 'injector', glühkerze: 'glow plug', zündkerze: 'spark plug',
  kraftstofffilter: 'fuel filter', kupplung: 'clutch', schwungrad: 'flywheel',
  auspuff: 'exhaust', katalysator: 'catalytic converter',
  klimaanlage: 'air conditioning', lichtmaschine: 'alternator', anlasser: 'starter',
  lenkung: 'steering', bremsen: 'brakes',
}

function translateTerm(raw: string): string {
  return TRANSLATIONS[raw.toLowerCase().trim()] ?? raw
}

/** Pull component keywords out of a fault name in any language */
function keywordsFromFault(name: string): string[] {
  const lo = name.toLowerCase()
  const hits: string[] = []
  for (const [src, en] of Object.entries(TRANSLATIONS)) {
    if (lo.includes(src)) hits.push(en)
  }
  // also match English terms already present
  for (const en of Object.values(TRANSLATIONS)) {
    if (lo.includes(en.toLowerCase()) && !hits.includes(en)) hits.push(en)
  }
  return [...new Set(hits)]
}

// ── Repair-group hints (generic VW numbering, but only used as soft hint) ──

const COMPONENT_RG: Record<string, string[]> = {
  turbocharger: ['21'], intercooler: ['21'],
  'oil pump': ['17'], 'oil filter': ['17'], 'oil sump': ['17'], 'oil cooler': ['17'],
  'cylinder head': ['15'], camshaft: ['15'], valve: ['15'],
  crankshaft: ['13'], flywheel: ['13'], 'timing belt': ['13'],
  'water pump': ['19'], thermostat: ['19'], radiator: ['19'], coolant: ['19'],
  'fuel filter': ['20'], 'fuel pump': ['20'],
  injector: ['23'], injection: ['23'],
  exhaust: ['26'], 'catalytic converter': ['26'], 'EGR valve': ['26'],
  'glow plug': ['28'], 'spark plug': ['15'],
  clutch: ['30'],
  'air conditioning': ['87'],
  alternator: ['90'], starter: ['90'],
  steering: ['44'],
  brakes: ['46'], 'brake pads': ['46'],
  'lambda probe': ['26'],
}

// ── Types ───────────────────────────────────────────────────────────────────

interface EngineHints { kw: number | null; displacement: number | null; fuelHint: string | null }

interface ManualHit {
  manual: string
  section: string
  repair_group: string
  page: number | null
  subsections: { number: string; title: string }[]
  components: string[]
}

// ── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  const user = await getAuthUser(req)
  if (!user) return json({ error: 'Unauthorized' }, 401)

  try {
    const { brand, model, engine_power, components = [], fault_names = [] } = await req.json()

    if (!brand && !model && !components.length && !fault_names.length) {
      return json({ error: 'No search criteria.' }, 400)
    }

    const cleanModel = model ? normalizeModel(model) : ''
    const engine     = engine_power ? parseEngine(engine_power) : { kw: null, displacement: null, fuelHint: null }

    // Translate all component terms to English
    const enTerms = components.map(translateTerm)
    // Also extract keywords from fault names
    const faultKw = fault_names.flatMap(keywordsFromFault)
    const allTerms = [...new Set([...enTerms, ...faultKw])].filter(Boolean)

    // Collect repair-group hints
    const rgHints = [...new Set(allTerms.flatMap(t => COMPONENT_RG[t.toLowerCase()] ?? []))]

    const results = await lookup(cleanModel, engine, allTerms, rgHints)

    return json({ results, count: results.length })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('manual-lookup error:', msg)
    return json({ error: msg }, 500)
  }
})

// ── Query strategies (cascade: stop at first non-empty result) ──────────────

async function lookup(
  model: string,
  eng: EngineHints,
  terms: string[],
  rgHints: string[],
): Promise<ManualHit[]> {
  const noEng: EngineHints = { kw: null, displacement: null, fuelHint: null }

  if (terms.length) {
    // 1a. Component match — full filters (model + engine)
    let r = await qComponent(model, eng, terms)
    if (r.length) return r

    // 1b. Relax: drop model, keep engine (model name may not match graph exactly)
    if (model && (eng.displacement || eng.fuelHint)) {
      r = await qComponent('', eng, terms)
      if (r.length) return r
    }

    // 1c. Relax: keep model, drop engine
    if (model) {
      r = await qComponent(model, noEng, terms)
      if (r.length) return r
    }

    // 1d. Relax: drop both — just find the component anywhere
    r = await qComponent('', noEng, terms)
    if (r.length) return r

    // 2. Fulltext search (same relaxation cascade)
    const ftq = terms.slice(0, 4).join(' ')
    r = await qFulltext(model, eng, ftq)
    if (r.length) return r
    r = await qFulltext('', eng, ftq)
    if (r.length) return r
    r = await qFulltext('', noEng, ftq)
    if (r.length) return r
  }

  // 3. Repair-group browse
  if (rgHints.length) {
    let r = await qRepairGroup(model, eng, rgHints)
    if (r.length) return r
    if (model) {
      r = await qRepairGroup(model, noEng, rgHints)
      if (r.length) return r
    }
  }

  // 4. List all sections for vehicle
  if (model) return qVehicle(model, eng)
  return []
}

// ── Query helpers ───────────────────────────────────────────────────────────

/**
 * Optional clauses are appended only when relevant.
 * Engine matching is relaxed: displacement OR fuelHint, not both required.
 */
function vehicleWhere(model: string): string {
  if (!model) return ''
  // Match if vehicle model contains the search term OR vice versa
  // This handles "Golf Plus" matching vehicle "Golf" and "Golf Plus" matching "Golf Plus 2005"
  return `MATCH (v:Vehicle)-[:DESCRIBED_IN]->(m)
          WHERE toLower(v.model) CONTAINS toLower($model)
             OR toLower($model) CONTAINS toLower(v.model)`
}

function engineWhere(eng: EngineHints): string {
  if (!eng.displacement && !eng.fuelHint) return ''
  const conds: string[] = []
  if (eng.displacement) conds.push('eng.displacement = $disp')
  if (eng.fuelHint) {
    // Use parameter for fuel types — not inline array literal
    conds.push('eng.fuel_type IN $fuelTypes')
  }
  return `MATCH (eng:Engine)-[:DESCRIBED_IN]->(m) WHERE ${conds.join(' AND ')}`
}

function baseParams(model: string, eng: EngineHints): Record<string, unknown> {
  const p: Record<string, unknown> = {}
  if (model) p.model = model
  if (eng.displacement) p.disp = eng.displacement
  if (eng.fuelHint) {
    p.fuelTypes = eng.fuelHint === 'diesel'
      ? ['diesel']
      : ['petrol', 'petrol_turbo', 'petrol_supercharged']
  }
  return p
}

function toHit(row: Record<string, unknown>): ManualHit {
  return {
    manual:       (row.manual as string) ?? '',
    section:      (row.section as string) ?? '',
    repair_group: (row.rg as string) ?? '',
    page:         (row.page as number) ?? null,
    subsections:  ((row.subs as unknown[][]) ?? [])
                    .filter(s => s?.[0] && s?.[1])
                    .map(s => ({ number: String(s[0]), title: String(s[1]) })),
    components:   (row.comps as string[]) ?? [],
  }
}

// ── Queries ─────────────────────────────────────────────────────────────────

async function qComponent(model: string, eng: EngineHints, terms: string[]): Promise<ManualHit[]> {
  // Pass terms as parameter list — safe against injection
  const rows = await cypher(`
    UNWIND $terms AS term
    MATCH (c:Component) WHERE toLower(c.name) CONTAINS toLower(term)
    WITH DISTINCT c
    MATCH (sub:Subsection)-[:ABOUT_COMPONENT]->(c)
    MATCH (sec:Section)-[:CONTAINS]->(sub)
    MATCH (m:Manual)-[:CONTAINS]->(sec)
    ${vehicleWhere(model)}
    ${engineWhere(eng)}
    RETURN m.filename AS manual, sec.title AS section, sec.repair_group AS rg,
           sec.pdf_page AS page,
           collect(DISTINCT [sub.number, sub.title]) AS subs,
           collect(DISTINCT c.name) AS comps
    ORDER BY rg LIMIT 15
  `, { terms, ...baseParams(model, eng) })
  return rows.map(toHit)
}

async function qFulltext(model: string, eng: EngineHints, query: string): Promise<ManualHit[]> {
  const rows = await cypher(`
    CALL db.index.fulltext.queryNodes("component_search", $query) YIELD node, score
    WHERE score > 0.3
    WITH node AS c ORDER BY score DESC LIMIT 20
    MATCH (sub:Subsection)-[:ABOUT_COMPONENT]->(c)
    MATCH (sec:Section)-[:CONTAINS]->(sub)
    MATCH (m:Manual)-[:CONTAINS]->(sec)
    ${vehicleWhere(model)}
    ${engineWhere(eng)}
    RETURN m.filename AS manual, sec.title AS section, sec.repair_group AS rg,
           sec.pdf_page AS page,
           collect(DISTINCT [sub.number, sub.title]) AS subs,
           collect(DISTINCT c.name) AS comps
    ORDER BY rg LIMIT 15
  `, { query, ...baseParams(model, eng) })
  return rows.map(toHit)
}

async function qRepairGroup(model: string, eng: EngineHints, rgs: string[]): Promise<ManualHit[]> {
  const rows = await cypher(`
    MATCH (sec:Section) WHERE sec.repair_group IN $rgs
    MATCH (m:Manual)-[:CONTAINS]->(sec)
    ${vehicleWhere(model)}
    ${engineWhere(eng)}
    OPTIONAL MATCH (sec)-[:CONTAINS]->(sub:Subsection)
    RETURN m.filename AS manual, sec.title AS section, sec.repair_group AS rg,
           sec.pdf_page AS page,
           collect(DISTINCT [sub.number, sub.title]) AS subs,
           [] AS comps
    ORDER BY rg LIMIT 15
  `, { rgs, ...baseParams(model, eng) })
  return rows.map(toHit)
}

async function qVehicle(model: string, eng: EngineHints): Promise<ManualHit[]> {
  const rows = await cypher(`
    MATCH (v:Vehicle)-[:DESCRIBED_IN]->(m:Manual)
    WHERE toLower(v.model) CONTAINS toLower($model)
    ${engineWhere(eng)}
    MATCH (m)-[:CONTAINS]->(sec:Section)
    RETURN m.filename AS manual, sec.title AS section, sec.repair_group AS rg,
           sec.pdf_page AS page, [] AS subs, [] AS comps
    ORDER BY rg LIMIT 30
  `, { ...baseParams(model, eng) })
  return rows.map(toHit)
}
