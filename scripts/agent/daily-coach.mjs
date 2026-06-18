/**
 * daily-coach.mjs — daily self-improvement loop for the crawl agent (Phase 1: OBSERVE + EMIT).
 *
 * Runs once per local day, after the night crawl window, as a non-fatal step of
 * run-agent-batch.ps1. It aggregates the just-finished night into:
 *   1. a structured metrics time-series (local crawl_metrics table; the durable
 *      source of truth for measuring how each metric evolves over time), and
 *   2. a plain-Czech daily report (logs/daily-coach-YYYY-MM-DD.md) — the artifact
 *      the owner sees (later surfaced in the app's Analytics panel).
 * Both are also pushed best-effort to Supabase (crawl_metrics / crawl_daily_report)
 * when those tables exist, so the app can display the report and the data survives
 * off the local machine.
 *
 * Phase 1 is OBSERVE-ONLY: it changes NO crawler knob and emits NO proposals.
 * The diagnose/adapt tiers (auto scheduling + gated prompt proposals) come later.
 *
 * Self-gating: at most once per local day, only at/after COACH_HOUR. Unlike the
 * recall-watchdog it stamps the once-per-day key ONLY AFTER a successful report
 * write, so a crash/quota leaves the slot open to retry and the liveness gap shows.
 *
 * Usage:
 *   node --experimental-sqlite daily-coach.mjs [--force] [--dry-run] [--window-hours N]
 */

import { writeFileSync, existsSync, mkdirSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { AgentState } from './state.mjs';
import { failingCondition } from './recall-watchdog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const COACH_HOUR    = intEnv('COACH_HOUR', 6);          // run only at/after this local hour
const WINDOW_HOURS  = intEnv('COACH_WINDOW_HOURS', 12); // lookback covering the 21:00–06:00 night
const META_DATE     = 'coach_last_date';
const META_SUCCESS  = 'coach_last_success_at';

function intEnv(name, dflt) { const v = parseInt(process.env[name] ?? '', 10); return Number.isFinite(v) ? v : dflt; }

// ── Pure helpers (exported for tests) ───────────────────────────────────────

/** Bucket a thread discard_reason into a small stable set. */
export function bucketDiscardReason(reason) {
  const r = (reason || '').toString().toLowerCase();
  if (!r) return 'other';
  if (r.includes('too few posts')) return 'too_few_posts';
  if (r.startsWith('classifier rejected') || r.includes('classifier rejected')) return 'classifier_reject';
  if (r.includes('extractor returned no cases') || r.includes('no cases')) return 'extractor_empty';
  if (r.startsWith('transient') || r.includes('http 4') || r.includes('http 5') || r.includes('timeout')) return 'transient';
  return 'other';
}

/**
 * Aggregate one night into a flat metrics map + per-forum yield + reject breakdown.
 * Pure: takes already-fetched rows. Returns { metrics, byForum, rejectConditions, discardBuckets }.
 */
export function aggregateNight({ threads = [], cases = [], runs = [], forums = [] } = {}) {
  // Funnel from runs (sum across the night's batches)
  const sum = (k) => runs.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const threadsProcessed = sum('threads_processed');
  const casesExtracted = sum('cases_extracted');
  const casesVerified = sum('cases_verified');
  const casesImported = sum('cases_imported');

  // Discard buckets from threads created in the window
  const discardBuckets = {};
  let discardedTotal = 0;
  for (const t of threads) {
    if (t.status !== 'discarded') continue;
    discardedTotal++;
    const b = bucketDiscardReason(t.discard_reason);
    discardBuckets[b] = (discardBuckets[b] || 0) + 1;
  }

  // Case status histogram + verify-reject conditions, from cases created in the window
  const statusHist = {};
  const rejectConditions = {};
  let verifyRejected = 0;
  for (const c of cases) {
    statusHist[c.status] = (statusHist[c.status] || 0) + 1;
    if (c.status === 'verify_rejected') {
      verifyRejected++;
      const cond = failingCondition(c.review_note);
      rejectConditions[cond] = (rejectConditions[cond] || 0) + 1;
    }
  }

  // Per-forum yield (verified+imported cases vs threads), window-scoped
  const forumName = new Map(forums.map(f => [f.id, f.name || f.url || f.id]));
  const threadForum = new Map(threads.map(t => [t.id, t.forum_id]));
  const byForumRaw = {};
  for (const c of cases) {
    const fid = threadForum.get(c.thread_id);
    if (!fid) continue;
    const e = byForumRaw[fid] || (byForumRaw[fid] = { good: 0, rejected: 0 });
    if (c.status === 'verified' || c.status === 'import_ready' || c.status === 'imported') e.good++;
    else if (c.status === 'verify_rejected') e.rejected++;
  }
  const byForum = Object.entries(byForumRaw)
    .map(([fid, v]) => ({ forum: forumName.get(fid) || fid, forumId: fid, good: v.good, rejected: v.rejected }))
    .sort((a, b) => b.good - a.good || b.rejected - a.rejected);

  const ratio = (n, d) => (d > 0 ? +(n / d).toFixed(3) : 0);
  const metrics = {
    threads_processed: threadsProcessed,
    cases_extracted: casesExtracted,
    cases_verified: casesVerified,
    cases_imported: casesImported,
    threads_discarded: discardedTotal,
    verify_rejected: verifyRejected,
    yield_rate: ratio(casesExtracted, threadsProcessed),
    verify_pass_rate: ratio(casesVerified, casesVerified + verifyRejected),
    import_rate: ratio(casesImported, casesExtracted),
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
export function buildReport(agg, { date, windowHours, degenerate = null } = {}) {
  const m = agg.metrics;
  const L = [];
  L.push(`# Noční report crawleru — ${date}`, '');
  if (degenerate) {
    L.push(`⚠️ ${degenerate}`, '', 'Dnes nevyhodnocuju (neúplná noc), aby jeden špatný běh nezkreslil statistiky.');
    return L.join('\n');
  }
  L.push(`_Okno: posledních ${windowHours} h (noční běh)._`, '');

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
    for (const f of agg.byForum.slice(0, 10)) {
      L.push(`- ${f.forum}: ${f.good} ✓ / ${f.rejected} ✕`);
    }
    L.push('');
  }

  L.push('---');
  L.push('_Fáze 1: zatím jen sleduji a měřím. Automatické úpravy plánu a návrhy na doladění přijdou v dalších fázích._');
  return L.join('\n');
}

/** UTC 'YYYY-MM-DD HH:MM:SS' cutoff `hours` ago (matches SQLite created_at format). */
function utcCutoff(hours) {
  return new Date(Date.now() - hours * 3_600_000).toISOString().slice(0, 19).replace('T', ' ');
}
function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function intArg(args, flag, dflt) {
  const i = args.indexOf(flag);
  if (i === -1) return dflt;
  const v = parseInt(args[i + 1], 10);
  return Number.isFinite(v) ? v : dflt;
}

// ── Best-effort Supabase push (store-only; tables may not exist yet) ─────────

async function pushToSupabase(date, agg, reportMd) {
  const URL = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!URL || !KEY) return { ok: false, reason: 'no Supabase credentials' };
  const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
  try {
    // metrics: upsert long-format rows
    const rows = Object.entries(agg.metrics).map(([metric, value]) => ({ date, scope: 'global', metric, value }));
    const mRes = await fetch(`${URL}/rest/v1/crawl_metrics?on_conflict=date,scope,metric`, {
      method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(rows),
    });
    // report: upsert one row per date
    const rRes = await fetch(`${URL}/rest/v1/crawl_daily_report?on_conflict=date`, {
      method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([{ date, report_md: reportMd, metrics_json: agg.metrics }]),
    });
    if (!mRes.ok || !rRes.ok) {
      return { ok: false, reason: `metrics ${mRes.status} / report ${rRes.status} (tables may not exist yet)` };
    }
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
  const windowHours = intArg(args, '--window-hours', WINDOW_HOURS);

  const now = new Date();
  const today = localDateStr(now);
  const state = new AgentState();

  try {
    if (!force) {
      if (now.getHours() < COACH_HOUR) { console.log(`daily-coach: before ${COACH_HOUR}:00 local — skipping (night not finished).`); return; }
      if (state.getMeta(META_DATE) === today) { console.log('daily-coach: already ran today — skipping.'); return; }
    }

    const cutoff = utcCutoff(windowHours);
    const runs = state.getRunsSince(cutoff);
    const threads = state.getThreadsCreatedSince(cutoff);
    const cases = state.getCasesCreatedSince(cutoff);
    const forums = state.getAllForums();

    // Degenerate-night guard: a quota/auth/error-stopped night must not skew metrics.
    const last = state.getLastRun();
    let degenerate = null;
    const stop = (last?.stop_reason || '').toLowerCase();
    if (stop.includes('quota') || stop.includes('auth') || stop.includes('limit')) {
      degenerate = `Noční běh skončil předčasně (${last.stop_reason}).`;
    } else if (runs.length === 0 && threads.length === 0 && cases.length === 0) {
      degenerate = 'V okně neproběhl žádný crawl (prázdná noc).';
    }

    const agg = degenerate ? { metrics: {}, byForum: [], rejectConditions: {}, discardBuckets: {}, statusHist: {} }
      : aggregateNight({ threads, cases, runs, forums });
    const reportMd = buildReport(agg, { date: today, windowHours, degenerate });

    console.log(`daily-coach: ${today} window=${windowHours}h runs=${runs.length} threads=${threads.length} cases=${cases.length}` +
      (degenerate ? ` DEGENERATE(${degenerate})` : ` metrics=${JSON.stringify(agg.metrics)}`));

    if (dryRun) { console.log('\n----- REPORT (dry-run, not written) -----\n' + reportMd); return; }

    // 1. local metrics time-series (source of truth) — skip on degenerate nights
    if (!degenerate) {
      for (const [metric, value] of Object.entries(agg.metrics)) state.recordMetric(today, metric, value);
      for (const f of agg.byForum) {
        state.recordMetric(today, 'forum_good', f.good, f.forumId);
        state.recordMetric(today, 'forum_rejected', f.rejected, f.forumId);
      }
    }

    // 2. local report file
    const logDir = join(__dirname, 'logs');
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
    writeFileSync(join(logDir, `daily-coach-${today}.md`), reportMd, 'utf8');

    // 3. best-effort Supabase push (store-only; app reads it from there)
    const push = await pushToSupabase(today, agg, reportMd);
    console.log(`daily-coach: supabase push ${push.ok ? 'ok' : 'skipped (' + push.reason + ')'}`);

    // stamp once-per-day + liveness ONLY after a successful write
    state.setMeta(META_DATE, today);
    state.setMeta(META_SUCCESS, now.toISOString());
    state.log('info', `daily-coach report written for ${today} (${Object.keys(agg.metrics).length} metrics)`, 'coach');
  } finally {
    state.close();
  }
}

const invokedDirectly = (() => {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
if (invokedDirectly) await main();
