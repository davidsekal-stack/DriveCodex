import assert from 'node:assert/strict';
import {
  clampResolutionForImport,
  RESOLUTION_MIN_LENGTH,
  RESOLUTION_MAX_LENGTH,
  SUPABASE_CASES_TABLE,
  buildCasesRestUrl,
  crosscheckCaseAgainstSupabase,
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

let requestedUrl = '';
const duplicateResult = await crosscheckCaseAgainstSupabase({
  supabaseUrl: 'https://nmvjthfezyjcwuzphiuu.supabase.co',
  supabaseKey: 'test-key',
  payload: {
    vehicle_brand: 'Kia',
    vehicle_model: 'Ceed',
    symptoms: ['engine stalls', 'check engine light'],
    description: 'The car stalled while driving and showed a check engine light.',
    resolution: 'Crankshaft position sensor was replaced and the engine no longer stalls.',
    thread_url: 'https://forum.example.com/thread/1',
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
        thread_url: 'https://forum.example.com/thread/2',
      }]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  },
});

assert.equal(duplicateResult.status, 'duplicate');
assert.match(requestedUrl, /\/rest\/v1\/gearbrain_cases\?/);
assert.match(requestedUrl, /vehicle_brand=ilike\.\*Kia\*/);
assert.doesNotMatch(requestedUrl, /vehicle_model=eq\.Ceed/);

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

console.log('agent-supabase-utils.test.js passed');
