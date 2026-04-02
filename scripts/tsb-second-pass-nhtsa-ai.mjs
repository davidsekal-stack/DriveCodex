#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  collectCandidatePaths,
  deepseekChatJson,
  dedupeAcceptedSeeds,
  enforceCatalogResolvedDecision,
  loadCandidate,
  normalizeAiDecision,
  parseArgs,
  safeParseJsonObject,
} from "./tsb-review-nhtsa-ai.mjs";

function cleanText(value) {
  return (value ?? "").toString().replace(/^\uFEFF/, "").replace(/\s+/g, " ").trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function makeDecisionId(sourcePath) {
  return path.basename(sourcePath).replace(/\.json$/i, "");
}

export function hasConditionalResolution(text) {
  const normalized = cleanText(text).toLowerCase();
  if (!normalized) return false;
  return [
    /\bas needed\b/,
    /\bif necessary\b/,
    /\bif the concern persists\b/,
    /\bif concern persists\b/,
    /\bif concern remains\b/,
    /\bif the issue persists\b/,
    /\bif issue persists\b/,
    /\bif symptoms persist\b/,
    /\bif the vehicle still\b/,
    /\bif .* found\b/,
    /\bif .* damaged\b/,
    /\bif .* out of spec\b/,
    /\bif .* cannot be established\b/,
    /\bthen replace\b/,
  ].some(pattern => pattern.test(normalized));
}

export function isTooGenericSymptom(symptom) {
  const normalized = cleanText(symptom).toLowerCase();
  return [
    "inoperative",
    "warning light",
    "mil on",
    "noise",
    "vct dtcs",
    "lack of power",
    "wrench indicator",
  ].includes(normalized);
}

export function isWeakSoftwareOnlyCase(symptoms, description, resolution) {
  const normalizedResolution = cleanText(resolution).toLowerCase();
  const normalizedDescription = cleanText(description).toLowerCase();
  const normalizedSymptoms = (symptoms ?? []).map(symptom => cleanText(symptom).toLowerCase());
  const isSoftwareFix =
    /\breprogram\b/.test(normalizedResolution) ||
    /\bupdate\b/.test(normalizedResolution) ||
    /\bflash\b/.test(normalizedResolution);
  if (!isSoftwareFix) return false;

  const seriousFaultSignals = [
    /\bdtc\b/,
    /\bno start\b/,
    /\bstall\b/,
    /\bwon't start\b/,
    /\boverheat\b/,
    /\bleak\b/,
    /\blimp\b/,
    /\bmisfire\b/,
    /\binoperative\b/,
    /\bcharging\b/,
    /\bbattery\b/,
    /\bpower steering\b/,
    /\bengine coolant over temperature\b/,
  ].some(pattern => pattern.test(normalizedDescription));
  if (seriousFaultSignals) return false;

  const comfortSignals = [
    /\beta\b/,
    /\bsync\b/,
    /\bnavigation\b/,
    /\bambient\b/,
    /\bdisplay\b/,
    /\bmessage\b/,
    /\bphone\b/,
    /\bconnected service\b/,
    /\bdeep sleep\b/,
    /\bperformance issues\b/,
  ].some(pattern => pattern.test(normalizedDescription))
    || normalizedSymptoms.some(symptom =>
      ["sync performance issues", "false deep sleep notification", "inaccurate deep sleep notification"].includes(symptom),
    );
  return comfortSignals;
}

export function applySecondPassGuards(seed, decision) {
  const guarded = {
    ...decision,
    cleanedSymptoms: [...(decision.cleanedSymptoms ?? [])],
  };
  const description = cleanText(guarded.cleanedDescription);
  const resolution = cleanText(guarded.cleanedResolution);
  const symptoms = guarded.cleanedSymptoms.map(symptom => cleanText(symptom)).filter(Boolean);

  if (guarded.decision !== "accept") {
    return guarded;
  }

  if (symptoms.length === 0) {
    return {
      ...guarded,
      decision: "review",
      reason: "Second pass downgraded accept: empty symptoms after normalization.",
    };
  }

  if (symptoms.some(isTooGenericSymptom)) {
    return {
      ...guarded,
      decision: "review",
      reason: "Second pass downgraded accept: symptom tag is too generic for diagnostic retrieval.",
    };
  }

  if (hasConditionalResolution(resolution)) {
    return {
      ...guarded,
      decision: "review",
      reason: "Second pass downgraded accept: repair action is conditional or decision-tree based.",
    };
  }

  if (isWeakSoftwareOnlyCase(symptoms, description, resolution)) {
    return {
      ...guarded,
      decision: "review",
      reason: "Second pass downgraded accept: software-only comfort/convenience bulletin is too weak for closed-case retrieval.",
    };
  }

  return guarded;
}

function buildSecondPassPrompt(candidate) {
  return [
    "You review one already AI-cleaned automotive diagnostic seed candidate from an NHTSA bulletin.",
    "This is a SECOND PASS safety review before production import.",
    "Return ONLY one JSON object and nothing else.",
    "",
    "Accept ONLY if ALL are true:",
    "- it is a high-confidence closed diagnostic case",
    "- the symptom is specific enough for retrieval",
    "- the repair action is explicit and non-conditional",
    "- the case is useful in a production diagnostic database",
    "",
    "Reject if ANY are true:",
    "- symptom tag is too generic (examples: 'inoperative', 'warning light', 'noise', 'lack of power')",
    "- repair is conditional or decision-tree based ('if needed', 'if concern persists', 'if found', 'as needed')",
    "- it is mostly software update / comfort / infotainment / connected-service guidance without a strong fault case",
    "- it still feels like service guidance rather than a closed case",
    "",
    "If accepted, keep the seed concise.",
    "- cleaned_symptoms must stay as SHORT TAGS only, 1 to 4 words each.",
    "- Prefer rejecting over weakening standards.",
    "",
    'JSON schema:',
    '{"decision":"reject","is_relevant":false,"has_clear_symptoms":false,"has_clear_resolution":false,"matches_case_structure":false,"cleaned_symptoms":[],"cleaned_description":"","cleaned_resolution":"","reason":""}',
    "",
    `Brand: ${candidate.seed.vehicle_brand}`,
    `Model: ${candidate.seed.vehicle_model}`,
    `Source ref: ${candidate.seed.source_ref ?? ""}`,
    `Current symptoms: ${JSON.stringify(candidate.seed.symptoms ?? [])}`,
    `Current description: ${candidate.seed.description ?? ""}`,
    `Current resolution: ${candidate.seed.resolution ?? ""}`,
    `Current OBD codes: ${JSON.stringify(candidate.seed.obd_codes ?? [])}`,
    `Raw source summary: ${candidate.summaryRaw}`,
  ].join("\n");
}

function applyDecisionToSeed(seed, decision, model) {
  const updated = structuredClone(seed);
  updated.symptoms = [...(decision.cleanedSymptoms ?? [])];
  updated.description = decision.cleanedDescription;
  updated.resolution = decision.cleanedResolution;
  updated.metadata = updated.metadata ?? {};
  updated.metadata.ai_second_pass = {
    reviewed_at: new Date().toISOString(),
    reviewer_model: model,
    decision: decision.decision,
    reason: decision.reason,
  };
  return updated;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error("Missing DEEPSEEK_API_KEY.");
    process.exit(2);
  }

  const readyDir = path.join(args.outDir, "ready");
  const reviewDir = path.join(args.outDir, "to_review");
  const rejectDir = path.join(args.outDir, "manual_review", "rejected_second_pass");
  const summaryPath = path.join(args.outDir, "summary.json");
  const decisionsPath = path.join(args.outDir, "ai_second_pass_decisions.jsonl");
  await ensureDir(readyDir);
  await ensureDir(reviewDir);
  await ensureDir(rejectDir);
  await fs.writeFile(decisionsPath, "", "utf8");

  const candidatePaths = (await collectCandidatePaths(args.inputs, true)).slice(0, args.maxCases);
  const summary = {
    input_dirs: args.inputs,
    model: args.model,
    reviewed: 0,
    accepted: 0,
    review: 0,
    rejected: 0,
    deduped_accepted_duplicates: 0,
  };
  const acceptedRecords = [];

  for (let index = 0; index < candidatePaths.length; index++) {
    const candidatePath = candidatePaths[index];
    const candidate = await loadCandidate(candidatePath);
    const prompt = buildSecondPassPrompt(candidate);
    const content = await deepseekChatJson({
      apiKey,
      model: args.model,
      maxTokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });
    let decision = normalizeAiDecision(safeParseJsonObject(content));
    decision = enforceCatalogResolvedDecision(candidate.seed, decision);
    decision = applySecondPassGuards(candidate.seed, decision);
    const decisionRecord = {
      source_path: candidate.sourcePath,
      source_ref: candidate.seed.source_ref ?? null,
      vehicle_brand: candidate.seed.vehicle_brand ?? null,
      vehicle_model: candidate.seed.vehicle_model ?? null,
      decision,
    };
    await fs.appendFile(decisionsPath, `${JSON.stringify(decisionRecord)}\n`, "utf8");

    if (decision.decision === "accept") {
      acceptedRecords.push({
        sourcePath: candidate.sourcePath,
        seed: applyDecisionToSeed(candidate.seed, decision, args.model),
      });
    } else if (decision.decision === "review") {
      await writeJson(path.join(reviewDir, `${makeDecisionId(candidate.sourcePath)}.json`), {
        source_path: candidate.sourcePath,
        seed: candidate.seed,
        source_record: candidate.sourceRecord,
        raw_summary: candidate.summaryRaw,
        ai_decision: decision,
      });
      summary.review++;
    } else {
      await writeJson(path.join(rejectDir, path.basename(candidate.sourcePath)), {
        source_path: candidate.sourcePath,
        seed: candidate.seed,
        source_record: candidate.sourceRecord,
        raw_summary: candidate.summaryRaw,
        ai_decision: decision,
      });
      summary.rejected++;
    }

    summary.reviewed++;
    if (summary.reviewed % 25 === 0) {
      await writeJson(summaryPath, summary);
    }
    if (args.sleepMs > 0 && index < candidatePaths.length - 1) {
      await sleep(args.sleepMs);
    }
  }

  const deduped = dedupeAcceptedSeeds(acceptedRecords);
  for (const record of deduped.kept) {
    await writeJson(path.join(readyDir, path.basename(record.sourcePath)), record.seed);
  }
  for (const duplicate of deduped.dropped) {
    await writeJson(path.join(rejectDir, path.basename(duplicate.dropped.sourcePath)), {
      source_path: duplicate.dropped.sourcePath,
      seed: duplicate.dropped.seed,
      duplicate_of: path.basename(duplicate.kept.sourcePath),
      kept_source_ref: duplicate.kept.seed.source_ref ?? null,
      reason: duplicate.reason,
    });
  }

  summary.accepted = deduped.kept.length;
  summary.deduped_accepted_duplicates = deduped.dropped.length;
  summary.rejected += deduped.dropped.length;
  await writeJson(summaryPath, summary);
  console.log(
    `Second-pass reviewed ${summary.reviewed} candidate(s). Accepted ${summary.accepted}, review ${summary.review}, rejected ${summary.rejected} into: ${args.outDir}`,
  );
}

const entryArg = process.argv[1];
const isDirectRun = entryArg
  ? import.meta.url === pathToFileURL(path.resolve(entryArg)).href
  : false;

if (isDirectRun) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}
