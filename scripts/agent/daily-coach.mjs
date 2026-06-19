/**
 * daily-coach.mjs — daily self-improvement loop for the crawl agent (Phase 1: OBSERVE + EMIT).
 *
 * Runs once per day AFTER the night crawl window, from a DEDICATED scheduled task
 * (DriveCodexDailyCoach, ~06:20, via run-coach-batch.ps1) — NOT from the 5-minute
 * crawl batch, because that batch only fires inside the 21:00–06:00 window and would
 * run the coach at the window START against an empty daytime lookback. It aggregates
 * the just-finished night into:
 *   1. a structured metrics time-series (local crawl_metrics table; durable source of
 *      truth for measuring how each metric evolves), and
 *   2. a plain-Czech daily report (logs/daily-coach-YYYY-MM-DD.md) — surfaced in the
 *      app's admin Analytics panel.
 * Both are also pushed best-effort to Supabase (crawl_metrics / crawl_daily_report).
 *
 * Phase 1 is OBSERVE-ONLY: it changes NO crawler knob and emits NO proposals.
 *
 * Correctness notes (post-review):
 *  - The lookback window is ANCHORED to the night boundary (most recent
 *    COACH_NIGHT_START_HOUR, default 21:00 local — matches the crawl task's start),
 *    NOT a rolling Date.now()-Nh, so it captures the whole night whenever it runs.
 *  - The funnel + ratios are computed from ONE cohort (threads/cases created in the
 *    window), so verify_pass_rate etc. never mix started_at vs created_at cohorts.
 *  - A degenerate night (quota/auth stop anywhere in the window, or an empty window)
 *    writes an informational report but does NOT stamp the once-per-day key, so a
 *    later/again invocation can re-evaluate once real data exists.
 *
 * Usage:
 *   node --experimental-sqlite daily-coach.mjs [--force] [--dry-run]
 */

import { writeFileSync, existsSync, mkdirSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { AgentState } from './state.mjs';
import { failingCondition } from './recall-watchdog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const COACH_NIGHT_START_HOUR = intEnv('COACH_NIGHT_START_HOUR', 21); // crawl window start (local); window = [this, now]
const COACH_HOUR     = intEnv('COACH_HOUR', 6);   // closed morning gate start (local)
const COACH_HOUR_END = intEnv('COACH_HOUR_END', 21); // closed morning gate end (exclusive)
const META_DATE      = 'coach_last_date';
const META_SUCCESS   = 'coach_last_success_at';

// Cases that have PASSED the verify gate (verified and everything downstream of it).
const VERIFY_PASSED = new Set(['verified', 'import_ready', 'imported', 'import_failed', 'crosscheck_dupe']);

function intEnv(name, dflt) { const v = parseInt(process.env[name] ?? '', 10); return Number.isFinite(v) ? v : dflt; }

// ── Pure helpers (exported for tests) ───────────────────────────────────────

/** Bucket a thread discard_reason into a small stable set. */
export function bucketDiscardReason(reason) {
  const r = (reason || '').toString().toLowerCase();
  if (!r) return 'other';
  if (r.includes('too few posts')) return 'too_few_posts';
  if (r.includes('classifier rejected')) return 'classifier_reject';
  if (r.includes('extractor returned no cases') || r.includes('no cases')) return 'extractor_empty';
  if (r.startsWith('transient') || r.includes('http 4') || r.includes('http 5') || r.includes('timeout')) return 'transient';
  return 'other';
}

/** UTC 'YYYY-MM-DD HH:MM:SS' = start of the most recent night window (local nightStartHour). */
export function nightCutoffUtc(now, nightStartHour = COACH_NIGHT_START_HOUR) {
  const start = new Date(now.getTime());
  if (now.getHours() < nightStartHour) start.setDate(start.getDate() - 1); // before tonight's start → last night
  start.setHours(nightStartHour, 0, 0, 0);
  return start.toISOString().slice(0, 19).replace('T', ' ');
}

/** Should the coach run now? Closed morning window + once-per-day. --force bypasses this upstream. */
export function gateDecision(now, { lastDate, today, hourStart = COACH_HOUR, hourEnd = COACH_HOUR_END } = {}) {
  const h = now.getHours();
  if (h < hourStart || h >= hourEnd) return { run: false, reason: `mimo ranní okno (${hourStart}:00–${hourEnd}:00)` };
  if (lastDate === today) return { run: false, reason: 'už dnes proběhlo' };
  return { run: true, reason: '' };
}

/** A night that must NOT move metrics: quota/auth stop anywhere in the window, or an empty window. */
export function detectDegenerate({ runs = [], threads = [], cases = [] } = {}) {
  const bad = runs.find(r => /quota|auth|limit/i.test((r.stop_reason || '').toString()));
  if (bad) return `Noční běh skončil předčasně (${bad.stop_reason}).`;
  if (runs.length === 0 && threads.length === 0 && cases.length === 0) return 'V okně neproběhl žádný crawl (prázdná noc).';
  return null;
}

const EMPTY_AGG = { metrics: {}, byForum: [], rejectConditions: {}, discardBuckets: {}, statusHist: {} };

/**
 * Aggregate the night from ONE cohort (threads + cases created in the window).
 * Pure. `cases` rows carry forum_id (joined in the windowed reader), so per-forum
 * yield is correct even for cases whose thread was crawled on a previous night.
 */
export function aggregateNight({ threads = [], cases = [], forums = [] } = {}) {
  const threadsProcessed = threads.filter(t => t.status && t.status !== 'pending').length;

  const discardBuckets = {};
  let discardedTotal = 0;
  for (const t of threads) {
    if (t.status !== 'discarded') continue;
    discardedTotal++;
    const b = bucketDiscardReason(t.discard_reason);
    discardBuckets[b] = (discardBuckets[b] || 0) + 1;
  }

  const statusHist = {};
  const rejectConditions = {};
  let verifyPassed = 0, verifyRejected = 0, imported = 0;
  for (const c of cases) {
    statusHist[c.status] = (statusHist[c.status] || 0) + 1;
    if (VERIFY_PASSED.has(c.status)) verifyPassed++;
    if (c.status === 'imported') imported++;
    if (c.status === 'verify_rejected') {
      verifyRejected++;
      const cond = failingCondition(c.review_note);
      rejectConditions[cond] = (rejectConditions[cond] || 0) + 1;
    }
  }
  const casesExtracted = cases.length;

  const forumName = new Map(forums.map(f => [f.id, f.name || f.url || f.id]));
  const byForumRaw = {};
  for (const c of cases) {
    const fid = c.forum_id;
    if (!fid) continue;
    const e = byForumRaw[fid] || (byForumRaw[fid] = { good: 0, rejected: 0 });
    if (VERIFY_PASSED.has(c.status)) e.good++;
    else if (c.status === 'verify_rejected') e.rejected++;
  }
  const byForum = Object.entries(byForumRaw)
    .map(([fid, v]) => ({ forum: forumName.get(fid) || fid, forumId: fid, good: v.good, rejected: v.rejected }))
    .sort((a, b) => b.good - a.good || b.rejected - a.rejected);

  const ratio = (n, d) => (d > 0 ? +(n / d).toFixed(3) : 0);
  const metrics = {
    threads_processed: threadsProcessed,
    cases_extracted: casesExtracted,
    cases_verified: verifyPassed,
    cases_imported: imported,
    threads_discarded: discardedTotal,
    verify_rejected: verifyRejected,
    yield_rate: ratio(casesExtracted, threadsProcessed),
    verify_pass_rate: ratio(verifyPassed, verifyPassed + verifyRejected),
    import_rate: ratio(imported, casesExtracted),
  };
  for (const [b, n] of Object.entries(discardBuckets)) metrics[`discarded:${b}`] = n;
  for (const [c, n] of Object.entries(rejectConditions)) metrics[`verify_reject:${c}`] = n;

  return { metrics, byForum, rejectConditions, discardBuckets, statusHist };
}

const DISCARD_LABEL = {
  too_few_posts: 'málo příspěvků',
  classifier_reject: 'zamítl klasifikátor',
  extractor_empty: 'extraktor nic nevytěžil',
  transient: 'dočasná chyba (síť/blok)',
  other: 'jiné',
};

/** Build the plain-Czech daily report (markdown). Pure. */
export function buildReport(agg, { date, windowLabel, degenerate = null } = {}) {
  const m = agg.metrics;
  const L = [];
  L.push(`# Noční report crawleru — ${date}`, '');
  if (degenerate) {
    L.push(`⚠️ ${degenerate}`, '', 'Dnes nevyhodnocuju (neúplná noc), aby jeden špatný běh nezkreslil statistiky.');
    return L.join('\n');
  }
  L.push(`_Okno: ${windowLabel}._`, '');

  L.push('## Co se vytěžilo');
  L.push(`- Zpracovaná vlákna: **${m.threads_processed}**`);
  L.push(`- Vytěžené případy: **${m.cases_extracted}** (výnos ${(m.yield_rate * 100).toFixed(0)} %)`);
  L.push(`- Prošlo verifikací: **${m.cases_verified}** (úspěšnost ${(m.verify_pass_rate * 100).toFixed(0)} %)`);
  L.push(`- Naimportováno do fronty ke schválení: **${m.cases_imported}**`, '');

  L.push('## Proč to padalo');
  if (m.threads_discarded > 0) {
    L.push(`Zahozená vlákna: **${m.threads_discarded}**`);
    for (const [b, n] of Object.entries(agg.discardBuckets).sort((a, b2) => b2[1] - a[1])) {
      L.push(`  - ${DISCARD_LABEL[b] || b}: ${n}`);
    }
  } else {
    L.push('Žádná zahozená vlákna v okně.');
  }
  if (m.verify_rejected > 0) {
    L.push(`Zamítl verifikátor: **${m.verify_rejected}**`);
    for (const [c, n] of Object.entries(agg.rejectConditions).sort((a, b2) => b2[1] - a[1])) {
      L.push(`  - ${c}: ${n}`);
    }
  }
  L.push('');

  if (agg.byForum.length > 0) {
    L.push('## Po fórech (dobré / zamítnuté)');
    for (const f of agg.byForum.slice(0, 10)) L.push(`- ${f.forum}: ${f.good} ✓ / ${f.rejected} ✕`);
    L.push('');
  }

  L.push('---');
  L.push('_Fáze 1: zatím jen sleduji a měřím. Automatické úpravy plánu a návrhy na doladění přijdou v dalších fázích._');
  return L.join('\n');
}

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Best-effort Supabase push (store-only; app reads it from there) ──────────

async function pushToSupabase(date, agg, reportMd) {
  const URL = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!URL || !KEY) return { ok: false, reason: 'no Supabase credentials' };
  const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
  try {
    const rows = Object.entries(agg.metrics).map(([metric, value]) => ({ date, scope: 'global', metric, value }));
    let mRes = { ok: true };
    if (rows.length > 0) {
      mRes = await fetch(`${URL}/rest/v1/crawl_metrics?on_conflict=date,scope,metric`, {
        method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(rows),
      });
    }
    const rRes = await fetch(`${URL}/rest/v1/crawl_daily_report?on_conflict=date`, {
      method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([{ date, report_md: reportMd, metrics_json: agg.metrics }]),
    });
    if (!mRes.ok || !rRes.ok) return { ok: false, reason: `metrics ${mRes.status ?? 'ok'} / report ${rRes.status} (tables may not exist yet)` };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const dryRun = args.includes('--dry-run');

  const now = new Date();
  const today = localDateStr(now);
  const state = new AgentState();

  try {
    if (!force) {
      const gate = gateDecision(now, { lastDate: state.getMeta(META_DATE), today });
      if (!gate.run) { console.log(`daily-coach: skipping — ${gate.reason}.`); return; }
    }

    const cutoff = nightCutoffUtc(now);
    const runs = state.getRunsSince(cutoff);
    const threads = state.getThreadsCreatedSince(cutoff);
    const cases = state.getCasesCreatedSince(cutoff);
    const forums = state.getAllForums();

    const degenerate = detectDegenerate({ runs, threads, cases });
    const agg = degenerate ? EMPTY_AGG : aggregateNight({ threads, cases, forums });
    const windowLabel = `${cutoff.slice(0, 16)} → ${now.toISOString().slice(0, 16)} UTC (noční běh)`;
    const reportMd = buildReport(agg, { date: today, windowLabel, degenerate });

    console.log(`daily-coach: ${today} cutoff=${cutoff} runs=${runs.length} threads=${threads.length} cases=${cases.length}` +
      (degenerate ? ` DEGENERATE(${degenerate})` : ` metrics=${JSON.stringify(agg.metrics)}`));

    if (dryRun) { console.log('\n----- REPORT (dry-run, not written) -----\n' + reportMd); return; }

    // local report file (always — informational even on a degenerate night)
    const logDir = join(__dirname, 'logs');
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
    writeFileSync(join(logDir, `daily-coach-${today}.md`), reportMd, 'utf8');

    // local metrics + once-per-day stamp ONLY on a real (non-degenerate) night
    if (!degenerate) {
      for (const [metric, value] of Object.entries(agg.metrics)) state.recordMetric(today, metric, value);
      for (const f of agg.byForum) {
        state.recordMetric(today, 'forum_good', f.good, f.forumId);
        state.recordMetric(today, 'forum_rejected', f.rejected, f.forumId);
      }
      state.setMeta(META_DATE, today); // claim the day only after a real evaluation
    }

    const push = await pushToSupabase(today, agg, reportMd);
    console.log(`daily-coach: supabase push ${push.ok ? 'ok' : 'skipped (' + push.reason + ')'}`);

    state.setMeta(META_SUCCESS, now.toISOString()); // liveness heartbeat (the coach ran)
    state.log('info', `daily-coach ${degenerate ? 'degenerate' : 'report'} for ${today}` + (degenerate ? ` (${degenerate})` : ` (${Object.keys(agg.metrics).length} metrics)`), 'coach');
  } finally {
    state.close();
  }
}

const invokedDirectly = (() => {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
if (invokedDirectly) await main();
