#!/usr/bin/env node --experimental-sqlite
/**
 * seed-known-forums.mjs — Pre-populate the agent database with forums
 * that have already been crawled by the forum-seed scripts.
 *
 * These forums get status "exhausted" with a long cooldown so the agent
 * doesn't re-crawl them and create duplicates.
 *
 * Usage:
 *   node --experimental-sqlite scripts/agent/seed-known-forums.mjs
 */

import { AgentState } from './state.mjs';

// All forums already processed by existing forum-seed-*.mjs scripts
const KNOWN_FORUMS = [
  // ── Czech & EU brand clubs (Invision-based) ──
  {
    url: 'https://www.skoda-club.net/forum',
    name: 'Škoda Club',
    brand: 'Škoda',
    language: 'cs',
    parser: 'invision',
  },
  {
    url: 'https://forum.skodahome.cz/forum',
    name: 'ŠkodaHome',
    brand: 'Škoda',
    language: 'cs',
    parser: 'invision',
  },
  {
    url: 'https://www.audiclub.eu',
    name: 'Audi Club EU',
    brand: 'Audi',
    language: 'cs',
    parser: 'invision',
  },
  {
    url: 'https://www.fordclub.eu',
    name: 'Ford Club EU',
    brand: 'Ford',
    language: 'cs',
    parser: 'invision',
  },
  {
    url: 'https://www.peugeotclub.eu',
    name: 'Peugeot Club EU',
    brand: 'Peugeot',
    language: 'cs',
    parser: 'invision',
  },
  {
    url: 'https://cs.renault-club.cz',
    name: 'Renault Club CZ',
    brand: 'Renault',
    language: 'cs',
    parser: 'invision',
  },
  {
    url: 'https://www.citroen-club.cz/forum',
    name: 'Citroën Club CZ',
    brand: 'Citroën',
    language: 'cs',
    parser: 'invision',
  },
  {
    url: 'https://www.bmw-club.cz/forum',
    name: 'BMW Club CZ',
    brand: 'BMW',
    language: 'cs',
    parser: 'invision',
  },
  {
    url: 'https://www.club-opel.com/forum',
    name: 'Club Opel',
    brand: 'Opel',
    language: 'cs',
    parser: 'invision',
  },
  {
    url: 'https://www.seatclub.cz/forum',
    name: 'SEAT Club CZ',
    brand: 'Seat',
    language: 'cs',
    parser: 'invision',
  },
  {
    url: 'https://www.daciaclub.cz/forum',
    name: 'Dacia Club CZ',
    brand: 'Dacia',
    language: 'cs',
    parser: 'invision',
  },
  {
    url: 'https://www.mercedesclub.cz/forum',
    name: 'Mercedes Club CZ',
    brand: 'Mercedes-Benz',
    language: 'cs',
    parser: 'invision',
  },
  {
    url: 'https://www.nissanclub.cz/forum',
    name: 'Nissan Club CZ',
    brand: 'Nissan',
    language: 'cs',
    parser: 'invision',
  },
  {
    url: 'https://cs.tesla-club.eu/forum',
    name: 'Tesla Club EU (CS)',
    brand: 'Tesla',
    language: 'cs',
    parser: 'invision',
  },
  {
    url: 'https://www.toyota-club.eu/forum',
    name: 'Toyota Club EU (CS)',
    brand: 'Toyota',
    language: 'cs',
    parser: 'invision',
  },
  {
    url: 'https://en.toyota-club.eu/forum',
    name: 'Toyota Club EU (EN)',
    brand: 'Toyota',
    language: 'en',
    parser: 'invision',
  },
  {
    url: 'https://www.vw-club.cz/volkswagen/',
    name: 'VW Club CZ',
    brand: 'Volkswagen',
    language: 'cs',
    parser: 'invision',
  },

  // ── XenForo / phpBB ──
  {
    url: 'https://www.hyundai-club.eu/forums/',
    name: 'Hyundai Club EU',
    brand: 'Hyundai',
    language: 'cs',
    parser: 'xenforo',
  },
  {
    url: 'https://fordtransit.org/forum',
    name: 'Ford Transit Forum',
    brand: 'Ford',
    language: 'en',
    parser: 'phpbb',
  },
];

// 30 day cooldown for already-exhausted forums
const COOLDOWN_DAYS = 30;

function main() {
  const state = new AgentState();
  const cooldownUntil = new Date(Date.now() + COOLDOWN_DAYS * 24 * 3600_000).toISOString();

  let added = 0;
  let skipped = 0;

  for (const forum of KNOWN_FORUMS) {
    const existing = state.getForumByUrl(forum.url);
    if (existing) {
      console.log(`  skip (exists): ${forum.name}`);
      skipped++;
      continue;
    }

    const id = state.addForum({
      url: forum.url,
      name: forum.name,
      brand: forum.brand,
      language: forum.language,
      parser: forum.parser,
    });

    state.updateForum(id, {
      status: 'exhausted',
      calibration_status: 'calibrated',
      cooldown_until: cooldownUntil,
    });

    console.log(`  ✓ ${forum.name} (${forum.brand}) → exhausted, cooldown until ${cooldownUntil.slice(0, 10)}`);
    added++;
  }

  console.log(`\nDone: ${added} added, ${skipped} already existed.`);
  console.log(`Total forums in DB: ${state.getStats().forums}`);
  state.close();
}

main();
