/**
 * patch-symptoms.mjs — Re-extract symptoms for imported cases and patch Supabase.
 *
 * Usage:
 *   node --experimental-sqlite patch-symptoms.mjs [--dry-run]
 */

import { AgentState } from './state.mjs';
import { extractCases } from './extract.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nmvjthfezyjcwuzphiuu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_KEY) {
  console.error('ERROR: Set SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const state = new AgentState();

// ── Collect imported cases + their thread texts ────────────────────────────

const importedCases = state.getCasesByStatus('imported');
console.log(`Found ${importedCases.length} imported case(s) to patch.\n`);

for (const c of importedCases) {
  const payload = JSON.parse(c.payload_json);
  const threadUrl = payload.thread_url || payload.source_url || '';

  // Find thread text from the threads table
  const thread = state.getThread(c.thread_id);
  if (!thread?.thread_text) {
    console.log(`  [${c.id.slice(0, 8)}] ✗ No thread_text found — skipping`);
    continue;
  }

  console.log(`  [${c.id.slice(0, 8)}] ${threadUrl}`);
  console.log(`    Old symptoms: ${JSON.stringify(payload.symptoms)}`);

  // Re-run extractor
  let newCases;
  // extractCases signature: (threadText, classifierResult, options)
  // Pass a minimal classifierResult with evidence post numbers
  const classifierResult = { evidence_post_numbers: payload.fault_post_numbers || [] };
  try {
    newCases = await extractCases(thread.thread_text, classifierResult);
  } catch (err) {
    console.error(`    ✗ Extractor failed: ${err.message}`);
    continue;
  }

  // Match by case_author + description prefix
  const match = newCases.find(nc =>
    nc.case_author === payload.case_author ||
    nc.description?.slice(0, 40) === payload.description?.slice(0, 40)
  ) ?? newCases[0];

  if (!match) {
    console.log(`    ✗ No matching case in re-extraction — skipping`);
    continue;
  }

  const newSymptoms = match.symptoms || [];
  console.log(`    New symptoms: ${JSON.stringify(newSymptoms)}`);

  if (JSON.stringify(newSymptoms) === JSON.stringify(payload.symptoms)) {
    console.log(`    = No change`);
    continue;
  }

  if (DRY_RUN) {
    console.log(`    [dry-run] Would patch Supabase`);
    continue;
  }

  // PATCH Supabase via REST — match by thread_url
  if (!threadUrl) {
    console.log(`    ✗ No thread_url — cannot identify row in Supabase`);
    continue;
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/gearbrain_cases?thread_url=eq.${encodeURIComponent(threadUrl)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ symptoms: newSymptoms }),
      }
    );

    if (res.ok) {
      const updated = await res.json();
      console.log(`    ✓ Patched ${updated.length} row(s) in Supabase`);
      // Update local SQLite payload too
      payload.symptoms = newSymptoms;
      state.updateCase(c.id, { payload_json: JSON.stringify(payload) });
    } else {
      const err = await res.text();
      console.error(`    ✗ Supabase PATCH failed (${res.status}): ${err.slice(0, 200)}`);
    }
  } catch (err) {
    console.error(`    ✗ Network error: ${err.message}`);
  }

  console.log('');
}

console.log('\nDone.');
