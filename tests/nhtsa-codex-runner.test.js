import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  claimNextJob,
  completeJob,
  discoverPendingJobs,
  parseArgs,
} from "../scripts/nhtsa-codex-runner.mjs";

let passed = 0;
let failed = 0;
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

async function writeJson(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function makeBrandManifest(brandRoot, status) {
  return {
    file_path: "C:\\input\\TSBS_RECEIVED_2020-2024.txt",
    file_key: "tsbs_received_2020_2024",
    brand_key: "kia",
    make: "KIA",
    supported_rows: 123,
    sample_models: ["SORENTO"],
    status,
    iteration_count: 0,
    why_refined_again: null,
    reused_decisions_count: 0,
    refined_from_previous_run: null,
    directories: {
      brand_root: brandRoot,
      coarse: path.join(brandRoot, "01_coarse"),
      refined: path.join(brandRoot, "02_refined"),
      deepseek: path.join(brandRoot, "03_deepseek_review"),
      second_pass: path.join(brandRoot, "04_second_pass"),
      codex_review: path.join(brandRoot, "05_codex_review"),
      codex_validate: path.join(brandRoot, "06_codex_validate"),
      final_subset: path.join(brandRoot, "07_final_subset"),
      import_dry: path.join(brandRoot, "08_import_dry"),
      import_live: path.join(brandRoot, "09_import_live"),
    },
    steps: {},
  };
}

console.log("\n== nhtsa-codex-runner ==");

test("parseArgs parses claim command", async () => {
  const args = parseArgs(["claim", "--state-root", "C:\\state", "--phase", "review"]);
  assert.equal(args.subcommand, "claim");
  assert.equal(args.stateRoot, "C:\\state");
  assert.equal(args.phase, "codex_review");
});

test("parseArgs parses complete command", async () => {
  const args = parseArgs(["complete", "C:\\job.json", "--status", "approved", "--final-subset-dir", "C:\\subset"]);
  assert.equal(args.subcommand, "complete");
  assert.equal(args.jobFile, "C:\\job.json");
  assert.equal(args.status, "approved");
  assert.equal(args.finalSubsetDir, "C:\\subset");
});

test("discoverPendingJobs finds review jobs before validate jobs", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nhtsa-codex-runner-jobs-"));
  const fileDir = path.join(tempDir, "tsbs_received_2020_2024");
  const reviewBrandDir = path.join(fileDir, "kia");
  const validateBrandDir = path.join(fileDir, "ford");

  try {
    await writeJson(path.join(reviewBrandDir, "brand_manifest.json"), makeBrandManifest(reviewBrandDir, "awaiting_codex_review"));
    await writeJson(path.join(reviewBrandDir, "05_codex_review", "review_job.json"), {
      type: "codex_review",
      status: "pending",
      input_dir: path.join(reviewBrandDir, "04_second_pass"),
      expected_output_dir: path.join(reviewBrandDir, "07_final_subset"),
      checklist: ["review"],
    });

    const validateManifest = makeBrandManifest(validateBrandDir, "awaiting_codex_validate");
    validateManifest.brand_key = "ford";
    validateManifest.make = "FORD";
    validateManifest.supported_rows = 50;
    await writeJson(path.join(validateBrandDir, "brand_manifest.json"), validateManifest);
    await writeJson(path.join(validateBrandDir, "06_codex_validate", "validate_job.json"), {
      type: "codex_validate",
      status: "pending",
      input_dir: path.join(validateBrandDir, "07_final_subset"),
      expected_output_dir: path.join(validateBrandDir, "08_import_dry"),
      checklist: ["validate"],
    });

    const jobs = await discoverPendingJobs(tempDir);
    assert.equal(jobs.length, 2);
    assert.equal(jobs[0].jobType, "codex_review");
    assert.equal(jobs[1].jobType, "codex_validate");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("claimNextJob writes claim, prompt and context", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nhtsa-codex-runner-claim-"));
  const brandDir = path.join(tempDir, "tsbs_received_2020_2024", "kia");

  try {
    await writeJson(path.join(brandDir, "brand_manifest.json"), makeBrandManifest(brandDir, "awaiting_codex_review"));
    await writeJson(path.join(brandDir, "05_codex_review", "review_job.json"), {
      type: "codex_review",
      status: "pending",
      input_dir: path.join(brandDir, "04_second_pass"),
      expected_output_dir: path.join(brandDir, "07_final_subset"),
      checklist: ["review"],
    });

    const claimed = await claimNextJob(tempDir, "");
    assert.equal(claimed.jobType, "codex_review");
    const claim = JSON.parse(await fs.readFile(path.join(brandDir, "05_codex_review", "runner_claim.json"), "utf8"));
    const job = JSON.parse(await fs.readFile(path.join(brandDir, "05_codex_review", "review_job.json"), "utf8"));
    const context = JSON.parse(await fs.readFile(path.join(brandDir, "05_codex_review", "job_context.json"), "utf8"));
    assert.equal(job.status, "claimed");
    assert.equal(context.job_type, "codex_review");
    assert.match(claim.run_id, /^codex_job_/);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("completeJob writes approved review result and removes claim", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nhtsa-codex-runner-complete-"));
  const jobFile = path.join(tempDir, "review_job.json");

  try {
    await writeJson(jobFile, {
      type: "codex_review",
      status: "claimed",
      input_dir: "C:\\input",
      expected_output_dir: "C:\\subset",
    });
    await writeJson(path.join(tempDir, "runner_claim.json"), { run_id: "codex_job_1" });

    const result = await completeJob({
      jobFile,
      status: "approved",
      finalSubsetDir: "C:\\subset",
      manualReviewPath: "C:\\subset\\MANUAL_REVIEW.md",
      readyCount: 12,
      rejectedCount: 3,
      notes: "",
    });
    const saved = JSON.parse(await fs.readFile(path.join(tempDir, "review_result.json"), "utf8"));
    assert.equal(result.status, "approved");
    assert.equal(saved.final_subset_dir, "C:\\subset");
    await assert.rejects(fs.access(path.join(tempDir, "runner_claim.json")));
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("completeJob writes validate result", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nhtsa-codex-runner-validate-"));
  const jobFile = path.join(tempDir, "validate_job.json");

  try {
    await writeJson(jobFile, {
      type: "codex_validate",
      status: "claimed",
      input_dir: "C:\\subset",
      expected_output_dir: "C:\\dry",
    });

    await completeJob({
      jobFile,
      status: "blocked",
      finalSubsetDir: "",
      manualReviewPath: "",
      readyCount: null,
      rejectedCount: null,
      notes: "duplicate semantic variants remain",
    });
    const saved = JSON.parse(await fs.readFile(path.join(tempDir, "validate_result.json"), "utf8"));
    assert.equal(saved.status, "blocked");
    assert.match(saved.notes, /duplicate semantic variants/i);
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

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
