/**
 * calibrate.mjs — Forum calibration loop.
 *
 * When the agent discovers a new forum, it must calibrate before full crawl.
 * This module:
 *   0. DISCOVER STRUCTURE — fetch root page, send HTML to Codex to identify
 *      technical subforum URLs (faults/defects/technical corner), auto-detect
 *      forum type, and set sections_json
 *   1. Picks a small sample of threads (PROBE_SIZE) from discovered sections
 *   2. Runs them through parser → classifier → extractor → validation
 *   3. Computes quality metrics
 *   4. If metrics are below thresholds, calls Codex to diagnose & adapt
 *   5. Stores per-forum calibration config in forums.calibration_json
 *   6. Re-probes with adapted config
 *   7. After MAX_ATTEMPTS fails → marks forum as 'calibration_failed'
 *
 * Usage:
 *   import { calibrateForum } from './calibrate.mjs';
 *   const result = await calibrateForum(state, forumId, pipeline);
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { assertCodexNotQuotaError } from './quota.mjs';
import { buildDiaryContext } from './diary.mjs';

const execFile = promisify(execFileCb);

const PROBE_SIZE = 5;
const MAX_ATTEMPTS = 3;

// Minimum thresholds for a forum to be considered calibrated
const THRESHOLDS = {
  parser_success_rate: 0.6,      // ≥60% threads yield ≥2 parseable posts
  classifier_pass_rate: 0.1,     // ≥10% threads pass classifier (forums have lots of noise)
  extractor_yield_rate: 0.05,    // ≥5% threads produce ≥1 valid case
};

// ---------------------------------------------------------------------------
// Metrics computation
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ProbeResult
 * @property {number} threads_total
 * @property {number} parser_ok     - threads where parser found ≥2 posts
 * @property {number} classifier_ok - threads that passed classifier
 * @property {number} extractor_ok  - threads that yielded ≥1 valid case
 * @property {string[]} sample_html - raw HTML snippets from failed parses (for diagnosis)
 * @property {string[]} sample_discards - classifier/extractor rejection reasons
 */

function computeMetrics(probeResult) {
  const { threads_total, parser_ok, classifier_ok, extractor_ok } = probeResult;
  if (threads_total === 0) {
    return { parser_success_rate: 0, classifier_pass_rate: 0, extractor_yield_rate: 0 };
  }
  return {
    parser_success_rate: parser_ok / threads_total,
    classifier_pass_rate: classifier_ok / threads_total,
    extractor_yield_rate: extractor_ok / threads_total,
  };
}

function meetsThresholds(metrics) {
  return (
    metrics.parser_success_rate >= THRESHOLDS.parser_success_rate &&
    metrics.classifier_pass_rate >= THRESHOLDS.classifier_pass_rate &&
    metrics.extractor_yield_rate >= THRESHOLDS.extractor_yield_rate
  );
}

// ---------------------------------------------------------------------------
// Codex diagnosis — asks Codex to analyze why parsing/extraction failed
// ---------------------------------------------------------------------------

async function diagnoseWithCodex(forum, probeResult, metrics, currentCalibration) {
  const prompt = buildDiagnosisPrompt(forum, probeResult, metrics, currentCalibration);
  const promptFile = join(tmpdir(), `calibrate-diag-${randomUUID()}.txt`);
  const outFile = join(tmpdir(), `calibrate-diag-out-${randomUUID()}.txt`);

  try {
    await writeFile(promptFile, prompt, 'utf-8');
    await execFile('bash', [
      '-c',
      `codex exec --sandbox read-only --ephemeral -o "${outFile}" < "${promptFile}"`,
    ], {
      timeout: 180_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const output = await readFile(outFile, 'utf-8').catch(() => '');
    assertCodexNotQuotaError(output);
    return parseCalibrationResponse(output);
  } catch (err) {
    // QuotaError propagates up — do not swallow it
    if (err.name === 'QuotaError') throw err;
    console.error(`  Codex diagnosis failed: ${err.message}`);
    return null;
  } finally {
    await unlink(promptFile).catch(() => {});
    await unlink(outFile).catch(() => {});
  }
}

function buildDiagnosisPrompt(forum, probeResult, metrics, currentCalibration) {
  const htmlSamples = (probeResult.sample_html || [])
    .slice(0, 3)
    .map((h, i) => `--- HTML SAMPLE ${i + 1} (first 2000 chars) ---\n${h.slice(0, 2000)}\n`)
    .join('\n');

  const discardSamples = (probeResult.sample_discards || [])
    .slice(0, 5)
    .map((d, i) => `  ${i + 1}. ${d}`)
    .join('\n');

  return `You are an expert web scraping engineer helping calibrate a forum parser.

FORUM:
  URL: ${forum.url}
  Name: ${forum.name || 'unknown'}
  Language: ${forum.language || 'unknown'}
  Detected parser: ${forum.parser || 'unknown'}
  Current calibration: ${JSON.stringify(currentCalibration, null, 2)}

PROBE RESULTS (${probeResult.threads_total} threads sampled):
  Parser success: ${probeResult.parser_ok}/${probeResult.threads_total} (${(metrics.parser_success_rate * 100).toFixed(0)}%)
  Classifier pass: ${probeResult.classifier_ok}/${probeResult.threads_total} (${(metrics.classifier_pass_rate * 100).toFixed(0)}%)
  Extractor yield: ${probeResult.extractor_ok}/${probeResult.threads_total} (${(metrics.extractor_yield_rate * 100).toFixed(0)}%)

DISCARD REASONS:
${discardSamples || '  (none)'}

HTML SAMPLES FROM FAILED PARSES:
${htmlSamples || '  (none available)'}

Based on the above, provide a JSON calibration config to improve parsing for this forum.
Reply with ONLY a JSON object, no other text:

{
  "parser": "invision|phpbb|xenforo|generic",
  "post_selector": "CSS selector for individual post containers",
  "author_selector": "CSS selector for post author",
  "content_selector": "CSS selector for post content body",
  "quote_selector": "CSS selector for quoted text blocks to strip",
  "date_selector": "CSS selector for post date/time",
  "min_post_length": 50,
  "language": "detected language code (cs/en/de/sk/pl/...)",
  "thread_list_selector": "CSS selector for thread links on section pages",
  "pagination_selector": "CSS selector for next page link",
  "extra_classifier_context": "any special context the LLM classifier should know about this forum",
  "notes": "brief explanation of what you changed and why"
}

Only include fields you are confident about. Omit fields where you cannot determine the correct value.`;
}

function parseCalibrationResponse(output) {
  const text = (output || '').trim();
  // Find JSON object in response
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Phase 0: Structure discovery — Codex explores forum root to find sections
// ---------------------------------------------------------------------------

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

async function fetchPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: controller.signal, redirect: 'follow' });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Discover forum structure: fetch root page, send to Codex to:
 *   1. QUALIFY — is this forum worth crawling at all?
 *   2. IDENTIFY — find technical subforum URLs
 *   3. DETECT — forum type + initial parser hints
 */
async function discoverForumStructure(forum, state = null) {
  console.log(`  Phase 0: Discovering forum structure...`);

  let rootHtml;
  try {
    rootHtml = await fetchPage(forum.url);
  } catch (err) {
    console.log(`  Could not fetch forum root: ${err.message}`);
    return null;
  }

  // Truncate HTML for Codex prompt (keep first 15K — enough for link structure)
  const htmlSample = rootHtml.slice(0, 15_000);

  // Inject lessons from past similar forums (same parser type or language)
  const diaryContext = state
    ? buildDiaryContext(state, { parser: forum.parser, language: forum.language })
    : '';

  const prompt = `You are a web scraping engineer evaluating and analyzing an automotive forum.
${diaryContext}

TASK 1 — QUALIFY: Decide if this forum is worth crawling for resolved vehicle fault cases.
A good forum has:
- Active threads (recent posts, not dead/archived)
- Technical/repair content (fault descriptions, diagnostics, confirmed fixes)
- Structured subforums for specific models or technical topics
- Multiple users discussing real vehicle problems with resolutions
A bad forum has:
- Very few threads or very old content (>3 years inactive)
- Only marketplace/classifieds content
- Only general chat, no technical substance
- Requires login/registration to view threads
- Non-automotive content

TASK 2 — IDENTIFY: If qualified, find the best subforum URLs for resolved fault threads.
We want sections like "Závady" (faults/defects), "Technický koutek" (technical corner),
"Problémy" (problems), "Poruchy" (malfunctions), "Motor" (engine), "Elektrika" (electrics).
Avoid: general discussion, marketplace/bazaar, off-topic, rules, introductions, galleries.

TASK 3 — DETECT: Identify forum software type and initial parser configuration.

FORUM ROOT URL: ${forum.url}
FORUM NAME: ${forum.name || 'unknown'}

ROOT PAGE HTML (first 15K chars):
---
${htmlSample}
---

Reply with ONLY a JSON object:
{
  "qualified": true,
  "qualification_reason": "brief reason why this forum is or isn't worth crawling",
  "estimated_thread_count": 0,
  "activity_level": "active|moderate|low|dead",
  "requires_login": false,
  "forum_type": "invision|phpbb|xenforo|vbulletin|generic",
  "language": "cs|en|de|sk|pl|...",
  "forum_name": "detected forum name",
  "sections": [
    {"url": "full URL to subforum", "name": "section name", "relevance": "high|medium"}
  ],
  "parser_hints": {
    "post_selector": "CSS selector if identifiable",
    "content_selector": "CSS selector if identifiable",
    "notes": "brief notes"
  }
}

If qualified=false, you can omit sections and parser_hints.
Only include sections where you found actual links in the HTML. Prefer "high" relevance
sections (fault/defect/technical). Include "medium" for model-specific general sections
that likely contain repair threads. Return at most 15 sections.`;

  const promptFile = join(tmpdir(), `calibrate-struct-${randomUUID()}.txt`);
  const outFile = join(tmpdir(), `calibrate-struct-out-${randomUUID()}.txt`);

  try {
    await writeFile(promptFile, prompt, 'utf-8');
    await execFile('bash', [
      '-c',
      `codex exec --sandbox read-only --ephemeral -o "${outFile}" < "${promptFile}"`,
    ], { timeout: 180_000, maxBuffer: 10 * 1024 * 1024 });

    const output = await readFile(outFile, 'utf-8').catch(() => '');
    assertCodexNotQuotaError(output);
    return parseCalibrationResponse(output);
  } catch (err) {
    if (err.name === 'QuotaError') throw err;
    console.error(`  Structure discovery failed: ${err.message}`);
    return null;
  } finally {
    await unlink(promptFile).catch(() => {});
    await unlink(outFile).catch(() => {});
  }
}

/**
 * If sections_json is empty, run structure discovery and apply results.
 * Returns: 'ok' | 'disqualified' | 'fallback'
 */
async function ensureSections(state, forumId, forum) {
  let sections;
  try { sections = JSON.parse(forum.sections_json || '[]'); } catch { sections = []; }

  // Already has sections — skip discovery
  if (Array.isArray(sections) && sections.length > 0) {
    return 'ok';
  }

  const result = await discoverForumStructure(forum, state);

  // Check qualification
  if (result && result.qualified === false) {
    const reason = result.qualification_reason || 'Codex disqualified this forum';
    console.log(`  ✗ Forum DISQUALIFIED: ${reason}`);
    console.log(`    Activity: ${result.activity_level || '?'}, Requires login: ${result.requires_login ?? '?'}, Est. threads: ${result.estimated_thread_count ?? '?'}`);
    state.updateForum(forumId, {
      status: 'disqualified',
      calibration_status: 'disqualified',
      calibration_json: JSON.stringify({ disqualification_reason: reason, ...result }),
    });
    return 'disqualified';
  }

  if (!result || !Array.isArray(result.sections) || result.sections.length === 0) {
    console.log(`  No sections discovered. Will use forum root URL as fallback.`);
    return 'fallback'; // proceed with root URL
  }

  // Log qualification info
  if (result.qualification_reason) {
    console.log(`  ✓ Qualified: ${result.qualification_reason}`);
    console.log(`    Activity: ${result.activity_level || '?'}, Est. threads: ${result.estimated_thread_count ?? '?'}`);
  }

  // Extract URLs, prefer high relevance first
  const sorted = result.sections
    .filter(s => s.url)
    .sort((a, b) => (a.relevance === 'high' ? -1 : 1) - (b.relevance === 'high' ? -1 : 1));
  const sectionUrls = sorted.map(s => s.url);

  console.log(`  Discovered ${sectionUrls.length} section(s):`);
  for (const s of result.sections.slice(0, 8)) {
    console.log(`    [${s.relevance}] ${s.name}: ${s.url}`);
  }

  // Apply to forum
  const updates = { sections_json: JSON.stringify(sectionUrls) };
  if (result.forum_type) updates.parser = result.forum_type;
  if (result.language) updates.language = result.language;
  if (result.forum_name && !forum.name) updates.name = result.forum_name;
  state.updateForum(forumId, updates);

  // Merge parser hints into calibration
  if (result.parser_hints) {
    const cal = safeJsonParse(forum.calibration_json);
    const merged = { ...cal, ...result.parser_hints };
    if (result.forum_type) merged.parser = result.forum_type;
    if (result.language) merged.language = result.language;
    state.updateForum(forumId, { calibration_json: JSON.stringify(merged) });
  }

  return 'ok';
}

// ---------------------------------------------------------------------------
// Main calibration loop
// ---------------------------------------------------------------------------

/**
 * Run the calibration loop for a forum.
 *
 * @param {import('./state.mjs').AgentState} state
 * @param {string} forumId
 * @param {object} pipeline - The crawl pipeline functions:
 *   @param {function} pipeline.sampleThreadUrls(forum, count) → string[]
 *   @param {function} pipeline.fetchAndParse(url, calibration) → { posts[], html }
 *   @param {function} pipeline.classify(threadText) → { approved: boolean, reason: string }
 *   @param {function} pipeline.extract(threadText, classifierResult) → cases[]
 *   @param {function} pipeline.validate(case) → { valid: boolean, reason: string }
 * @returns {Promise<{ success: boolean, metrics: object, attempts: number }>}
 */
export async function calibrateForum(state, forumId, pipeline) {
  let forum = state.getForum(forumId);
  if (!forum) throw new Error(`Forum ${forumId} not found`);

  console.log(`\n── Calibrating: ${forum.name || forum.url} ──`);

  // Phase 0: Discover forum structure if no sections configured
  const structureResult = await ensureSections(state, forumId, forum);
  if (structureResult === 'disqualified') {
    return { success: false, metrics: { parser_success_rate: 0, classifier_pass_rate: 0, extractor_yield_rate: 0 }, attempts: 0, disqualified: true };
  }
  // Reload forum after possible updates
  forum = state.getForum(forumId);

  let currentCalibration = safeJsonParse(forum.calibration_json);
  let attempt = forum.calibration_attempts || 0;

  while (attempt < MAX_ATTEMPTS) {
    attempt++;
    console.log(`  Attempt ${attempt}/${MAX_ATTEMPTS}...`);

    // 1. Probe — sample threads and run pipeline
    const probeResult = await runProbe(forum, currentCalibration, pipeline);
    const metrics = computeMetrics(probeResult);

    console.log(`  Results: parser=${(metrics.parser_success_rate * 100).toFixed(0)}% classifier=${(metrics.classifier_pass_rate * 100).toFixed(0)}% extractor=${(metrics.extractor_yield_rate * 100).toFixed(0)}%`);

    // 2. Check thresholds
    if (meetsThresholds(metrics)) {
      console.log(`  ✓ Calibration PASSED on attempt ${attempt}`);
      state.updateForum(forumId, {
        calibration_json: JSON.stringify(currentCalibration),
        calibration_status: 'calibrated',
        calibration_attempts: attempt,
        status: 'queued',
      });
      return { success: true, metrics, attempts: attempt };
    }

    // 3. Diagnose failures with Codex
    if (attempt < MAX_ATTEMPTS) {
      console.log(`  Metrics below thresholds, asking Codex to diagnose...`);
      const newCalibration = await diagnoseWithCodex(forum, probeResult, metrics, currentCalibration);
      if (newCalibration) {
        console.log(`  Codex suggested: ${newCalibration.notes || '(no notes)'}`);
        currentCalibration = { ...currentCalibration, ...newCalibration };
      } else {
        console.log(`  Codex returned no actionable config.`);
      }
    }

    state.updateForum(forumId, {
      calibration_json: JSON.stringify(currentCalibration),
      calibration_attempts: attempt,
    });
  }

  // All attempts exhausted
  console.log(`  ✗ Calibration FAILED after ${MAX_ATTEMPTS} attempts`);
  state.updateForum(forumId, {
    calibration_status: 'failed',
    calibration_attempts: attempt,
    status: 'calibration_failed',
  });
  return { success: false, metrics: computeMetrics({ threads_total: 0, parser_ok: 0, classifier_ok: 0, extractor_ok: 0 }), attempts: attempt };
}

// ---------------------------------------------------------------------------
// Probe runner
// ---------------------------------------------------------------------------

async function runProbe(forum, calibration, pipeline) {
  const result = {
    threads_total: 0,
    parser_ok: 0,
    classifier_ok: 0,
    extractor_ok: 0,
    sample_html: [],
    sample_discards: [],
  };

  // Get sample thread URLs
  let urls;
  try {
    urls = await pipeline.sampleThreadUrls(forum, PROBE_SIZE);
  } catch (err) {
    result.sample_discards.push(`sampleThreadUrls failed: ${err.message}`);
    return result;
  }

  if (!urls || urls.length === 0) {
    result.sample_discards.push('No thread URLs found on forum');
    return result;
  }

  result.threads_total = urls.length;

  for (const url of urls) {
    // Parser
    let parseResult;
    try {
      parseResult = await pipeline.fetchAndParse(url, calibration);
    } catch (err) {
      result.sample_discards.push(`parse failed (${url}): ${err.message}`);
      continue;
    }

    if (!parseResult.posts || parseResult.posts.length < 2) {
      result.sample_discards.push(`parser returned <2 posts (${url}): got ${parseResult.posts?.length || 0}`);
      if (parseResult.html) {
        result.sample_html.push(parseResult.html);
      }
      continue;
    }
    result.parser_ok++;

    // Classifier
    let classResult;
    try {
      classResult = await pipeline.classify(parseResult.threadText);
    } catch (err) {
      result.sample_discards.push(`classify failed (${url}): ${err.message}`);
      continue;
    }

    if (!classResult.approved) {
      const detail = classResult.result
        ? JSON.stringify(classResult.result)
        : classResult.reason || 'no reason';
      result.sample_discards.push(`classifier rejected (${url}): ${detail}`);
      continue;
    }
    result.classifier_ok++;

    // Extractor
    let cases;
    try {
      cases = await pipeline.extract(parseResult.threadText, classResult);
    } catch (err) {
      result.sample_discards.push(`extract failed (${url}): ${err.message}`);
      continue;
    }

    // Validation
    let validCount = 0;
    for (const c of (cases || [])) {
      let v;
      try {
        v = pipeline.validate(c, parseResult.threadText);
      } catch {
        continue;
      }
      if (v.valid) validCount++;
      else result.sample_discards.push(`validation rejected (${url}): ${v.reason}`);
    }

    if (validCount > 0) {
      result.extractor_ok++;
    } else if (cases?.length > 0) {
      result.sample_discards.push(`extractor produced ${cases.length} cases but none passed validation (${url})`);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeJsonParse(str) {
  try {
    return JSON.parse(str || '{}') || {};
  } catch {
    return {};
  }
}
