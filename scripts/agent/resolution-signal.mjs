/**
 * resolution-signal.mjs — Resolution-signal scoring for the CALIBRATION probe.
 *
 * Why this exists: the calibration probe must measure a forum's TRUE potential to
 * yield resolved cases. Forum listings are ordered newest-first, and the newest
 * threads are brand-new, unanswered questions that structurally cannot contain a
 * confirmed resolution. Sampling them makes the classifier pass rate 0% and good
 * forums fail calibration (observed repeatedly: the calibrate LLM diagnosed it,
 * and AutoForum.cz only passed once resolution-signal title pre-filtering was
 * added). This module scores thread links by language-aware, diacritic-folded
 * resolution markers in the title so the probe can prioritise likely-resolved
 * threads.
 *
 * SCOPE: this is a CALIBRATION-ONLY heuristic. It is deliberately NOT used by the
 * production crawl sampler — that one stays random because its sampled set feeds
 * the exhaustion/cooldown math (computeCooldown in orchestrator.mjs); a
 * deterministic bias there would re-pick the same threads every batch and trip a
 * premature "exhausted" cooldown. Here it is a weak PRIOR, never a hard filter:
 * pickCalibrationSample always fills the sample from unscored threads, so probe
 * coverage is never reduced — at worst we waste a probe slot on a mislabeled
 * (e.g. spam "[VYŘEŠENO]") thread, which the downstream gates still reject.
 */

// Resolution markers with natural diacritics (folded at match time, so both
// "vyřešeno" and "vyreseno" match). Keyed by language; an English set is always
// applied too because EU forums mix languages and English markers leak in.
const RESOLUTION_KEYWORDS = {
  cs: ['vyřešeno', 'vyrešeno', 'vyřešené', 'opraveno', 'opravené', 'spraveno', 'pomohlo', 'funguje', 'hotovo', 'vyřešil', 'vyřešilo'],
  sk: ['vyriešené', 'vyriešené', 'opravené', 'funguje', 'pomohlo', 'hotovo'],
  de: ['gelöst', 'erledigt', 'behoben', 'repariert', 'funktioniert', 'lösung', 'geklärt'],
  en: ['solved', 'fixed', 'resolved', 'working', 'sorted', 'repaired', 'success'],
  pl: ['rozwiązane', 'naprawione', 'działa'],
  fr: ['résolu', 'réparé', 'fonctionne'],
  nl: ['opgelost', 'gerepareerd', 'werkt'],
};

const ALWAYS_APPLIED = 'en';

/**
 * Fold a string to a diacritic-insensitive, lowercase, alnum-token form.
 * Mirrors normalizeText() in validate.mjs (NFKD + strip combining marks).
 */
function fold(s) {
  return (s ?? '')
    .toString()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function keywordsForLanguage(language) {
  const lang = (language || '').toString().slice(0, 2).toLowerCase();
  const set = new Set(RESOLUTION_KEYWORDS[ALWAYS_APPLIED]);
  if (RESOLUTION_KEYWORDS[lang]) {
    for (const kw of RESOLUTION_KEYWORDS[lang]) set.add(kw);
  }
  return [...set];
}

/**
 * Score a thread title by how strongly it signals a resolved case.
 * Returns the number of distinct resolution keywords matched as whole tokens
 * (0 = no signal). Whole-token matching avoids false positives like "fixed"
 * inside "prefixed".
 *
 * @param {string} title
 * @param {string} [language] - forum language code (cs/de/en/...)
 * @returns {number}
 */
export function scoreResolutionSignal(title, language = '') {
  const folded = ` ${fold(title)} `;
  if (folded.trim() === '') return 0;
  let score = 0;
  for (const kw of keywordsForLanguage(language)) {
    const foldedKw = fold(kw);
    if (foldedKw && folded.includes(` ${foldedKw} `)) score++;
  }
  return score;
}

/**
 * Pick a calibration sample biased toward likely-resolved threads.
 *
 * Threads with a resolution signal come first (highest score first, original
 * order as tiebreak); the remainder is then appended in its original
 * (newest-first) order to fill up to `count`. This is a PRIOR, not a filter:
 * the returned length is always min(count, links.length), so coverage is never
 * reduced versus an unscored sample.
 *
 * @param {Array<{url:string,title?:string}>} links - enumerated thread links
 * @param {number} count - desired sample size
 * @param {string} [language]
 * @returns {Array<{url:string,title?:string}>}
 */
export function pickCalibrationSample(links, count, language = '') {
  const list = Array.isArray(links) ? links : [];
  if (count <= 0 || list.length === 0) return [];

  const scored = list.map((link, index) => ({
    link,
    index,
    score: scoreResolutionSignal(link?.title, language),
  }));

  const signal = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const rest = scored.filter(s => s.score === 0); // already in original order

  return [...signal, ...rest].slice(0, count).map(s => s.link);
}
