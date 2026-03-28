import assert from "node:assert/strict";

import {
  buildReviewPrompt,
  dedupeAcceptedSeeds,
  normalizeAiDecision,
  pruneSymptomsAgainstObdCodes,
  normalizeSymptomTags,
  parseArgs,
  safeParseJsonObject,
} from "../scripts/tsb-review-nhtsa-ai.mjs";

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

console.log("\n== tsb-review-nhtsa-ai ==");

test("parseArgs accepts multiple input dirs and output dir", () => {
  const args = parseArgs(["dirA", "dirB", "out", "--model", "deepseek-chat", "--max-cases", "50", "--include-review"]);
  assert.equal(args.inputs.length, 2);
  assert.equal(args.outDir.endsWith("out"), true);
  assert.equal(args.model, "deepseek-chat");
  assert.equal(args.maxCases, 50);
  assert.equal(args.includeReview, true);
});

test("safeParseJsonObject extracts JSON object from fenced response", () => {
  const parsed = safeParseJsonObject("```json\n{\"decision\":\"reject\",\"reason\":\"x\"}\n```");
  assert.equal(parsed.decision, "reject");
  assert.equal(parsed.reason, "x");
});

test("safeParseJsonObject tolerates UTF-8 BOM before JSON", () => {
  const parsed = safeParseJsonObject("\uFEFF{\"decision\":\"review\",\"reason\":\"bom\"}");
  assert.equal(parsed.decision, "review");
  assert.equal(parsed.reason, "bom");
});

test("normalizeAiDecision keeps valid accepted decision", () => {
  const normalized = normalizeAiDecision({
    decision: "accept",
    is_relevant: true,
    has_clear_symptoms: true,
    has_clear_resolution: true,
    matches_case_structure: true,
    cleaned_symptoms: ["Fuel door will not open with DTC P04CA."],
    cleaned_description: "Fuel door will not open with DTC P04CA.",
    cleaned_resolution: "Inspect circuit SBB05 and splice S133 and repair the circuit as needed.",
    reason: "Clear symptom and repair.",
  });
  assert.equal(normalized.decision, "accept");
  assert.equal(normalized.cleanedSymptoms.length, 1);
  assert.deepEqual(normalized.cleanedSymptoms, ["Fuel door stuck"]);
});

test("normalizeAiDecision downgrades generic resolution accept to review", () => {
  const normalized = normalizeAiDecision({
    decision: "accept",
    is_relevant: true,
    has_clear_symptoms: true,
    has_clear_resolution: true,
    matches_case_structure: true,
    cleaned_symptoms: ["Noise from the HVAC system when the blower motor is turned on."],
    cleaned_description: "Noise from the HVAC system when the blower motor is turned on.",
    cleaned_resolution: "Follow the bulletin repair procedure to eliminate the HVAC blower noise.",
    reason: "Looks usable.",
  });
  assert.equal(normalized.decision, "review");
});

test("normalizeSymptomTags shortens verbose Uconnect and DTC symptoms into short tags", () => {
  const normalized = normalizeSymptomTags([
    "Uconnect Box requires service message at start up on the display screen",
    "Malfunction Indicator Lamp (MIL) illumination",
    "Diagnostic Trouble Codes (DTCs) B1562-14, B1561-11, B1560-11, B22A9-96, B1560-13, or B1561-13 present",
  ]);
  assert.deepEqual(normalized, [
    "Uconnect service message",
    "MIL on",
    "DTCs B1562/B1561/B1560/B22A9",
  ]);
});

test("normalizeAiDecision rewrites accepted long symptom prose into short tags", () => {
  const normalized = normalizeAiDecision({
    decision: "accept",
    is_relevant: true,
    has_clear_symptoms: true,
    has_clear_resolution: true,
    matches_case_structure: true,
    cleaned_symptoms: [
      "Uconnect Box requires service message at start up on the display screen",
      "Malfunction Indicator Lamp (MIL) illumination",
      "Diagnostic Trouble Codes (DTCs) B1562-14, B1561-11, B1560-11, B22A9-96, B1560-13, or B1561-13 present",
    ],
    cleaned_description: "Vehicle displays 'Uconnect Box requires service' message at startup. Associated DTCs may include B22A9, B1560, B1561, or B1562.",
    cleaned_resolution: "Reprogram the Telematics Box Module (TBM) with the latest available software.",
    reason: "Clear telematics module fault and repair.",
  });
  assert.equal(normalized.decision, "accept");
  assert.deepEqual(normalized.cleanedSymptoms, [
    "Uconnect service message",
    "MIL on",
    "DTCs B1562/B1561/B1560/B22A9",
  ]);
  assert.equal(normalized.cleanedSymptoms.every(tag => tag.split(/\s+/).length <= 4), true);
});

test("pruneSymptomsAgainstObdCodes removes redundant DTC symptom tags when obd codes exist", () => {
  const pruned = pruneSymptomsAgainstObdCodes(
    ["Uconnect service message", "MIL on", "DTCs B1562/B1561/B1560/B22A9"],
    ["B22A9", "B1560", "B1561", "B1562"],
  );
  assert.deepEqual(pruned, ["Uconnect service message", "MIL on"]);
});

test("buildReviewPrompt includes raw summary and current seed fields", () => {
  const prompt = buildReviewPrompt({
    seed: {
      vehicle_brand: "Lincoln",
      vehicle_model: "Corsair (2020–present)",
      source_ref: "SSM 54313 / NHTSA 11024526",
      symptoms: ["Blind spot system fault."],
      description: "Blind spot system fault.",
      resolution: "Replace the exterior mirror assembly.",
      obd_codes: ["B118C"],
    },
    summaryRaw: "Some vehicles may experience an inoperative blind spot monitoring...",
  });
  assert.match(prompt, /Raw source summary:/);
  assert.match(prompt, /SSM 54313/);
  assert.match(prompt, /Blind spot system fault/);
});

test("dedupeAcceptedSeeds keeps latest revision variant", () => {
  const deduped = dedupeAcceptedSeeds([
    {
      sourcePath: "seed_old.json",
      seed: {
        vehicle_brand: "Alfa Romeo",
        vehicle_model: "Stelvio (2018–present)",
        obd_codes: [],
        description: "Oil leaking from the timing cover.",
        resolution: "Replace the timing cover sealant.",
        source_ref: "09-013-25 / NHTSA 11018862",
        thread_url: "https://example.com/base.pdf",
        metadata: {},
      },
    },
    {
      sourcePath: "seed_new.json",
      seed: {
        vehicle_brand: "Alfa Romeo",
        vehicle_model: "Stelvio (2018–present)",
        obd_codes: [],
        description: "Oil leaking from the timing cover.",
        resolution: "Replace the timing cover sealant.",
        source_ref: "09-013-25 REV. B / NHTSA 11019431",
        thread_url: "https://example.com/revb.pdf",
        metadata: {},
      },
    },
  ]);
  assert.equal(deduped.kept.length, 1);
  assert.equal(deduped.dropped.length, 1);
  assert.equal(deduped.kept[0].seed.source_ref, "09-013-25 REV. B / NHTSA 11019431");
  assert.deepEqual(deduped.kept[0].seed.metadata.source_refs, [
    "09-013-25 / NHTSA 11018862",
    "09-013-25 REV. B / NHTSA 11019431",
  ]);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
