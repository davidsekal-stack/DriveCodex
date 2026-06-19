/**
 * forum-profiles.mjs — autoritativní per-fórum profily.
 *
 * Některá fóra (custom enginy, netypický tvar URL vláken, layout, který
 * generická LLM kalibrace nezvládne) je výhodnější popsat RUČNĚ jednou a pak
 * je agent jen čte. Když profil pro dané fórum existuje, calibrateForum ho
 * použije přímo — naseeduje sekce + selektory + parser do forums.* a PŘESKOČÍ
 * automatickou kalibraci (LLM discovery + probe).
 *
 * Profily jsou v [`forum-profiles.json`](./forum-profiles.json) (verzované).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILES_PATH = join(__dirname, 'forum-profiles.json');

/** Doména bez www., malými písmeny; '' při nevalidní URL. */
export function domainOf(url) {
  try {
    return new URL(String(url)).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

let cached = null;

/** Načte a zvaliduje profily (cachované). Vrací pole profilů. */
export function loadProfiles(fileImpl = readFileSync, path = PROFILES_PATH) {
  if (cached) return cached;
  let parsed;
  try {
    parsed = JSON.parse(fileImpl(path, 'utf-8'));
  } catch {
    cached = [];
    return cached;
  }
  const list = Array.isArray(parsed?.profiles) ? parsed.profiles : [];
  cached = list.filter((p) => p && typeof p.match === 'string' && p.match.trim());
  return cached;
}

/** Reset cache (pro testy). */
export function _resetCache() {
  cached = null;
}

/**
 * Vrátí profil pro dané URL fóra (shoda na doméně, případně na předponě URL
 * uvedené v `match`), nebo null. Delší/přesnější match vyhrává.
 */
export function getForumProfile(url, profiles = loadProfiles()) {
  const u = String(url ?? '');
  const dom = domainOf(u);
  // Forma bez schématu a www pro porovnání s URL-předponovým `match`
  // (např. "example.com/forum/"), který schéma neobsahuje.
  const uNoScheme = u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').toLowerCase();
  let best = null;
  for (const p of profiles) {
    const m = p.match.toLowerCase().replace(/^www\./, '');
    const isUrlMatch = m.includes('/') && uNoScheme.startsWith(m);
    const isDomMatch = !m.includes('/') && !!dom && (dom === m || dom.endsWith('.' + m));
    if (isUrlMatch || isDomMatch) {
      if (!best || p.match.length > best.match.length) best = p;
    }
  }
  return best;
}

/**
 * Aplikuje profil na fórum v lokálním stavu: naseeduje parser, sekce a
 * kalibrační selektory a označí fórum jako připravené ke crawlu (status
 * 'queued', calibration_status 'profile'). Idempotentní.
 */
export function applyProfileToForum(state, forumId, profile) {
  // calibration_status MUSÍ být 'calibrated' (ne vlastní 'profile') — crawl
  // phase i pool-counter v orchestrator.mjs propouštějí jen 'calibrated' a
  // #repairCalibrationState by jiný stav stejně přepsal. Profilované fórum JE
  // kalibrované, jen z autoritativního zdroje; provenance držíme v
  // calibration_json (_profile), ať je dohledatelná bez nového stavu.
  const calibration = { ...(profile.calibration || {}), _profile: profile.match };
  state.updateForum(forumId, {
    parser: profile.engine || 'generic',
    sections_json: JSON.stringify(profile.sections || []),
    calibration_json: JSON.stringify(calibration),
    calibration_status: 'calibrated',
    calibration_attempts: 0,
    status: 'queued',
    cooldown_until: null,
    // Keep the coach's yield-tier markers consistent with cooldown_until (here: none).
    cooldown_tier_hours: null,
    cooldown_set_at: null,
  });
}
