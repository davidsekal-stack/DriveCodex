/**
 * Unit testy — autoritativní per-fórum profily + navazující mechanika:
 *   - getForumProfile / loadProfiles (scripts/agent/forum-profiles.mjs)
 *   - makeThreadUrlFilter (scripts/agent/crawl.mjs) — vzor URL vláken z profilu
 *   - selectPosts header_selector (parsers/common.mjs) — autor z hlavičky-sourozence
 *
 * Spuštění:  node --experimental-sqlite tests/agent-forum-profiles.test.js
 */

import assert from 'node:assert/strict';
import { getForumProfile, loadProfiles, domainOf, _resetCache } from '../scripts/agent/forum-profiles.mjs';
import { makeThreadUrlFilter, isLikelyThreadUrl } from '../scripts/agent/crawl.mjs';
import { selectPosts } from '../scripts/agent/parsers/common.mjs';

// ── domainOf ─────────────────────────────────────────────────────────────────
assert.equal(domainOf('https://www.bmw-syndikat.de/bmwsyndikatforum/'), 'bmw-syndikat.de');
assert.equal(domainOf('http://Forum.Example.COM/x'), 'forum.example.com');
assert.equal(domainOf('not a url'), '');

// ── getForumProfile — shoda na doméně / předponě URL, nejdelší vyhrává ────────
const PROFILES = [
  { match: 'bmw-syndikat.de', name: 'BMW' },
  { match: 'example.com/forum/', name: 'ExURL' },
  { match: 'example.com', name: 'ExDom' },
];
assert.equal(getForumProfile('https://www.bmw-syndikat.de/bmwsyndikatforum/', PROFILES).name, 'BMW');
assert.equal(getForumProfile('https://example.com/other', PROFILES).name, 'ExDom');
// doména i URL-předpona sedí → vyhrává delší (přesnější) match
assert.equal(getForumProfile('https://example.com/forum/x', PROFILES).name, 'ExURL');
assert.equal(getForumProfile('https://nope.org', PROFILES), null);
assert.equal(getForumProfile('', PROFILES), null);

// ── makeThreadUrlFilter — profilový vzor je autoritativní ────────────────────
const fBmw = makeThreadUrlFilter({ thread_url_pattern: '/topic\\d+_.*\\.html' });
assert.equal(fBmw('/bmwsyndikatforum/topic408525_320d_startet_nicht.html'), true);
assert.equal(fBmw('/bmwsyndikatforum/pop_profile.asp?id=1'), false);
assert.equal(fBmw('/bmwsyndikatforum/forum13_3er_BMW_-_E46.html'), false);
// generická heuristika ten tvar NEpozná (to byl ten bug) — profil ho opravuje
assert.equal(isLikelyThreadUrl('/bmwsyndikatforum/topic408525_x.html'), false);
// bez vzoru → fallback na isLikelyThreadUrl
const fGen = makeThreadUrlFilter({});
assert.equal(fGen('/forum/threads/foo.123/'), true);
assert.equal(fGen('/bmwsyndikatforum/topic408525_x.html'), false);
// nevalidní regex → fallback (nesmí spadnout)
const fBad = makeThreadUrlFilter({ thread_url_pattern: '([' });
assert.equal(typeof fBad, 'function');
assert.equal(fBad('/forum/threads/x/'), true);

// ── selectPosts header_selector — autor z odděleného hlavičkového bloku ──────
const SPLIT_HTML = `
<div class="headline_big_show"><span class="forum_show_headline1"><a href="/p?id=1">Alice</a></span></div>
<div class="forum_show_outer">
  <div class="forum_show_left">Mitglied seit 2005 Deutschland 1234 Beitraege sidebar-noise</div>
  <div class="forum_show_main_top">Alice popisuje zavadu: motor obcas nestartuje za studena, kontrolka sviti.</div>
</div>
<div class="headline_big_show"><span class="forum_show_headline1"><a href="/p?id=2">Bob</a></span></div>
<div class="forum_show_outer">
  <div class="forum_show_main_top">Bob potvrzuje opravu: vymena snimace klikove hridele problem vyresila.</div>
</div>`;
const SPLIT_CAL = {
  post_selector: 'div.forum_show_outer',
  header_selector: 'div.headline_big_show',
  author_selector: 'span.forum_show_headline1 a',
  content_selector: 'div.forum_show_main_top',
  min_post_length: 20,
};
const splitPosts = selectPosts(SPLIT_HTML, SPLIT_CAL, 1);
assert.equal(splitPosts.length, 2, 'oba příspěvky spárovány');
assert.equal(splitPosts[0].author, 'Alice');
assert.equal(splitPosts[1].author, 'Bob');
// tělo = zpráva z forum_show_main_top, BEZ šumu z postranního panelu
assert.ok(splitPosts[0].text.includes('motor obcas nestartuje'));
assert.ok(!splitPosts[0].text.includes('sidebar-noise'), 'postranní panel se do textu nedostane');
assert.ok(splitPosts[1].text.includes('vymena snimace'));

// ── selectPosts BEZ header_selector — beze změny (autor z těla) ──────────────
const INLINE_HTML = `<div class="post"><a class="user">Carol</a><div class="msg">Carol pise dostatecne dlouhou zpravu o vadnych brzdach na dalnici.</div></div>`;
const inlinePosts = selectPosts(INLINE_HTML, { post_selector: 'div.post', author_selector: 'a.user', content_selector: 'div.msg', min_post_length: 20 }, 1);
assert.equal(inlinePosts.length, 1);
assert.equal(inlinePosts[0].author, 'Carol');
assert.ok(inlinePosts[0].text.includes('vadnych brzdach'));

// ── applyProfileToForum — fórum je crawl-ready ('calibrated') + provenance ───
import { applyProfileToForum } from '../scripts/agent/forum-profiles.mjs';
{
  let captured = null;
  const fakeState = { updateForum: (id, patch) => { captured = { id, patch }; } };
  applyProfileToForum(fakeState, 'fid', { match: 'x.com', engine: 'generic', sections: ['https://x.com/s1'], calibration: { post_selector: 'div.p' } });
  // MUSÍ být 'calibrated', jinak ho phaseCrawl nevezme (review finding HIGH)
  assert.equal(captured.patch.calibration_status, 'calibrated');
  assert.equal(captured.patch.status, 'queued');
  assert.equal(captured.patch.parser, 'generic');
  const cal = JSON.parse(captured.patch.calibration_json);
  assert.equal(cal.post_selector, 'div.p');
  assert.equal(cal._profile, 'x.com', 'provenance marker zachován');
  assert.deepEqual(JSON.parse(captured.patch.sections_json), ['https://x.com/s1']);
}

// ── makeThreadUrlFilter — strop délky URL (ReDoS obrana) ─────────────────────
{
  const f = makeThreadUrlFilter({ thread_url_pattern: '/topic\\d+_.*\\.html' });
  const longUrl = '/topic1_' + 'a'.repeat(5000) + '.html';
  assert.equal(f(longUrl), false, 'přehnaně dlouhé URL se zahodí bez testování');
}

// ── Reálný profil BMW-Syndikat je dobře formovaný ────────────────────────────
_resetCache();
const real = loadProfiles();
const bmw = getForumProfile('https://www.bmw-syndikat.de/bmwsyndikatforum/', real);
assert.ok(bmw, 'BMW-Syndikat profil existuje');
assert.equal(bmw.calibration.post_selector, 'div.forum_show_outer');
assert.equal(bmw.calibration.header_selector, 'div.headline_big_show');
assert.ok(Array.isArray(bmw.sections) && bmw.sections.length >= 5, 'má aspoň 5 sekcí');
assert.ok(bmw.calibration.thread_url_pattern, 'má vzor URL vláken');

console.log('agent-forum-profiles.test.js passed');
