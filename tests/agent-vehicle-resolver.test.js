import assert from 'node:assert/strict';
import { buildCatalogIndex, resolveVehicle, familyToken, normVehicle } from '../scripts/agent/vehicle-resolver.mjs';

// Mock catalog so the test is independent of the live catalog contents.
const MOCK = [
  { brand: 'SEAT', active: true, models: [{ group: 'Leon' }, { label: 'Leon Mk3 (2012–2020)' }] },
  { brand: 'Škoda', active: true, models: [{ group: 'Octavia' }, { label: 'Octavia III (2013–2020)' }] },
  { brand: 'Volkswagen', active: true, models: [{ group: 'Golf' }, { label: 'Golf Mk7 (2012–2020)' }] },
  { brand: 'Alfa Romeo', active: false, models: [{ group: 'Giulia' }, { label: 'Giulia (2016–)' }] },
  { brand: 'BMW', active: true, models: [{ group: '5 Series' }, { label: '5 Series F10 (2010–2017)' }] },
];
const idx = buildCatalogIndex([MOCK]);

// helpers
assert.equal(normVehicle('Škoda'), 'skoda', 'diacritics stripped');
assert.equal(familyToken('5 Series F10 (2010–2017)'), '5', 'family = first token');
assert.equal(familyToken('Octavia III'), 'octavia');

// exact, active, model family present → discoverable, no change
let r = resolveVehicle({ brand: 'SEAT', model: 'Leon Mk3' }, idx);
assert.equal(r.matched, true);
assert.equal(r.brandActive, true);
assert.equal(r.brandChanged, false);
assert.equal(r.modelInCatalog, true);
assert.equal(r.needsModelResolution, false);
assert.deepEqual(r.changes, {});

// brand casing differs → canonical SEAT, brand change emitted
r = resolveVehicle({ brand: 'Seat', model: 'Leon' }, idx);
assert.equal(r.canonicalBrand, 'SEAT');
assert.equal(r.brandChanged, true);
assert.equal(r.changes.vehicle_brand, 'SEAT');
assert.equal(r.modelInCatalog, true);

// diacritics: stored "Skoda" → canonical "Škoda"
r = resolveVehicle({ brand: 'Skoda', model: 'Octavia 3' }, idx);
assert.equal(r.canonicalBrand, 'Škoda');
assert.equal(r.brandChanged, true);
assert.equal(r.modelInCatalog, true);

// brand alias VW → Volkswagen
r = resolveVehicle({ brand: 'VW', model: 'Golf' }, idx);
assert.equal(r.canonicalBrand, 'Volkswagen');
assert.equal(r.brandChanged, true);
assert.equal(r.modelInCatalog, true);

// brand present but INACTIVE → needs activation (not a case write)
r = resolveVehicle({ brand: 'Alfa Romeo', model: 'Giulia' }, idx);
assert.equal(r.matched, true);
assert.equal(r.brandActive, false);
assert.equal(r.modelInCatalog, true);

// chassis code not a catalog family → needs model resolution (LLM/alias) or gap
r = resolveVehicle({ brand: 'BMW', model: 'E39' }, idx);
assert.equal(r.matched, true);
assert.equal(r.modelInCatalog, false);
assert.equal(r.needsModelResolution, true);

// brand not in catalog at all
r = resolveVehicle({ brand: 'Tesla', model: 'Model 3' }, idx);
assert.equal(r.matched, false);
assert.equal(r.needsModelResolution, true);

// falls back through raw fields (brand_raw/model_raw)
r = resolveVehicle({ brand_raw: 'Seat', model_raw: 'Leon' }, idx);
assert.equal(r.canonicalBrand, 'SEAT');

console.log('agent-vehicle-resolver.test.js passed');
