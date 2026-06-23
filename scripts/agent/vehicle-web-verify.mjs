/**
 * vehicle-web-verify.mjs — Fáze 1 jádro spolehlivosti automatického rozšiřování
 * katalogu. Claude + WebSearch ověří kandidáta vozidla z VÍCE NEZÁVISLÝCH,
 * ideálně OFICIÁLNÍCH zdrojů (NE fóra/blogy/inzeráty — fórum je ten zdroj, co
 * ověřujeme, bylo by to kruhové).
 *
 * Confirm=true jen když:
 *   - model/generace existuje a je IN-SCOPE (osobák/dodávka/lehký pickup), a
 *   - shodu potvrdí >=2 NEZÁVISLÉ ne-fórové domény (kontrola v KÓDU, ne jen
 *     dle modelu — model nemá poslední slovo).
 * Jinak confirmed=false → vůz se PODRŽÍ (nepřidá), zaloguje.
 *
 * Usage (test na vzorku): node --env-file=scripts/agent/.env.local scripts/agent/vehicle-web-verify.mjs
 */
import { pathToFileURL } from 'node:url';
import { runLlm } from './llm.mjs';

const VERIFY_TIMEOUT_MS = 300_000;
const MIN_INDEPENDENT_SOURCES = 2;

// Domény, které se NEPOČÍTAJÍ jako autoritativní potvrzení (fóra, kluby, UGC,
// inzeráty, sociální sítě, blogy). Fórum je vstup, ne důkaz.
const NON_AUTHORITATIVE_RE =
  /(forum|forums|klub|club|\bbbs\b|reddit|quora|blogspot|wordpress|medium\.com|pinterest|facebook|fb\.com|twitter|x\.com|youtube|tiktok|instagram|bazos|bazar|autobazar|sauto|inzer|mobile\.de|autoscout|gumtree|craigslist|ebay|marktplaats)/i;

function hostOf(url) {
  try { return new URL(url).host.replace(/^www\./i, '').toLowerCase(); } catch { return ''; }
}

export function buildVerifyPrompt({ brand, model, market, engine, examples }) {
  const ex = Array.isArray(examples) && examples.length ? examples.join('", "') : model;
  return `You verify a candidate vehicle for an automotive catalog, using web search. Reliability is critical: CONFIRM ONLY from MULTIPLE INDEPENDENT, AUTHORITATIVE / OFFICIAL sources — the manufacturer's own site, Wikipedia, or established automotive encyclopedias / spec databases (e.g. autoevolution, automobile-catalog, ultimatespecs, ev-database, caranddriver). DO NOT treat forums, clubs, blogs, classifieds, marketplaces, social media, or any user-generated content as confirming sources.

CANDIDATE: brand="${brand}", model="${model}", market=${market}.
This vehicle appears in real repair cases as: "${ex}". Engine hint from cases: "${engine || 'unknown'}".
Use these to identify the SPECIFIC model line and GENERATION, and pick the generation CONSISTENT with the engine/era: a combustion engine (e.g. a "1.4", a "TDI", a carburettor) RULES OUT a modern electric-only generation; conversely an electric powertrain rules out a 1980s generation. If the name is ambiguous across generations (e.g. "Renault 5" — classic 1972–1996 vs the 2024 electric "5 E-Tech"), CHOOSE the one matching the engine hint, not merely the most famous one. Use the clean base model name from the examples, not a trim suffix.
IMPORTANT — generation: if the candidate model or the examples already name a GENERATION or CHASSIS CODE (e.g. "B8", "E39", "E92", "W202", "6L", "CD", "Mk III"), you MUST verify and KEEP THAT EXACT generation — never substitute a different generation of the same model (e.g. do NOT return a C4-generation "S4" when the candidate says "B8").
IMPORTANT — trims: treat trim/equipment suffixes (GLX, GT, GTI, Sport, L, LX, LS, GTL, FR, Cupra, T-GDi) as TRIMS of the model line, NOT separate models — verify that the MODEL LINE/generation exists; do not reject just because an exact trim string isn't separately documented.

Steps:
1. Web-search for this brand + model (+ its generation/chassis if present in the text).
2. Find at least TWO INDEPENDENT authoritative sources (different organisations / domains, NONE a forum or user content) that describe this exact model/generation.
3. Cross-check ACROSS those sources and agree on: (a) does this exact model/generation really EXIST? (b) production YEARS (start–end, or start–present); (c) BODY TYPE — a passenger car, light van, or light pickup = IN SCOPE; a motorcycle / heavy truck / bus / tractor / boat = OUT OF SCOPE; (d) the engine/motorisation variants, with the market unit (kW for EU, hp for US) — include ONLY variants a source explicitly states.
4. Set confirmed=true ONLY IF at least two independent authoritative non-forum sources AGREE it exists and is in scope. If sources conflict, you can find only forums/UGC, or you cannot find two independent authoritative sources → confirmed=false.

Return ONLY this JSON, nothing else (use an en-dash – in labels/powers):
{"confirmed":true,"in_scope":true,"model_label":"<Model Generation (start–end)>","years":"<start–end>","powers":["<N> kW – <engine>"],"market":"EU","sources":[{"url":"https://…","name":"…","official":true,"is_forum":false}],"reason":"<=25 words"}`;
}

export function parseVerdict(raw) {
  const t = (raw || '').toString();
  const s = t.indexOf('{'); const e = t.lastIndexOf('}');
  if (s === -1 || e <= s) return null;
  try { return JSON.parse(t.slice(s, e + 1)); } catch { return null; }
}

/** Spočítá NEZÁVISLÉ autoritativní (ne-fórové) domény mezi zdroji. */
export function independentAuthoritativeDomains(sources) {
  const domains = new Set();
  for (const src of Array.isArray(sources) ? sources : []) {
    if (!src || typeof src.url !== 'string') continue;
    if (src.is_forum === true) continue;
    const host = hostOf(src.url);
    if (!host || NON_AUTHORITATIVE_RE.test(host)) continue;
    domains.add(host);
  }
  return [...domains];
}

/**
 * Ověř kandidáta. Vrací { confirmed, held, ...verdict, independentDomains }.
 * confirmed pouze pokud model i KÓDOVÁ kontrola zdrojů souhlasí.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Přechodné chyby API (přetížení 529, 5xx, 429, timeout) NEjsou „podržet" — pro
// noční bezobslužný běh je nutné zkusit znovu s backoffem. Trvalé chyby a kvóta
// propadnou ven (kvótu řeší orchestrátor).
async function callVerifyWithRetry(llm, prompt, attempts = 4) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      return await llm('catalog-verify', prompt, { allowedTools: ['WebSearch'], timeoutMs: VERIFY_TIMEOUT_MS });
    } catch (e) {
      last = e;
      const msg = String(e?.message || e);
      const transient = /transient|HTTP\s*5\d\d|\b529\b|\b503\b|\b500\b|\b429\b|overload|timeout|ETIMEDOUT|ECONNRESET|EAI_AGAIN/i.test(msg);
      if (!transient || i === attempts - 1) throw e;
      await sleep(4000 * (i + 1)); // 4s, 8s, 12s
    }
  }
  throw last;
}

export async function verifyVehicle(candidate, { llm = runLlm } = {}) {
  let raw;
  try {
    raw = await callVerifyWithRetry(llm, buildVerifyPrompt(candidate));
  } catch (err) {
    return { confirmed: false, held: true, reason: `verify error: ${String(err?.message || err).slice(0, 80)}`, independentDomains: [] };
  }
  const v = parseVerdict(raw);
  if (!v) return { confirmed: false, held: true, reason: 'unparseable verifier output', independentDomains: [] };

  const domains = independentAuthoritativeDomains(v.sources);
  // KÓDOVÁ pojistka: bez ohledu na to, co řekl model, vyžadujeme reálnou shodu zdrojů.
  const confirmed = v.confirmed === true && v.in_scope === true && domains.length >= MIN_INDEPENDENT_SOURCES;
  return {
    confirmed,
    held: !confirmed,
    model_label: v.model_label || '',
    years: v.years || '',
    powers: Array.isArray(v.powers) ? v.powers : [],
    market: v.market || candidate.market || '',
    sources: Array.isArray(v.sources) ? v.sources : [],
    independentDomains: domains,
    reason: confirmed ? (v.reason || 'confirmed') : (v.reason || `held: only ${domains.length} independent authoritative source(s)`),
  };
}

// ── CLI: test na pestrém vzorku (vč. záměrně FALEŠNÉHO, ať vidíme, že se podrží) ──
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const SAMPLE = [
    { brand: 'Škoda', model: 'Favorit', market: 'EU' },           // reálná klasika → confirm
    { brand: 'Cadillac', model: 'Celestiq', market: 'US' },       // reálné nové EV → confirm
    { brand: 'BMW', model: 'E39', market: 'EU' },                 // chassis-kód (5 Series) → confirm
    { brand: 'Toyota', model: 'Scion xB', market: 'EU' },        // reálné, ale US/JP → confirm (+pozn. market)
    { brand: 'Lexus', model: 'RZ', market: 'US' },               // reálné EV → confirm
    { brand: 'Audi', model: 'A9 quattro sport', market: 'EU' },  // VYMYŠLENÉ → musí se PODRŽET
  ];
  for (const c of SAMPLE) {
    const r = await verifyVehicle(c);
    const tag = r.confirmed ? '✅ PŘIDAT' : '⏸ PODRŽET';
    console.log(`\n${tag}  ${c.brand} / ${c.model}`);
    console.log(`   label: ${r.model_label || '—'} | roky: ${r.years || '—'}`);
    console.log(`   nezávislé zdroje (${r.independentDomains.length}): ${r.independentDomains.join(', ') || '—'}`);
    console.log(`   motory: ${(r.powers || []).join(' | ') || '—'}`);
    console.log(`   důvod: ${r.reason}`);
  }
}
