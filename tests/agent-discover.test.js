import assert from 'node:assert/strict';
import {
  buildDiscoveryPrompt,
  parseDiscoveryResponse,
  discoverCandidates,
  DISCOVERY_BRANDS,
  DISCOVERY_LANGUAGE_GROUPS,
} from '../scripts/agent/discover.mjs';
import { forumDomain } from '../scripts/agent/forum-registry.mjs';

function testForumDomain() {
  // Only `www.` is stripped — aggressive subdomain stripping would wrongly
  // merge intentionally-separate sites (e.g. en.toyota-club.eu vs toyota-club.eu)
  assert.equal(forumDomain('https://www.skoda-club.net/forum'), 'skoda-club.net');
  assert.equal(forumDomain('http://Forum.BMW-Syndikat.DE/x'), 'forum.bmw-syndikat.de');
  assert.equal(forumDomain('https://en.toyota-club.eu/forum'), 'en.toyota-club.eu');
  assert.equal(forumDomain('not a url'), '');
}

function testPrompt() {
  const p = buildDiscoveryPrompt('Škoda', DISCOVERY_LANGUAGE_GROUPS[0]);
  assert.match(p, /Škoda/);
  assert.match(p, /Czech\/Slovak/);
  assert.match(p, /JSON array/);
}

function testParse() {
  const good = parseDiscoveryResponse(`Here are results:
  [
    {"root_url":"https://skoda-club.net/forum","name":"Škoda Club","brands":["Škoda"],"language":"cs","engine":"invision","public_readable":true,"why":"active fault board"},
    {"root_url":"not-a-url","name":"bad"},
    {"root_url":"https://shop.example.com","name":"Shop","public_readable":false}
  ]
  Done.`);
  assert.equal(good.length, 2, 'drops the non-URL entry, keeps valid http(s)');
  assert.equal(good[0].engine, 'invision');
  assert.equal(good[0].public_readable, true);
  assert.equal(good[1].public_readable, false);

  assert.deepEqual(parseDiscoveryResponse('no json here'), []);
  assert.deepEqual(parseDiscoveryResponse('{"not":"an array"}'), []);

  // Clean whole-text array (the requested format)
  assert.equal(parseDiscoveryResponse('[{"root_url":"https://a.cz","public_readable":true}]').length, 1);
  // Fenced ```json block
  assert.equal(parseDiscoveryResponse('```json\n[{"root_url":"https://b.cz","public_readable":true}]\n```').length, 1);
  // Prose with a stray bracket before the real array still recovers via span scan
  assert.equal(parseDiscoveryResponse('top picks [3]:\n[{"root_url":"https://c.cz","public_readable":true}]').length, 1);
}

function makeFakeState(existingUrls = []) {
  const meta = new Map();
  const added = [];
  return {
    added,
    meta,
    getAllForums: () => existingUrls.map(url => ({ url })),
    addForum: (f) => { added.push(f); return 'id-' + added.length; },
    getMeta: k => (meta.has(k) ? meta.get(k) : null),
    setMeta: (k, v) => meta.set(k, v),
  };
}

async function testDiscoverDedupAndCaps() {
  const state = makeFakeState(['https://skoda-club.net/forum']); // already known locally
  const upserts = [];

  const result = await discoverCandidates(state, {
    maxQueries: 1,
    maxAdd: 5,
    fetchKnownDomainsImpl: async () => ({ ok: true, domains: new Set(['bmw-syndikat.de']) }),
    upsertForumImpl: async (row) => { upserts.push(row); return { ok: true }; },
    runLlmImpl: async (task, _prompt, o) => {
      assert.equal(task, 'discover');
      assert.deepEqual(o.allowedTools, ['WebSearch'], 'discovery must request WebSearch');
      return JSON.stringify([
        { root_url: 'https://skoda-club.net/forum', name: 'dup-local', public_readable: true },   // dup (local)
        { root_url: 'https://bmw-syndikat.de/', name: 'dup-registry', public_readable: true },     // dup (registry)
        { root_url: 'https://www.novehoforum.cz/', name: 'Nové', brands: ['Škoda'], language: 'cs', engine: 'phpbb', public_readable: true },
        { root_url: 'https://loginwall.example/', name: 'gated', public_readable: false },         // not public
        { root_url: 'https://www.novehoforum.cz/jine', name: 'same-domain-again', public_readable: true }, // dup within run
      ]);
    },
  });

  assert.equal(result.added, 1, 'only the one fresh, public, unique-domain forum is queued');
  assert.equal(state.added.length, 1);
  assert.equal(forumDomain(state.added[0].url), 'novehoforum.cz');
  assert.equal(upserts.length, 1, 'registry upsert mirrors the local add');
  assert.equal(upserts[0].discovered_via.startsWith('search:'), true);
  assert.ok(result.skipped >= 3);
  assert.equal(state.getMeta('discover_cursor') !== null, true, 'cursor advances');
}

async function testCursorRotation() {
  // Two runs should start at different matrix positions
  const state = makeFakeState();
  const seen = [];
  const stub = async (_task, prompt) => { seen.push(prompt.match(/owners of (.+?) cars/)?.[1]); return '[]'; };
  await discoverCandidates(state, { maxQueries: 1, fetchKnownDomainsImpl: async () => ({ ok: false, domains: new Set() }), upsertForumImpl: async () => ({ ok: true }), runLlmImpl: stub });
  await discoverCandidates(state, { maxQueries: 1, fetchKnownDomainsImpl: async () => ({ ok: false, domains: new Set() }), upsertForumImpl: async () => ({ ok: true }), runLlmImpl: stub });
  assert.equal(seen.length, 2);
  assert.notEqual(seen[0], seen[1], 'cursor rotation queries a different brand on the next run');
}

function testMatrixSanity() {
  assert.ok(DISCOVERY_BRANDS.includes('Škoda'));
  assert.ok(DISCOVERY_LANGUAGE_GROUPS.some(g => g.codes.includes('cs')));
}

testForumDomain();
testPrompt();
testParse();
await testDiscoverDedupAndCaps();
await testCursorRotation();
testMatrixSanity();

console.log('agent-discover.test.js passed');
