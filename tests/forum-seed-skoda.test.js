import assert from "node:assert/strict";

import {
  classifySkodaTopicEntry,
  discoverSkodaRootCategoriesFromRoot,
  parseArgs,
  resolveSkodaVehicleModel,
} from "../scripts/forum-seed-skoda.mjs";

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

console.log("\n== forum-seed-skoda ==");

test("parseArgs uses the Skoda root forum by default", () => {
  const args = parseArgs(["out_dir", "--discover-only", "--signals-only", "--min-posts", "4"]);
  assert.equal(args.discoverOnly, true);
  assert.equal(args.signalsOnly, true);
  assert.equal(args.minPosts, 4);
  assert.deepEqual(args.inputs, ["https://www.skoda-club.net/forum"]);
});

test("classifySkodaTopicEntry drops obvious noise and keeps clear fault titles", () => {
  assert.equal(classifySkodaTopicEntry({ title: "Octavia III 2.0 TDI DSG vibration when cold", postCount: 6 }).keep, true);
  assert.equal(classifySkodaTopicEntry({ title: "Owners manual", postCount: 9 }).keep, false);
  assert.equal(classifySkodaTopicEntry({ title: "Jaký olej do převodovky?", postCount: 8 }).keep, false);
  assert.equal(classifySkodaTopicEntry({ title: "Emise", postCount: 8 }).keep, false);
  assert.equal(classifySkodaTopicEntry({ title: "Chladici zmes", postCount: 5 }).keep, false);
  assert.equal(classifySkodaTopicEntry({ title: "Posunuty volant", postCount: 4 }).keep, false);
  assert.equal(classifySkodaTopicEntry({ title: "Kód rádia", postCount: 8 }).keep, false);
  assert.equal(classifySkodaTopicEntry({ title: "Skoda Scala tazne zarizeni", postCount: 6 }).keep, false);
  assert.equal(classifySkodaTopicEntry({ title: "Skoda Scala, kod barvy", postCount: 6 }).keep, false);
  assert.equal(classifySkodaTopicEntry({ title: "Rádio", postCount: 8 }).keep, false);
  assert.equal(classifySkodaTopicEntry({ title: "Need help", postCount: 1 }).keep, false);
});

test("discoverSkodaRootCategoriesFromRoot keeps conservative 2000+ Skoda forums", () => {
  const html = `
    <a href="https://www.skoda-club.net/forum-kategorie/fabia-ii-27">Fabia II</a>
    <a href="https://www.skoda-club.net/forum-kategorie/octavia-iv-55">Octavia IV</a>
    <a href="https://www.skoda-club.net/forum-kategorie/kodiaq-59">Kodiaq</a>
    <a href="https://www.skoda-club.net/forum-kategorie/enyaq-54">Enyaq</a>
    <a href="https://www.skoda-club.net/forum-kategorie/rapid-35">Rapid</a>
    <a href="https://www.skoda-club.net/forum-kategorie/rapid-43">Rapid</a>
    <a href="https://www.skoda-club.net/forum-kategorie/fabia-i-17">Fabia I</a>
    <a href="https://www.skoda-club.net/forum-kategorie/octavia-i-18">Octavia I</a>
    <a href="https://www.skoda-club.net/forum-kategorie/superb-i-20">Superb I</a>
    <a href="https://www.skoda-club.net/forum-kategorie/kushaq-56">Kushaq</a>
    <a href="https://www.skoda-club.net/forum-kategorie/technicky-koutek-6">Technický koutek</a>
    <a href="https://www.skoda-club.net/forum-kategorie/favorit-15">Favorit</a>
  `;

  const categories = discoverSkodaRootCategoriesFromRoot({
    rootUrl: "https://www.skoda-club.net/forum",
    rootHtml: html,
  });

  const fabia2 = categories.find((entry) => entry.forum_url.includes("fabia-ii-27"));
  const octavia4 = categories.find((entry) => entry.forum_url.includes("octavia-iv-55"));
  const kodiaq = categories.find((entry) => entry.forum_url.includes("kodiaq-59"));
  const enyaq = categories.find((entry) => entry.forum_url.includes("enyaq-54"));
  const rapidLegacy = categories.find((entry) => entry.forum_url.includes("rapid-35"));
  const rapidModern = categories.find((entry) => entry.forum_url.includes("rapid-43"));
  const fabia1 = categories.find((entry) => entry.forum_url.includes("fabia-i-17"));
  const octavia1 = categories.find((entry) => entry.forum_url.includes("octavia-i-18"));
  const superb1 = categories.find((entry) => entry.forum_url.includes("superb-i-20"));
  const kushaq = categories.find((entry) => entry.forum_url.includes("kushaq-56"));
  const tech = categories.find((entry) => entry.forum_url.includes("technicky-koutek-6"));
  const favorit = categories.find((entry) => entry.forum_url.includes("favorit-15"));

  assert.equal(fabia2.keep, true);
  assert.equal(fabia2.resolved_model, "Fabia II (2007–2014)");
  assert.equal(octavia4.keep, true);
  assert.equal(octavia4.forum_type, "model_family");
  assert.deepEqual(octavia4.candidate_models, ["Octavia IV (2020–2024)", "Octavia IV FL (2024–dosud)"]);
  assert.equal(kodiaq.keep, true);
  assert.equal(kodiaq.forum_type, "model_family");
  assert.deepEqual(kodiaq.candidate_models, ["Kodiaq I (2016–2024)", "Kodiaq II (2024–dosud)"]);
  assert.equal(enyaq.keep, true);
  assert.equal(enyaq.resolved_model, "Enyaq iV (2021–)");
  assert.equal(rapidLegacy.keep, false);
  assert.equal(rapidModern.keep, true);
  assert.equal(rapidModern.resolved_model, "Rapid (2012–2019)");
  assert.equal(fabia1.keep, false);
  assert.equal(octavia1.keep, false);
  assert.equal(superb1.keep, false);
  assert.equal(kushaq.keep, false);
  assert.equal(tech.keep, false);
  assert.equal(favorit.keep, false);
});

test("resolveSkodaVehicleModel uses year hints on generic family forums", () => {
  const kodiaq2 = resolveSkodaVehicleModel({
    modelRaw: "Kodiaq",
    threadTitle: "2025 Kodiaq 2.0 TDI ACC error",
    parentForumTitle: "Kodiaq - Fórum - Škoda klub",
    subforumUrl: "https://www.skoda-club.net/forum-kategorie/kodiaq-59",
  });
  assert.equal(kodiaq2, "Kodiaq II (2024–dosud)");

  const kodiaq1 = resolveSkodaVehicleModel({
    modelRaw: "Kodiaq",
    threadTitle: "2019 Kodiaq 2.0 TDI DSG judder",
    parentForumTitle: "Kodiaq - Fórum - Škoda klub",
    subforumUrl: "https://www.skoda-club.net/forum-kategorie/kodiaq-59",
  });
  assert.equal(kodiaq1, "Kodiaq I (2016–2024)");

  const genericKodiaq = resolveSkodaVehicleModel({
    modelRaw: "Kodiaq",
    threadTitle: "Spojkovy pedal mi dnes zustal v polovine",
    parentForumTitle: "Kodiaq - Fórum - Škoda klub",
    subforumUrl: "https://www.skoda-club.net/forum-kategorie/kodiaq-59",
  });
  assert.equal(genericKodiaq, "Kodiaq I (2016–2024)");

  const kodiaqScout = resolveSkodaVehicleModel({
    modelRaw: "Kodiaq Scout",
    threadTitle: "Chyba kontrolka motoru",
    parentForumTitle: "Kodiaq - Fórum - Škoda klub",
    subforumUrl: "https://www.skoda-club.net/forum-kategorie/kodiaq-59",
  });
  assert.equal(kodiaqScout, "Kodiaq I (2016–2024)");

  const octavia4fl = resolveSkodaVehicleModel({
    modelRaw: "Octavia IV",
    threadTitle: "2025 Octavia facelift 1.5 TSI lane assist fault",
    parentForumTitle: "Octavia IV - Fórum - Škoda klub",
    subforumUrl: "https://www.skoda-club.net/forum-kategorie/octavia-iv-55",
  });
  assert.equal(octavia4fl, "Octavia IV FL (2024–dosud)");

  const ambiguousOctavia4 = resolveSkodaVehicleModel({
    modelRaw: "Octavia IV",
    threadTitle: "Octavia IV vibration from rear axle",
    parentForumTitle: "Octavia IV - Fórum - Škoda klub",
    subforumUrl: "https://www.skoda-club.net/forum-kategorie/octavia-iv-55",
  });
  assert.equal(ambiguousOctavia4, "Octavia IV (2020–2024)");
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
