/**
 * Unit testy — panel „Známé závady tohoto vozu" (web/src/lib/known-faults.js)
 *
 * Spuštění:  node tests/known-faults.test.js
 */

import assert from 'node:assert/strict';
import {
  BANDS,
  bandForMileage,
  pickFaultLabel,
  localizeResolution,
  countForBand,
  bandTotals,
  topObdCodes,
  sourceLabelFor,
} from '../web/src/lib/known-faults.js';

// ── bandForMileage — musí odpovídat SQL mileage_band (migrace 021) ───────────

assert.equal(bandForMileage(''), 'all');
assert.equal(bandForMileage(null), 'all');
assert.equal(bandForMileage(undefined), 'all');
assert.equal(bandForMileage('abc'), 'all');
assert.equal(bandForMileage(0), 'all');
assert.equal(bandForMileage(-5), 'all');
assert.equal(bandForMileage('99999'), '0-100');
assert.equal(bandForMileage(100000), '100-150');
assert.equal(bandForMileage('149999'), '100-150');
assert.equal(bandForMileage(150000), '150-200');
assert.equal(bandForMileage('185000'), '150-200');
assert.equal(bandForMileage(200000), '200+');
assert.equal(bandForMileage(412000), '200+');

// ── pickFaultLabel — lokalizace s fallbacky ──────────────────────────────────

const fault = {
  faultId: 'egr-valve-failure',
  labelCs: 'EGR ventil — zanesený / vadný',
  labelEn: 'EGR valve clogged or faulty',
  labelDe: 'AGR-Ventil verstopft oder defekt',
  counts: { all: 41, '0-100': 2, '100-150': 10, '150-200': 25, '200+': 3, unknown: 1 },
};

assert.equal(pickFaultLabel(fault, 'cs'), 'EGR ventil — zanesený / vadný');
assert.equal(pickFaultLabel(fault, 'en'), 'EGR valve clogged or faulty');
assert.equal(pickFaultLabel(fault, 'de'), 'AGR-Ventil verstopft oder defekt');
// Neznámý jazyk → angličtina
assert.equal(pickFaultLabel(fault, 'fr'), 'EGR valve clogged or faulty');
// Chybějící labely → fallback na EN, pak na slug
assert.equal(pickFaultLabel({ faultId: 'x', labelEn: 'X fault' }, 'cs'), 'X fault');
assert.equal(pickFaultLabel({ faultId: 'x-slug' }, 'cs'), 'x-slug');
assert.equal(pickFaultLabel(null, 'cs'), '');

// ── localizeResolution — lokalizace textu opravy s fallbackem na EN ──────────

const caseFull = {
  resolution: 'Replaced the in-tank fuel pump.',
  resolutionCs: 'Vyměněno palivové čerpadlo v nádrži.',
  resolutionDe: 'Kraftstoffpumpe im Tank ersetzt.',
  resolutionLang: 'en',
};
assert.equal(localizeResolution(caseFull, 'cs'), 'Vyměněno palivové čerpadlo v nádrži.');
assert.equal(localizeResolution(caseFull, 'de'), 'Kraftstoffpumpe im Tank ersetzt.');
assert.equal(localizeResolution(caseFull, 'en'), 'Replaced the in-tank fuel pump.');
// Neznámý jazyk → kanonická angličtina
assert.equal(localizeResolution(caseFull, 'fr'), 'Replaced the in-tank fuel pump.');
// Chybějící CZ/DE varianta → fallback na anglický originál
assert.equal(localizeResolution({ resolution: 'English only.' }, 'cs'), 'English only.');
assert.equal(localizeResolution({ resolution: 'English only.', resolutionCs: null }, 'cs'), 'English only.');
assert.equal(localizeResolution({ resolution: 'English only.', resolutionDe: '' }, 'de'), 'English only.');
// Prázdný/chybný vstup
assert.equal(localizeResolution(null, 'cs'), '');
assert.equal(localizeResolution({}, 'cs'), '');

// ── countForBand + bandTotals ────────────────────────────────────────────────

assert.equal(countForBand(fault, 'all'), 41);
assert.equal(countForBand(fault, '150-200'), 25);
assert.equal(countForBand(fault, '200+'), 3);
assert.equal(countForBand({ counts: {} }, '150-200'), 0);
assert.equal(countForBand(null, 'all'), 0);

const totals = bandTotals([fault, { counts: { all: 9, '150-200': 4 } }]);
assert.equal(totals.all, 50);
assert.equal(totals['150-200'], 29);
assert.equal(totals['0-100'], 2);
assert.deepEqual(Object.keys(totals).sort(), [...BANDS].sort());
assert.deepEqual(bandTotals([]), { all: 0, '0-100': 0, '100-150': 0, '150-200': 0, '200+': 0 });

// ── topObdCodes — četnostní žebříček napříč případy ──────────────────────────

const cases = [
  { obdCodes: ['P0401', 'P0403'] },
  { obdCodes: ['p0401'] },
  { obdCodes: ['P0401', 'P0101'] },
  { obdCodes: [] },
  { obdCodes: null },
];
assert.deepEqual(topObdCodes(cases, 2), ['P0401', 'P0403']);
assert.deepEqual(topObdCodes(cases), ['P0401', 'P0403', 'P0101']);
assert.deepEqual(topObdCodes([]), []);
assert.deepEqual(topObdCodes(null), []);

// ── sourceLabelFor — doména zdroje vs. uživatel aplikace ─────────────────────

assert.equal(sourceLabelFor('https://www.skodahome.cz/forum/topic/123'), 'skodahome.cz');
assert.equal(sourceLabelFor('https://forum.fordtransit.org/viewtopic.php?t=1'), 'forum.fordtransit.org');
assert.equal(sourceLabelFor(''), null);
assert.equal(sourceLabelFor(null), null);
assert.equal(sourceLabelFor('not a url'), null);

console.log('known-faults.test.js passed');
