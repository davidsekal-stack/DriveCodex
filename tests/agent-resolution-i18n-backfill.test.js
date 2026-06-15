/**
 * Unit testy — backfill lokalizovaných textů oprav
 * (scripts/agent/backfill-resolution-i18n.mjs)
 *
 * Spuštění:  node --experimental-sqlite tests/agent-resolution-i18n-backfill.test.js
 */

import assert from 'node:assert/strict';
import {
  assignTranslations,
  buildTranslatePrompt,
  parseTranslateResponse,
  runBackfill,
} from '../scripts/agent/backfill-resolution-i18n.mjs';

// ── assignTranslations — do shodného jazyka se nepřekládá ─────────────────────

// Originál anglicky (typický stav DB): CZ i DE jsou překlady.
assert.deepEqual(
  assignTranslations({ original: 'Replaced fuel pump.', lang: 'en', cs: 'Vyměněno čerpadlo.', de: 'Pumpe ersetzt.' }),
  { resolution_cs: 'Vyměněno čerpadlo.', resolution_de: 'Pumpe ersetzt.', resolution_lang: 'en' },
);

// Originál česky: do CZ se NEpřekládá — uloží se původní text (autentický),
// i kdyby model do "cs" vrátil přeloženou verzi.
assert.deepEqual(
  assignTranslations({ original: 'Vyměněno palivové čerpadlo.', lang: 'cs', cs: 'NĚCO JINÉHO', de: 'Pumpe ersetzt.' }),
  { resolution_cs: 'Vyměněno palivové čerpadlo.', resolution_de: 'Pumpe ersetzt.', resolution_lang: 'cs' },
);

// Originál německy: do DE se NEpřekládá.
assert.deepEqual(
  assignTranslations({ original: 'Pumpe ersetzt.', lang: 'de', cs: 'Čerpadlo vyměněno.', de: 'IGNOROVAT' }),
  { resolution_cs: 'Čerpadlo vyměněno.', resolution_de: 'Pumpe ersetzt.', resolution_lang: 'de' },
);

// Jiný jazyk originálu (např. polština): obě varianty jsou překlady, lang='other'.
assert.deepEqual(
  assignTranslations({ original: 'Wymieniono pompę.', lang: 'pl', cs: 'Vyměněno čerpadlo.', de: 'Pumpe ersetzt.' }),
  { resolution_cs: 'Vyměněno čerpadlo.', resolution_de: 'Pumpe ersetzt.', resolution_lang: 'other' },
);

// Chybějící/prázdný překlad → null (panel zobrazí EN fallback).
assert.deepEqual(
  assignTranslations({ original: 'Replaced fuel pump.', lang: 'en', cs: '', de: '   ' }),
  { resolution_cs: null, resolution_de: null, resolution_lang: 'en' },
);

// Whitespace se normalizuje.
assert.equal(
  assignTranslations({ original: 'x', lang: 'en', cs: '  Vyměněno   čerpadlo.  ', de: '' }).resolution_cs,
  'Vyměněno čerpadlo.',
);

// ── buildTranslatePrompt — obsahuje id i text ────────────────────────────────

const items = [
  { id: 'aaaa1111-0000-0000-0000-000000000001', resolution: 'Replaced the fuel pump.' },
  { id: 'bbbb2222-0000-0000-0000-000000000002', resolution: 'Cleaned the EGR valve, code P0401.' },
];
const prompt = buildTranslatePrompt(items);
assert.ok(prompt.includes('aaaa1111-0000-0000-0000-000000000001'));
assert.ok(prompt.includes('Replaced the fuel pump.'));
assert.ok(prompt.includes('P0401'));
assert.ok(prompt.includes('JSON array'));

// ── parseTranslateResponse — robustní parsování + přiřazení ───────────────────

const raw = `Here you go:
[
  {"id":"aaaa1111-0000-0000-0000-000000000001","lang":"en","cs":"Vyměněno palivové čerpadlo.","de":"Kraftstoffpumpe ersetzt."},
  {"id":"bbbb2222-0000-0000-0000-000000000002","lang":"en","cs":"Vyčištěn EGR ventil, kód P0401.","de":"AGR-Ventil gereinigt, Code P0401."}
]`;
const parsed = parseTranslateResponse(raw, items);
assert.equal(parsed.length, 2);
assert.equal(parsed[0].id, 'aaaa1111-0000-0000-0000-000000000001');
assert.equal(parsed[0].resolution_cs, 'Vyměněno palivové čerpadlo.');
assert.equal(parsed[0].resolution_de, 'Kraftstoffpumpe ersetzt.');
assert.equal(parsed[0].resolution_lang, 'en');

// Neznámé id se ignoruje; duplicitní id se nezapočítá dvakrát.
const withJunk = `[
  {"id":"unknown","lang":"en","cs":"x","de":"y"},
  {"id":"aaaa1111-0000-0000-0000-000000000001","lang":"en","cs":"A","de":"B"},
  {"id":"aaaa1111-0000-0000-0000-000000000001","lang":"en","cs":"DUP","de":"DUP"}
]`;
const parsedJunk = parseTranslateResponse(withJunk, items);
assert.equal(parsedJunk.length, 1);
assert.equal(parsedJunk[0].resolution_cs, 'A');

// Nevalidní vstup → prázdné pole (žádný pád).
assert.deepEqual(parseTranslateResponse('no json here', items), []);
assert.deepEqual(parseTranslateResponse('', items), []);
assert.deepEqual(parseTranslateResponse('{not an array}', items), []);

// ── runBackfill — paging smyčka (regrese: zacyklení na prázdných řádcích) ─────
// Mock fetchImpl ctí offset/limit z URL a simuluje frontu (resolution_lang IS
// NULL). PATCH odebere řádek z fronty (jako nastavení resolution_lang).

function makeFetchImpl(rows, counters) {
  // rows: pole { id, resolution, _done? } — _done simuluje vyřazení z fronty
  return async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    if (method === 'GET') {
      counters.get++;
      if (counters.get > 100) throw new Error('runBackfill se zacyklil (GET > 100)');
      const offset = Number((/offset=(\d+)/.exec(url) || [])[1] || 0);
      const limit = Number((/limit=(\d+)/.exec(url) || [])[1] || 15);
      const queue = rows.filter(r => !r._done);
      const slice = queue.slice(offset, offset + limit).map(r => ({ id: r.id, resolution: r.resolution }));
      return { ok: true, json: async () => slice, text: async () => '' };
    }
    // PATCH ?id=eq.<id> → vyřaď řádek z fronty
    counters.patch++;
    const id = decodeURIComponent((/id=eq\.([^&]+)/.exec(url) || [])[1] || '');
    const row = rows.find(r => r.id === id);
    if (row) row._done = true;
    return { ok: true, json: async () => ({}), text: async () => '' };
  };
}

// (1) Celé okno tvoří řádek s prázdným (whitespace) resolution → žádné volání
//     LLM, kurzor se posune za něj a smyčka rychle skončí (nezacyklí se).
{
  const rows = [{ id: 'e0000000-0000-0000-0000-000000000001', resolution: '          ' }];
  const counters = { get: 0, patch: 0 };
  let llmCalls = 0;
  const llm = async () => { llmCalls++; return '[]'; };
  const r = await runBackfill({ llm, fetchImpl: makeFetchImpl(rows, counters), batchSize: 15 });
  assert.equal(r.ok, true);
  assert.equal(llmCalls, 0, 'na prázdné dávce se nesmí volat LLM');
  assert.equal(counters.patch, 0);
  assert.ok(counters.get <= 3, `smyčka musí rychle skončit (get=${counters.get})`);
}

// (2) Mix: prázdný řádek + dva platné → LLM se zavolá, platné se patchnou,
//     prázdný se přeskočí, smyčka terminuje.
{
  const rows = [
    { id: 'aaaa1111-0000-0000-0000-000000000001', resolution: 'Replaced fuel pump.' },
    { id: 'blank000-0000-0000-0000-000000000002', resolution: '   ' },
    { id: 'cccc3333-0000-0000-0000-000000000003', resolution: 'Cleaned EGR valve.' },
  ];
  const counters = { get: 0, patch: 0 };
  let llmCalls = 0;
  const llm = async (_task, prompt) => {
    llmCalls++;
    // Vrať verdikt jen pro id, která jsou v promptu (platné řádky).
    const out = [];
    for (const r of rows) {
      if (prompt.includes(r.id)) out.push({ id: r.id, lang: 'en', cs: 'CZ', de: 'DE' });
    }
    return JSON.stringify(out);
  };
  const r = await runBackfill({ llm, fetchImpl: makeFetchImpl(rows, counters), batchSize: 2 });
  assert.equal(r.ok, true);
  assert.equal(r.patched, 2, 'oba platné řádky se mají patchnout');
  assert.equal(counters.patch, 2);
  assert.ok(llmCalls >= 1 && llmCalls <= 5, `LLM voláno přiměřeně (${llmCalls})`);
  assert.ok(counters.get <= 10, `smyčka terminuje (get=${counters.get})`);
}

console.log('agent-resolution-i18n-backfill.test.js passed');
