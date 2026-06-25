/**
 * apply-proposal.mjs — undo tool for the daily coach's reversible auto-tier actions.
 *
 * The coach journals each applied change in coach_journal with the exact pre-change
 * values. This tool rolls them back, newest-first, using COMPARE-AND-SWAP: it restores
 * a change only if the target STILL holds the value the coach wrote — if the engine or a
 * human has since changed it, the row is closed out without clobbering the newer value.
 * Dispatch is on target_kind: `forum` knobs (priority/cooldown/recalibrate) restore forum
 * columns; `quarantine` restores a case status AND un-rejects the live gearbrain_cases
 * row. A quarantine revert is ATOMIC per case — the live row is un-rejected FIRST and the
 * local status is restored only on success, so a failed live restore leaves the row OPEN
 * for a clean retry (never a half-revert).
 *
 * Usage:
 *   node --experimental-sqlite apply-proposal.mjs --list   [--date Y-M-D] [--forum <id|url|name>] [--case <id>] [--knob priority|cooldown|recalibrate|quarantine]
 *   node --experimental-sqlite apply-proposal.mjs --revert [--date Y-M-D] [--forum <id|url|name>] [--case <id>] [--knob priority|cooldown|recalibrate|quarantine] [--dry-run]
 */

import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { AgentState } from './state.mjs';
import { setLiveCaseStatusByLocalId, resolveSupabaseReadKey } from './supabase-utils.mjs';

/** Normalise a value for cross-source (SQLite vs JSON) equality. */
function eq(a, b) { return String(a ?? null) === String(b ?? null); }

/**
 * Revert applied coach changes (newest-first) with compare-and-swap. ASYNC because a
 * quarantine revert must also un-reject the LIVE gearbrain_cases row. Dispatch is on
 * target_kind: 'forum' (priority/cooldown/recalibrate) restores forum columns via
 * getForum/updateForum; 'case' (quarantine) restores a case status via getCase/updateCase
 * AND un-rejects the live row. A case revert is ATOMIC: the live row is un-rejected FIRST
 * and the local status is restored + the journal row closed ONLY on success, so a failed
 * live restore leaves the row OPEN and a re-run retries the whole thing (never a
 * half-revert). Idempotent (reverted rows are filtered out by the query).
 * @returns {{reverted:Array, superseded:Array, liveFailed:Array, total:number}}
 */
export async function revertCoachChanges(state, { date = null, forumId = null, knob = null } = {}, { dryRun = false, env = process.env } = {}) {
  const rows = state.getRevertableCoachChanges({ date, forumId, knob });
  const result = { reverted: [], superseded: [], liveFailed: [], total: rows.length };
  for (const r of rows) {
    let newVals, oldVals, signal = {};
    try { newVals = JSON.parse(r.new_json || '{}'); oldVals = JSON.parse(r.old_json || '{}'); signal = JSON.parse(r.signal_json || '{}'); }
    catch { continue; }

    const isCase = r.target_kind === 'case';
    const localId = r.case_id || r.forum_id;
    const row = isCase ? state.getCase(localId) : state.getForum(r.forum_id);
    const stillHolds = row && Object.keys(newVals).every(k => eq(row[k], newVals[k]));
    const label = r.forum_name || localId;

    if (!stillHolds) {
      result.superseded.push(r);
      if (!dryRun) {
        state.markCoachReverted(r.id);
        state.log('info', `coach revert #${r.id} ${r.knob} ${label}: superseded by a newer value — left as is`, 'coach');
      }
      continue;
    }

    // A quarantine that reached the LIVE DB is un-rejected FIRST. If that fails, leave the
    // journal row OPEN (don't touch local, don't close it) so `--revert` retries it cleanly.
    if (isCase && signal.live_pulled && !dryRun) {
      const back = await restoreLiveCase(env, localId, signal.live_prev_status || 'pending');
      if (!back.cleared) {
        result.liveFailed.push({ id: r.id, label, reason: back.reason });
        state.log('warn', `coach revert #${r.id} quarantine ${label}: live restore failed (${back.reason}) — left OPEN for retry`, 'coach');
        continue;
      }
    }

    if (!dryRun) {
      if (isCase) state.updateCase(localId, oldVals);
      else state.updateForum(r.forum_id, oldVals);
      state.markCoachReverted(r.id);
      state.log('info', `coach revert #${r.id} ${r.knob} ${label}: ${r.new_json} → ${r.old_json}`, 'coach');
    }
    result.reverted.push(r);
  }
  return result;
}

/**
 * Un-reject a quarantined case in the live gearbrain_cases DB. Returns {cleared, reason}:
 * cleared=true when nothing of ours is left rejected (we flipped it back, OR it was
 * already changed by a human, OR it is not in the live DB); cleared=false ONLY on a real
 * lookup/patch failure — that path keeps the journal row open so the revert can retry.
 */
async function restoreLiveCase(env, localId, prevStatus) {
  const supabaseUrl = env.SUPABASE_URL;
  const serviceKey = resolveSupabaseReadKey(env);
  if (!supabaseUrl || !serviceKey) return { cleared: false, reason: 'no Supabase credentials' };
  const res = await setLiveCaseStatusByLocalId({
    supabaseUrl, serviceKey, localId,
    patch: { status: prevStatus, review_reason: null, reviewed_at: null },
    expectStatuses: ['rejected'], // CAS: only un-reject what WE left rejected
  });
  if (res.ok && (res.updated || res.skipped || !res.found)) return { cleared: true };
  return { cleared: false, reason: res.reason || `http ${res.httpStatus}` };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function argVal(args, flag) { const i = args.indexOf(flag); return i === -1 ? null : args[i + 1]; }

function resolveForumId(state, forumArg) {
  const all = state.getAllForums();
  const match = all.find(f =>
    String(f.id) === forumArg ||
    (f.url || '').includes(forumArg) ||
    (f.name || '').toLowerCase().includes(forumArg.toLowerCase())
  );
  return match ? match.id : null;
}

const USAGE = `apply-proposal.mjs — vrácení automatických úprav denního kouče (Fáze 2+).

Použití:
  node --experimental-sqlite apply-proposal.mjs --list   [--date RRRR-MM-DD] [--forum <id|část-url|název>] [--case <id>] [--knob priority|cooldown|recalibrate|quarantine]
  node --experimental-sqlite apply-proposal.mjs --revert [--date RRRR-MM-DD] [--forum <id|část-url|název>] [--case <id>] [--knob priority|cooldown|recalibrate|quarantine] [--dry-run]

Bez filtru se --revert vrátí VŠECHNY dosud nevrácené automatické úpravy (od nejnovější):
priority/cooldown/recalibrate (obnoví sloupce fóra) i quarantine (obnoví stav případu
lokálně i v živé databázi). (Aplikace rizikových návrhů promptů/prahů = Fáze 4, zde ne.)`;

async function main() {
  const args = process.argv.slice(2);
  const doRevert = args.includes('--revert');
  const doList = args.includes('--list');
  const dryRun = args.includes('--dry-run');
  const date = argVal(args, '--date');
  const knob = argVal(args, '--knob');
  const forumArg = argVal(args, '--forum');
  const caseArg = argVal(args, '--case');

  if (!doRevert && !doList) { console.log(USAGE); return; }

  const state = new AgentState();
  try {
    // A case-scoped row stores forum_id = caseId, so --case filters by passing the
    // case id straight through as the forum_id filter (no forums-table resolution).
    let filterId = caseArg || null;
    if (!filterId && forumArg) {
      filterId = resolveForumId(state, forumArg);
      if (!filterId) { console.error(`Žádné fórum neodpovídá: ${forumArg}`); process.exitCode = 1; return; }
    }

    if (doList) {
      const rows = state.getRevertableCoachChanges({ date, forumId: filterId, knob });
      if (rows.length === 0) console.log('Žádné vratné automatické úpravy.');
      else {
        console.log(`Vratné automatické úpravy (${rows.length}):`);
        for (const r of rows) console.log(`  [#${r.id}] ${r.date}  ${r.knob} ${r.direction || ''} ${r.target_kind === 'case' ? '(případ) ' : ''} ${r.forum_name || r.forum_id}: ${r.old_json} → ${r.new_json}`);
      }
      if (!doRevert) return;
    }

    if (doRevert) {
      const res = await revertCoachChanges(state, { date, forumId: filterId, knob }, { dryRun });
      const tag = dryRun ? '(zkušebně, nic neměním) ' : '';
      const liveNote = res.liveFailed.length ? `, živá obnova selhala: ${res.liveFailed.length}` : '';
      console.log(`${tag}Vráceno: ${res.reverted.length}, přeskočeno (mezitím změněno jinde): ${res.superseded.length}${liveNote}, celkem zváženo: ${res.total}.`);
      for (const r of res.reverted)   console.log(`  ↩ [#${r.id}] ${r.knob} ${r.forum_name || r.forum_id}: ${r.new_json} → ${r.old_json}`);
      for (const r of res.superseded) console.log(`  ⏭ [#${r.id}] ${r.knob} ${r.forum_name || r.forum_id}: ponecháno (novější hodnota)`);
      for (const f of res.liveFailed) console.log(`  ⚠ [#${f.id}] ${f.label}: živý řádek zůstal 'rejected' (${f.reason}) — ponecháno OTEVŘENÉ, spusť --revert znovu`);
    }
  } finally {
    state.close();
  }
}

const invokedDirectly = (() => {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
if (invokedDirectly) await main();
