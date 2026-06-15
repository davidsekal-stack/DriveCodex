import assert from 'node:assert/strict';
import {
  splitModel,
  buildCatalogGenerations,
  buildSeedPrompt,
  parseSeedResponse,
  buildClassifyPrompt,
  parseClassifyResponse,
  prepareBatchItems,
  runSeed,
  runClassify,
} from '../scripts/agent/fault-taxonomy.mjs';
import { resolveRoute } from '../scripts/agent/llm.mjs';

// ── splitModel: JS zrcadlo SQL normalizace z migrace 021 ─────────────────────

function testSplitModel() {
  // Generační tokeny: římské číslice → arabské
  assert.deepEqual(splitModel('Octavia II (2006–2013)'), { family: 'octavia', gen: '2', year: '2006' });
  assert.deepEqual(splitModel('Octavia II (2004–2013)'), { family: 'octavia', gen: '2', year: '2004' });
  assert.deepEqual(splitModel('Octavia IV (2020–dosud)'), { family: 'octavia', gen: '4', year: '2020' });
  // MK varianty: MK5, MK III, label s motorem uvnitř
  assert.deepEqual(splitModel('Transit MK5 2.5 Diesel (1994–2000)'), { family: 'transit', gen: 'mk5', year: '1994' });
  assert.deepEqual(splitModel('Mondeo MK III (2000–2007)'), { family: 'mondeo', gen: 'mk3', year: '2000' });
  assert.deepEqual(splitModel('Fiesta MK7 (2008–2017)'), { family: 'fiesta', gen: 'mk7', year: '2008' });
  // Šasi kódy a jednopísmenné generace
  assert.deepEqual(splitModel('Almera N16 (2000–2006)'), { family: 'almera', gen: 'n16', year: '2000' });
  assert.deepEqual(splitModel('Astra H (2004–2010)'), { family: 'astra', gen: 'h', year: '2004' });
  assert.deepEqual(splitModel('S-Class W223 (2020–současnost)'), { family: 's class', gen: 'w223', year: '2020' });
  // Bez tokenu — identita přes počáteční rok
  assert.deepEqual(splitModel('Compass (2017–present)'), { family: 'compass', gen: null, year: '2017' });
  assert.deepEqual(splitModel('Compass (2017–)'), { family: 'compass', gen: null, year: '2017' });
  // Víceslovná rodina zůstává pohromadě
  assert.deepEqual(splitModel('Transit Custom I 2.2 TDCi (2012–2016)'), { family: 'transit custom', gen: '1', year: '2012' });
  assert.deepEqual(splitModel('Grand Cherokee WK2 (2011–2021)'), { family: 'grand cherokee', gen: 'wk2', year: '2011' });
  // Duplicitní tokeny po sobě se slijí („206 / 206+" → '206')
  assert.deepEqual(splitModel('206 / 206+'), { family: '206', gen: null, year: null });
  // Holý model bez generace i roku
  assert.deepEqual(splitModel('307'), { family: '307', gen: null, year: null });
  // Číselný název modelu jako první token NESMÍ být rok (Peugeot 2008/3008)
  assert.deepEqual(splitModel('2008 I (2013–2019)'), { family: '2008', gen: '1', year: '2013' });
  assert.deepEqual(splitModel('3008 II (2016–2023)'), { family: '3008', gen: '2', year: '2016' });
  assert.equal(splitModel('2008').family, '2008');
  // Neplatná římská číslice u mk → gen null (shoda se SQL 'mk' || NULL = NULL)
  assert.equal(splitModel('Galaxy MkXL').gen, null);
  // Platná mk+římská zůstává funkční
  assert.equal(splitModel('Transit MkVII').gen, 'mk7');
  // Diakritika nesmí rozbít tokenizaci
  assert.equal(splitModel('Felicia (1994–2001)').family, 'felicia');
  // První token nesmí být sežrán jako generace (Peugeot 206 je model, ne gen)
  assert.equal(splitModel('206 (1998–2012)').family, '206');
  // FL/rok ukončí parsování bez nalezené generace
  assert.deepEqual(splitModel('Focus MK2 FL (2008–2011)').gen, 'mk2');
  assert.equal(splitModel('Octavia 2008').gen, null);
  // Prázdný vstup
  assert.deepEqual(splitModel(''), { family: null, gen: null, year: null });
  assert.deepEqual(splitModel(null), { family: null, gen: null, year: null });
}

// ── Katalogové generace ──────────────────────────────────────────────────────

function testCatalogGenerations() {
  const map = buildCatalogGenerations();
  const octavia = map.get('Škoda|octavia');
  assert.ok(octavia?.length >= 2, 'Škoda Octavia má mít více generací v katalogu');
  assert.ok(octavia.some(g => g.value === '2'), 'Octavia II má mít hodnotu 2');
  const transit = map.get('Ford|transit');
  assert.ok(transit?.length >= 3, 'Ford Transit má mít více generací');
  // Hodnoty jsou unikátní (varianty motorů téže generace se slijí)
  const values = transit.map(g => g.value);
  assert.equal(values.length, new Set(values).size);
}

// ── Seed prompt + parsování ──────────────────────────────────────────────────

function makeSeedEntries(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `fault-${i}`,
    label_cs: `Závada ${i}`,
    label_en: `Fault ${i}`,
    label_de: `Defekt ${i}`,
    category: 'engine',
  }));
}

function testSeedPromptAndParse() {
  const prompt = buildSeedPrompt({ 'Škoda': ['replaced EGR valve', 'new clutch'], Ford: ['injector seals'] });
  assert.match(prompt, /JSON array/);
  assert.match(prompt, /replaced EGR valve/);
  assert.match(prompt, /Škoda:/);

  // Validní odpověď (100 položek) projde
  const good = parseSeedResponse('Here you go:\n' + JSON.stringify(makeSeedEntries(100)));
  assert.equal(good.error, null);
  assert.equal(good.entries.length, 100);

  // Málo položek → chyba
  const few = parseSeedResponse(JSON.stringify(makeSeedEntries(10)));
  assert.equal(few.entries, null);
  assert.match(few.error, /expected/);

  // Nevalidní slugy a labely se zahodí; duplicitní id taky; 'other' je rezervované
  const mixed = makeSeedEntries(90);
  mixed.push({ id: 'Bad Slug!', label_cs: 'x', label_en: 'x', label_de: 'x', category: 'engine' });
  mixed.push({ id: 'fault-1', label_cs: 'dup', label_en: 'dup', label_de: 'dup', category: 'engine' });
  mixed.push({ id: 'other', label_cs: 'x', label_en: 'x', label_de: 'x', category: 'other' });
  mixed.push({ id: 'missing-label', label_cs: '', label_en: 'x', label_de: 'x', category: 'engine' });
  const filtered = parseSeedResponse(JSON.stringify(mixed));
  assert.equal(filtered.entries.length, 90);
  // Neznámá kategorie spadne do 'other'
  const cat = parseSeedResponse(JSON.stringify(makeSeedEntries(85).map(e => ({ ...e, category: 'nonsense' }))));
  assert.ok(cat.entries.every(e => e.category === 'other'));

  // Žádné JSON pole → chyba
  assert.match(parseSeedResponse('no json here').error, /No JSON array/);
}

// ── Classify prompt + parsování ──────────────────────────────────────────────

const TAXONOMY = [
  { id: 'egr-valve-failure', label_en: 'EGR valve clogged or faulty', category: 'exhaust' },
  { id: 'dual-mass-flywheel-worn', label_en: 'Dual-mass flywheel worn', category: 'clutch' },
  { id: 'other', label_en: 'Other fault', category: 'other' },
];
const SLUGS = new Set(TAXONOMY.map(t => t.id));

function makeItems() {
  const rows = [
    {
      id: 'aaaa-1', vehicle_brand: 'Škoda', vehicle_model: 'Octavia II (2006–2013)', vehicle_generation: null,
      engine_power: '77 kW – 1.9 TDI', mileage: 185000, closed_at: '2014-05-01',
      symptoms: ['loss of power'], obd_codes: ['P0401'], description: 'smoke', resolution: 'cleaned EGR valve',
    },
    {
      id: 'bbbb-2', vehicle_brand: 'Peugeot', vehicle_model: '307', vehicle_generation: null,
      engine_power: '', mileage: null, closed_at: '2010-01-01',
      symptoms: [], obd_codes: [], description: '', resolution: 'replaced clutch and flywheel',
    },
  ];
  const catalogGens = new Map([
    ['Peugeot|307', [
      { value: '2001', label: '307 (2001–2008)', powers: '50 kW – 1.4' },
      { value: '2008', label: '308 nonsense', powers: '' },
    ]],
  ]);
  return prepareBatchItems(rows, catalogGens);
}

function testPrepareBatchItems() {
  const items = makeItems();
  // Octavia má generaci v labelu → inference není potřeba
  assert.equal(items[0].needsGen, false);
  // Holý „307" bez roku → potřebuje inferenci a dostane nabídku z katalogu
  assert.equal(items[1].needsGen, true);
  assert.equal(items[1].genOptions.length, 2);
  // Případ s už vyplněnou vehicle_generation inferenci nepotřebuje
  const pre = prepareBatchItems(
    [{ id: 'c', vehicle_brand: 'Peugeot', vehicle_model: '307', vehicle_generation: '2001' }],
    new Map(),
  );
  assert.equal(pre[0].needsGen, false);
}

function testClassifyPromptAndParse() {
  const items = makeItems();
  const prompt = buildClassifyPrompt(TAXONOMY, items);
  assert.match(prompt, /egr-valve-failure — EGR valve/);
  assert.match(prompt, /id=aaaa-1/);
  assert.match(prompt, /GENERATION OPTIONS/);
  // 'other' se v seznamu taxonomie neopakuje (je popsané v pravidlech)
  assert.ok(!prompt.includes('other — Other fault'));

  // Validní odpověď
  const raw = JSON.stringify([
    { id: 'aaaa-1', fault: 'egr-valve-failure', generation: null },
    { id: 'bbbb-2', fault: 'dual-mass-flywheel-worn', generation: '2001' },
  ]);
  const verdicts = parseClassifyResponse(raw, items, SLUGS);
  assert.equal(verdicts.length, 2);
  assert.equal(verdicts[0].fault, 'egr-valve-failure');
  assert.equal(verdicts[1].generation, '2001');

  // Neznámý slug → verdikt se zahodí (řádek zůstane NULL); neznámé id taky
  const bad = JSON.stringify([
    { id: 'aaaa-1', fault: 'invented-slug', generation: null },
    { id: 'zzzz-9', fault: 'other', generation: null },
    { id: 'bbbb-2', fault: 'other', generation: 'mk9' },
  ]);
  const badVerdicts = parseClassifyResponse(bad, items, SLUGS);
  assert.equal(badVerdicts.length, 1);
  assert.equal(badVerdicts[0].id, 'bbbb-2');
  // Generace mimo nabídku → null
  assert.equal(badVerdicts[0].generation, null);

  // Generace u případu bez nabídky se ignoruje
  const sneaky = parseClassifyResponse(
    JSON.stringify([{ id: 'aaaa-1', fault: 'other', generation: '2' }]), items, SLUGS,
  );
  assert.equal(sneaky[0].generation, null);

  // Nevalidní JSON → prázdno
  assert.deepEqual(parseClassifyResponse('garbage', items, SLUGS), []);
}

// ── Běhy s mocky (llm + fetch) ───────────────────────────────────────────────

function mockFetchFactory(routes) {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, opts });
    for (const r of routes) {
      if (r.match.test(url) && (!r.method || (opts.method ?? 'GET') === r.method)) {
        return {
          ok: true,
          status: 200,
          json: async () => (typeof r.body === 'function' ? r.body(url, opts) : r.body),
          text: async () => '',
        };
      }
    }
    return { ok: false, status: 404, json: async () => null, text: async () => `no mock for ${url}` };
  };
  return { fetchImpl, calls };
}

async function testRunSeedDryRun() {
  const { fetchImpl, calls } = mockFetchFactory([
    { match: /gearbrain_fault_taxonomy\?select=id/, body: [] },
    { match: /gearbrain_cases\?select=vehicle_brand,resolution/, body: [
      { vehicle_brand: 'Škoda', resolution: 'cleaned EGR' },
      { vehicle_brand: 'Ford', resolution: 'replaced injector seals' },
    ] },
  ]);
  const llm = async (task, prompt) => {
    assert.equal(task, 'taxonomy-seed');
    assert.match(prompt, /cleaned EGR/);
    return JSON.stringify(makeSeedEntries(100));
  };
  const r = await runSeed({ llm, fetchImpl, dryRun: true });
  assert.equal(r.ok, true);
  // 'other' se přidává automaticky
  assert.equal(r.entries.length, 101);
  assert.ok(r.entries.some(e => e.id === 'other'));
  // dry-run nesmí nic POSTovat
  assert.ok(!calls.some(c => c.opts.method === 'POST'));
}

async function testRunSeedAbortsOnExistingTaxonomy() {
  const { fetchImpl } = mockFetchFactory([
    { match: /gearbrain_fault_taxonomy\?select=id/, body: [{ id: 'egr-valve-failure' }] },
  ]);
  const r = await runSeed({ llm: async () => { throw new Error('LLM nesmí být volán'); }, fetchImpl });
  assert.equal(r.ok, false);
}

async function testRunClassifyPatchesRows() {
  let fetchCount = 0;
  const { fetchImpl, calls } = mockFetchFactory([
    { match: /gearbrain_fault_taxonomy\?select=id,label_en/, body: TAXONOMY },
    {
      match: /gearbrain_cases\?select=id,vehicle_brand/, body: () => {
        fetchCount++;
        // První dotaz vrátí 2 případy, další už nic (oba byly klasifikovány)
        return fetchCount === 1 ? [
          { id: 'aaaa-1', vehicle_brand: 'Škoda', vehicle_model: 'Octavia II (2006–2013)', vehicle_generation: null, engine_power: '', mileage: null, closed_at: null, symptoms: [], obd_codes: [], description: '', resolution: 'cleaned EGR valve' },
          { id: 'bbbb-2', vehicle_brand: 'Peugeot', vehicle_model: '307', vehicle_generation: null, engine_power: '', mileage: null, closed_at: null, symptoms: [], obd_codes: [], description: '', resolution: 'replaced flywheel' },
        ] : [];
      },
    },
    { match: /gearbrain_cases\?id=eq\./, method: 'PATCH', body: null },
  ]);
  const llm = async (task, prompt) => {
    assert.equal(task, 'taxonomy-classify');
    assert.match(prompt, /TAXONOMY:/);
    return JSON.stringify([
      { id: 'aaaa-1', fault: 'egr-valve-failure', generation: null },
      { id: 'bbbb-2', fault: 'dual-mass-flywheel-worn', generation: null },
    ]);
  };
  const r = await runClassify({ llm, fetchImpl, batchSize: 25 });
  assert.equal(r.ok, true);
  assert.equal(r.classified, 2);
  const patches = calls.filter(c => c.opts.method === 'PATCH');
  assert.equal(patches.length, 2);
  assert.match(patches[0].url, /id=eq\.aaaa-1/);
  assert.deepEqual(JSON.parse(patches[0].opts.body), { canonical_fault_id: 'egr-valve-failure' });
}

async function testRunClassifySkipsUnverdicted() {
  let fetchCount = 0;
  const { fetchImpl, calls } = mockFetchFactory([
    { match: /gearbrain_fault_taxonomy\?select=id,label_en/, body: TAXONOMY },
    {
      match: /gearbrain_cases\?select=id,vehicle_brand/, body: (url) => {
        fetchCount++;
        // Neklasifikovaný řádek zůstává NULL → druhý dotaz musí mít offset=1
        if (fetchCount === 2) assert.match(url, /offset=1/);
        return fetchCount === 1 ? [
          { id: 'aaaa-1', vehicle_brand: 'Škoda', vehicle_model: 'Octavia II (2006–2013)', vehicle_generation: null, engine_power: '', mileage: null, closed_at: null, symptoms: [], obd_codes: [], description: '', resolution: 'cleaned EGR valve' },
        ] : [];
      },
    },
  ]);
  // LLM nevrátí žádný verdikt → žádný PATCH, offset roste
  const r = await runClassify({ llm: async () => '[]', fetchImpl, batchSize: 25 });
  assert.equal(r.ok, true);
  assert.equal(r.classified, 0);
  assert.ok(!calls.some(c => c.opts.method === 'PATCH'));
}

function testLlmRoutes() {
  assert.deepEqual(resolveRoute('taxonomy-seed', {}), { provider: 'claude', model: 'sonnet' });
  assert.deepEqual(resolveRoute('taxonomy-classify', {}), { provider: 'claude', model: 'haiku' });
}

testSplitModel();
testCatalogGenerations();
testSeedPromptAndParse();
testPrepareBatchItems();
testClassifyPromptAndParse();
testLlmRoutes();
await testRunSeedDryRun();
await testRunSeedAbortsOnExistingTaxonomy();
await testRunClassifyPatchesRows();
await testRunClassifySkipsUnverdicted();

console.log('agent-fault-taxonomy.test.js passed');
