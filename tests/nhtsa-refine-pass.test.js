import assert from "node:assert/strict";

import {
  classifySeedForRefine,
  parseArgs,
} from "../scripts/nhtsa-refine-pass.mjs";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  OK ${name}`);
    passed++;
  } catch (error) {
    console.error(`  FAIL ${name}`);
    console.error(`    ${error.message}`);
    failed++;
  }
}

function makeSeed(overrides = {}) {
  return {
    symptoms: ["No start"],
    description: "Engine will not start because the fuel pump control module failed.",
    resolution: "Replace the fuel pump control module.",
    metadata: {
      summary_raw: "Vehicle will not start because the fuel pump control module failed. Replace the fuel pump control module.",
      catalog_mapping: {
        resolved: true,
      },
    },
    ...overrides,
  };
}

console.log("\n== nhtsa-refine-pass ==");

test("parseArgs resolves input and output directories", () => {
  const args = parseArgs(["C:\\in", "C:\\out"]);
  assert.equal(args.inputDir, "C:\\in");
  assert.equal(args.outDir, "C:\\out");
});

test("classifySeedForRefine keeps strong high-value cases ready", () => {
  const result = classifySeedForRefine(makeSeed());
  assert.equal(result.stage, "ready");
});

test("classifySeedForRefine moves unresolved catalog mappings to review", () => {
  const result = classifySeedForRefine(makeSeed({
    metadata: {
      summary_raw: "No start because the fuel pump control module failed. Replace the fuel pump control module.",
      catalog_mapping: {
        resolved: false,
      },
    },
  }));
  assert.equal(result.stage, "review");
  assert.match(result.reason, /catalog mapping/i);
});

test("classifySeedForRefine moves verbose symptom tags to review", () => {
  const result = classifySeedForRefine(makeSeed({
    symptoms: ["Vehicle will not start when parked outside overnight"],
  }));
  assert.equal(result.stage, "review");
  assert.match(result.reason, /symptom tags are too verbose/i);
});

test("classifySeedForRefine moves generic bulletin procedures to review", () => {
  const result = classifySeedForRefine(makeSeed({
    resolution: "Follow the bulletin repair procedure.",
  }));
  assert.equal(result.stage, "review");
  assert.match(result.reason, /procedural or generic bulletin guidance/i);
});

test("classifySeedForRefine moves low-value NVH cases to review", () => {
  const result = classifySeedForRefine(makeSeed({
    symptoms: ["Roof rattle"],
    description: "Customer hears a roof rattle while driving over bumps.",
    resolution: "Replace the roof side molding clip.",
    metadata: {
      summary_raw: "Customer hears a roof rattle while driving over bumps. Replace the roof side molding clip.",
      catalog_mapping: {
        resolved: true,
      },
    },
  }));
  assert.equal(result.stage, "review");
  assert.match(result.reason, /low-value nvh\/comfort/i);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
