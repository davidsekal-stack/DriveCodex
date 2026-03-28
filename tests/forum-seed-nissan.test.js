import assert from "node:assert/strict";

import {
  classifyNissanTopicEntry,
  discoverNissanRootCategoriesFromRoot,
  parseArgs,
  resolveNissanVehicleModel,
} from "../scripts/forum-seed-nissan.mjs";

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

console.log("\n== forum-seed-nissan ==");

test("parseArgs uses the Nissan root forum by default", () => {
  const args = parseArgs(["out_dir", "--discover-only", "--signals-only", "--min-posts", "3"]);
  assert.equal(args.discoverOnly, true);
  assert.equal(args.signalsOnly, true);
  assert.equal(args.minPosts, 3);
  assert.deepEqual(args.inputs, ["https://www.nissanclub.cz/forum"]);
});

test("classifyNissanTopicEntry drops manuals and low-value Nissan noise", () => {
  assert.equal(classifyNissanTopicEntry({ title: "Micra K12 oil leak", postCount: 4 }).keep, true);
  assert.equal(classifyNissanTopicEntry({ title: "Owners manual", postCount: 9 }).keep, false);
  assert.equal(classifyNissanTopicEntry({ title: "Jaký olej do převodovky?", postCount: 8 }).keep, false);
  assert.equal(classifyNissanTopicEntry({ title: "Kód radia", postCount: 12 }).keep, false);
  assert.equal(classifyNissanTopicEntry({ title: "Rádio", postCount: 7 }).keep, false);
  assert.equal(classifyNissanTopicEntry({ title: "Převodovka", postCount: 9 }).keep, false);
  assert.equal(classifyNissanTopicEntry({ title: "Náhradní díl", postCount: 3 }).keep, false);
  assert.equal(classifyNissanTopicEntry({ title: "XDF súbor ECU Nissan Almera 1.5 66kw", postCount: 2 }).keep, false);
  assert.equal(classifyNissanTopicEntry({ title: "Need help", postCount: 1 }).keep, false);
  assert.equal(classifyNissanTopicEntry({ title: "Qashqai J11 kontrolka motoru P0470", postCount: 5 }).keep, true);
});

test("discoverNissanRootCategoriesFromRoot keeps only conservative post-2000 Nissan forums", () => {
  const html = `
    <a href="https://www.nissanclub.cz/forum-kategorie/almera-n16-39">Almera N16</a>
    <a href="https://www.nissanclub.cz/forum-kategorie/note-22">Note</a>
    <a href="https://www.nissanclub.cz/forum-kategorie/leaf-85">Leaf</a>
    <a href="https://www.nissanclub.cz/forum-kategorie/x-trail-t30-16">X-Trail T30</a>
    <a href="https://www.nissanclub.cz/forum-kategorie/almera-iii-n17-versa-latio-115">Almera III N17 / Versa / Latio</a>
    <a href="https://www.nissanclub.cz/forum-kategorie/pathfinder-r51-14">Pathfinder R51</a>
    <a href="https://www.nissanclub.cz/forum-kategorie/micra-k11-43">Micra K11</a>
    <a href="https://www.nissanclub.cz/forum-kategorie/technicky-koutek-6">Technický koutek</a>
  `;

  const categories = discoverNissanRootCategoriesFromRoot({
    rootUrl: "https://www.nissanclub.cz/forum",
    rootHtml: html,
  });

  const almera = categories.find((entry) => entry.forum_url.includes("almera-n16-39"));
  const note = categories.find((entry) => entry.forum_url.includes("note-22"));
  const leaf = categories.find((entry) => entry.forum_url.includes("leaf-85"));
  const xtrail = categories.find((entry) => entry.forum_url.includes("x-trail-t30-16"));
  const almeraN17 = categories.find((entry) => entry.forum_url.includes("almera-iii-n17-versa-latio-115"));
  const pathfinder = categories.find((entry) => entry.forum_url.includes("pathfinder-r51-14"));
  const micraK11 = categories.find((entry) => entry.forum_url.includes("micra-k11-43"));
  const tech = categories.find((entry) => entry.forum_url.includes("technicky-koutek-6"));

  assert.equal(almera.keep, true);
  assert.equal(almera.resolved_model, "Almera N16 (2000–2006)");
  assert.equal(note.keep, true);
  assert.equal(note.forum_type, "model_family");
  assert.deepEqual(note.candidate_models, ["Note E11 (2006–2013)", "Note E12 (2013–2020)"]);
  assert.equal(leaf.keep, true);
  assert.equal(leaf.forum_type, "model_family");
  assert.deepEqual(leaf.candidate_models, ["Leaf ZE0 (2010–2017)", "Leaf ZE1 (2017–současnost)"]);
  assert.equal(xtrail.keep, true);
  assert.equal(xtrail.resolved_model, "X-Trail T30 (2001–2007)");
  assert.equal(almeraN17.keep, false);
  assert.equal(pathfinder.keep, false);
  assert.equal(micraK11.keep, false);
  assert.equal(tech.keep, false);
});

test("resolveNissanVehicleModel uses year hints conservatively on family forums", () => {
  const noteE11 = resolveNissanVehicleModel({
    modelRaw: "Note",
    threadTitle: "Nissan Note 2008 no-start after rain",
    parentForumTitle: "Note - Fórum - Nissan klub",
    subforumUrl: "https://www.nissanclub.cz/forum-kategorie/note-22",
  });
  assert.equal(noteE11, "Note E11 (2006–2013)");

  const leafZe1 = resolveNissanVehicleModel({
    modelRaw: "Leaf",
    threadTitle: "Leaf 2023 charging port fault",
    parentForumTitle: "Leaf - Fórum - Nissan klub",
    subforumUrl: "https://www.nissanclub.cz/forum-kategorie/leaf-85",
  });
  assert.equal(leafZe1, "Leaf ZE1 (2017–současnost)");

  const ambiguousLeaf = resolveNissanVehicleModel({
    modelRaw: "Leaf",
    threadTitle: "Leaf battery degradation discussion",
    parentForumTitle: "Leaf - Fórum - Nissan klub",
    subforumUrl: "https://www.nissanclub.cz/forum-kategorie/leaf-85",
  });
  assert.equal(ambiguousLeaf, null);

  const exactGtr = resolveNissanVehicleModel({
    modelRaw: "GT-R",
    threadTitle: "GT-R R35 gearbox warning",
    parentForumTitle: "GT-R - Fórum - Nissan klub",
    subforumUrl: "https://www.nissanclub.cz/forum-kategorie/gt-r-27",
  });
  assert.equal(exactGtr, "GT-R R35 (2007–současnost)");
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
