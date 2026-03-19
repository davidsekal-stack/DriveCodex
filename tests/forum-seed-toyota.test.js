import assert from "node:assert/strict";

import {
  extractPostsFromToyotaText,
  extractToyotaModelForumsFromRoot,
  extractToyotaTopicEntriesFromForumPage,
  looksLikeUsefulToyotaTopicTitle,
  parseToyotaForumYearRange,
  resolveToyotaVehicleModel,
  shouldKeepToyotaModelForum,
} from "../scripts/forum-seed-toyota.mjs";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  OK ${name}`);
    passed++;
  } catch (error) {
    console.error(`  FAIL ${name}`);
    console.error(`    ${error.message}`);
    failed++;
  }
}

console.log("\n== forum-seed-toyota ==");

test("parseToyotaForumYearRange reads English and Czech year lines", () => {
  const en = parseToyotaForumYearRange("Auris\n2007 - present\nFollow");
  assert.equal(en?.start, 2007);
  assert.ok(en?.end >= new Date().getFullYear());

  const cs = parseToyotaForumYearRange("Corolla\n2007 - dosud\nSledovat");
  assert.equal(cs?.start, 2007);
  assert.ok(cs?.end >= new Date().getFullYear());
});

test("shouldKeepToyotaModelForum keeps Auris and rejects old Carina", () => {
  assert.equal(shouldKeepToyotaModelForum({
    title: "Auris",
    url: "https://en.toyota-club.eu/forum-category/auris-14",
    yearRange: { start: 2007, end: 2026, text: "2007-present" },
  }), true);

  assert.equal(shouldKeepToyotaModelForum({
    title: "Carina",
    url: "https://en.toyota-club.eu/forum-category/carina-8",
    yearRange: { start: 1970, end: 2000, text: "1970-2000" },
  }), false);
});

test("extractToyotaModelForumsFromRoot finds Toyota model category links", () => {
  const html = `
    <a href="/forum-category/auris-14">Auris</a>
    <a href="/forum-category/rav-4-22">Rav 4</a>
    <a href="/forum-category/club-matters-7">Club matters</a>
    <a href="/forum-category/tech-corner-4">Tech corner</a>
  `;
  const forums = extractToyotaModelForumsFromRoot(html, "https://en.toyota-club.eu/forum");
  assert.deepEqual(
    forums.map(item => item.url),
    [
      "https://en.toyota-club.eu/forum-category/auris-14",
      "https://en.toyota-club.eu/forum-category/rav-4-22",
    ]
  );
});

test("looksLikeUsefulToyotaTopicTitle keeps fault titles and rejects manuals", () => {
  assert.equal(looksLikeUsefulToyotaTopicTitle("Auris 1.6 VVT-i oil leak"), true);
  assert.equal(looksLikeUsefulToyotaTopicTitle("Corolla 2020 chyba P264A"), true);
  assert.equal(looksLikeUsefulToyotaTopicTitle("Auris Manuals"), false);
  assert.equal(looksLikeUsefulToyotaTopicTitle("How to remove headliner"), false);
});

test("extractToyotaTopicEntriesFromForumPage filters out guide topics", () => {
  const html = `
    <a href="/forum-topic/auris-1-6-vvt-i-oil-leak-4369">Auris 1.6 VVT-i oil leak</a>
    <a href="/forum-topic/owners-manual-100">Owners manual</a>
    <a href="/forum-topic/how-to-remove-dome-light-200">How to remove dome light</a>
    <a href="/forum-topic/corolla-2020-chyba-p264a-500">Corolla 2020 chyba P264A</a>
  `;
  const topics = extractToyotaTopicEntriesFromForumPage(html, "https://en.toyota-club.eu/forum-category/auris-14");
  assert.deepEqual(
    topics.map(item => item.url),
    [
      "https://en.toyota-club.eu/forum-topic/auris-1-6-vvt-i-oil-leak-4369",
      "https://en.toyota-club.eu/forum-topic/corolla-2020-chyba-p264a-500",
    ]
  );
});

test("resolveToyotaVehicleModel uses year and engine hints", () => {
  const prius = resolveToyotaVehicleModel({
    modelRaw: "Prius",
    threadTitle: "Prius 2018 1.8 hybrid battery issue",
    parentForumTitle: "Forum Prius",
  });
  assert.equal(prius, "Prius IV (2016–2022)");

  const corollaCross = resolveToyotaVehicleModel({
    modelRaw: "Corolla Cross",
    threadTitle: "Corolla Cross 2023 2.0 Hybrid AWD vibration",
    parentForumTitle: "Forum Corolla Cross",
  });
  assert.equal(corollaCross, "Corolla Cross (2022–dosud)");
});

test("extractPostsFromToyotaText parses Czech and English style timestamps", () => {
  const html = `
    <div>Fandys</div>
    <div>2025-04-20 09:11:43</div>
    <div>Ahoj, chtěl bych se zeptat na počet žárovek. Na mé Corolla 2020 sedan svítí jedna couvací žárovka a druhá nesvítí.</div>
    <div>z80 Image</div>
    <div>2025-04-20 09:30:11</div>
    <div>Je to originální konstrukce auta, nejde o závadu.</div>
    <div>Pomohla Ti má rada? Získej VIP členství</div>
    <div>Fandys</div>
    <div>2025-04-20 11:44:35</div>
    <div>Mockrát děkuji. Poprvé vlastním Toyotu a stále se seznamujeme.</div>
  `;

  const posts = extractPostsFromToyotaText(html);
  assert.equal(posts.length, 3);
  assert.equal(posts[0].author, "Fandys");
  assert.equal(posts[1].author, "z80");
  assert.match(posts[2].text, /Mockrát děkuji/);
  assert.doesNotMatch(posts[1].text, /VIP členství/);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
