#!/usr/bin/env node

/**
 * cleanup-tsb-dupes.mjs
 *
 * Removes duplicate TSB cases from the gearbrain_cases table.
 *
 * Usage:
 *   node scripts/cleanup-tsb-dupes.mjs            # dry run (default)
 *   node scripts/cleanup-tsb-dupes.mjs --execute   # actually delete
 */

const SUPABASE_URL = "https://nmvjthfezyjcwuzphiuu.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tdmp0aGZlenlqY3d1enBoaXV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MzcwNTAsImV4cCI6MjA4ODMxMzA1MH0.acMPCJe2asOToPXg6DQccejtLOUbD8EMx9Z9FqWo_xo";
const AUTH_EMAIL = "socialpilotbot@gmail.com";
const AUTH_PASSWORD = "claude";

const SINCE = "2026-03-31T00:00:00Z";
const PAGE_SIZE = 1000;

const executeMode = process.argv.includes("--execute");

// ---------------------------------------------------------------------------
// Auth helper — sign in to get a JWT so we can query & delete via RLS
// ---------------------------------------------------------------------------

async function signIn() {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email: AUTH_EMAIL, password: AUTH_PASSWORD }),
    },
  );
  if (!res.ok) {
    throw new Error(`Auth failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token;
}

// ---------------------------------------------------------------------------
// Supabase REST helpers
// ---------------------------------------------------------------------------

function authHeaders(token) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };
}

async function fetchAllCases(token) {
  const allCases = [];
  let offset = 0;

  while (true) {
    const url =
      `${SUPABASE_URL}/rest/v1/gearbrain_cases` +
      `?select=id,vehicle_model,resolution,source_ref,created_at` +
      `&created_at=gte.${SINCE}` +
      `&order=created_at.asc` +
      `&offset=${offset}` +
      `&limit=${PAGE_SIZE}`;

    const res = await fetch(url, { headers: authHeaders(token) });
    if (!res.ok) {
      throw new Error(`Fetch failed (${res.status}): ${await res.text()}`);
    }
    const rows = await res.json();
    if (rows.length === 0) break;
    allCases.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return allCases;
}

async function deleteCaseById(token, id) {
  const url = `${SUPABASE_URL}/rest/v1/gearbrain_cases?id=eq.${id}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`Delete ${id} failed (${res.status}): ${await res.text()}`);
  }
}

// ---------------------------------------------------------------------------
// TSB base-ID extraction
// ---------------------------------------------------------------------------

/**
 * Extract the NHTSA number from a source_ref string.
 * Pattern: "... / NHTSA 12345678" at the end.
 * Returns the numeric value, or 0 if not found.
 */
function extractNhtsaNumber(sourceRef) {
  if (!sourceRef) return 0;
  const m = sourceRef.match(/\/\s*NHTSA\s+(\d+)\s*$/i);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * Extract the base TSB ID from a source_ref string.
 *
 * The source_ref typically looks like:
 *   "<tsb_id_with_possible_revision> / NHTSA <number>"
 *
 * We first strip the "/ NHTSA ..." suffix, then strip revision markers
 * from the TSB ID portion.
 *
 * Revision patterns handled:
 *   TSB_ELE231_R3         -> TSB_ELE231       (strip _R<digits>)
 *   PIP5964C              -> PIP5964          (strip trailing letter on PIP-style)
 *   36551.6.1             -> 36551            (strip .<version>)
 *   TJ36551.9.0-2024-...  -> 36551            (strip TJ prefix + version + date)
 *   21-039-24 REV. H      -> 21-039-24        (strip REV. <letter>)
 *   LI09.41-P-078735 / NHTSA ...  -> LI09.41-P-078735  (NHTSA suffix only)
 */
function extractBaseTsbId(sourceRef) {
  if (!sourceRef) return "";

  // Strip "/ NHTSA ..." suffix
  let tsb = sourceRef.replace(/\s*\/\s*NHTSA\s+\d+\s*$/i, "").trim();

  // Strip " REV. X" or " REV. XX" suffix (e.g., "21-039-24 REV. H")
  tsb = tsb.replace(/\s+REV\.\s*[A-Z0-9]+$/i, "").trim();

  // Strip _R<digits> suffix (e.g., TSB_ELE231_R3 -> TSB_ELE231)
  tsb = tsb.replace(/_R\d+$/i, "").trim();

  // Handle TJ-prefixed numeric IDs: TJ36551.9.0-2024-08-07 -> 36551
  const tjMatch = tsb.match(/^TJ(\d+)/i);
  if (tjMatch) {
    return tjMatch[1];
  }

  // Handle pure numeric with version dots: 36551.6.1 -> 36551
  const numericDotMatch = tsb.match(/^(\d+)\.\d/);
  if (numericDotMatch) {
    return numericDotMatch[1];
  }

  // Handle PIP-style: PIP5964C -> PIP5964 (trailing single letter after digits)
  const pipMatch = tsb.match(/^(PIP\d+)[A-Z]$/i);
  if (pipMatch) {
    return pipMatch[1];
  }

  // Handle date suffixes on otherwise clean IDs: strip -YYYY-MM-DD
  tsb = tsb.replace(/-\d{4}-\d{2}-\d{2}$/, "").trim();

  return tsb;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(executeMode ? "*** EXECUTE MODE ***" : "*** DRY RUN ***");
  console.log();

  // 1. Authenticate
  console.log("Signing in...");
  const token = await signIn();
  console.log("Authenticated.\n");

  // 2. Fetch all cases since cutoff
  console.log(`Fetching cases created since ${SINCE}...`);
  const cases = await fetchAllCases(token);
  console.log(`Fetched ${cases.length} cases.\n`);

  if (cases.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  // 3. Group by (vehicle_model, resolution)
  const groups = new Map();
  for (const c of cases) {
    const key = `${(c.vehicle_model || "").toLowerCase()}|||${(c.resolution || "").toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  // 4. Identify duplicates within each group
  const toDelete = []; // { id, source_ref, vehicle_model, reason }

  for (const [, entries] of groups) {
    if (entries.length < 2) continue;

    // Sub-group by base TSB ID
    const byBase = new Map();
    for (const e of entries) {
      const base = extractBaseTsbId(e.source_ref);
      if (!byBase.has(base)) byBase.set(base, []);
      byBase.get(base).push(e);
    }

    for (const [baseTsb, revisions] of byBase) {
      if (revisions.length < 2) continue; // only one entry for this base TSB

      // Check if these are truly related (same base TSB) — Category 1 + 2
      // Sort by NHTSA number descending (highest = newest)
      // For ties (same NHTSA or no NHTSA), fall back to created_at ascending (keep first)
      revisions.sort((a, b) => {
        const nhtsaA = extractNhtsaNumber(a.source_ref);
        const nhtsaB = extractNhtsaNumber(b.source_ref);
        if (nhtsaA !== nhtsaB) return nhtsaB - nhtsaA; // highest first
        // Same NHTSA (or both 0): keep earliest created
        return new Date(a.created_at) - new Date(b.created_at);
      });

      // Keep the first (newest revision / earliest created), delete the rest
      const keeper = revisions[0];
      for (let i = 1; i < revisions.length; i++) {
        const dup = revisions[i];
        const nhtsaKeeper = extractNhtsaNumber(keeper.source_ref);
        const nhtsaDup = extractNhtsaNumber(dup.source_ref);

        let reason;
        if (keeper.source_ref === dup.source_ref) {
          reason = `exact duplicate of ${keeper.source_ref}`;
        } else if (nhtsaKeeper > nhtsaDup) {
          reason = `older revision (NHTSA ${nhtsaDup}) superseded by ${keeper.source_ref} (NHTSA ${nhtsaKeeper})`;
        } else {
          reason = `duplicate base TSB "${baseTsb}", keeping ${keeper.source_ref}`;
        }

        toDelete.push({
          id: dup.id,
          source_ref: dup.source_ref,
          vehicle_model: dup.vehicle_model,
          reason,
        });
      }
    }
  }

  // 5. Report
  console.log(`Found ${toDelete.length} duplicate(s) to remove.\n`);

  if (toDelete.length === 0) {
    console.log("No duplicates found. Done.");
    return;
  }

  // Group report by vehicle_model for readability
  const byModel = new Map();
  for (const d of toDelete) {
    const model = d.vehicle_model || "(unknown)";
    if (!byModel.has(model)) byModel.set(model, []);
    byModel.get(model).push(d);
  }

  for (const [model, dupes] of [...byModel.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`--- ${model} (${dupes.length} duplicate${dupes.length > 1 ? "s" : ""}) ---`);
    for (const d of dupes) {
      console.log(`  DELETE  ${d.source_ref}`);
      console.log(`          ${d.reason}`);
    }
    console.log();
  }

  // Summary
  console.log("=".repeat(60));
  console.log(`Total cases fetched:       ${cases.length}`);
  console.log(`Duplicates to delete:      ${toDelete.length}`);
  console.log(`Cases remaining after:     ${cases.length - toDelete.length}`);
  console.log("=".repeat(60));
  console.log();

  // 6. Execute deletions if --execute
  if (!executeMode) {
    console.log("This was a DRY RUN. Re-run with --execute to delete.");
    return;
  }

  console.log(`Deleting ${toDelete.length} cases...`);
  let deleted = 0;
  let errors = 0;

  for (const d of toDelete) {
    try {
      await deleteCaseById(token, d.id);
      deleted++;
      if (deleted % 50 === 0) {
        console.log(`  ... deleted ${deleted}/${toDelete.length}`);
      }
    } catch (err) {
      errors++;
      console.error(`  ERROR deleting ${d.id} (${d.source_ref}): ${err.message}`);
    }
  }

  console.log();
  console.log(`Done. Deleted: ${deleted}, Errors: ${errors}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
