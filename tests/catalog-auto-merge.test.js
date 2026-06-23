import assert from 'node:assert/strict';
import { mergeAuto } from '../web/src/constants/catalog-helpers.js';

const STATIC = [
  { brand: 'BMW', active: true, models: [{ group: '5 Series' }, { label: '5 E60 (2003–2010)' }] },
  { brand: 'Mazda', active: true, models: [{ label: 'Mazda2 Hybrid (2022–present)' }] }, // EU Mazda
];
const AUTO = [
  { brand: 'BMW', market: 'EU', model: { label: '5 E39 (1995–2003)', powers: ['110 kW – 520i 2.0'] } },
  { brand: 'Mazda', market: 'US', model: { label: 'Mazda3 (2019–present)', powers: ['186 hp – 2.5L'] } }, // US → NEsmí do EU Mazdy
];

const merged = mergeAuto(STATIC, AUTO, 'EU');

const bmw = merged.find((b) => b.brand === 'BMW');
assert.ok(bmw.models.some((m) => m.label === '5 E39 (1995–2003)'), 'EU auto model připojen k BMW');
assert.equal(bmw.models.length, 3, 'připojeno (group + E60 + E39), ne nahrazeno');
assert.equal(bmw.models[0].group, '5 Series', 'původní pořadí zachováno, auto na konci');

const mazda = merged.find((b) => b.brand === 'Mazda');
assert.equal(mazda.models.length, 1, 'US auto model se NEpřipojil k EU Mazdě (market guard)');

// prázdný auto-seznam → původní katalog beze změny (reference-equal)
assert.equal(mergeAuto(STATIC, [], 'EU'), STATIC, 'prázdný auto → původní katalog beze změny');
assert.equal(mergeAuto(STATIC, undefined, 'EU'), STATIC, 'undefined auto → beze změny');

console.log('catalog-auto-merge.test.js passed');
