import assert from "node:assert/strict";

import {
  classifyVwSection,
  extractPostsFromVwText,
  extractVwModelForumsFromRoot,
  extractVwRelevantSections,
  extractVwTopicEntriesFromForumPage,
  looksLikeUsefulVwTopicTitle,
  parseForumYearRange,
  shouldKeepVwModelForum,
} from "../scripts/forum-seed-vw.mjs";

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

console.log("\n== forum-seed-vw ==");

test("parseForumYearRange reads forum year line", () => {
  const range = parseForumYearRange("Golf V / Jetta\n2004 - 2008\nModerátoři: ...");
  assert.equal(range?.start, 2004);
  assert.equal(range?.end, 2008);
});

test("shouldKeepVwModelForum keeps Golf V and rejects Golf IV", () => {
  assert.equal(shouldKeepVwModelForum({
    title: "Golf V / Jetta",
    url: "https://www.vw-club.cz/golf-v-jetta/",
    yearRange: { start: 2004, end: 2008, text: "2004-2008" },
  }), true);

  assert.equal(shouldKeepVwModelForum({
    title: "Golf IV / Bora",
    url: "https://www.vw-club.cz/golf-iv-bora/",
    yearRange: { start: 1997, end: 2006, text: "1997-2006" },
  }), false);
});

test("extractVwModelForumsFromRoot finds model forum links", () => {
  const html = `
    <a href="/golf-v-jetta/">Golf V / Jetta</a>
    <a href="/passat-3c-cc/">Passat 3C / CC</a>
    <a href="/golf5-motory-diesel/">Motory diesel</a>
    <a href="/faq.php">FAQ</a>
  `;
  const forums = extractVwModelForumsFromRoot(html, "https://www.vw-club.cz/volkswagen/");
  assert.deepEqual(
    forums.map(item => item.url),
    [
      "https://www.vw-club.cz/golf-v-jetta/",
      "https://www.vw-club.cz/passat-3c-cc/",
    ]
  );
});

test("classifyVwSection keeps diagnostic sections and rejects bazar", () => {
  assert.deepEqual(classifyVwSection("Motory - diesel"), { keep: true, kind: "motor-diesel" });
  assert.deepEqual(classifyVwSection("Interiér + Elektro"), { keep: true, kind: "interier-elektro" });
  assert.deepEqual(classifyVwSection("Podvozek a kola"), { keep: true, kind: "podvozek" });
  assert.deepEqual(classifyVwSection("Bazar"), { keep: false, kind: "" });
});

test("extractVwRelevantSections keeps only relevant child sections", () => {
  const html = `
    <div>
      <a href="/golf5-motory-diesel/">Motory - diesel</a>
      <a href="/golf5-interier-elektro/">Interiér + Elektro</a>
      <a href="/golf5-podvozek-a-kola/">Podvozek a kola</a>
      <a href="/golf5-bazar/">Bazar</a>
      <a href="/golf5-exterier-styling-tuning/">Exteriér + Styling + Tuning</a>
      Nové téma
      <a href="/faq.php">FAQ</a>
    </div>
  `;

  const sections = extractVwRelevantSections(html, "https://www.vw-club.cz/golf-v-jetta/");
  assert.deepEqual(
    sections.map(item => item.url),
    [
      "https://www.vw-club.cz/golf5-motory-diesel/",
      "https://www.vw-club.cz/golf5-interier-elektro/",
      "https://www.vw-club.cz/golf5-podvozek-a-kola/",
    ]
  );
});

test("looksLikeUsefulVwTopicTitle is stricter on root topics", () => {
  assert.equal(looksLikeUsefulVwTopicTitle("1.9 TDI PD 77kw škube", { kind: "root" }), true);
  assert.equal(looksLikeUsefulVwTopicTitle("Fotky našich mazlíků", { kind: "root" }), false);
  assert.equal(looksLikeUsefulVwTopicTitle("Blinkry", { kind: "interier-elektro" }), true);
});

test("extractVwTopicEntriesFromForumPage filters out bazar and manual topics", () => {
  const html = `
    <a href="/golf-v-jetta/1-9-tdi-pd-77kw-skube-t360634.html">1.9 TDI PD 77kw škube</a>
    <a href="/golf-v-jetta/navod-k-obsluze-golf-plus-t360700.html">Návod k obsluze Golf Plus</a>
    <a href="/golf-v-jetta/majitele-golfu-pokec-t999.html">Majitelé Golfu - pokec</a>
  `;
  const topics = extractVwTopicEntriesFromForumPage(html, "https://www.vw-club.cz/golf-v-jetta/", { kind: "root" });
  assert.deepEqual(
    topics.map(item => item.url),
    ["https://www.vw-club.cz/golf-v-jetta/1-9-tdi-pd-77kw-skube-t360634.html"]
  );
});

test("extractPostsFromVwText parses multi-user conversation", () => {
  const html = `
    <div>Příspěvek od UserA » 11.05.2013 23:36</div>
    <div>Motor zhasíná na volnoběh a auto cuká při dojezdu na křižovatku.</div>
    <div>Nahoru</div>
    <div>Příspěvek od UserB » 12.05.2013 08:10</div>
    <div>Zkus čidlo kliky.</div>
    <div>Nahoru</div>
    <div>Příspěvek od UserA » 13.05.2013 10:20</div>
    <div>Vyřešeno po výměně čidla kliky, motor už nezhasíná.</div>
    <div>Nahoru</div>
  `;

  const posts = extractPostsFromVwText(html);
  assert.equal(posts.length, 3);
  assert.equal(posts[0].author, "UserA");
  assert.match(posts[2].text, /Vyřešeno/);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
