import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  chooseNextBrand,
  discoverSupportedMakesInFile,
  isNhtsaInputFileName,
  makeBrandKey,
  makeFileKey,
  parseArgs,
} from "../scripts/nhtsa-supercrawler.mjs";

const execFileAsync = promisify(execFile);

let passed = 0;
let failed = 0;
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function makeLine({
  nhtsaId = "11000001",
  tsbId = "TSB-1",
  communicationType = "Service Bulletin/Repair Instructions",
  make = "KIA",
  model = "SORENTO",
  modelYear = "2024",
  summary = "Vehicle will not start. Replace the fuel pump control module.",
} = {}) {
  return [
    nhtsaId,
    "",
    "20240101",
    tsbId,
    "20240101",
    "",
    communicationType,
    make,
    model,
    modelYear,
    "ENGINE",
    "ENG",
    "",
    summary,
  ].join("\t");
}

console.log("\n== nhtsa-supercrawler ==");

test("parseArgs reads file, make and state-root filters", async () => {
  const args = parseArgs([
    "C:\\input",
    "--state-root", "C:\\state",
    "--file", "TSBS_RECEIVED_2020-2024.txt",
    "--make", "KIA",
    "--model", "deepseek-reasoner",
    "--user-id", "user-123",
    "--stop-after", "refined",
  ]);
  assert.equal(args.inputDir, "C:\\input");
  assert.equal(args.stateRoot, "C:\\state");
  assert.equal(args.fileName, "TSBS_RECEIVED_2020-2024.txt");
  assert.equal(args.make, "KIA");
  assert.equal(args.model, "deepseek-reasoner");
  assert.equal(args.userId, "user-123");
  assert.equal(args.stopAfter, "refined");
});

test("isNhtsaInputFileName matches only NHTSA file chunks", async () => {
  assert.equal(isNhtsaInputFileName("TSBS_RECEIVED_2020-2024.txt"), true);
  assert.equal(isNhtsaInputFileName("MfrComms.txt"), false);
  assert.equal(isNhtsaInputFileName("TSBS_RECEIVED_2020-24.txt"), false);
});

test("makeFileKey and makeBrandKey normalize identifiers", async () => {
  assert.equal(makeFileKey("C:\\tmp\\TSBS_RECEIVED_2020-2024.txt"), "tsbs_received_2020_2024");
  assert.equal(makeBrandKey("Mercedes-Maybach"), "mercedes_maybach");
});

test("chooseNextBrand prioritizes earliest non-terminal status and then row count", async () => {
  const choice = chooseNextBrand([
    { make: "FORD", status: "awaiting_codex_review", supported_rows: 999 },
    { make: "KIA", status: "refined_done", supported_rows: 50 },
    { make: "BMW", status: "coarse_done", supported_rows: 10 },
    { make: "AUDI", status: "coarse_done", supported_rows: 100 },
  ]);
  assert.equal(choice.make, "AUDI");
});

test("discoverSupportedMakesInFile keeps only supported passenger-car makes", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nhtsa-supercrawler-"));
  const filePath = path.join(tempDir, "TSBS_RECEIVED_2020-2024.txt");
  await fs.writeFile(filePath, [
    makeLine({
      nhtsaId: "11000001",
      make: "KIA",
      model: "SORENTO",
    }),
    makeLine({
      nhtsaId: "11000002",
      make: "VOLVO",
      model: "VNL (4)",
    }),
    makeLine({
      nhtsaId: "11000003",
      make: "HARLEY-DAVIDSON",
      model: "SPORTSTER",
    }),
    makeLine({
      nhtsaId: "11000004",
      make: "KIA",
      model: "SOUL",
    }),
  ].join("\n"), "utf8");

  try {
    const makes = await discoverSupportedMakesInFile(filePath);
    assert.equal(makes.length, 1);
    assert.equal(makes[0].make, "KIA");
    assert.equal(makes[0].supported_rows, 2);
    assert.deepEqual(makes[0].sample_models, ["SORENTO", "SOUL"]);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("nhtsa-supercrawler can stop after refined phase for a tiny fixture", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nhtsa-supercrawler-run-"));
  const inputDir = path.join(tempDir, "input");
  const stateRoot = path.join(tempDir, "state");
  await fs.mkdir(inputDir, { recursive: true });
  const filePath = path.join(inputDir, "TSBS_RECEIVED_2020-2024.txt");
  await fs.writeFile(filePath, makeLine({
    nhtsaId: "11000021",
    make: "KIA",
    model: "SORENTO",
    summary: "Vehicle will not start. Replace the fuel pump control module.",
  }), "utf8");

  try {
    await execFileAsync(process.execPath, [
      "C:\\GB\\scripts\\nhtsa-supercrawler.mjs",
      inputDir,
      "--state-root", stateRoot,
      "--file", "TSBS_RECEIVED_2020-2024.txt",
      "--make", "KIA",
      "--stop-after", "refined",
      "--allow-main-branch",
    ], {
      cwd: "C:\\GB",
    });

    const brandManifestPath = path.join(stateRoot, "tsbs_received_2020_2024", "kia", "brand_manifest.json");
    const summaryPath = path.join(stateRoot, "tsbs_received_2020_2024", "kia", "02_refined", "summary.json");
    const brandManifest = JSON.parse(await fs.readFile(brandManifestPath, "utf8"));
    const summary = JSON.parse(await fs.readFile(summaryPath, "utf8"));

    assert.equal(brandManifest.status, "refined_done");
    assert.equal(
      summary.ready_kept + summary.ready_moved_to_review + summary.existing_review_copied,
      1,
    );
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
