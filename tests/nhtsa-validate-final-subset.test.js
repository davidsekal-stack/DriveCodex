import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  hasConditionalResolution,
  isDtcLikeSymptom,
  makeCanonicalKey,
  parseArgs,
  validateSubset,
  wordCount,
} from "../scripts/nhtsa-validate-final-subset.mjs";

let passed = 0;
let failed = 0;
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function makeSeed(overrides = {}) {
  return {
    local_id: "seed_demo_1",
    user_id: "user-1",
    vehicle_brand: "Kia (US)",
    vehicle_model: "Sorento (2021–present)",
    symptoms: ["No start"],
    obd_codes: ["P0089"],
    description: "Engine will not start because the fuel pump control module failed.",
    resolution: "Replace the fuel pump control module.",
    metadata: {
      catalog_mapping: {
        resolved: true,
      },
    },
    ...overrides,
  };
}

console.log("\n== nhtsa-validate-final-subset ==");

test("parseArgs resolves input and output directories", async () => {
  const args = parseArgs(["C:\\in", "C:\\out"]);
  assert.equal(args.inputDir, "C:\\in");
  assert.equal(args.outDir, "C:\\out");
});

test("wordCount counts tokens conservatively", async () => {
  assert.equal(wordCount("Door glass won't drop"), 4);
});

test("hasConditionalResolution detects decision-tree repair wording", async () => {
  assert.equal(hasConditionalResolution("Inspect the harness and replace the module if damage is found."), true);
  assert.equal(hasConditionalResolution("Replace the module."), false);
});

test("isDtcLikeSymptom recognizes DTC symptom tags", async () => {
  assert.equal(isDtcLikeSymptom("DTC P0089"), true);
  assert.equal(isDtcLikeSymptom("P0089"), true);
  assert.equal(isDtcLikeSymptom("No start"), false);
});

test("makeCanonicalKey collapses semantically identical seeds", async () => {
  const a = makeCanonicalKey(makeSeed());
  const b = makeCanonicalKey(makeSeed({ local_id: "seed_demo_2" }));
  assert.equal(a, b);
});

test("validateSubset approves clean subset", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nhtsa-validate-clean-"));
  const inputDir = path.join(tempDir, "subset");
  const outDir = path.join(tempDir, "validate");
  await fs.mkdir(path.join(inputDir, "ready"), { recursive: true });
  await fs.writeFile(path.join(inputDir, "ready", "seed_demo_1.json"), `${JSON.stringify(makeSeed(), null, 2)}\n`, "utf8");

  try {
    const summary = await validateSubset(inputDir, outDir);
    assert.equal(summary.approved, true);
    assert.equal(summary.seed_count, 1);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("validateSubset blocks duplicates, long tags and redundant dtc tags", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nhtsa-validate-dirty-"));
  const inputDir = path.join(tempDir, "subset");
  const outDir = path.join(tempDir, "validate");
  await fs.mkdir(path.join(inputDir, "ready"), { recursive: true });
  const a = makeSeed({
    local_id: "seed_demo_1",
    symptoms: ["Vehicle will not start when parked outside overnight", "DTC P0089"],
  });
  const b = makeSeed({
    local_id: "seed_demo_2",
    symptoms: ["Vehicle will not start when parked outside overnight", "DTC P0089"],
  });
  await fs.writeFile(path.join(inputDir, "ready", "seed_demo_1.json"), `${JSON.stringify(a, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(inputDir, "ready", "seed_demo_2.json"), `${JSON.stringify(b, null, 2)}\n`, "utf8");

  try {
    const summary = await validateSubset(inputDir, outDir);
    assert.equal(summary.approved, false);
    assert.equal(summary.duplicate_groups, 1);
    assert.equal(summary.long_symptom_tags > 0, true);
    assert.equal(summary.redundant_dtc_symptom_hits > 0, true);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("validateSubset blocks unresolved mapping and conditional resolution", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nhtsa-validate-mapping-"));
  const inputDir = path.join(tempDir, "subset");
  const outDir = path.join(tempDir, "validate");
  await fs.mkdir(path.join(inputDir, "ready"), { recursive: true });
  const seed = makeSeed({
    resolution: "Inspect the harness and replace the module if damage is found.",
    metadata: {
      catalog_mapping: {
        resolved: false,
      },
    },
  });
  await fs.writeFile(path.join(inputDir, "ready", "seed_demo_1.json"), `${JSON.stringify(seed, null, 2)}\n`, "utf8");

  try {
    const summary = await validateSubset(inputDir, outDir);
    assert.equal(summary.approved, false);
    assert.equal(summary.unresolved_catalog_mapping, 1);
    assert.equal(summary.conditional_resolutions, 1);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`  OK ${name}`);
    passed++;
  } catch (error) {
    console.error(`  FAIL ${name}`);
    console.error(`    ${error.message}`);
    failed++;
  }
}

{
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
