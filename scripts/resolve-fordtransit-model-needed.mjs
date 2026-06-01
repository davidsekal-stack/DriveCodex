#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import {
  canonicalizeSymptoms,
  computeLocalId,
  ensureArrayOfStrings,
  isReadyRecord,
  normalizeText,
  pickEnginePower,
  selectCatalogForMarket,
  toIsoOrNow,
} from "./forum-seed.mjs";
import {
  canonicalTopicUrl,
  extractNextPageUrl,
  extractPostsFromPhpbb,
  normalizeThreadTitle,
  resolveTransitFamilyVehicleModel,
  sanitizeResolvedTransitModel,
} from "./forum-seed-fordtransit.mjs";

const DEFAULT_FORUM = "fordtransit_org";
const DEFAULT_USER_ID = "ai_importer";

const FORD_ENTRY = selectCatalogForMarket("eu").catalog.find(
  (entry) => normalizeText(entry.brand) === "ford",
);

if (!FORD_ENTRY) {
  throw new Error("Ford brand entry was not found in web/src/constants/catalog.js");
}

function usage(exitCode = 1) {
  console.log(
    "Usage: node scripts/resolve-fordtransit-model-needed.mjs <triage_csv> <review_dir> <out_dir>",
  );
  process.exit(exitCode);
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function defaultHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (compatible; GearBrainFordTransitModelResolve/1.0; +https://example.invalid)",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };
}

async function fetchUrl(url) {
  const res = await fetch(url, { method: "GET", headers: defaultHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return await res.text();
}

async function readCsv(csvPath) {
  const raw = await fs.readFile(csvPath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
  });
}

function parseCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function collectTopicPosts(topicUrl, maxPages = 20) {
  const pages = [];
  let currentUrl = canonicalTopicUrl(topicUrl);
  let currentHtml = await fetchUrl(currentUrl);
  const seen = new Set();

  while (currentUrl && currentHtml && pages.length < maxPages && !seen.has(currentUrl)) {
    pages.push({ url: currentUrl, html: currentHtml });
    seen.add(currentUrl);
    const nextUrl = extractNextPageUrl(currentHtml, currentUrl, "topic");
    if (!nextUrl || seen.has(nextUrl)) break;
    currentUrl = nextUrl;
    currentHtml = await fetchUrl(currentUrl);
  }

  const posts = [];
  for (let i = 0; i < pages.length; i++) {
    posts.push(...extractPostsFromPhpbb(pages[i].html, i + 1));
  }
  return posts;
}

function buildCatalogMapping({ modelRaw = "", threadTitle = "", parentForumTitle = "", vehicleModel = null }) {
  return {
    resolved: Boolean(vehicleModel),
    model_raw: modelRaw || null,
    thread_title: threadTitle || null,
    parent_forum_title: parentForumTitle || null,
    candidate_hints: [],
  };
}

function buildCandidateSeed(review, vehicleModel, enginePower) {
  const normalizedItem = review.extracted_raw;
  let description = (normalizedItem?.description ?? "").toString();
  const engineCodeRaw = (normalizedItem?.engine_code_raw ?? "").toString().trim();
  if (engineCodeRaw && !normalizeText(description).includes(normalizeText(engineCodeRaw))) {
    description = description.trim()
      ? `${description.trim()} Engine code: ${engineCodeRaw}.`
      : `Engine code: ${engineCodeRaw}.`;
  }

  const metadata = {
    source_type: "forum_fordtransit_org",
    source_ref: "fordtransit.org/forum/viewforum.php?f=2",
    thread_title: review.thread_title || null,
    case_author: review?.extracted_raw?.case_author || null,
    catalog_mapping: buildCatalogMapping({
      modelRaw: review?.extracted_raw?.model_raw ?? "",
      threadTitle: review.thread_title ?? "",
      parentForumTitle: review.parent_forum_title ?? "",
      vehicleModel,
    }),
  };

  return {
    local_id: computeLocalId({
      forum: DEFAULT_FORUM,
      sourceUrl: review.thread_url,
      item: normalizedItem,
      canonical: { vehicle_brand: "Ford", vehicle_model: vehicleModel, engine_power: enginePower },
    }),
    user_id: review?.candidate_seed?.user_id || DEFAULT_USER_ID,
    thread_url: review.thread_url || null,
    vehicle_brand: "Ford",
    vehicle_model: vehicleModel,
    mileage: typeof normalizedItem?.mileage === "number" ? Math.trunc(normalizedItem.mileage) : null,
    engine_power: enginePower,
    symptoms: canonicalizeSymptoms(normalizedItem?.symptoms),
    obd_codes: ensureArrayOfStrings(normalizedItem?.obd_codes).map((code) => code.toUpperCase()),
    description,
    resolution: (normalizedItem?.resolution ?? "").toString(),
    closed_at: toIsoOrNow(normalizedItem?.closed_at),
    metadata,
  };
}

async function writeJsonl(filePath, rows) {
  const text = rows.map((row) => JSON.stringify(row)).join("\n");
  await fs.writeFile(filePath, text ? `${text}\n` : "", "utf8");
}

async function writeCsv(filePath, rows, columns) {
  const lines = [columns.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => csvEscape(row[column])).join(","));
  }
  await fs.writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  const [, , triageCsv, reviewDir, outDir] = process.argv;
  if (!triageCsv || !reviewDir || !outDir) usage(1);

  await fs.mkdir(outDir, { recursive: true });
  const stamp = dateStamp();
  const triageRows = await readCsv(triageCsv);
  const targetRows = triageRows.filter((row) => row.final_status === "model_resolution_needed");

  const resolutions = [];
  const promoted = [];

  for (let i = 0; i < targetRows.length; i++) {
    const row = targetRows[i];
    const review = await readJson(path.join(reviewDir, row.file));
    const caseAuthor = normalizeText(review?.extracted_raw?.case_author ?? "");
    let posts = [];
    let fetchError = "";

    try {
      posts = await collectTopicPosts(review.thread_url, 20);
    } catch (error) {
      fetchError = error?.message || String(error);
    }

    const authorPosts = caseAuthor
      ? posts.filter((post) => normalizeText(post.author) === caseAuthor)
      : [];

    const authorContext = authorPosts.map((post) => post.text).join("\n\n");
    const allContext = posts.map((post) => `${post.author}: ${post.text}`).join("\n\n");
    const contextText = authorContext || allContext;
    const resolverContext = [
      review?.extracted_raw?.engine_raw ?? "",
      review?.extracted_raw?.engine_code_raw ?? "",
      review?.extracted_raw?.description ?? "",
      contextText,
    ].filter(Boolean).join(" | ");
    const resolvedVehicleModel = sanitizeResolvedTransitModel(
      resolveTransitFamilyVehicleModel({
        modelRaw: review?.extracted_raw?.model_raw ?? "",
        threadTitle: normalizeThreadTitle(review.thread_title ?? ""),
        parentForumTitle: review.parent_forum_title ?? "",
        extraText: resolverContext,
      }),
      resolverContext,
    );

    const enginePower = resolvedVehicleModel
      ? pickEnginePower(
          FORD_ENTRY,
          resolvedVehicleModel,
          resolverContext,
        )
      : null;

    const candidate = resolvedVehicleModel
      ? buildCandidateSeed(review, resolvedVehicleModel, enginePower)
      : null;

    const finalStatus = candidate && isReadyRecord(candidate, review.classifier)
      ? "promote_ready_candidate"
      : resolvedVehicleModel
        ? "record_hold"
        : "still_model_resolution_needed";

    const resultRow = {
      file: row.file,
      thread_title: review.thread_title ?? "",
      thread_url: review.thread_url ?? "",
      case_author: review?.extracted_raw?.case_author ?? "",
      model_raw: review?.extracted_raw?.model_raw ?? "",
      engine_raw: review?.extracted_raw?.engine_raw ?? "",
      author_posts_found: authorPosts.length,
      total_posts_fetched: posts.length,
      resolved_vehicle_model: resolvedVehicleModel ?? "",
      resolved_engine_power: enginePower ?? "",
      final_status: finalStatus,
      fetch_error: fetchError,
    };

    resolutions.push(resultRow);
    if (finalStatus === "promote_ready_candidate" && candidate) promoted.push(candidate);

    if ((i + 1) % 50 === 0) {
      console.log(`[${new Date().toISOString()}] Processed ${i + 1}/${targetRows.length} model-resolution-needed threads`);
    }
  }

  const summary = {
    source_model_resolution_needed: targetRows.length,
    promoted_after_fetch_context: promoted.length,
    still_model_resolution_needed: resolutions.filter((row) => row.final_status === "still_model_resolution_needed").length,
    record_hold_after_fetch_context: resolutions.filter((row) => row.final_status === "record_hold").length,
    fetch_errors: resolutions.filter((row) => row.fetch_error).length,
  };

  const resolutionCsv = path.join(outDir, `model_resolution_fetch_pass_${stamp}.csv`);
  const resolutionJsonl = path.join(outDir, `model_resolution_fetch_pass_${stamp}.jsonl`);
  const promotedCsv = path.join(outDir, `model_resolution_promoted_after_fetch_${stamp}.csv`);
  const promotedJsonl = path.join(outDir, `model_resolution_promoted_after_fetch_${stamp}.jsonl`);
  const summaryPath = path.join(outDir, `model_resolution_fetch_pass_${stamp}_summary.json`);

  await writeCsv(resolutionCsv, resolutions, [
    "file",
    "thread_title",
    "thread_url",
    "case_author",
    "model_raw",
    "engine_raw",
    "author_posts_found",
    "total_posts_fetched",
    "resolved_vehicle_model",
    "resolved_engine_power",
    "final_status",
    "fetch_error",
  ]);
  await writeJsonl(resolutionJsonl, resolutions);
  await writeCsv(promotedCsv, promoted, [
    "local_id",
    "thread_url",
    "vehicle_brand",
    "vehicle_model",
    "mileage",
    "engine_power",
    "description",
    "resolution",
    "closed_at",
  ]);
  await writeJsonl(promotedJsonl, promoted);
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    summary_path: summaryPath,
    promoted_after_fetch_context: promoted.length,
    still_model_resolution_needed: summary.still_model_resolution_needed,
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
