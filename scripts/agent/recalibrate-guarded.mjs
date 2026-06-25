/**
 * recalibrate-guarded.mjs — SAFE, REVERSIBLE auto-recalibration of stuck forums.
 *
 * Phase 4 step that PROMOTES the daily coach's shadow `recalibrate_proposal` into an
 * action the agent can take by itself — without the original safety objection. The
 * objection was: calibrateForum() overwrites a forum's sections_json/calibration_json/
 * parser IN PLACE at many points, so a worse result (or a crash/quota mid-run) leaves
 * the forum half-rewritten with no way back for a non-technical owner.
 *
 * This module removes that objection with three guards:
 *   1. NEVER touch the real forum row until the decision. calibrateForum is run against
 *      a BUFFERING shim of AgentState (makeBufferingState): its getForum sees the
 *      candidate overlay, its updateForum writes ONLY to that in-memory overlay. So a
 *      crash/quota mid-recalibration leaves the live row byte-identical to the snapshot.
 *   2. KEEP ONLY IF BETTER. An honest baseline probe of the CURRENT config is compared
 *      to the candidate; the candidate is committed only if it genuinely calibrates
 *      (calibrateForum success == meets thresholds) AND beats the baseline yield by a
 *      margin. Otherwise nothing is written and an ATTEMPT marker is journaled.
 *   3. ONE atomic, REVERTIBLE write. A kept candidate is committed via the existing
 *      applyCoachChange (knob='recalibrate'): one transaction, journaled with the full
 *      column snapshot in old_json, so `apply-proposal.mjs --revert` restores it.
 *
 * Cost control: profile forums (authoritative, hand-authored) are skipped; a forum is
 * re-attempted at most once per RECAL_COOLDOWN_DAYS (the attempt marker drives this);
 * at most RECAL_MAX_PER_NIGHT forums are recalibrated per run; quota/auth aborts the
 * whole step (exit code 3) so the batch wrapper can short-circuit and leave it for
 * tomorrow. Runs AFTER the night crawl + daily-coach from run-coach-batch.ps1.
 *
 * Usage:
 *   node --experimental-sqlite recalibrate-guarded.mjs [--force] [--dry-run]
 */

import { writeFileSync, existsSync, mkdirSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { AgentState } from './state.mjs';
import { createCrawlPipeline } from './crawl.mjs';
import { calibrateForum, runProbe, computeMetrics, THRESHOLDS } from './calibrate.mjs';
import { isStoppingError } from './quota.mjs';
import { planRecalProposal, alignNights, addDays, DEFAULT_CONFIG } from './coach-adapt.mjs';
import { getForumProfile } from './forum-profiles.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const EVAL_HOUR     = intEnv('RECAL_GUARDED_HOUR', 6);    // closed morning window start
const EVAL_HOUR_END = intEnv('RECAL_GUARDED_HOUR_END', 21);
const META_KEY = 'recal_guarded_last_date';

// Per-forum night metrics the daily coach records (scope = forum id). MUST stay
// aligned with PER_FORUM_METRICS in daily-coach.mjs — these are the series the
// stuck-signal planner reads.
const PER_FORUM_METRICS = ['forum_good', 'forum_rejected', 'forum_processed', 'forum_extracted', 'forum_transient', 'forum_too_few'];

// Forum columns calibrateForum can write — the FULL snapshot/restore set, so a kept
// candidate's journal carries every column that changed (partial would break revert).
const SNAP_COLS = [
  'sections_json', 'calibration_json', 'parser', 'language', 'name', 'status',
  'calibration_status', 'calibration_attempts', 'cooldown_until', 'cooldown_tier_hours', 'cooldown_set_at',
];

function intEnv(name, dflt)   { const v = parseInt(process.env[name] ?? '', 10); return Number.isFinite(v) ? v : dflt; }
function floatEnv(name, dflt) { const v = parseFloat(process.env[name] ?? '');   return Number.isFinite(v) ? v : dflt; }
function safeJsonParse(s, dflt = {}) { try { return JSON.parse(s ?? '') ?? dflt; } catch { return dflt; } }
function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Guarded-recal config: the coach's stuck-signal thresholds (COACH_* overridable, kept
 *  consistent with daily-coach) plus the three guarded-recal-specific knobs. */
export function buildConfig(env = process.env) {
  const c = { ...DEFAULT_CONFIG };
  for (const k of Object.keys(c)) {
    const v = parseFloat(env[`COACH_${k}`] ?? '');
    if (Number.isFinite(v)) c[k] = v;
  }
  c.RECAL_MAX_PER_NIGHT = intEnv('RECAL_MAX_PER_NIGHT', 1);    // expensive (LLM discovery + probes) → 1/night default
  c.RECAL_COOLDOWN_DAYS = intEnv('RECAL_COOLDOWN_DAYS', 7);    // don't re-attempt the same forum within this many days
  c.RECAL_MIN_YIELD_GAIN = floatEnv('RECAL_MIN_YIELD_GAIN', 0.2); // candidate yield must beat baseline by this margin
  c.SLEEP_MS = intEnv('AGENT_SLEEP_MS', 600);
  return c;
}

// ── Pure helpers (exported for tests) ────────────────────────────────────────

/** Build the per-night aligned series for one forum from the recorded metrics. */
export function buildNights(state, forum, perForumMetrics = PER_FORUM_METRICS) {
  const series = {};
  for (const m of perForumMetrics) series[m] = state.getMetricSeries(m, forum.id, 120);
  return alignNights(series);
}

/** Whether a forum is eligible for a guarded recal tonight. Pure: callers pass the
 *  derived flags so this is unit-testable without a DB. */
export function shouldConsiderForum({ forum, nights, recentRecalCount = 0, alreadyChangedToday = false, hasProfile = false, todayStr, config = DEFAULT_CONFIG }) {
  if (alreadyChangedToday) return false;     // forum already used its 1/forum/day slot
  if (hasProfile) return false;              // authoritative profile → re-discovery is meaningless
  if (recentRecalCount > 0) return false;    // anti-flap: tried recently (applied OR unproductive attempt)
  return planRecalProposal(forum, nights, todayStr, config) != null; // the same stuck signal the coach uses
}

/** The baseline config already yields acceptably → the forum is NOT actually stuck. */
export function isAlreadyYielding(baseMetrics) {
  return (baseMetrics?.extractor_yield_rate ?? 0) >= THRESHOLDS.extractor_yield_rate;
}

/** Keep the candidate only if it genuinely calibrates AND beats baseline yield by a margin. */
export function decideKeep(baseMetrics, candidate, config = {}) {
  const minGain = config.RECAL_MIN_YIELD_GAIN ?? 0.2;
  if (!candidate || !candidate.success) return false;
  const cand = candidate.metrics?.extractor_yield_rate ?? 0;
  const base = baseMetrics?.extractor_yield_rate ?? 0;
  return cand > base && (cand - base) >= minGain;
}

/** True iff the JSON encodes a non-empty section list. A candidate that re-discovered
 *  NO sections (root-URL fallback) must NOT be committed — keeping it would overwrite a
 *  forum's targeted subforums with '[]' and silently degrade every future crawl to
 *  root-only (a regression masquerading as a yield win). */
export function hasNonEmptySections(sectionsJson) {
  try { const a = JSON.parse(sectionsJson ?? '[]'); return Array.isArray(a) && a.length > 0; }
  catch { return false; }
}

/**
 * A read-through, write-buffering proxy over AgentState. getForum(forumId) returns the
 * live row merged with the in-memory overlay; updateForum(forumId, …) writes ONLY to
 * the overlay (no DB). Every other method delegates to the real state (bound, so the
 * private DB handle works). Reading `.__overlay` returns the buffered candidate columns.
 */
export function makeBufferingState(realState, forumId) {
  const overlay = {};
  return new Proxy(realState, {
    get(target, prop) {
      if (prop === '__overlay') return overlay;
      if (prop === 'getForum') {
        return (id) => {
          const row = target.getForum(id);
          return (id === forumId && row) ? { ...row, ...overlay } : row;
        };
      }
      if (prop === 'updateForum') {
        return (id, fields) => {
          if (id === forumId) { Object.assign(overlay, fields); return; }
          return target.updateForum(id, fields);
        };
      }
      const v = target[prop];
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}

// ── Selection ─────────────────────────────────────────────────────────────────

function selectStuckForums(state, forums, { alreadyChanged, today, config }) {
  const since = addDays(today, -config.RECAL_COOLDOWN_DAYS);
  const out = [];
  for (const forum of forums) {
    const nights = buildNights(state, forum);
    const eligible = shouldConsiderForum({
      forum,
      nights,
      recentRecalCount: state.getRecentCoachChanges(forum.id, 'recalibrate', since).length,
      alreadyChangedToday: alreadyChanged.has(forum.id),
      hasProfile: !!getForumProfile(forum.url),
      todayStr: today,
      config,
    });
    if (eligible) {
      const signal = planRecalProposal(forum, nights, today, config)?.signal || {};
      out.push({ forum, processed: signal.processed || 0 });
    }
  }
  out.sort((a, b) => b.processed - a.processed); // most wasted work first
  return out.map(x => x.forum);
}

/** Journal an UNPRODUCTIVE attempt (applied=0) so the anti-flap cooldown counts it. */
function recordAttempt(state, today, forum, reasonCode, signal) {
  state.recordCoachProposal({
    date: today, forumId: forum.id, forumName: forum.name || forum.url || forum.id,
    knob: 'recalibrate', reasonCode, signal,
  });
}

// ── One guarded recalibration ───────────────────────────────────────────────

export async function runGuardedRecal(state, forumId, pipeline, { today, config }) {
  const forum = state.getForum(forumId);
  if (!forum) return { forumId, status: 'missing' };
  const forumName = forum.name || forum.url || forumId;

  if (getForumProfile(forum.url)) return { forumId, forumName, status: 'skipped_profile' };

  const snapshot = {};
  for (const c of SNAP_COLS) snapshot[c] = forum[c];

  // 1) Honest baseline probe of the CURRENT config (the multi-night stuck signal may be stale).
  const baseMetrics = computeMetrics(await runProbe(forum, safeJsonParse(forum.calibration_json), pipeline));
  if (isAlreadyYielding(baseMetrics)) {
    recordAttempt(state, today, forum, 'not_stuck_on_probe', { baseline: baseMetrics });
    return { forumId, forumName, status: 'not_stuck', baseMetrics };
  }

  // 2) Candidate: force fresh discovery + recalibrate against the buffering shim, so the
  //    real forum row is untouched until (and unless) we decide to keep it.
  const shim = makeBufferingState(state, forumId);
  shim.updateForum(forumId, { sections_json: '[]' });
  const candidate = await calibrateForum(shim, forumId, pipeline);
  const candMetrics = candidate.metrics || { extractor_yield_rate: 0, classifier_pass_rate: 0, parser_success_rate: 0 };
  const overlay = shim.__overlay;

  // Reject unless the candidate both beat baseline AND ended up with real sections. A
  // re-discovery that fell back to the root URL leaves sections_json='[]'; committing
  // that would strip the forum's targeted subforums and quietly degrade future crawls.
  const keptSections = hasNonEmptySections(overlay.sections_json);
  if (!decideKeep(baseMetrics, candidate, config) || !keptSections) {
    const reason = candidate.transient ? 'recal_transient'
      : (!keptSections && candidate.success) ? 'recal_no_sections'
      : 'recal_no_improvement';
    recordAttempt(state, today, forum, reason, { baseline: baseMetrics, candidate: candMetrics });
    return { forumId, forumName, status: 'rolled_back', baseMetrics, candMetrics };
  }

  // 3) Commit the candidate as ONE atomic, revertible change.
  const newFields = {};
  for (const k of SNAP_COLS) if (k in overlay) newFields[k] = overlay[k];
  newFields.calibration_status = 'calibrated';
  if (newFields.status == null || newFields.status === 'calibration_failed') newFields.status = 'queued';
  const oldFields = {};
  for (const k of Object.keys(newFields)) oldFields[k] = snapshot[k];

  const res = state.applyCoachChange({
    date: today, forumId, forumName, knob: 'recalibrate', reasonCode: 'recal_improved',
    signal: { baseline: baseMetrics, candidate: candMetrics, attempts: candidate.attempts },
    oldFields, newFields,
  });
  if (!res.ok) return { forumId, forumName, status: 'slot_taken', reason: res.reason, baseMetrics, candMetrics };
  return { forumId, forumName, status: 'applied', baseMetrics, candMetrics };
}

// ── Report ───────────────────────────────────────────────────────────────────

const STATUS_LABEL = {
  applied: '✅ překalibrováno (nové nastavení je lepší, uloženo a vratné)',
  rolled_back: '↩ ponecháno staré (nové nastavení nebylo lepší)',
  not_stuck: 'přeskočeno (při kontrole už něco vytěžilo — není zaseknuté)',
  skipped_profile: 'přeskočeno (má ruční profil — nesahám)',
  slot_taken: 'přeskočeno (fórum dnes už upravil kouč)',
  missing: 'fórum nenalezeno',
};

function pct(m) { return `${Math.round((m?.extractor_yield_rate ?? 0) * 100)} %`; }

function writeReport(today, results, stopping) {
  const logDir = join(__dirname, 'logs');
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  const L = [`# Automatická překalibrace — ${today}`, ''];
  if (results.length === 0) {
    L.push('Žádné zaseknuté fórum ke zvážení (nebo všechna v ochranné lhůtě).');
  } else {
    for (const r of results) {
      const detail = (r.baseMetrics && r.candMetrics) ? ` — výnos ${pct(r.baseMetrics)} → ${pct(r.candMetrics)}` : '';
      L.push(`- **${r.forumName}**: ${STATUS_LABEL[r.status] || r.status}${detail}`);
    }
  }
  if (stopping) L.push('', '⚠️ Běh přerušen (limit/přihlášení) — zbytek nechávám na zítra.');
  L.push('', '_Skutečné nastavení fóra se nikdy nemění, dokud nový pokus neprokáže lepší výnos. Vše je v deníku a vratné příkazem `apply-proposal.mjs --revert --knob recalibrate`._');
  writeFileSync(join(logDir, `recalibrate-guarded-${today}.md`), L.join('\n'), 'utf8');
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const dryRun = args.includes('--dry-run');
  const config = buildConfig();
  const now = new Date();
  const today = localDateStr(now);
  const state = new AgentState();
  let stopping = false;

  try {
    if (!force) {
      const h = now.getHours();
      if (h < EVAL_HOUR || h >= EVAL_HOUR_END) { console.log(`recalibrate-guarded: mimo ranní okno (${EVAL_HOUR}:00–${EVAL_HOUR_END}:00) — skip.`); return; }
      if (state.getMeta(META_KEY) === today) { console.log('recalibrate-guarded: už dnes proběhlo — skip.'); return; }
    }

    const forums = state.getAllForums();
    const alreadyChanged = new Set(state.getCoachJournalForDate(today).filter(r => Number(r.applied) === 1).map(r => r.forum_id));
    const candidates = selectStuckForums(state, forums, { alreadyChanged, today, config });
    console.log(`recalibrate-guarded: ${candidates.length} stuck candidate(s); cap=${config.RECAL_MAX_PER_NIGHT}`);

    const pipeline = createCrawlPipeline({ sleepMs: config.SLEEP_MS });
    const results = [];
    for (const forum of candidates.slice(0, config.RECAL_MAX_PER_NIGHT)) {
      if (dryRun) { results.push({ forumId: forum.id, forumName: forum.name || forum.url, status: 'dry_run' }); continue; }
      try {
        const r = await runGuardedRecal(state, forum.id, pipeline, { today, config });
        results.push(r);
        const detail = (r.baseMetrics && r.candMetrics) ? ` (base ${pct(r.baseMetrics)} → cand ${pct(r.candMetrics)})` : '';
        console.log(`  ${r.forumName}: ${r.status}${detail}`);
      } catch (err) {
        if (isStoppingError(err)) { stopping = true; state.log('warn', `recalibrate-guarded stopped: ${err.message}`, 'coach'); break; }
        console.error(`  ${forum.name || forum.url}: error ${err.message}`);
        state.log('warn', `recalibrate-guarded error ${forum.id}: ${err.message}`, 'coach');
      }
    }

    if (dryRun) { console.log(`recalibrate-guarded: dry-run — ${results.length} candidate(s), nothing written.`); return; }

    writeReport(today, results, stopping);
    if (!stopping) state.setMeta(META_KEY, today); // claim the day only on a clean (non-aborted) run
    state.log('info', `recalibrate-guarded ${today}: ${results.map(r => r.status).join(',') || 'no candidates'}${stopping ? ' (STOPPED)' : ''}`, 'coach');
  } finally {
    state.close();
  }

  if (stopping) process.exitCode = 3; // tell run-coach-batch.ps1 to short-circuit remaining steps
}

const invokedDirectly = (() => {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
if (invokedDirectly) await main();
