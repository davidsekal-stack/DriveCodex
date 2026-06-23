/**
 * vehicle-catalog-apply.mjs — Fáze 2 APPLY: vloží schválené návrhy z
 * logs/catalog-proposals/proposals.json do web/src/constants/catalog.js (EU)
 * a catalog-us.js (US). Lidsky schválený krok (mění katalog → deploy).
 *
 * Aplikuje ověřené OPRAVY: vypustí redundantní BMW "3 E9x" (katalog už má
 * "3 E90"), opraví Scion label (bez pochybného chassis-kódu), rok Celestiq a
 * výkon Lexus RZ.
 *
 * Vkládá čistě stringově hned za `models: [` dané značky (zbytek souboru beze
 * změny). Default dry-run; --apply zapisuje.
 */
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { VEHICLE_CATALOG_US } from '../../web/src/constants/catalog-us.js';

const PROPOSALS = new URL('./logs/catalog-proposals/proposals.json', import.meta.url);
const EU_FILE = new URL('../../web/src/constants/catalog.js', import.meta.url);
const US_FILE = new URL('../../web/src/constants/catalog-us.js', import.meta.url);
const US_BRANDS = new Set(VEHICLE_CATALOG_US.map(b => b.brand));

// Ověřené opravy aplikované na syrové návrhy.
function applyFixes(raw) {
  const out = [];
  for (const p of raw) {
    if (p.brand === 'BMW' && /E9x/.test(p.label)) continue; // redundantní s existující "3 E90"
    if (p.brand === 'Toyota' && /Scion xB/.test(p.label)) {
      out.push({ ...p, label: 'Scion xB (2007–2015)', powers: ['118 kW – 2.4 2AZ-FE'] }); // pochybný "E160" pryč
      continue;
    }
    if (p.brand === 'Cadillac' && /Celestiq/.test(p.label)) { out.push({ ...p, label: 'Celestiq (2025–present)' }); continue; }
    if (p.brand === 'Lexus' && /^RZ/.test(p.label)) { out.push({ ...p, powers: ['313 hp – dual motor AWD', '150 kW – single motor FWD'] }); continue; }
    out.push(p);
  }
  return out;
}

function fmtEntry(p) {
  const powers = (p.powers || []).filter(Boolean);
  const pw = powers.length ? `, powers: [${powers.map(s => JSON.stringify(s)).join(', ')}]` : '';
  return `      { label: ${JSON.stringify(p.label)}${pw} },`;
}

function insertForFile(text, byBrand) {
  let result = text;
  const report = [];
  for (const [brand, entries] of byBrand) {
    const brandIdx = result.indexOf(`brand:     ${JSON.stringify(brand)},`);
    if (brandIdx === -1) { report.push(`  ✗ ${brand}: brand řádek NENALEZEN`); continue; }
    const modelsIdx = result.indexOf('models: [', brandIdx);
    if (modelsIdx === -1) { report.push(`  ✗ ${brand}: models: [ nenalezeno`); continue; }
    const insertAt = result.indexOf('\n', modelsIdx) + 1; // hned za "models: ["
    const block = entries.map(fmtEntry).join('\n') + '\n';
    result = result.slice(0, insertAt) + block + result.slice(insertAt);
    report.push(`  ✓ ${brand}: +${entries.length}`);
  }
  return { result, report };
}

export function run({ dryRun = true } = {}) {
  const proposals = applyFixes(JSON.parse(readFileSync(PROPOSALS, 'utf8')));
  const euByBrand = new Map(), usByBrand = new Map();
  for (const p of proposals) {
    const map = US_BRANDS.has(p.brand) ? usByBrand : euByBrand;
    if (!map.has(p.brand)) map.set(p.brand, []);
    map.get(p.brand).push(p);
  }
  console.log(`Po opravách: ${proposals.length} položek (EU ${[...euByBrand.values()].flat().length} / US ${[...usByBrand.values()].flat().length})`);

  const eu = insertForFile(readFileSync(EU_FILE, 'utf8'), euByBrand);
  const us = insertForFile(readFileSync(US_FILE, 'utf8'), usByBrand);
  console.log('\nEU (catalog.js):'); eu.report.forEach(r => console.log(r));
  console.log('\nUS (catalog-us.js):'); us.report.forEach(r => console.log(r));

  // ukázka vložených bloků
  console.log('\n— ukázka vkládaných položek —');
  for (const [brand, entries] of [...euByBrand, ...usByBrand]) for (const e of entries.slice(0, 99)) console.log(`  [${brand}] ${fmtEntry(e).trim()}`);

  if (dryRun) { console.log('\n[dry-run] soubory nezměněny.'); return; }
  if (eu.report.some(r => r.includes('✗')) || us.report.some(r => r.includes('✗'))) { console.error('\nNĚKTERÁ ZNAČKA NENALEZENA — nezapisuji, oprav anchory.'); process.exit(1); }
  writeFileSync(EU_FILE, eu.result);
  writeFileSync(US_FILE, us.result);
  console.log('\n[apply] catalog.js + catalog-us.js zapsány.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run({ dryRun: !process.argv.includes('--apply') });
}
