import assert from "node:assert/strict";

import {
  augmentDtcOnlySymptoms,
  buildReviewPrompt,
  dedupeAcceptedSeeds,
  deepseekChatJson,
  enforceCatalogResolvedDecision,
  normalizeAiDecision,
  normalizeSymptomTags,
  parseDecisionLogLines,
  parseArgs,
  pruneGenericSymptomTags,
  pruneSymptomsAgainstObdCodes,
  safeParseJsonObject,
} from "../scripts/tsb-review-nhtsa-ai.mjs";

let passed = 0;
let failed = 0;
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

console.log("\n== tsb-review-nhtsa-ai ==");

test("parseArgs accepts multiple input dirs and output dir", () => {
  const args = parseArgs(["dirA", "dirB", "out", "--model", "deepseek-v4-flash", "--max-cases", "50", "--include-review"]);
  assert.equal(args.inputs.length, 2);
  assert.equal(args.outDir.endsWith("out"), true);
  assert.equal(args.model, "deepseek-v4-flash");
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

test("pruneSymptomsAgainstObdCodes also removes 7-character manufacturer DTC symptom tags", () => {
  const pruned = pruneSymptomsAgainstObdCodes(
    ["Battery monitor fault", "DTC P162B87", "DTC P15AD87"],
    ["P162B87", "P15AD87"],
  );
  assert.deepEqual(pruned, ["Battery monitor fault"]);
});

test("normalizeSymptomTags rewrites door-glass prose into a compact action-free tag", () => {
  const normalized = normalizeSymptomTags([
    "Door glass does not drop when opening the door.",
  ]);
  assert.deepEqual(normalized, ["Door glass won't drop"]);
});

test("normalizeSymptomTags prefers subsystem fault tag over generic MIL when TBM backup battery is explicit", () => {
  const normalized = normalizeSymptomTags([
    "Malfunction Indicator Lamp (MIL) is illuminated with DTC B1E21-96 stored, indicating a Telematics Box Module (TBM) backup battery internal failure.",
  ]);
  assert.deepEqual(normalized, ["TBM battery fault"]);
});

test("pruneGenericSymptomTags drops generic MIL when a more specific symptom remains", () => {
  const pruned = pruneGenericSymptomTags(
    ["MIL on", "Limp mode"],
    "Malfunction Indicator Lamp (MIL) is illuminated with DTC P0606 stored. Vehicle may enter limp mode.",
  );
  assert.deepEqual(pruned, ["Limp mode"]);
});

test("pruneGenericSymptomTags derives specific TBM symptom from description when only MIL remains", () => {
  const pruned = pruneGenericSymptomTags(
    ["MIL on"],
    "Malfunction Indicator Lamp (MIL) is illuminated with DTC B1E21-96 stored, indicating a Telematics Box Module (TBM) backup battery internal failure.",
  );
  assert.deepEqual(pruned, ["TBM battery fault"]);
});

test("normalizeSymptomTags derives 12V battery fault from warning-light prose", () => {
  const normalized = normalizeSymptomTags([
    "Vehicle exhibits a warning light with DTC P1BB20 (12V Lithium Battery Cell Voltage High) stored.",
  ]);
  assert.deepEqual(normalized, ["12V battery fault"]);
});

test("augmentDtcOnlySymptoms prepends specific fault tag when only DTC tags remain", () => {
  const augmented = augmentDtcOnlySymptoms(
    ["DTC P1BB20"],
    "Vehicle exhibits a warning light with DTC P1BB20 (12V Lithium Battery Cell Voltage High).",
  );
  assert.deepEqual(augmented, ["12V battery fault", "DTC P1BB20"]);
});

test("normalizeSymptomTags derives battery monitor fault from Toyota DTC prose", () => {
  const normalized = normalizeSymptomTags([
    "Malfunction indicator lamp (MIL) is on with diagnostic trouble codes P162B87 (Lost Communication with Battery Monitor Module) and/or P15AD87 (Active Grille Air Shutter \"A\" Missing).",
  ]);
  assert.deepEqual(normalized, ["Battery monitor fault"]);
});

test("normalizeSymptomTags derives no-shift-out-of-park from park pawl prose", () => {
  const normalized = normalizeSymptomTags([
    "Malfunction Indicator Lamp (MIL) is illuminated with DTC P1E18 (Internal Control Module Electronic Park Performance) stored. The vehicle will not shift out of park.",
  ]);
  assert.deepEqual(normalized, ["Stuck in Park"]);
});

test("normalizeSymptomTags derives torque converter clutch fault from engagement prose", () => {
  const normalized = normalizeSymptomTags([
    "Lack of engagement of the torque converter damper clutch with MIL illumination and DTC P074100 stored.",
  ]);
  assert.deepEqual(normalized, ["Torque converter clutch fault"]);
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

test("deepseekChatJson retries transient fetch failures and returns content", async () => {
  let calls = 0;
  const result = await deepseekChatJson({
    apiKey: "test-key",
    model: "deepseek-v4-flash",
    messages: [{ role: "user", content: "x" }],
    fetchFn: async () => {
      calls++;
      if (calls < 3) throw new TypeError("fetch failed");
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "{\"decision\":\"reject\"}" } }],
        }),
      };
    },
    sleepFn: async () => {},
  });
  assert.equal(calls, 3);
  assert.equal(result, "{\"decision\":\"reject\"}");
});

test("parseDecisionLogLines restores processed paths and accepted decisions for resume", () => {
  const parsed = parseDecisionLogLines(
    [
      JSON.stringify({
        source_path: "C:/GB/tmp/case1.json",
        decision: {
          decision: "accept",
          is_relevant: true,
          has_clear_symptoms: true,
          has_clear_resolution: true,
          matches_case_structure: true,
          cleaned_symptoms: ["Fuel door will not open with DTC P04CA."],
          cleaned_description: "Fuel door will not open with DTC P04CA.",
          cleaned_resolution: "Inspect circuit SBB05 and repair the circuit.",
          reason: "Clear repair path.",
        },
      }),
      JSON.stringify({
        source_path: "C:/GB/tmp/case2.json",
        decision: {
          decision: "review",
          reason: "Needs manual check.",
        },
      }),
    ].join("\n"),
  );
  assert.deepEqual(parsed.processedPaths, [
    "C:\\GB\\tmp\\case1.json",
    "C:\\GB\\tmp\\case2.json",
  ]);
  assert.equal(parsed.acceptedDecisions.length, 1);
  assert.equal(parsed.summary.reviewed, 2);
  assert.equal(parsed.summary.accepted, 1);
  assert.equal(parsed.summary.review, 1);
  assert.equal(parsed.summary.rejected, 0);
  assert.deepEqual(parsed.acceptedDecisions[0].decision.cleanedSymptoms, ["Fuel door stuck"]);
});

test("enforceCatalogResolvedDecision downgrades unresolved accepted seed to review", () => {
  const decision = enforceCatalogResolvedDecision(
    {
      metadata: {
        catalog_mapping: {
          resolved: false,
        },
      },
    },
    {
      decision: "accept",
      isRelevant: true,
      hasClearSymptoms: true,
      hasClearResolution: true,
      matchesCaseStructure: true,
      cleanedSymptoms: ["TBM battery fault"],
      cleanedDescription: "MIL illuminated with DTC B1E21 stored.",
      cleanedResolution: "Replace the TBM backup battery.",
      reason: "Looks valid.",
    },
  );
  assert.equal(decision.decision, "review");
  assert.match(decision.reason, /catalog mapping is unresolved/i);
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
