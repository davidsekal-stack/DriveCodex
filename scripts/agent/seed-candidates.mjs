#!/usr/bin/env node --experimental-sqlite
/**
 * seed-candidates.mjs — Import forum-candidates.json into agent.db.
 *
 * Usage:
 *   node --experimental-sqlite scripts/agent/seed-candidates.mjs
 */

import { AgentState } from './state.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const candidates = JSON.parse(
  readFileSync(join(__dirname, 'forum-candidates.json'), 'utf-8')
);

function main() {
  const state = new AgentState();
  let added = 0;
  let skipped = 0;

  for (const f of candidates) {
    const existing = state.getForumByUrl(f.url);
    if (existing) {
      console.log(`  skip (exists): ${f.name} [${existing.status}]`);
      skipped++;
      continue;
    }

    const id = state.addForum({
      url: f.url,
      name: f.name,
      brand: f.brands?.join(', ') || null,
      language: f.language,
      parser: f.parser || 'generic',
    });

    console.log(`  ✓ #${f.rank} ${f.name} (${f.language}, ${f.parser})`);
    added++;
  }

  console.log(`\nDone: ${added} added, ${skipped} already in DB.`);
  console.log('Run the agent with:');
  console.log('  node --experimental-sqlite scripts/agent/orchestrator.mjs --phase calibrate');
  state.close();
}

main();
