import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  collectSeedJsonFiles,
  collectRetryErrorFiles,
  normalizeSeedPayload,
  normalizeResolutionText,
  parseSeedJson,
  parseArgs,
  wasResolutionTruncated,
} from "../scripts/import-seeds-to-supabase.mjs";

let passed = 0;
let failed = 0;

function test(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`  OK ${name}`);
      passed++;
    })
    .catch(error => {
      console.error(`  FAIL ${name}`);
      console.error(`    ${error.message}`);
      failed++;
      process.exitCode = 1;
    });
}

test("collectSeedJsonFiles prefers ready subdirectory when present", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gb-seed-ready-"));
  const ready = path.join(root, "ready");
  await fs.mkdir(ready, { recursive: true });
  await fs.writeFile(path.join(root, "ignored.json"), "{}");
  await fs.writeFile(path.join(ready, "b.json"), "{}");
  await fs.writeFile(path.join(ready, "a.json"), "{}");

  const files = await collectSeedJsonFiles(root);
  assert.deepEqual(files.map(file => path.basename(file)), ["a.json", "b.json"]);
});

test("collectSeedJsonFiles falls back to direct json files", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gb-seed-flat-"));
  await fs.writeFile(path.join(root, "seed_2.json"), "{}");
  await fs.writeFile(path.join(root, "seed_1.json"), "{}");

  const files = await collectSeedJsonFiles(root);
  assert.deepEqual(files.map(file => path.basename(file)), ["seed_1.json", "seed_2.json"]);
});

test("normalizeSeedPayload keeps importer alias and arrays", () => {
  const payload = normalizeSeedPayload({
    local_id: "seed_123",
    user_id: "ai_importer",
    vehicle_brand: "Volkswagen",
    vehicle_model: "Golf VI (2008–2012)",
    symptoms: ["Noise"],
    obd_codes: ["P0401"],
    description: "Noise from door area",
    resolution: "Replaced striker",
  });

  assert.equal(payload.user_id, "ai_importer");
  assert.deepEqual(payload.symptoms, ["Noise"]);
  assert.deepEqual(payload.obd_codes, ["P0401"]);
});

test("normalizeSeedPayload allows forcing a concrete user id", () => {
  const payload = normalizeSeedPayload(
    { local_id: "seed_456", user_id: "ai_importer", vehicle_model: "Octavia", resolution: "Fixed" },
    "ai_importer",
    "11111111-1111-4111-8111-111111111111",
  );

  assert.equal(payload.user_id, "11111111-1111-4111-8111-111111111111");
});

test("normalizeResolutionText trims long resolutions to database limit", () => {
  const input = (
    "Replaced the gateway module and verified the CAN bus sleep current. "
    + "Also repaired damaged aftermarket door-light wiring that kept the control unit awake overnight. "
    + "Measured parasitic draw again after the repair and confirmed the battery drain was gone. "
    + "Documented the final readings and returned the car to the owner without further warning lights. "
  ).repeat(2);

  const normalized = normalizeResolutionText(input);
  assert.equal(normalized.length <= 400, true);
  assert.equal(normalized.startsWith("Replaced the gateway module"), true);
  assert.equal(normalized.length < input.length, true);
});

test("parseSeedJson tolerates UTF-8 BOM at file start", () => {
  const parsed = parseSeedJson('\uFEFF{"local_id":"seed_bom","vehicle_model":"Focus","resolution":"Replaced injector harness"}');

  assert.equal(parsed.local_id, "seed_bom");
  assert.equal(parsed.vehicle_model, "Focus");
});

test("wasResolutionTruncated reports truncation only when content changes", () => {
  const raw = { resolution: "  Tightened battery terminal and reset the fault.  " };
  const normalized = normalizeResolutionText(raw.resolution);

  assert.equal(wasResolutionTruncated(raw, normalized), false);
  assert.equal(wasResolutionTruncated({ resolution: `${raw.resolution} Added extra explanation that pushes the text well beyond the database limit and forces truncation at import time.`.repeat(3) }, normalizeResolutionText(`${raw.resolution} Added extra explanation that pushes the text well beyond the database limit and forces truncation at import time.`.repeat(3))), true);
});

test("parseArgs defaults to known seed directories", () => {
  const args = parseArgs([]);
  assert.equal(Array.isArray(args.inputs), true);
  assert.equal(args.inputs.length >= 2, true);
  assert.equal(typeof args.url, "string");
  assert.equal(typeof args.anonKey, "string");
});

test("parseArgs allows retrying from a results log without default inputs", () => {
  const args = parseArgs(["--errors-from", "tmp/results.jsonl"]);
  assert.deepEqual(args.inputs, []);
  assert.equal(args.errorsFrom, "tmp/results.jsonl");
});

test("collectRetryErrorFiles returns only failed seed paths", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gb-seed-retry-"));
  const logPath = path.join(root, "results.jsonl");
  await fs.writeFile(
    logPath,
    [
      JSON.stringify({ file: "seed_vw_full_20260319_145646\\ready\\seed_a.json", status: "ok" }),
      JSON.stringify({ file: "seed_vw_full_20260319_145646\\ready\\seed_b.json", status: "error" }),
      JSON.stringify({ file: "seed_skoda\\seed_c.json", status: "error" }),
    ].join("\n"),
  );

  const files = await collectRetryErrorFiles(logPath);
  assert.equal(files.length, 2);
  assert.equal(files[0].endsWith(path.join("seed_skoda", "seed_c.json")) || files[1].endsWith(path.join("seed_skoda", "seed_c.json")), true);
});

process.on("beforeExit", () => {
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
});
