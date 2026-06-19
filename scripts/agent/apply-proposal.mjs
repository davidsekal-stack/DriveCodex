/**
 * apply-proposal.mjs — undo tool for the daily coach's Phase 2 auto-tier changes.
 *
 * The coach applies only reversible knobs (priority_score, cooldown timing) and
 * journals each one in coach_journal with the exact pre-change column values. This
 * tool rolls them back, newest-first, using COMPARE-AND-SWAP: it restores a change
 * only if the forum STILL holds the value the coach wrote — if the engine or a human
 * has since changed it, the row is closed out without clobbering the newer value.
 *
 * Re-calibration is NOT applied automatically in Phase 2 (it is a shadow proposal
 * only), so there is nothing of that kind to revert here. Applying risky proposals
 * (prompts/thresholds) is a Phase 4 deliverable, deliberately not built yet.
 *
 * Usage:
 *   node --experimental-sqlite apply-proposal.mjs --list   [--date Y-M-D] [--forum <id|url|name>] [--knob priority|cooldown]
 *   node --experimental-sqlite apply-proposal.mjs --revert [--date Y-M-D] [--forum <id|url|name>] [--knob priority|cooldown] [--dry-run]
 */

import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { AgentState } from './state.mjs';

/** Normalise a value for cross-source (SQLite vs JSON) equality. */
function eq(a, b) { return String(a ?? null) === String(b ?? null); }

/**
 * Revert applied coach changes (newest-first) with compare-and-swap. PURE w.r.t.
 * time (no Date.now); idempotent (reverted rows are filtered out by the query).
 * @returns {{reverted:Array, superseded:Array, total:number}}
 */
export function revertCoachChanges(state, { date = null, forumId = null, knob = null } = {}, { dryRun = false } = {}) {
  const rows = state.getRevertableCoachChanges({ date, forumId, knob });
  const result = { reverted: [], superseded: [], total: rows.length };
  for (const r of rows) {
    let newVals, oldVals;
    try { newVals = JSON.parse(r.new_json || '{}'); oldVals = JSON.parse(r.old_json || '{}'); }
    catch { continue; }
    const forum = state.getForum(r.forum_id);
    const stillHolds = forum && Object.keys(newVals).every(k => eq(forum[k], newVals[k]));
    if (!stillHolds) {
      result.superseded.push(r);
      if (!dryRun) {
        state.markCoachReverted(r.id);
        state.log('info', `coach revert #${r.id} ${r.knob} ${r.forum_name || r.forum_id}: superseded by a newer value — left as is`, 'coach');
      }
      continue;
    }
    if (!dryRun) {
      state.updateForum(r.forum_id, oldVals);
      state.markCoachReverted(r.id);
      state.log('info', `coach revert #${r.id} ${r.knob} ${r.forum_name || r.forum_id}: ${r.new_json} → ${r.old_json}`, 'coach');
    }
    result.reverted.push(r);
  }
  return result;
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

const USAGE = `apply-proposal.mjs — vrácení automatických úprav denního kouče (Fáze 2).

Použití:
  node --experimental-sqlite apply-proposal.mjs --list   [--date RRRR-MM-DD] [--forum <id|část-url|název>] [--knob priority|cooldown]
  node --experimental-sqlite apply-proposal.mjs --revert [--date RRRR-MM-DD] [--forum <id|část-url|název>] [--knob priority|cooldown] [--dry-run]

Bez filtru se --revert vrátí VŠECHNY dosud nevrácené automatické úpravy (od nejnovější).
(Aplikace rizikových návrhů promptů/prahů přijde ve Fázi 4 — zde se neřeší.)`;

async function main() {
  const args = process.argv.slice(2);
  const doRevert = args.includes('--revert');
  const doList = args.includes('--list');
  const dryRun = args.includes('--dry-run');
  const date = argVal(args, '--date');
  const knob = argVal(args, '--knob');
  const forumArg = argVal(args, '--forum');

  if (!doRevert && !doList) { console.log(USAGE); return; }

  const state = new AgentState();
  try {
    let forumId = null;
    if (forumArg) {
      forumId = resolveForumId(state, forumArg);
      if (!forumId) { console.error(`Žádné fórum neodpovídá: ${forumArg}`); process.exitCode = 1; return; }
    }

    if (doList) {
      const rows = state.getRevertableCoachChanges({ date, forumId, knob });
      if (rows.length === 0) console.log('Žádné vratné automatické úpravy.');
      else {
        console.log(`Vratné automatické úpravy (${rows.length}):`);
        for (const r of rows) console.log(`  [#${r.id}] ${r.date}  ${r.knob} ${r.direction || ''}  ${r.forum_name || r.forum_id}: ${r.old_json} → ${r.new_json}`);
      }
      if (!doRevert) return;
    }

    if (doRevert) {
      const res = revertCoachChanges(state, { date, forumId, knob }, { dryRun });
      const tag = dryRun ? '(zkušebně, nic neměním) ' : '';
      console.log(`${tag}Vráceno: ${res.reverted.length}, přeskočeno (mezitím změněno jinde): ${res.superseded.length}, celkem zváženo: ${res.total}.`);
      for (const r of res.reverted)   console.log(`  ↩ [#${r.id}] ${r.knob} ${r.forum_name || r.forum_id}: ${r.new_json} → ${r.old_json}`);
      for (const r of res.superseded) console.log(`  ⏭ [#${r.id}] ${r.knob} ${r.forum_name || r.forum_id}: ponecháno (novější hodnota)`);
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
