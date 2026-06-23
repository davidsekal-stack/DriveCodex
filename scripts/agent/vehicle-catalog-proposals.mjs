/**
 * vehicle-catalog-proposals.mjs — Fáze 2: z model-level mezer (logs/catalog-
 * proposals/gaps.json, produkuje vehicle-resolve-backfill.mjs) sestaví ČISTÉ
 * návrhy katalogových položek (label + roky výroby + motorizace) ve formátu
 * web/src/constants/catalog*.js.
 *
 * Návrhy jsou DRAFTY ke schválení (lidská brána) — NIC nezapisuje do katalogu.
 * LLM může v rocích/motorizaci chybovat → proto se to NEnasazuje automaticky;
 * majitel/operátor návrhy zkontroluje a teprve pak se zapíšou do catalog.js +
 * commit + deploy (samostatný krok, zrcadlo apply-proposal).
 *
 * Usage:
 *   node --env-file=scripts/agent/.env.local scripts/agent/vehicle-catalog-proposals.mjs
 */
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { runLlm } from './llm.mjs';
import { VEHICLE_CATALOG_US } from '../../web/src/constants/catalog-us.js';

const DIR = new URL('./logs/catalog-proposals/', import.meta.url);
const US_BRANDS = new Set(VEHICLE_CATALOG_US.map(b => b.brand));

export function buildProposalPrompt(brand, isUS, vehicles) {
  const unit = isUS ? 'hp (US convention)' : 'kW (EU convention)';
  return `You are extending an automotive app's vehicle catalog. For the brand "${brand}", the cases below reference models/generations that are MISSING from the catalog. Draft accurate catalog entries.

MISSING VEHICLES found in real repair cases (model text as extracted + engine if known):
${vehicles.map(v => `- model: "${v.model}"${v.engine ? ` | engine: "${v.engine}"` : ''}`).join('\n')}

Produce one catalog entry per distinct MODEL GENERATION. Rules:
- "label": "<Model Generation/chassis (startYear–endYear)>" with ACCURATE real production years, e.g. "5 E39 (1995–2003)", "Favorit (1987–1995)", "Celestiq (2024–present)". Use an en-dash – between years.
- "powers": array of real engine variants for THAT generation, format "<N> ${unit} – <engine>" (e.g. "${isUS ? '420 hp – 6.2L V8' : '110 kW – 2.0 TDI'}"). Include only variants you are CONFIDENT are real; if unsure, return an empty array [] rather than guessing.
- "covers": array of the input model strings this entry accounts for.
- Keep the SAME generation only — do not merge different generations into one entry.
- If a referenced "model" is not a real ${brand} vehicle, omit it.

Return ONLY a JSON array, nothing else:
[{"label":"...","powers":["..."],"covers":["..."]}]`;
}

function parseArray(raw) {
  const t = (raw || '').trim();
  const s = t.indexOf('['); const e = t.lastIndexOf(']');
  if (s === -1 || e <= s) return null;
  try { const a = JSON.parse(t.slice(s, e + 1)); return Array.isArray(a) ? a : null; } catch { return null; }
}

export async function runProposals({ llm = runLlm } = {}) {
  const gaps = JSON.parse(readFileSync(new URL('./gaps.json', DIR), 'utf8'));
  // sdruž podle kanonické značky
  const byBrand = new Map();
  for (const g of gaps) {
    if (!byBrand.has(g.brand)) byBrand.set(g.brand, []);
    byBrand.get(g.brand).push({ model: g.model, engine: g.engine });
  }

  const proposals = [];
  const failed = [];
  for (const [brand, vehicles] of byBrand) {
    const isUS = US_BRANDS.has(brand);
    let entries = null;
    for (let attempt = 1; attempt <= 2 && entries === null; attempt++) {
      try {
        const raw = await llm('catalog-propose', buildProposalPrompt(brand, isUS, vehicles), { maxTokens: 1500, timeoutMs: 240000 });
        entries = parseArray(raw) || [];
      } catch (e) {
        console.log(`  ! ${brand} pokus ${attempt}/2 selhal: ${String(e?.message || e).slice(0, 70)}`);
        if (attempt === 2) failed.push(brand);
      }
    }
    if (entries === null) continue; // obě selhání → přeskoč (značka v `failed`)
    for (const e of entries) {
      if (!e || typeof e.label !== 'string') continue;
      proposals.push({ brand, label: e.label, powers: Array.isArray(e.powers) ? e.powers : [], covers: Array.isArray(e.covers) ? e.covers : [], market: isUS ? 'US' : 'EU' });
    }
    console.log(`  ${brand}: ${entries.length} návrh(ů)`);
  }
  if (failed.length) console.log(`\n⚠️ NEDOKONČENO (k re-runu): ${failed.join(', ')}`);

  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  writeFileSync(new URL('./proposals.json', DIR), JSON.stringify(proposals, null, 2));
  // čitelný přehled
  const md = ['# Návrhy doplnění katalogu (Fáze 2)', '', `Celkem ${proposals.length} položek z ${byBrand.size} značek. Zkontroluj roky/motorizace před zápisem do katalogu.`, ''];
  let lastBrand = '';
  for (const p of proposals.sort((a, b) => a.brand.localeCompare(b.brand))) {
    if (p.brand !== lastBrand) { md.push(`\n## ${p.brand} (${p.market})`); lastBrand = p.brand; }
    md.push(`- **${p.label}** — ${p.powers.length ? p.powers.join(', ') : '_(bez motorizací)_'}  ⟵ pokrývá: ${p.covers.join(', ') || '?'}`);
  }
  writeFileSync(new URL('./proposals.md', DIR), md.join('\n'));
  console.log(`\nHotovo: ${proposals.length} návrhů → logs/catalog-proposals/proposals.json (+ .md). Zápis do katalogu je samostatný schválený krok.`);
  return { proposals };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runProposals().catch(e => { console.error(e); process.exit(1); });
}
