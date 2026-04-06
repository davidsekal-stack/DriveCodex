#!/usr/bin/env node --experimental-sqlite
/**
 * orchestrator.mjs — Main loop for the autonomous crawl agent.
 *
 * Phases:
 *   1. DISCOVER  — find new forums via web search
 *   2. CALIBRATE — probe + adapt parser for each new forum
 *   3. CRAWL     — fetch threads, classify, extract cases
 *   4. VALIDATE  — deterministic gates (L4)
 *   5. VERIFY    — Codex independent audit (L5)
 *   6. CROSSCHECK— dedupe vs. Supabase (L6)
 *   7. IMPORT    — push verified cases to Supabase
 *
 * Usage:
 *   node --experimental-sqlite scripts/agent/orchestrator.mjs [options]
 *
 * Options:
 *   --batch-size <n>    Threads per batch (default: 20)
 *   --sleep-ms <n>      Delay between HTTP requests (default: 600)
 *   --continuous         Keep running in a loop
 *   --phase <name>       Run only one phase: discover|calibrate|crawl|verify|import
 *   --forum-url <url>    Seed a specific forum URL
 *   --stats              Print stats and exit
 */

import { AgentState } from './state.mjs';
import { calibrateForum } from './calibrate.mjs';
import { verifyCase } from './verify.mjs';
import { createCrawlPipeline, processThread } from './crawl.mjs';
import { createHash } from 'node:crypto';
import { QuotaError, formatQuotaMessage } from './quota.mjs';

// Supabase connection defaults (same as other scripts in this repo)
const SUPABASE_DEFAULTS = {
  url: 'https://nmvjthfezyjcwuzphiuu.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tdmp0aGZlenlqY3d1enBoaXV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MzcwNTAsImV4cCI6MjA4ODMxMzA1MH0.acMPCJe2asOToPXg6DQccejtLOUbD8EMx9Z9FqWo_xo',
  authEmail: 'socialpilotbot@gmail.com',
  authPassword: 'claude',
};

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    batchSize: 20,
    sleepMs: 600,
    continuous: false,
    phase: null,
    forumUrl: null,
    stats: false,
    force: false,
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--batch-size':  opts.batchSize = Number(args[++i]) || 20; break;
      case '--sleep-ms':    opts.sleepMs = Number(args[++i]) || 600; break;
      case '--continuous':  opts.continuous = true; break;
      case '--phase':       opts.phase = args[++i]; break;
      case '--forum-url':   opts.forumUrl = args[++i]; break;
      case '--stats':       opts.stats = true; break;
      case '--force':       opts.force = true; break;
    }
  }
  return opts;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Logging — console + SQLite agent_log table
// ---------------------------------------------------------------------------

let _logState = null; // set in main()
let _logPhase = null;

function setLogState(state) { _logState = state; }
function setLogPhase(phase) { _logPhase = phase; }

function log(level, message) {
  const ts = new Date().toISOString().slice(11, 19); // HH:MM:SS
  const prefix = level === 'error' ? '  ✗' : level === 'warn' ? '  ⚠' : '  ·';
  if (level === 'error') console.error(`${prefix} ${message}`);
  else console.log(`${prefix} ${message}`);
  try { _logState?.log(level, message, _logPhase); } catch { /* non-fatal */ }
}

function logWarn(msg)  { log('warn',  msg); }
function logError(msg) { log('error', msg); }
function logInfo(msg)  { log('info',  msg); }

// ---------------------------------------------------------------------------
// Phase: STATS
// ---------------------------------------------------------------------------

function printStats(state) {
  const stats = state.getStats();
  console.log('\n═══ AGENT STATUS ═══');
  console.log(`Forums: ${stats.forums}`);

  // Per-forum detail
  if (stats.forums_detail?.length > 0) {
    console.log('\nForum detail:');
    for (const f of stats.forums_detail) {
      const name = f.name || new URL(f.url).hostname;
      const cooldown = f.cooldown_until
        ? (new Date(f.cooldown_until) > new Date()
          ? `⏸ cooldown until ${f.cooldown_until.slice(0, 10)}`
          : '✓ cooldown expired')
        : '';
      const yield_ = f.threads_crawled > 0
        ? `${f.cases_total || 0} cases / ${f.threads_crawled} threads (${((f.cases_total || 0) / f.threads_crawled * 100).toFixed(1)}% yield)`
        : 'not yet crawled';
      console.log(`  ${f.status.padEnd(12)} ${name}`);
      console.log(`             ${yield_}${cooldown ? '  ' + cooldown : ''}`);
      if (f.last_crawled_at) console.log(`             last crawl: ${f.last_crawled_at.slice(0, 16)}, new last batch: ${f.new_threads_last_batch ?? '?'}`);
    }
  }

  console.log('\nThreads:');
  for (const [status, count] of Object.entries(stats.threads_by_status)) {
    console.log(`  ${status}: ${count}`);
  }
  console.log('\nCases:');
  for (const [status, count] of Object.entries(stats.cases_by_status)) {
    console.log(`  ${status}: ${count}`);
  }
  if (stats.last_run) {
    const lr = stats.last_run;
    console.log(`\nLast run: ${lr.started_at} (${lr.mode})`);
    console.log(`  threads: ${lr.threads_processed}, cases: ${lr.cases_extracted}, verified: ${lr.cases_verified}, imported: ${lr.cases_imported}`);
    if (lr.stop_reason) console.log(`  stop reason: ${lr.stop_reason}`);
  }

  // Recent agent log entries
  const logs = state.getRecentLogs(20);
  if (logs.length > 0) {
    console.log('\nRecent log (last 20):');
    for (const entry of logs) {
      const ts = (entry.ts || '').slice(11, 19); // HH:MM:SS
      const phase = entry.phase ? `[${entry.phase}] ` : '';
      const icon = entry.level === 'error' ? '✗' : entry.level === 'warn' ? '⚠' : '·';
      console.log(`  ${ts} ${icon} ${phase}${entry.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Phase: DISCOVER — find new forums
// ---------------------------------------------------------------------------

async function phaseDiscover(state, opts) {
  console.log('\n── Phase: DISCOVER ──');

  // If a specific forum URL was provided, seed it directly
  if (opts.forumUrl) {
    // Domain-level dedup: check if any forum on the same domain already exists
    const sameDomain = state.getForumsByDomain(opts.forumUrl);
    if (sameDomain.length > 0) {
      const existing = sameDomain.map(f => `${f.name || f.url} [${f.status}]`).join(', ');
      console.log(`  ⚠ Domain already known: ${existing}`);
      console.log(`  Skipping — use --force to add anyway.`);
      if (!opts.force) return;
    }

    const id = state.addForum({ url: opts.forumUrl });
    console.log(`  Seeded forum: ${opts.forumUrl} (${id.slice(0, 8)})`);
    return;
  }

  // TODO: integrate discovery.mjs — web search for automotive forums
  // For now, log that discovery is not yet implemented
  console.log('  Discovery module not yet implemented.');
  console.log('  Seed forums manually with --forum-url <url>');
}

// ---------------------------------------------------------------------------
// Phase: CALIBRATE — probe + adapt new forums
// ---------------------------------------------------------------------------

async function phaseCalibrate(state, opts) {
  console.log('\n── Phase: CALIBRATE ──');

  const forums = state.getForumsToProcess(10);
  const uncalibrated = forums.filter(f => {
    const cs = f.calibration_status;
    return cs === 'pending' || cs === null;
  });

  if (uncalibrated.length === 0) {
    console.log('  No forums pending calibration.');
    return;
  }

  for (const forum of uncalibrated) {
    console.log(`  Calibrating: ${forum.name || forum.url}`);

    // Build pipeline functions for calibration probe
    // These will be wired to actual implementations in crawl.mjs, classify.mjs, etc.
    const pipeline = buildCalibrationPipeline(opts);

    try {
      const result = await calibrateForum(state, forum.id, pipeline);
      if (result.success) {
        console.log(`  ✓ ${forum.url} calibrated in ${result.attempts} attempt(s)`);
      } else {
        console.log(`  ✗ ${forum.url} calibration failed`);
      }
    } catch (err) {
      console.error(`  Error calibrating ${forum.url}: ${err.message}`);
      state.updateForum(forum.id, { calibration_status: 'failed', status: 'calibration_failed' });
    }
  }
}

// ---------------------------------------------------------------------------
// Phase: CRAWL — fetch threads, classify, extract
// ---------------------------------------------------------------------------

// Exhaustion / cooldown constants
const COOLDOWN_HOURS_SHORT = 24;      // < 10% new threads → wait 1 day
const COOLDOWN_HOURS_LONG  = 168;     // < 3% new threads  → wait 7 days
const COOLDOWN_HOURS_EXHAUSTED = 720; // 0 new threads     → wait 30 days
const NEW_THREAD_RATE_LOW = 0.10;
const NEW_THREAD_RATE_VERY_LOW = 0.03;

function computeCooldown(newThreads, totalEnumerated) {
  if (totalEnumerated === 0) return null;
  if (newThreads === 0) return COOLDOWN_HOURS_EXHAUSTED;
  const rate = newThreads / totalEnumerated;
  if (rate < NEW_THREAD_RATE_VERY_LOW) return COOLDOWN_HOURS_LONG;
  if (rate < NEW_THREAD_RATE_LOW) return COOLDOWN_HOURS_SHORT;
  return null; // no cooldown — forum still has fresh content
}

async function phaseCrawl(state, opts) {
  console.log('\n── Phase: CRAWL ──');

  // Get calibrated forums (respects cooldown_until from state)
  const forums = state.getForumsToProcess(10);
  const ready = forums.filter(f => f.calibration_status === 'calibrated');

  if (ready.length === 0) {
    console.log('  No calibrated forums ready for crawling.');
    return;
  }

  const pipeline = createCrawlPipeline({ sleepMs: opts.sleepMs });
  let totalThreads = 0;
  let totalCases = 0;

  for (const forum of ready) {
    console.log(`  Crawling: ${forum.name || forum.url}`);
    const calibration = safeJsonParse(forum.calibration_json);

    // Enumerate thread URLs
    let threadUrls;
    try {
      threadUrls = await pipeline.sampleThreadUrls(forum, opts.batchSize);
    } catch (err) {
      console.error(`  Error enumerating threads for ${forum.url}: ${err.message}`);
      continue;
    }

    if (!threadUrls || threadUrls.length === 0) {
      console.log('  No thread URLs found.');
      continue;
    }

    // ── Filter out already-processed threads ──
    const newUrls = [];
    const skippedUrls = [];
    for (const url of threadUrls) {
      const existing = state.getThreadByUrl(url);
      if (existing && existing.status !== 'pending') {
        skippedUrls.push(url);
      } else {
        newUrls.push(url);
      }
    }

    console.log(`  Enumerated ${threadUrls.length} thread(s): ${newUrls.length} new, ${skippedUrls.length} already crawled.`);

    // ── Exhaustion check — if almost everything is already known, set cooldown ──
    const cooldownHours = computeCooldown(newUrls.length, threadUrls.length);
    if (cooldownHours !== null) {
      const until = new Date(Date.now() + cooldownHours * 3600_000).toISOString();
      const label = cooldownHours >= 720 ? 'exhausted (30d)'
        : cooldownHours >= 168 ? 'mostly exhausted (7d)'
        : 'low yield (1d)';
      console.log(`  ⏸ Forum ${label}: ${newUrls.length}/${threadUrls.length} new. Cooldown until ${until.slice(0, 10)}.`);
      state.updateForum(forum.id, {
        cooldown_until: until,
        new_threads_last_batch: newUrls.length,
        status: cooldownHours >= 720 ? 'exhausted' : 'active',
      });

      // If truly zero new threads, skip entirely
      if (newUrls.length === 0) {
        state.updateForum(forum.id, { last_crawled_at: new Date().toISOString() });
        continue;
      }
    }

    // ── Process new threads ──
    let batchCases = 0;
    for (const url of newUrls) {
      const threadId = state.addThread({ forumId: forum.id, url });
      totalThreads++;

      try {
        const result = await processThread(url, calibration, pipeline);

        if (result.skipped) {
          state.updateThread(threadId, {
            status: 'discarded',
            discard_reason: result.skipped,
            thread_text: result.threadText || null,
            title: result.title || null,
          });
          continue;
        }

        state.updateThread(threadId, {
          status: 'extracted',
          thread_text: result.threadText,
          title: result.title,
        });

        // Save valid cases
        for (const { case: c, validation } of result.cases) {
          if (!validation.valid) continue;

          // Enrich payload with thread metadata
          c.thread_url = url;
          c.source_ref = c.source_ref || `agent:thread:${url}`;

          const caseId = createHash('sha256')
            .update(`${url}|${c.case_author}|${c.description?.slice(0, 50)}`)
            .digest('hex');

          state.addCase({ id: caseId, threadId, payload: c });
          totalCases++;
          batchCases++;
        }
      } catch (err) {
        if (err instanceof QuotaError) throw err;  // propagate up to stop the phase
        console.error(`  Error processing ${url}: ${err.message}`);
        state.updateThread(threadId, { status: 'error', discard_reason: err.message });
      }

      await sleep(opts.sleepMs);
    }

    // Update forum stats
    const crawled = state.countCrawledThreads(forum.id);
    const forumCases = state.countForumCases(forum.id);
    state.updateForum(forum.id, {
      last_crawled_at: new Date().toISOString(),
      threads_crawled: crawled,
      new_threads_last_batch: newUrls.length,
      cases_total: forumCases,
      status: 'active',
    });
    console.log(`  Forum done: +${newUrls.length} threads, +${batchCases} cases (total: ${crawled} threads, ${forumCases} cases).`);
  }

  console.log(`  Batch done: ${totalThreads} threads processed, ${totalCases} cases extracted.`);
}

// ---------------------------------------------------------------------------
// Phase: VERIFY — Codex independent audit (L5)
// ---------------------------------------------------------------------------

async function phaseVerify(state, opts) {
  console.log('\n── Phase: VERIFY ──');

  const cases = state.getCasesByStatus('ai_approved', opts.batchSize);
  if (cases.length === 0) {
    console.log('  No cases pending verification.');
    return;
  }

  console.log(`  Verifying ${cases.length} case(s) with Codex...`);
  let passed = 0;
  let failed = 0;

  for (const c of cases) {
    const payload = JSON.parse(c.payload_json);

    // Get original thread text
    const thread = state.getThread(c.thread_id);
    if (!thread?.thread_text) {
      console.log(`  ⊘ ${c.id}: no thread text available, skipping`);
      state.updateCase(c.id, { status: 'verify_skipped', review_note: 'No thread text' });
      continue;
    }

    try {
      const result = await verifyCase(thread.thread_text, payload, {
        timeoutMs: opts.verifyTimeoutMs || 120_000,
      });

      if (result.verdict === 'PASS') {
        state.updateCase(c.id, { status: 'verified', review_note: 'Codex: PASS' });
        passed++;
        console.log(`  ✓ ${c.id}`);
      } else {
        state.updateCase(c.id, { status: 'verify_rejected', review_note: `Codex: ${result.reason}` });
        failed++;
        console.log(`  ✗ ${c.id}: ${result.reason}`);
      }
    } catch (err) {
      if (err instanceof QuotaError) throw err;  // propagate up to stop the phase
      state.updateCase(c.id, { status: 'verify_error', review_note: `Error: ${err.message}` });
      failed++;
      console.error(`  ✗ ${c.id}: error — ${err.message}`);
    }

    await sleep(1000); // Brief pause between Codex calls
  }

  console.log(`  Verification done: ${passed} passed, ${failed} failed.`);
}

// ---------------------------------------------------------------------------
// Phase: CROSSCHECK — dedupe vs existing DB (L6)
// ---------------------------------------------------------------------------

async function phaseCrosscheck(state, opts) {
  console.log('\n── Phase: CROSSCHECK ──');

  const cases = state.getCasesByStatus('verified', opts.batchSize);
  if (cases.length === 0) {
    console.log('  No verified cases pending crosscheck.');
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || SUPABASE_DEFAULTS.url;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY || SUPABASE_DEFAULTS.anonKey;

  let passed = 0;
  let dupes = 0;

  for (const c of cases) {
    const payload = JSON.parse(c.payload_json);
    const brand = payload.vehicle_brand || payload.brand_raw || '';
    const model = payload.vehicle_model || payload.model_raw || '';
    const resolution = (payload.resolution || '').slice(0, 100);

    // Query Supabase for potential duplicates
    try {
      const query = new URLSearchParams({
        vehicle_brand: `eq.${brand}`,
        vehicle_model: `eq.${model}`,
        select: 'id,resolution',
        limit: '50',
      });
      const res = await fetch(`${supabaseUrl}/rest/v1/cases?${query}`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });

      if (res.ok) {
        const existing = await res.json();
        const isDupe = existing.some(e =>
          normalizeForDedupe(e.resolution) === normalizeForDedupe(resolution)
        );

        if (isDupe) {
          state.updateCase(c.id, { status: 'crosscheck_dupe', review_note: 'Duplicate resolution in Supabase' });
          dupes++;
          continue;
        }
      }
    } catch (err) {
      console.error(`  Crosscheck query failed for ${c.id}: ${err.message}`);
    }

    state.updateCase(c.id, { status: 'import_ready' });
    passed++;
  }

  console.log(`  Crosscheck done: ${passed} ready for import, ${dupes} duplicates skipped.`);
}

// ---------------------------------------------------------------------------
// Phase: IMPORT — push to Supabase
// ---------------------------------------------------------------------------

async function phaseImport(state, opts) {
  console.log('\n── Phase: IMPORT ──');

  const cases = state.getCasesByStatus('import_ready', opts.batchSize);
  if (cases.length === 0) {
    console.log('  No cases ready for import.');
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || SUPABASE_DEFAULTS.url;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY || SUPABASE_DEFAULTS.anonKey;

  let imported = 0;
  let failed = 0;

  for (const c of cases) {
    const payload = JSON.parse(c.payload_json);

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/push-case`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          user_id: 'ai_importer',
          vehicle_brand: payload.vehicle_brand || payload.brand_raw || '',
          vehicle_model: payload.vehicle_model || payload.model_raw || '',
          engine_power: payload.engine_power || payload.engine_raw || '',
          symptoms: payload.symptoms || [],
          obd_codes: payload.obd_codes || [],
          description: payload.description || '',
          resolution: payload.resolution || '',
          source_ref: payload.source_ref || `agent:${c.id.slice(0, 12)}`,
          thread_url: payload.thread_url || payload.source_url || '',
        }),
      });

      if (res.ok) {
        state.updateCase(c.id, { status: 'imported', review_note: 'Pushed to Supabase' });
        imported++;
        console.log(`  ✓ ${c.id.slice(0, 8)}`);
      } else {
        const errBody = await res.text().catch(() => '');
        state.updateCase(c.id, { status: 'import_failed', review_note: `HTTP ${res.status}: ${errBody.slice(0, 200)}` });
        failed++;
        console.log(`  ✗ ${c.id.slice(0, 8)}: HTTP ${res.status}`);
      }
    } catch (err) {
      state.updateCase(c.id, { status: 'import_failed', review_note: `Error: ${err.message}` });
      failed++;
      console.error(`  ✗ ${c.id.slice(0, 8)}: ${err.message}`);
    }

    await sleep(500);
  }

  console.log(`  Import done: ${imported} imported, ${failed} failed.`);
}

// ---------------------------------------------------------------------------
// Pipeline builder
// ---------------------------------------------------------------------------

function buildCalibrationPipeline(opts) {
  return createCrawlPipeline({ sleepMs: opts.sleepMs });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeJsonParse(str) {
  try { return JSON.parse(str || '{}') || {}; } catch { return {}; }
}

function normalizeForDedupe(s) {
  return (s ?? '').toString().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 100);
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function runOnce(state, opts) {
  const runId = state.startRun(opts.phase || 'full');
  // Snapshot counts before run to compute deltas
  const before = {
    threads: Object.values(state.countThreadsByStatus()).reduce((a, b) => a + b, 0),
    cases: Object.values(state.countCasesByStatus()).reduce((a, b) => a + b, 0),
    verified: (state.countCasesByStatus().verified ?? 0),
    imported: (state.countCasesByStatus().imported ?? 0),
  };

  let stopReason = null;
  try {
    const phases = opts.phase ? [opts.phase] : ['discover', 'calibrate', 'crawl', 'verify', 'crosscheck', 'import'];

    for (const phase of phases) {
      setLogPhase(phase);
      switch (phase) {
        case 'discover':   await phaseDiscover(state, opts); break;
        case 'calibrate':  await phaseCalibrate(state, opts); break;
        case 'crawl':      await phaseCrawl(state, opts); break;
        case 'verify':     await phaseVerify(state, opts); break;
        case 'crosscheck': await phaseCrosscheck(state, opts); break;
        case 'import':     await phaseImport(state, opts); break;
        default:
          logError(`Unknown phase: ${phase}`);
      }
    }
    setLogPhase(null);
  } catch (err) {
    setLogPhase(null);
    if (err instanceof QuotaError) {
      stopReason = err.message;
      // Log to DB first so it's persisted even if console output is lost
      state.log('error', err.message, 'quota');
      console.error(formatQuotaMessage(err));
    } else {
      stopReason = `error: ${err.message}`;
      logError(`Run error: ${err.message}`);
    }
  }

  // Compute actual deltas
  const after = {
    threads: Object.values(state.countThreadsByStatus()).reduce((a, b) => a + b, 0),
    cases: Object.values(state.countCasesByStatus()).reduce((a, b) => a + b, 0),
    verified: (state.countCasesByStatus().verified ?? 0),
    imported: (state.countCasesByStatus().imported ?? 0),
  };
  const stats = {
    threads_processed: after.threads - before.threads,
    cases_extracted: after.cases - before.cases,
    cases_verified: after.verified - before.verified,
    cases_imported: after.imported - before.imported,
  };

  state.finishRun(runId, stats, stopReason);
  return stats;
}

async function main() {
  const opts = parseArgs();
  const state = new AgentState();
  setLogState(state);

  if (opts.stats) {
    printStats(state);
    state.close();
    return;
  }

  console.log('═══ DriveCodex Autonomous Crawl Agent ═══');
  console.log(`Batch size: ${opts.batchSize}, Sleep: ${opts.sleepMs}ms, Continuous: ${opts.continuous}`);

  // Forum seeding is handled in phaseDiscover (with domain-level dedup check)

  do {
    await runOnce(state, opts);

    if (opts.continuous) {
      console.log(`\n  Sleeping 60s before next batch...`);
      await sleep(60_000);
    }
  } while (opts.continuous);

  printStats(state);
  state.close();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
