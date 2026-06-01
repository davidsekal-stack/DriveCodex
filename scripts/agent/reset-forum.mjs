/**
 * reset-forum.mjs — Reset a forum's calibration so it can be retried.
 *
 * Usage:
 *   node --experimental-sqlite reset-forum.mjs <forum-id-or-url-substring>
 *   node --experimental-sqlite reset-forum.mjs --all-failed
 */

import { AgentState } from './state.mjs';

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node --experimental-sqlite reset-forum.mjs <id|url-substring|--all-failed>');
  process.exit(1);
}

const state = new AgentState();

function resetForum(forum) {
  state.updateForum(forum.id, {
    status: 'discovered',
    calibration_status: null,
    calibration_attempts: 0,
    calibration_json: null,
    sections_json: '[]',
  });
  console.log(`  Reset: [${forum.id}] ${forum.name} (was: ${forum.status})`);
}

if (arg === '--all-failed') {
  const all = state.getAllForums ? state.getAllForums() : [];
  const failed = all.filter(f => f.status === 'calibration_failed' || f.calibration_status === 'failed');
  if (failed.length === 0) {
    console.log('No calibration_failed forums found.');
  } else {
    failed.forEach(resetForum);
    console.log(`\nReset ${failed.length} forum(s).`);
  }
} else {
  // Try by numeric id first, then URL substring
  const all = state.getAllForums ? state.getAllForums() : [];
  const match = all.find(f =>
    String(f.id) === arg ||
    (f.url || '').includes(arg) ||
    (f.name || '').toLowerCase().includes(arg.toLowerCase())
  );
  if (!match) {
    console.error(`No forum found matching: ${arg}`);
    console.log('Available forums:');
    all.forEach(f => console.log(`  [${f.id}] ${f.name} — ${f.url} (${f.status})`));
    process.exit(1);
  }
  resetForum(match);
}
