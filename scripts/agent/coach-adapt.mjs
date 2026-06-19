/**
 * coach-adapt.mjs — PURE Phase 2 planner for the daily coach's 🟢 auto-tier.
 *
 * Given a forum's per-night metric series (already excluding degenerate nights,
 * because the coach never records those), the forum row, and the recent change
 * journal, this decides AT MOST ONE reversible knob change per forum:
 *   - priority_score  (reorders the crawl queue; loosens no gate)
 *   - cooldown        (retimes the next visit, strictly within the engine's own
 *                      24h/168h tiers; never 720h, never null)
 * or emits a SHADOW re-calibration PROPOSAL (knob='recalibrate_proposal') that
 * mutates nothing and is surfaced to a human — re-calibration is deliberately NOT
 * auto-applied in Phase 2 because re-discovery overwrites a forum's config before a
 * non-technical owner could revert it (it is the one knob not column-reversible).
 *
 * Design invariants this module guarantees:
 *  - PURE: no DB, no fs, no Date.now() inside decisions — callers pass `now`/`todayStr`,
 *    so a re-run on the same day is deterministic (kills the Phase-1-class timing bug).
 *  - PRECISION not YIELD: every knob is reversible and structurally cannot make more
 *    cases pass the verify gate (it changes order/timing only).
 *  - Conservative: Laplace-smoothed yield + two-window agreement + deadband kill
 *    single-night spikes and flapping; min-volume ignores thin data; per-night
 *    transient guards stop outages being read as quality; a 10-day anti-flap and the
 *    exhausted/0-new lock stop the coach fighting the engine.
 *
 * All thresholds live in DEFAULT_CONFIG (env-overridable by the caller).
 */

export const DEFAULT_CONFIG = {
  // ── priority ──
  PRIORITY_WINDOW: 3,            // evaluated nights required + summed over
  PRIORITY_DEADBAND: 5.0,        // target must move at least this far to act
  PRIORITY_DELTA_MAX: 15.0,      // max single-night step (anti-overshoot)
  PRIORITY_NO_CHURN: 0.5,        // skip if |new-current| < this
  PRIORITY_MIN_PROCESSED: 20,    // min sum(processed) over window
  PRIORITY_MIN_OUTCOMES: 5,      // min sum(good+rejected) over window
  // ── cooldown ──
  COOLDOWN_WINDOW: 2,
  COOLDOWN_SHORT_HOURS: 24,
  COOLDOWN_LONG_HOURS: 168,
  SHORTEN_GOOD_MIN: 3,           // each window night needs good >= this
  SHORTEN_YIELD_MIN: 0.20,       // window smoothed yield >= this
  EXTEND_PROCESSED_MIN: 10,      // each window night needs processed >= this
  TRANSIENT_GUARD_PCT: 0.30,     // skip cooldown if transient share >= this on ANY window night
  COOLDOWN_REVERSE_LOCK_DAYS: 10,// never reverse an opposite cooldown change inside this many days
  // ── re-calibration (SHADOW proposal only) ──
  RECAL_WINDOW: 3,
  RECAL_MIN_PROCESSED: 30,       // min sum(processed) over window
  RECAL_TRANSIENT_MAX: 0.20,     // per-night transient share ceiling (stricter than cooldown)
  RECAL_TOOFEW_MAX_SHARE: 0.5,   // too_few must not dominate processed (else thin content, not a break)
  // ── global ──
  MAX_SERIES_AGE_DAYS: 21,       // newest aligned night must be this fresh (no archaeology)
  GLOBAL_CIRCUIT_PCT: 0.50,      // if > this share of evaluable forums would change → apply none
  CIRCUIT_MIN_EVALUABLE: 4,      // don't trip the breaker on a tiny fleet
  MAX_ACTIONS_PER_NIGHT: 8,      // global cap on applied changes; strongest first
};

const PRIORITY_STATUSES = new Set(['active', 'exhausted', 'queued']);
const RECAL_BLOCKED_STATUSES = new Set(['disqualified', 'calibration_failed', 'exhausted', 'discovered', 'queued']);

// ── small pure helpers ──────────────────────────────────────────────────────

function round(x, d) { const f = 10 ** d; return Math.round(x * f) / f; }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function sum(arr, key) { return arr.reduce((a, n) => a + (Number(n[key]) || 0), 0); }

/** Laplace-smoothed verified yield: a 1-good/1-thread night cannot spike. */
export function smoothedYield(G, P) { return (G + 1) / (P + 10); }

function toUtcDays(dateStr) { return Date.parse(`${dateStr}T00:00:00Z`) / 86_400_000; }
/** Whole-day difference between two local YYYY-MM-DD strings (b - a). */
export function daysBetween(a, b) { return Math.round(toUtcDays(b) - toUtcDays(a)); }
/** Local YYYY-MM-DD `n` days from `dateStr` (n may be negative). */
export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** A window night had a transient-dominated outcome (network/HTTP/timeout share). */
function transientShare(n) {
  const denom = n.processed + n.transient;
  return denom > 0 ? n.transient / denom : 0;
}

/**
 * Align per-metric series into dense per-night rows, oldest→newest. Anchored on
 * forum_processed presence: a "new-code" night records all six metrics together,
 * so older nights (which only have forum_good/forum_rejected) are excluded — the
 * planner naturally warms up over the first few nights after deploy.
 * @param {Record<string, Array<{date:string,value:number}>>} seriesByMetric
 */
export function alignNights(seriesByMetric) {
  const KEYS = ['forum_good', 'forum_rejected', 'forum_processed', 'forum_extracted', 'forum_transient', 'forum_too_few'];
  const byDate = {};
  for (const key of KEYS) {
    for (const { date, value } of (seriesByMetric[key] || [])) {
      (byDate[date] || (byDate[date] = {}))[key] = value;
    }
  }
  return Object.keys(byDate)
    .filter(d => byDate[d].forum_processed != null)
    .sort()
    .map(d => ({
      date: d,
      good: byDate[d].forum_good || 0,
      rejected: byDate[d].forum_rejected || 0,
      processed: byDate[d].forum_processed || 0,
      extracted: byDate[d].forum_extracted || 0,
      transient: byDate[d].forum_transient || 0,
      tooFew: byDate[d].forum_too_few || 0,
    }));
}

function tooStale(win, todayStr, config) {
  const newest = win[win.length - 1];
  return daysBetween(newest.date, todayStr) > config.MAX_SERIES_AGE_DAYS;
}

// ── per-knob planners (each returns a decision fragment or null) ─────────────

/** PRIORITY (lowest precedence): verified yield over the last 3 evaluated nights. */
export function planPriority(forum, nights, todayStr, config = DEFAULT_CONFIG) {
  if (!PRIORITY_STATUSES.has(forum.status)) return null;
  const W = config.PRIORITY_WINDOW;
  if (nights.length < W) return null;
  const win = nights.slice(-W);
  if (tooStale(win, todayStr, config)) return null;

  for (const n of win) {                                      // transient guard (as for cooldown):
    if (transientShare(n) >= config.TRANSIENT_GUARD_PCT) return null; // don't read an outage night as quality
  }
  const G3 = sum(win, 'good'), P3 = sum(win, 'processed'), R3 = sum(win, 'rejected');
  if (P3 < config.PRIORITY_MIN_PROCESSED) return null;        // min-volume
  if (G3 + R3 < config.PRIORITY_MIN_OUTCOMES) return null;    // min-volume

  const win2 = nights.slice(-2);
  const G2 = sum(win2, 'good'), P2 = sum(win2, 'processed');
  const current = Number(forum.priority_score) || 0;
  const target3 = round(smoothedYield(G3, P3) * 100, 1);
  const target2 = round(smoothedYield(G2, P2) * 100, 1);

  const D = config.PRIORITY_DEADBAND;
  const rising = target3 > current + D && target2 > current;   // two-window agreement
  const falling = target3 < current - D && target2 < current;
  if (!rising && !falling) return null;

  const step = clamp(target3 - current, -config.PRIORITY_DELTA_MAX, config.PRIORITY_DELTA_MAX);
  const newScore = round(clamp(current + step, 0, 100), 1);
  if (Math.abs(newScore - current) < config.PRIORITY_NO_CHURN) return null;  // no-churn

  return {
    kind: 'apply',
    knob: 'priority',
    direction: rising ? 'up' : 'down',
    reasonCode: rising ? 'rising_yield' : 'falling_yield',
    oldFields: { priority_score: current },
    newFields: { priority_score: newScore },
    signal: { nights: win.length, good: G3, processed: P3, rejected: R3, target2, target3, current },
    strength: Math.abs(newScore - current), // rank by the ACTUAL (clamped) move, not the raw yield shift
  };
}

/** COOLDOWN (middle precedence): shorten 168h→24h or extend 24h→168h, within bounds. */
export function planCooldown(forum, nights, recentCooldownJournal, now, todayStr, config = DEFAULT_CONFIG) {
  const tier = forum.cooldown_tier_hours;
  // Only retune a clean yield-based park the engine stamped; error/transient parks are cleared.
  if (tier == null || forum.cooldown_set_at == null) return null;
  // Exhausted / content-dry lock: never resurrect a forum the engine sees as mined out.
  if (forum.status === 'exhausted') return null;
  if (Number(forum.new_threads_last_batch) === 0) return null;

  const W = config.COOLDOWN_WINDOW;
  if (nights.length < W) return null;
  const win = nights.slice(-W);
  if (tooStale(win, todayStr, config)) return null;
  for (const n of win) {                                       // transient guard
    if (transientShare(n) >= config.TRANSIENT_GUARD_PCT) return null;
  }

  const G2 = sum(win, 'good'), P2 = sum(win, 'processed');
  const y2 = smoothedYield(G2, P2);

  let direction = null, newTier = null;
  if (tier === config.COOLDOWN_LONG_HOURS) {
    if (win.every(n => n.good >= config.SHORTEN_GOOD_MIN) && y2 >= config.SHORTEN_YIELD_MIN) {
      direction = 'shorten'; newTier = config.COOLDOWN_SHORT_HOURS;
    }
  } else if (tier === config.COOLDOWN_SHORT_HOURS) {
    if (win.every(n => n.good === 0) && win.every(n => n.processed >= config.EXTEND_PROCESSED_MIN)) {
      direction = 'extend'; newTier = config.COOLDOWN_LONG_HOURS;
    }
  }
  if (!direction) return null;

  // Cross-night anti-flap: never reverse an opposite-direction change made recently.
  const lockSince = addDays(todayStr, -config.COOLDOWN_REVERSE_LOCK_DAYS);
  for (const j of (recentCooldownJournal || [])) {
    if ((j.date || '') >= lockSince && j.direction && j.direction !== direction) return null;
  }

  const newUntil = new Date(now.getTime() + newTier * 3_600_000).toISOString();
  const cur = forum.cooldown_until;
  // Must be a genuine shorten/extend relative to the current park.
  if (direction === 'shorten' && !(cur && newUntil < cur)) return null;
  if (direction === 'extend' && !(cur && newUntil > cur)) return null;

  return {
    kind: 'apply',
    knob: 'cooldown',
    direction,
    reasonCode: direction === 'shorten' ? 'shorten_strong_yield' : 'extend_no_yield',
    oldFields: {
      cooldown_until: forum.cooldown_until,
      cooldown_tier_hours: forum.cooldown_tier_hours,
      cooldown_set_at: forum.cooldown_set_at,
    },
    newFields: {
      cooldown_until: newUntil,
      cooldown_tier_hours: newTier,
      cooldown_set_at: now.toISOString(),
    },
    signal: { fromTier: tier, toTier: newTier, good: G2, processed: P2, yield: round(y2, 3) },
    strength: 1000,  // a cooldown retiming outranks a priority nudge when the cap bites
  };
}

/** RE-CALIBRATION (highest precedence) — SHADOW proposal only, mutates nothing. */
export function planRecalProposal(forum, nights, todayStr, config = DEFAULT_CONFIG) {
  if (forum.calibration_status !== 'calibrated') return null;
  if (RECAL_BLOCKED_STATUSES.has(forum.status)) return null;
  const W = config.RECAL_WINDOW;
  if (nights.length < W) return null;
  const win = nights.slice(-W);
  if (tooStale(win, todayStr, config)) return null;

  const procSum = sum(win, 'processed'), extractedSum = sum(win, 'extracted'), tooFewSum = sum(win, 'tooFew');
  if (procSum < config.RECAL_MIN_PROCESSED) return null;       // min-volume
  if (extractedSum !== 0) return null;                          // STUCK = processed in volume, extracted nothing
  for (const n of win) {                                        // stricter transient ceiling (>= for consistency with cooldown)
    if (transientShare(n) >= config.RECAL_TRANSIENT_MAX) return null;
  }
  // If most processed threads were "too few posts", it's thin content — not a parser break.
  if (tooFewSum > config.RECAL_TOOFEW_MAX_SHARE * procSum) return null;

  return {
    kind: 'proposal',
    knob: 'recalibrate_proposal',
    reasonCode: 'stuck_no_extract',
    signal: { nights: win.length, processed: procSum, extracted: extractedSum, tooFew: tooFewSum },
  };
}

/**
 * Decide the SINGLE action for one forum, in precedence order:
 * re-calibration proposal (suppresses the others) > cooldown > priority.
 */
export function planForum({ forum, nights, recentCooldownJournal = [], now, todayStr, config = DEFAULT_CONFIG }) {
  const base = { forumId: forum.id, forumName: forum.name || forum.url || forum.id };
  const recal = planRecalProposal(forum, nights, todayStr, config);
  if (recal) return { ...base, ...recal };
  const cd = planCooldown(forum, nights, recentCooldownJournal, now, todayStr, config);
  if (cd) return { ...base, ...cd };
  const pr = planPriority(forum, nights, todayStr, config);
  if (pr) return { ...base, ...pr };
  return null;
}

/**
 * Plan the whole night across forums. Applies the global circuit-breaker (a metric
 * bug making many forums look bad → apply nothing) and the global cap (strongest
 * first). Forums that already have an applied change today are skipped (1/forum/day).
 */
export function planNight({ forums, nightsByForum, journalByForum = {}, alreadyChangedForumIds = new Set(), now, todayStr, config = DEFAULT_CONFIG }) {
  const applies = [], proposals = [];
  let evaluable = 0;
  for (const forum of forums) {
    // A forum already changed today is out of play tonight, so it must NOT inflate the
    // circuit-breaker denominator either — skip it before counting it as evaluable.
    if (alreadyChangedForumIds?.has(forum.id)) continue;
    const nights = nightsByForum[forum.id] || [];
    if (nights.length >= config.COOLDOWN_WINDOW) evaluable++;
    const decision = planForum({ forum, nights, recentCooldownJournal: journalByForum[forum.id] || [], now, todayStr, config });
    if (!decision) continue;
    if (decision.kind === 'proposal') proposals.push(decision);
    else applies.push(decision);
  }

  // Global circuit-breaker: too many forums changing at once smells like a data bug.
  const circuitTripped = evaluable >= config.CIRCUIT_MIN_EVALUABLE &&
    applies.length > config.GLOBAL_CIRCUIT_PCT * evaluable;
  if (circuitTripped) {
    return { applied: [], deferred: applies, proposals, circuitTripped: true, capHit: false, evaluable };
  }

  // Global cap — strongest first; the rest defer to tomorrow.
  applies.sort((a, b) => b.strength - a.strength);
  const applied = applies.slice(0, config.MAX_ACTIONS_PER_NIGHT);
  const deferred = applies.slice(config.MAX_ACTIONS_PER_NIGHT);
  return { applied, deferred, proposals, circuitTripped: false, capHit: deferred.length > 0, evaluable };
}
