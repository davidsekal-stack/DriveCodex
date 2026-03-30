import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { bootstrapReviewReuse, parseArgs } from "../scripts/tsb-reuse-nhtsa-review.mjs";

let passed = 0;
let failed = 0;
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

console.log("\n== tsb-reuse-nhtsa-review ==");

test("parseArgs reads old dir, new input dirs and output dir", () => {
  const args = parseArgs(["old", "in1", "in2", "out", "--include-review"]);
  assert.equal(args.oldReviewDir.endsWith("old"), true);
  assert.equal(args.newInputDirs.length, 2);
  assert.equal(args.newOutDir.endsWith("out"), true);
  assert.equal(args.includeReview, true);
});

test("bootstrapReviewReuse rewrites matched source paths into new subset", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gb-tsb-reuse-"));
  const oldDir = path.join(root, "old");
  const inputDir = path.join(root, "input");
  const readyDir = path.join(inputDir, "ready");
  const reviewDir = path.join(inputDir, "to_review");
  const outDir = path.join(root, "out");

  await fs.mkdir(oldDir, { recursive: true });
  await fs.mkdir(readyDir, { recursive: true });
  await fs.mkdir(reviewDir, { recursive: true });

  await fs.writeFile(
    path.join(oldDir, "ai_review_decisions.jsonl"),
    [
      JSON.stringify({
        source_path: "C:\\old\\seed_alpha.json",
        decision: {
          decision: "accept",
          is_relevant: true,
          has_clear_symptoms: true,
          has_clear_resolution: true,
          matches_case_structure: true,
          cleaned_symptoms: ["Door glass won't drop"],
          cleaned_description: "Door glass does not drop when opening the door.",
          cleaned_resolution: "Reprogram the latch module software.",
          reason: "Clear case.",
        },
      }),
      JSON.stringify({
        source_path: "C:\\old\\review_beta.json",
        decision: {
          decision: "review",
          reason: "Needs manual check.",
        },
      }),
      "",
    ].join("\n"),
    "utf8",
  );

  await fs.writeFile(
    path.join(readyDir, "seed_alpha.json"),
    JSON.stringify({
      local_id: "seed_alpha",
      vehicle_brand: "Dodge",
      vehicle_model: "Charger (2015–)",
      source_ref: "TSB-1",
      symptoms: ["Door glass won't drop"],
      obd_codes: [],
      description: "Door glass does not drop when opening the door.",
      resolution: "Reprogram the latch module software.",
      metadata: { summary_raw: "Door glass does not drop." },
    }),
    "utf8",
  );

  await fs.writeFile(
    path.join(reviewDir, "review_beta.json"),
    JSON.stringify({
      review_reason: "Thin resolution",
      candidate_seed: {
        local_id: "seed_beta",
        vehicle_brand: "Chevrolet",
        vehicle_model: "Traverse (2018–)",
        source_ref: "TSB-2",
        symptoms: ["MIL on"],
        obd_codes: ["P059F"],
        description: "MIL illuminated with P059F.",
        resolution: "Follow the service procedure.",
        metadata: { summary_raw: "MIL illuminated with P059F." },
      },
      source_record: { summary: "MIL illuminated with P059F." },
    }),
    "utf8",
  );

  const summary = await bootstrapReviewReuse({
    oldReviewDir: oldDir,
    newInputDirs: [inputDir],
    newOutDir: outDir,
    includeReview: true,
  });

  assert.equal(summary.matched, 2);
  assert.equal(summary.unmatched, 0);
  assert.equal(summary.reused_accept, 1);
  assert.equal(summary.reused_review, 1);

  const decisions = (await fs.readFile(path.join(outDir, "ai_review_decisions.jsonl"), "utf8"))
    .trim()
    .split(/\r?\n/)
    .map(line => JSON.parse(line));
  assert.equal(decisions.length, 2);
  assert.equal(path.basename(decisions[0].source_path), "seed_alpha.json");
  assert.equal(path.basename(decisions[1].source_path), "review_beta.json");

  const reusedReview = JSON.parse(await fs.readFile(path.join(outDir, "to_review", "review_beta.json"), "utf8"));
  assert.equal(reusedReview.ai_decision.decision, "review");
  assert.equal(reusedReview.seed.vehicle_brand, "Chevrolet");
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

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
