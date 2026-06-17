#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import {
  buildThreadText,
  canonicalizeSymptoms,
  computeLocalId,
  ensureArrayOfStrings,
  extractTitleFromHtml,
  extractedCaseUsesUnresolvedResolutionPost,
  htmlToText,
  isReadyRecord,
  normalizeText,
  parsePostMetaFromThreadText,
  parsePostTextByNumber,
  pickEnginePower,
  safeParseJsonArray,
  selectCatalogForMarket,
  toIsoOrNow,
  validateExtractedCaseAuthor,
} from "./forum-seed.mjs";
import { extractRelNextUrl, resolveSkodaVehicleModel } from "./forum-seed-skoda.mjs";
import { deepseekChatJson, OFFLINE_DEEPSEEK_MODEL } from "./agent/deepseek.mjs";

const DEFAULT_MODEL = OFFLINE_DEEPSEEK_MODEL;
const DEFAULT_SLEEP_MS = 100;
const DEFAULT_FORUM = "skoda_club_net";
const DEFAULT_USER_ID = "ai_importer";

const SKODA_ENTRY = selectCatalogForMarket("eu").catalog.find(
  (entry) => normalizeText(entry.brand) === normalizeText("Škoda"),
);

if (!SKODA_ENTRY) {
  throw new Error("Skoda brand entry was not found in web/src/constants/catalog.js");
}

function usage(exitCode = 1) {
  console.log("Usage: node scripts/retry-skoda-classifier-review.mjs <to_review_dir> <out_dir>");
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
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

async function fetchUrl(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; Codex/1.0; +https://openai.com)",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return await response.text();
}

function canonicalTopicUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:") parsed.protocol = "https:";
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString();
  } catch {
    return (url ?? "").toString();
  }
}

function isTimestampLine(line) {
  return /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test((line ?? "").toString().trim());
}

function isNoiseLine(line) {
  return !line
    || /^\s*$/.test(line)
    || /^\d+$/.test(line)
    || /^https?:\/\//i.test(line)
    || /^[|:;.,\-_=+*~`'"!?#()[\]{}\\\/\s]+$/.test(line);
}

function normalizeAuthor(line) {
  return (line ?? "")
    .toString()
    .replace(/\s+/g, " ")
    .replace(/^\s+|\s+$/g, "")
    .replace(/\s+\d{4}-\d{2}-\d{2}.*$/, "")
    .trim();
}

function sanitizePostText(lines) {
  return lines
    .map((line) => (line ?? "").toString().trim())
    .filter((line) => line && !/^https?:\/\//i.test(line))
    .join("\n")
    .trim();
}

function extractPostsFromText(html, pageNumber) {
  const lines = htmlToText(html)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const posts = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isTimestampLine(lines[i])) continue;
    const when = lines[i];

    let author = "";
    for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
      if (isNoiseLine(lines[j])) continue;
      author = normalizeAuthor(lines[j]);
      if (author) break;
    }
    if (!author) continue;

    const body = [];
    let k = i + 1;
    for (; k < lines.length; k++) {
      if (isTimestampLine(lines[k])) break;
      body.push(lines[k]);
    }

    const text = sanitizePostText(body);
    if (text.length >= 10) posts.push({ author, when, postId: "", pageNumber, text });
    i = k - 1;
  }

  return posts;
}

async function collectTopicPages(firstUrl, sleepMs) {
  const firstHtml = await fetchUrl(firstUrl);
  const pages = [{ url: canonicalTopicUrl(firstUrl), html: firstHtml }];
  const seen = new Set([canonicalTopicUrl(firstUrl)]);

  while (true) {
    const current = pages[pages.length - 1];
    const nextUrl = extractRelNextUrl(current.html, current.url, "topic");
    if (!nextUrl) break;
    const canonicalNext = canonicalTopicUrl(nextUrl);
    if (!canonicalNext || seen.has(canonicalNext)) break;
    const html = await fetchUrl(canonicalNext);
    pages.push({ url: canonicalNext, html });
    seen.add(canonicalNext);
    if (sleepMs > 0) await sleep(sleepMs);
  }

  return pages;
}

async function fetchThreadAsText({ url, forumTitle = "", sleepMs = DEFAULT_SLEEP_MS }) {
  const pageItems = await collectTopicPages(url, sleepMs);
  const title = extractTitleFromHtml(pageItems[0]?.html ?? "");
  const posts = [];
  for (let i = 0; i < pageItems.length; i++) posts.push(...extractPostsFromText(pageItems[i].html, i + 1));

  if (posts.length === 0) {
    return { text: htmlToText(pageItems[0]?.html ?? ""), title, totalPages: pageItems.length };
  }

  return {
    text: buildThreadText({ url, title, posts, forumTitle, subforumName: "", subforumTitle: "" }),
    title,
    totalPages: pageItems.length,
  };
}

function buildCandidate(review, item, classifier) {
  const threadTitle = (review.thread_title ?? "").toString();
  const parentForumTitle = (review.parent_forum_title ?? "").toString();
  const subforumUrl = (review.subforum_url ?? "").toString();
  const sourceUrl = (review.thread_url ?? "").toString();

  const modelContext = [
    threadTitle,
    item?.engine_raw ?? "",
    item?.engine_code_raw ?? "",
    item?.description ?? "",
  ].filter(Boolean).join(" | ");

  const vehicle_model = resolveSkodaVehicleModel({
    modelRaw: item?.model_raw ?? "",
    threadTitle,
    parentForumTitle,
    subforumUrl,
    extraText: modelContext,
  }) ?? null;

  const engine_power = vehicle_model
    ? pickEnginePower(
        SKODA_ENTRY,
        vehicle_model,
        [
          item?.engine_raw ?? "",
          modelContext,
          parentForumTitle,
        ].filter(Boolean).join(" | "),
      )
    : null;

  const canonical = {
    vehicle_brand: "Škoda",
    vehicle_model,
    engine_power,
  };

  const rec = {
    local_id: computeLocalId({
      forum: DEFAULT_FORUM,
      sourceUrl,
      item,
      canonical,
    }),
    user_id: DEFAULT_USER_ID,
    thread_url: sourceUrl || null,
    vehicle_brand: "Škoda",
    vehicle_model,
    mileage: typeof item?.mileage === "number" ? Math.trunc(item.mileage) : null,
    engine_power,
    symptoms: canonicalizeSymptoms(item?.symptoms),
    obd_codes: ensureArrayOfStrings(item?.obd_codes).map((code) => code.toUpperCase()),
    description: (item?.description ?? "").toString(),
    resolution: (item?.resolution ?? "").toString(),
    closed_at: toIsoOrNow(item?.closed_at),
    metadata: {
      source_type: "forum_skoda_club_net",
      source_ref: "www.skoda-club.net/forum",
      thread_title: threadTitle || null,
      case_author: item?.case_author || null,
      catalog_mapping: {
        resolved: Boolean(vehicle_model),
        model_raw: item?.model_raw ?? null,
        thread_title: threadTitle || null,
        parent_forum_title: parentForumTitle || null,
        candidate_hints: [],
      },
    },
  };

  return {
    candidate: rec,
    isReady: Boolean(vehicle_model) && isReadyRecord(rec, classifier),
  };
}

function shouldSkipByTitle(title) {
  const raw = (title ?? "").toString();
  return [
    /\bkoup[eě]\b/i,
    /\bvyjmut[ií]\s+akumul[aá]toru\b/i,
    /\bnulov[aá]n[ií]\s+servisn[ií]ho\s+intervalu\b/i,
    /\bservisn[ií]ho\s+intervalu\b/i,
    /\bzimn[ií]\s+pneu\b/i,
  ].some((pattern) => pattern.test(raw));
}

async function main() {
  const [, , reviewDir, outDir] = process.argv;
  if (!reviewDir || !outDir) usage(1);

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set.");

  await fs.mkdir(outDir, { recursive: true });
  const stamp = dateStamp();

  const files = (await fs.readdir(reviewDir))
    .filter((name) => name.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  const reviews = [];
  for (const fileName of files) {
    const review = await readJson(path.join(reviewDir, fileName));
    if (
      review?.stage === "classifier"
      && review?.classifier?.has_confirmed_resolution === true
      && review?.classifier?.has_required_fields === false
    ) {
      reviews.push({ fileName, review });
    }
  }

  const rows = [];
  const promoted = [];

  for (let index = 0; index < reviews.length; index++) {
    const { fileName, review } = reviews[index];
    const title = review.thread_title ?? "";

    if (shouldSkipByTitle(title)) {
      rows.push({
        file: fileName,
        thread_title: title,
        thread_url: review.thread_url ?? "",
        parent_forum_title: review.parent_forum_title ?? "",
        final_status: "skipped_title_noise",
        final_reason: "Title indicates maintenance/how-to/advice topic outside safe closed-case scope.",
        extracted_count: 0,
        candidate_local_id: "",
        candidate_vehicle_model: "",
      });
      continue;
    }

    const thread = await fetchThreadAsText({
      url: review.thread_url,
      forumTitle: review.parent_forum_title ?? "",
      sleepMs: DEFAULT_SLEEP_MS,
    });

    const postMetaByNumber = parsePostMetaFromThreadText(thread.text);
    const postTextByNumber = parsePostTextByNumber(thread.text);
    const classifier = review.classifier ?? {};
    const evidencePosts = Array.isArray(classifier.evidence_post_numbers) ? classifier.evidence_post_numbers.join(", ") : "";

    const extractorPrompt = [
      "You extract one or more high-confidence resolved automotive diagnostic cases from a forum thread.",
      "Return ONLY a JSON array, no other text.",
      "",
      "Rules:",
      "- Do not guess or infer missing facts.",
      "- Each case must belong to one forum user: the same user must explicitly describe the fault and later confirm the successful repair for that same case.",
      "- The case author does NOT need to be the original thread author.",
      "- Ignore purchase advice, maintenance how-to, retrofit topics, feature activations, coding, and spec discussions.",
      "- Use thread title and forum context only to fill model/generation when they are unambiguous.",
      "- If the repair action is vague (for example just 'solved' or 'works now') and the actual fix is not stated, omit the case.",
      "- If any required field is ambiguous for one case, omit that case.",
      "- If there are no clear cases, return [].",
      "- Translate symptoms, description, and resolution to English.",
      "- If mileage is explicitly mentioned, extract it as an integer number of kilometers.",
      "- Normalize OBD codes to uppercase format like P0401. If none are present, use [].",
      "",
      "Output schema:",
      `[{"case_author":"","fault_post_numbers":[],"resolution_post_numbers":[],"brand_raw":"Škoda","model_raw":"","engine_raw":"","engine_code_raw":"","mileage":null,"symptoms":[],"obd_codes":[],"description":"","resolution":"","closed_at":""}]`,
      "",
      `- Classifier evidence post numbers: ${evidencePosts}`,
      `- Classifier reason: ${classifier.reason ?? ""}`,
      "",
      "Forum thread text:",
      thread.text,
    ].join("\n");

    let extracted = [];
    let finalStatus = "no_extraction";
    let finalReason = "Retry classifier-extractor returned no usable case.";
    let candidateRecord = null;

    try {
      const content = await deepseekChatJson({
        apiKey,
        model: DEFAULT_MODEL,
        maxTokens: 2600,
        messages: [{ role: "user", content: extractorPrompt }],
      });
      extracted = safeParseJsonArray(content);
    } catch (error) {
      finalStatus = "extractor_error";
      finalReason = String(error.message || error);
    }

    if (Array.isArray(extracted) && extracted.length > 0) {
      for (const rawItem of extracted) {
        const authorValidation = validateExtractedCaseAuthor(rawItem, postMetaByNumber);
        if (!authorValidation.ok) {
          finalStatus = "author_validation_failed";
          finalReason = authorValidation.reason || "Author validation failed.";
          continue;
        }

        const normalizedItem = {
          ...(rawItem ?? {}),
          case_author: authorValidation.caseAuthor ?? (rawItem?.case_author ?? ""),
        };

        if (extractedCaseUsesUnresolvedResolutionPost(normalizedItem, postTextByNumber)) {
          finalStatus = "unresolved_language";
          finalReason = "Resolution post still uses future or uncertain language.";
          continue;
        }

        const rebuilt = buildCandidate(review, normalizedItem, classifier);
        if (rebuilt.isReady) {
          candidateRecord = rebuilt.candidate;
          finalStatus = "promote_ready_candidate";
          finalReason = "Retry classifier-extractor produced a valid READY case.";
          promoted.push(rebuilt.candidate);
          break;
        }

        candidateRecord = rebuilt.candidate;
        finalStatus = rebuilt.candidate?.vehicle_model ? "record_hold" : "model_resolution_needed";
        finalReason = rebuilt.candidate?.vehicle_model
          ? "Retry classifier-extractor produced a case, but strict READY validation still failed."
          : "Retry classifier-extractor produced a case, but model mapping is still unresolved.";
      }
    }

    rows.push({
      file: fileName,
      thread_title: title,
      thread_url: review.thread_url ?? "",
      parent_forum_title: review.parent_forum_title ?? "",
      final_status: finalStatus,
      final_reason: finalReason,
      extracted_count: Array.isArray(extracted) ? extracted.length : 0,
      candidate_local_id: candidateRecord?.local_id ?? "",
      candidate_vehicle_model: candidateRecord?.vehicle_model ?? "",
    });

    if (DEFAULT_SLEEP_MS > 0 && index < reviews.length - 1) {
      await sleep(DEFAULT_SLEEP_MS);
    }
  }

  const summary = {
    created_at: new Date().toISOString(),
    review_dir: path.resolve(reviewDir),
    total_classifier_reviews: reviews.length,
    promoted_ready_candidates: promoted.length,
    status_counts: Object.fromEntries(
      [...rows.reduce((map, row) => {
        map.set(row.final_status, (map.get(row.final_status) ?? 0) + 1);
        return map;
      }, new Map()).entries()].sort((a, b) => a[0].localeCompare(b[0])),
    ),
  };

  await writeJsonl(path.join(outDir, `retry_classifier_triage_${stamp}.jsonl`), rows);
  await writeCsv(path.join(outDir, `retry_classifier_triage_${stamp}.csv`), rows, [
    "file",
    "thread_title",
    "thread_url",
    "parent_forum_title",
    "final_status",
    "final_reason",
    "extracted_count",
    "candidate_local_id",
    "candidate_vehicle_model",
  ]);
  await writeJsonl(path.join(outDir, `retry_classifier_promoted_${stamp}.jsonl`), promoted);
  await fs.writeFile(path.join(outDir, `retry_classifier_summary_${stamp}.json`), `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(`Retried ${reviews.length} classifier review item(s). Promoted ${promoted.length} READY candidate(s) into: ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
