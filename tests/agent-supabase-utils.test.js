import assert from 'node:assert/strict';
import {
  clampResolutionForImport,
  RESOLUTION_MIN_LENGTH,
  RESOLUTION_MAX_LENGTH,
  SUPABASE_CASES_TABLE,
  NEAR_VERBATIM_SIMILARITY,
  buildCasesRestUrl,
  crosscheckCaseAgainstSupabase,
  isLikelySupabaseDuplicate,
  normalizeImportText,
  normalizeForDedupe,
  resolveSupabaseFunctionKey,
  resolveSupabaseReadKey,
  textSimilarity,
} from '../scripts/agent/supabase-utils.mjs';

const url = buildCasesRestUrl('https://nmvjthfezyjcwuzphiuu.supabase.co', {
  vehicle_brand: 'eq.Kia',
  vehicle_model: 'eq.Ceed',
  select: 'id,resolution',
  limit: '50',
});

assert.match(url, new RegExp(`/rest/v1/${SUPABASE_CASES_TABLE}\\?`));
assert.match(url, /vehicle_brand=eq\.Kia/);
assert.match(url, /vehicle_model=eq\.Ceed/);

// Two independent users on DIFFERENT forums, same fault, similar (but not verbatim)
// repair wording. This is corroboration the RAG layer rewards — it must NOT be
// dropped as a duplicate (see HANDOVER §0a). The crosscheck must report `clear`.
let requestedUrl = '';
const crossForumResult = await crosscheckCaseAgainstSupabase({
  supabaseUrl: 'https://nmvjthfezyjcwuzphiuu.supabase.co',
  supabaseKey: 'test-key',
  payload: {
    vehicle_brand: 'Kia',
    vehicle_model: 'Ceed',
    symptoms: ['engine stalls', 'check engine light'],
    description: 'The car stalled while driving and showed a check engine light.',
    resolution: 'Crankshaft position sensor was replaced and the engine no longer stalls.',
    thread_url: 'https://forum-a.example.com/thread/1',
    source_ref: 'forum-a:1',
  },
  fetchImpl: async (nextUrl) => {
    requestedUrl = String(nextUrl);
    return new Response(
      JSON.stringify([{
        id: '1',
        vehicle_brand: 'Kia',
        vehicle_model: 'Ceed',
        symptoms: ['engine shuts off', 'check engine light on'],
        description: 'The engine shut off while driving and the check engine light came on.',
        resolution: 'Diagnostics found a faulty crankshaft position sensor. It was replaced.',
        thread_url: 'https://forum-b.example.com/thread/2',
        source_ref: 'forum-b:2',
      }]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  },
});

assert.equal(crossForumResult.status, 'clear');
assert.match(requestedUrl, /\/rest\/v1\/gearbrain_cases\?/);
assert.match(requestedUrl, /vehicle_brand=ilike\.\*Kia\*/);
assert.doesNotMatch(requestedUrl, /vehicle_model=eq\.Ceed/);

// A re-crawl of the SAME thread already imported earlier still de-dupes (verbatim
// resolution) — the crosscheck must report `duplicate`.
const sameThreadResult = await crosscheckCaseAgainstSupabase({
  supabaseUrl: 'https://nmvjthfezyjcwuzphiuu.supabase.co',
  supabaseKey: 'test-key',
  payload: {
    vehicle_brand: 'Kia',
    vehicle_model: 'Ceed',
    resolution: 'Crankshaft position sensor was replaced and the engine no longer stalls.',
    thread_url: 'https://forum-a.example.com/thread/1',
    source_ref: 'forum-a:1',
  },
  fetchImpl: async () => new Response(
    JSON.stringify([{
      id: '9',
      vehicle_brand: 'Kia',
      vehicle_model: 'Ceed',
      resolution: 'Crankshaft position sensor was replaced and the engine no longer stalls.',
      thread_url: 'https://forum-a.example.com/thread/1',
      source_ref: 'forum-a:1',
    }]),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  ),
});

assert.equal(sameThreadResult.status, 'duplicate');

const errorResult = await crosscheckCaseAgainstSupabase({
  supabaseUrl: 'https://nmvjthfezyjcwuzphiuu.supabase.co',
  supabaseKey: 'test-key',
  brand: 'Kia',
  model: 'Ceed',
  resolution: 'ok',
  fetchImpl: async () => new Response('missing', { status: 404 }),
});

assert.equal(errorResult.status, 'error');
assert.equal(errorResult.httpStatus, 404);
assert.equal(normalizeForDedupe(' Sensor replaced!!! '), 'sensor replaced');
assert.equal(normalizeImportText('  noisy \n  injector   seal '), 'noisy injector seal');

const longResolution = Array.from({ length: 40 }, (_, index) => `Sentence ${index + 1} about the repair.`).join(' ');
const clampedResolution = clampResolutionForImport(longResolution);
assert.ok(clampedResolution.length <= RESOLUTION_MAX_LENGTH);
assert.ok(clampedResolution.endsWith('...'));
assert.match(clampedResolution, /^Sentence 1 about the repair\./);
assert.ok(!clampedResolution.includes('  '));
assert.ok(normalizeImportText(' short ').length < RESOLUTION_MIN_LENGTH);

assert.equal(
  resolveSupabaseReadKey({ SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_KEY: 'service' }),
  'service'
);
assert.equal(
  resolveSupabaseFunctionKey({ SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_KEY: 'service' }),
  'service'
);
assert.equal(resolveSupabaseReadKey({}, { anonKey: 'unsafe-default' }), '');
assert.equal(resolveSupabaseFunctionKey({ SUPABASE_ANON_KEY: 'anon' }), '');
assert.ok(textSimilarity('crankshaft position sensor replaced', 'faulty crankshaft sensor was replaced') >= 0.5);

// --- isLikelySupabaseDuplicate: independent cross-source reports vs. real reposts ---

// Same fault, DIFFERENT source, merely similar text => NOT a duplicate (keep both as
// corroboration). Sanity-check the inputs sit below the near-verbatim threshold.
const crossForumCandidate = {
  resolution: 'Crankshaft position sensor was replaced and the engine no longer stalls.',
  description: 'The car stalled while driving and showed a check engine light.',
  symptoms: ['engine stalls', 'check engine light'],
  thread_url: 'https://forum-a.example.com/thread/1',
  source_ref: 'forum-a:1',
};
const crossForumExisting = {
  resolution: 'Diagnostics found a faulty crankshaft position sensor. It was replaced.',
  description: 'The engine shut off while driving and the check engine light came on.',
  symptoms: ['engine shuts off', 'check engine light on'],
  thread_url: 'https://forum-b.example.com/thread/2',
  source_ref: 'forum-b:2',
};
assert.ok(textSimilarity(crossForumCandidate.resolution, crossForumExisting.resolution) < NEAR_VERBATIM_SIMILARITY);
assert.equal(isLikelySupabaseDuplicate(crossForumCandidate, crossForumExisting), false);

// Exact SAME resolution text but on DIFFERENT forums would have been merged before;
// even so, an identical write-up is a copy, not independent corroboration => duplicate.
assert.equal(
  isLikelySupabaseDuplicate(
    { resolution: crossForumCandidate.resolution, thread_url: 'https://forum-a.example.com/thread/1', source_ref: 'forum-a:1' },
    { resolution: crossForumCandidate.resolution, thread_url: 'https://forum-b.example.com/thread/9', source_ref: 'forum-b:9' }
  ),
  true
);

// Near-verbatim copy across DIFFERENT sources (one word changed past char 100 so the
// exact-normalized key differs) => still a duplicate via the similarity threshold.
const verbatimBase = 'Replaced the faulty crankshaft position sensor connector, cleaned the corroded wiring harness, reseated the engine control module plug, and the persistent intermittent stalling fault finally cleared completely.';
const verbatimCopy = verbatimBase.replace('faulty', 'broken');
assert.notEqual(normalizeForDedupe(verbatimBase), normalizeForDedupe(verbatimCopy));
assert.ok(textSimilarity(verbatimBase, verbatimCopy) >= NEAR_VERBATIM_SIMILARITY);
assert.equal(
  isLikelySupabaseDuplicate(
    { resolution: verbatimBase, thread_url: 'https://forum-a.example.com/t/1', source_ref: 'forum-a:1' },
    { resolution: verbatimCopy, thread_url: 'https://forum-b.example.com/t/2', source_ref: 'forum-b:2' }
  ),
  true
);

// SAME source (re-crawled thread) with moderate (not verbatim) resolution overlap =>
// duplicate; the very same pair across DIFFERENT sources must be kept.
const sameThreadCandidate = {
  resolution: 'Replaced the crankshaft position sensor and the stalling stopped.',
  thread_url: 'https://forum-a.example.com/thread/1',
};
const sameThreadExisting = {
  resolution: 'Crankshaft position sensor replaced; the engine stalling issue is gone now.',
  thread_url: 'https://forum-a.example.com/thread/1',
};
const moderateSimilarity = textSimilarity(sameThreadCandidate.resolution, sameThreadExisting.resolution);
assert.ok(moderateSimilarity >= 0.45 && moderateSimilarity < NEAR_VERBATIM_SIMILARITY);
assert.equal(isLikelySupabaseDuplicate(sameThreadCandidate, sameThreadExisting), true);
assert.equal(
  isLikelySupabaseDuplicate(
    { ...sameThreadCandidate, thread_url: 'https://forum-a.example.com/thread/1', source_ref: 'forum-a:1' },
    { ...sameThreadExisting, thread_url: 'https://forum-b.example.com/thread/2', source_ref: 'forum-b:2' }
  ),
  false
);

console.log('agent-supabase-utils.test.js passed');
