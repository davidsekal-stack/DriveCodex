/**
 * calibrate.mjs — Forum calibration loop.
 *
 * When the agent discovers a new forum, it must calibrate before full crawl.
 * This module:
 *   0. DISCOVER STRUCTURE — fetch root page, send HTML to the routed LLM to
 *      identify technical subforum URLs (faults/defects/technical corner),
 *      auto-detect forum type, and set sections_json
 *   1. Picks a small sample of threads (PROBE_SIZE) from discovered sections
 *   2. Runs them through parser → classifier → extractor → validation
 *   3. Computes quality metrics
 *   4. If metrics are below thresholds, asks the LLM to diagnose & adapt
 *   5. Stores per-forum calibration config in forums.calibration_json
 *   6. Re-probes with adapted config
 *   7. After MAX_ATTEMPTS fails → marks forum as 'calibration_failed'
 *
 * Usage:
 *   import { calibrateForum } from './calibrate.mjs';
 *   const result = await calibrateForum(state, forumId, pipeline);
 */

import { buildDiaryContext } from './diary.mjs';
import { runLlm } from './llm.mjs';
import { isStoppingError } from './quota.mjs';
import { fetchHtml } from './fetch-utils.mjs';

const PROBE_SIZE = 5;
const MAX_ATTEMPTS = 3;
const CALIBRATION_LLM_TIMEOUT_MS = 180_000;
const TRANSIENT_CALIBRATION_BACKOFF_HOURS = 6;

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

export function isTransientCrawlerError(err) {
  const message = (err?.message || err || '').toString();
  return Boolean(
    err?.code === 'ETIMEDOUT' ||
    err?.name === 'AbortError' ||
    /timed out|timeout|aborted|fetch failed|socket hang up|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(message) ||
    /HTTP (403|406|408|409|425|429|5\d\d)\b/i.test(message) ||
    /browser challenge fallback failed|browser fallback/i.test(message)
  );
}

function transientReason(prefix, err) {
  const detail = err?.message || String(err || 'unknown error');
  return `${prefix}: ${detail}`;
}

function deferCalibration(state, forumId, currentCalibration, attempts, reason) {
  const until = new Date(Date.now() + TRANSIENT_CALIBRATION_BACKOFF_HOURS * 3600_000).toISOString();
  state.updateForum(forumId, {
    calibration_json: JSON.stringify({
      ...currentCalibration,
      last_transient_failure: reason,
      last_transient_at: new Date().toISOString(),
    }),
    calibration_status: 'pending',
    calibration_attempts: attempts,
    cooldown_until: until,
  });
  console.log(`  Transient calibration failure. Backing off until ${until}.`);
}

// ---------------------------------------------------------------------------
// LLM diagnosis — asks the routed LLM to analyze why parsing/extraction failed
// ---------------------------------------------------------------------------

async function diagnoseCalibration(forum, probeResult, metrics, currentCalibration) {
  const prompt = buildDiagnosisPrompt(forum, probeResult, metrics, currentCalibration);

  try {
    const output = await runLlm('calibrate', prompt, {
      timeoutMs: CALIBRATION_LLM_TIMEOUT_MS,
      maxTokens: 1500,
    });
    return parseCalibrationResponse(output);
  } catch (err) {
    // Quota/auth stop the agent — never swallow or misclassify as transient
    if (isStoppingError(err)) throw err;
    if (isTransientCrawlerError(err)) throw err;
    console.error(`  Calibration diagnosis failed: ${err.message}`);
    return null;
  }
}

function buildDiagnosisPrompt(forum, probeResult, metrics, currentCalibration) {
  // Skip <head> section — we need <body> post HTML, not CSS/JS metadata
  const htmlSamples = (probeResult.sample_html || [])
    .slice(0, 3)
    .map((h, i) => {
      const bodyStart = h.indexOf('<body');
      const useful = bodyStart !== -1 ? h.slice(bodyStart) : h;
      return `--- HTML SAMPLE ${i + 1} (body, first 8000 chars) ---\n${useful.slice(0, 8000)}\n`;
    })
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

Base your analysis ONLY on the probe results and HTML samples above — you cannot fetch anything.
Your FINAL output MUST be a single JSON object and nothing else after it.
Do NOT end with a table, markdown list, or plain text summary.

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

function parseJsonObjectResponse(output) {
  const text = (output || '').trim();

  // Try to extract JSON from markdown code block first (```json ... ```)
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]);
      if (typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch { /* fall through */ }
  }

  // Find the LAST complete JSON object in response (models often reason first, then output JSON)
  // Walk backwards from the end to find the last }...{ pair
  let depth = 0;
  let end = -1;
  let start = -1;
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === '}') { if (depth === 0) end = i; depth++; }
    else if (text[i] === '{') {
      depth--;
      if (depth === 0) { start = i; break; }
    }
  }

  if (start === -1 || end === -1) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseCalibrationResponse(output) {
  const parsed = parseJsonObjectResponse(output);
  if (!parsed) return null;

  const meaningful = ['post_selector', 'content_selector', 'parser', 'thread_list_selector'];
  if (!meaningful.some(k => k in parsed)) return null;
  return parsed;
}

export function parseStructureDiscoveryResponse(output) {
  const parsed = parseJsonObjectResponse(output);
  if (!parsed) return null;

  const meaningful = ['qualified', 'sections', 'forum_type', 'qualification_reason', 'activity_level'];
  if (!meaningful.some(k => k in parsed)) return null;
  return parsed;
}

// ---------------------------------------------------------------------------
// Phase 0: Structure discovery — LLM analyzes forum root to find sections
// ---------------------------------------------------------------------------

async function fetchPage(url) {
  return fetchHtml(url, { maxRetries: 1 });
}

/**
 * Discover forum structure: fetch root page, send to the routed LLM to:
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
    if (isTransientCrawlerError(err)) {
      return { transient_failure: transientReason('Structure fetch failed', err) };
    }
    return null;
  }

  // Skip <head> (GDPR scripts dominate first 10-15K on European forums)
  // Take 20K of body content — enough to see forum section links
  const bodyStart = rootHtml.indexOf('<body');
  const usefulRoot = bodyStart !== -1 ? rootHtml.slice(bodyStart) : rootHtml;
  const htmlSample = usefulRoot.slice(0, 20_000);

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

HIGH relevance sections (rank these first):
- "Závady", "Fehler", "Probleme", "Défauts" (faults/defects)
- "Technický koutek", "Technik", "Reparatur", "Werkstatt" (technical/repair)
- "Motor", "Elektrik/Elektronik", "Getriebe", "Fahrwerk", "Bremsen" (drivetrain/components)
- "Poruchy", "Pannes", "Storingen" (malfunctions)
- Model-specific technical boards (e.g. "Golf Technik", "ID.3 Antrieb & Technik")

MEDIUM relevance (only if no high-relevance sections exist):
- Model-specific general boards that likely contain repair threads

LOW/EXCLUDE (do NOT include these):
- "Software & Updates", "OTA", "Firmware" — mostly general SW discussion, not hardware faults
- "Chat", "Lounge", "Off-Topic", "General" — no technical content
- "Marktplatz", "Verkauf", "Bazár", "Kleinanzeigen" — marketplace
- "Galerie", "Fotos", "Media" — image galleries
- "Regeln", "Ankündigungen", "News" — announcements
- "Einführung", "Vorstellen" — introductions

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
that likely contain repair threads. Return at most 15 sections.

CRITICAL: Your final output MUST be a single JSON object. You may analyse the HTML first,
but the LAST thing you output must be the JSON object and nothing else after it.
Do NOT output tables, markdown lists, or plain text as your final answer.`;

  try {
    const output = await runLlm('calibrate', prompt, {
      timeoutMs: CALIBRATION_LLM_TIMEOUT_MS,
      maxTokens: 2000,
    });
    return parseStructureDiscoveryResponse(output);
  } catch (err) {
    if (isStoppingError(err)) throw err;
    if (isTransientCrawlerError(err)) {
      console.error(`  Structure discovery failed transiently: ${err.message}`);
      return { transient_failure: transientReason('Structure discovery failed', err) };
    }
    console.error(`  Structure discovery failed: ${err.message}`);
    return null;
  }
}

/**
 * If sections_json is empty, run structure discovery and apply results.
 * Returns: 'ok' | 'disqualified' | 'fallback' | { transient_failure: string }
 */
async function ensureSections(state, forumId, forum) {
  let sections;
  try { sections = JSON.parse(forum.sections_json || '[]'); } catch { sections = []; }

  // Already has sections — skip discovery
  if (Array.isArray(sections) && sections.length > 0) {
    return 'ok';
  }

  const result = await discoverForumStructure(forum, state);

  if (result?.transient_failure) {
    return { transient_failure: result.transient_failure };
  }

  // Check qualification
  if (result && result.qualified === false) {
    const reason = result.qualification_reason || 'LLM disqualified this forum';
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

  if (structureResult?.transient_failure) {
    deferCalibration(state, forumId, currentCalibration, attempt, structureResult.transient_failure);
    return {
      success: false,
      metrics: { parser_success_rate: 0, classifier_pass_rate: 0, extractor_yield_rate: 0 },
      attempts: attempt,
      transient: true,
      reason: structureResult.transient_failure,
    };
  }

  while (attempt < MAX_ATTEMPTS) {
    const attemptNumber = attempt + 1;
    console.log(`  Attempt ${attemptNumber}/${MAX_ATTEMPTS}...`);

    // 1. Probe — sample threads and run pipeline
    const probeResult = await runProbe(forum, currentCalibration, pipeline);
    const metrics = computeMetrics(probeResult);

    console.log(`  Results: parser=${(metrics.parser_success_rate * 100).toFixed(0)}% classifier=${(metrics.classifier_pass_rate * 100).toFixed(0)}% extractor=${(metrics.extractor_yield_rate * 100).toFixed(0)}%`);

    if (probeResult.transient_failure) {
      deferCalibration(state, forumId, currentCalibration, attempt, probeResult.transient_failure);
      return { success: false, metrics, attempts: attempt, transient: true, reason: probeResult.transient_failure };
    }

    attempt = attemptNumber;

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

    // 3. Diagnose failures with the LLM
    if (attempt < MAX_ATTEMPTS) {
      console.log(`  Metrics below thresholds, asking the LLM to diagnose...`);
      let newCalibration;
      try {
        newCalibration = await diagnoseCalibration(forum, probeResult, metrics, currentCalibration);
      } catch (err) {
        if (!isTransientCrawlerError(err)) throw err;
        const reason = transientReason('Calibration diagnosis failed', err);
        deferCalibration(state, forumId, currentCalibration, attempt, reason);
        return { success: false, metrics, attempts: attempt, transient: true, reason };
      }
      if (newCalibration) {
        console.log(`  LLM suggested: ${newCalibration.notes || '(no notes)'}`);
        currentCalibration = { ...currentCalibration, ...newCalibration };
      } else {
        console.log(`  LLM returned no actionable config.`);
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
    transient_errors: 0,
    transient_failure: null,
  };

  // Get sample thread URLs — prefer the resolution-signal-biased calibration
  // sampler so the probe measures the forum's true potential instead of its
  // newest (unanswered) threads. Falls back to the plain sampler for older
  // pipelines / test mocks that don't define it.
  let urls;
  try {
    urls = pipeline.sampleThreadUrlsForCalibration
      ? await pipeline.sampleThreadUrlsForCalibration(forum, PROBE_SIZE)
      : await pipeline.sampleThreadUrls(forum, PROBE_SIZE);
  } catch (err) {
    result.sample_discards.push(`sampleThreadUrls failed: ${err.message}`);
    if (isTransientCrawlerError(err)) {
      result.transient_errors++;
      result.transient_failure = transientReason('sampleThreadUrls failed', err);
    }
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
      if (isTransientCrawlerError(err)) result.transient_errors++;
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
      // A quota/auth outage must stop the agent, not burn calibration attempts
      if (isStoppingError(err)) throw err;
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
      if (isStoppingError(err)) throw err;
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

  if (result.parser_ok === 0 && result.transient_errors === result.threads_total) {
    result.transient_failure = `All parse attempts failed transiently (${result.transient_errors}/${result.threads_total})`;
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
