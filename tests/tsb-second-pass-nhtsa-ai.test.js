import assert from "node:assert/strict";

import {
  applySecondPassGuards,
  hasConditionalResolution,
  isTooGenericSymptom,
  isWeakSoftwareOnlyCase,
} from "../scripts/tsb-second-pass-nhtsa-ai.mjs";

let passed = 0;
let failed = 0;
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

console.log("\n== tsb-second-pass-nhtsa-ai ==");

test("hasConditionalResolution detects decision-tree wording", () => {
  assert.equal(hasConditionalResolution("Inspect the harness and replace the module as needed."), true);
  assert.equal(hasConditionalResolution("Replace the telematics box module."), false);
});

test("isTooGenericSymptom rejects overly broad tags", () => {
  assert.equal(isTooGenericSymptom("inoperative"), true);
  assert.equal(isTooGenericSymptom("Door glass won't drop"), false);
});

test("isWeakSoftwareOnlyCase rejects weak comfort software cases", () => {
  assert.equal(
    isWeakSoftwareOnlyCase(
      ["SYNC performance issues"],
      "SYNC center display responds slowly and navigation ETA is inaccurate.",
      "Reprogram the instrument panel cluster with the latest software.",
    ),
    true,
  );
  assert.equal(
    isWeakSoftwareOnlyCase(
      ["No power steering assist"],
      "Vehicle has no power steering assist and DTC U3000 is stored.",
      "Reprogram the power steering control module with the latest software.",
    ),
    false,
  );
});

test("applySecondPassGuards downgrades generic symptom accept to review", () => {
  const guarded = applySecondPassGuards(
    {},
    {
      decision: "accept",
      cleanedSymptoms: ["inoperative"],
      cleanedDescription: "The power liftgate is inoperative.",
      cleanedResolution: "Reprogram the rear gate trunk module.",
      reason: "Looks good.",
    },
  );
  assert.equal(guarded.decision, "review");
});

test("applySecondPassGuards downgrades conditional repair accept to review", () => {
  const guarded = applySecondPassGuards(
    {},
    {
      decision: "accept",
      cleanedSymptoms: ["Battery drain"],
      cleanedDescription: "Battery drains overnight.",
      cleanedResolution: "Inspect the wiring and repair the circuit as needed.",
      reason: "Looks good.",
    },
  );
  assert.equal(guarded.decision, "review");
});

for (const { name, fn } of tests) {
  try {
    await fn();
    passed++;
    console.log(`ok - ${name}`);
  } catch (error) {
    failed++;
    console.error(`not ok - ${name}`);
    console.error(error?.stack || String(error));
  }
}

console.log(`\npassed: ${passed}`);
console.log(`failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
