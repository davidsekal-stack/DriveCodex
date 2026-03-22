import assert from "node:assert/strict";

import {
  classifyCitroenTopicEntry,
  discoverCitroenRootCategoriesFromRoot,
  parseArgs,
  resolveCitroenVehicleModel,
} from "../scripts/forum-seed-citroen.mjs";

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

console.log("\n== forum-seed-citroen ==");

test("parseArgs uses the Citroen root forum by default", () => {
  const args = parseArgs(["out_dir", "--discover-only", "--signals-only", "--min-posts", "3"]);
  assert.equal(args.discoverOnly, true);
  assert.equal(args.signalsOnly, true);
  assert.equal(args.minPosts, 3);
  assert.deepEqual(args.inputs, ["https://www.citroen-club.cz/forum"]);
});

test("classifyCitroenTopicEntry drops manuals and low-post noise", () => {
  assert.equal(classifyCitroenTopicEntry({ title: "C4 1.6 HDi oil leak", postCount: 4 }).keep, true);
  assert.equal(classifyCitroenTopicEntry({ title: "Owners manual", postCount: 9 }).keep, false);
  assert.equal(classifyCitroenTopicEntry({ title: "Foto", postCount: 12 }).keep, false);
  assert.equal(classifyCitroenTopicEntry({ title: "Need help", postCount: 1 }).keep, false);
});

test("discoverCitroenRootCategoriesFromRoot keeps post-2000 Citroen forums and drops older ones", () => {
  const html = `
    <a href="https://www.citroen-club.cz/forum-kategorie/xsara-picasso-9">Xsara Picasso</a>
    <a href="https://www.citroen-club.cz/forum-kategorie/c4-picasso-grand-i-53">C4 Picasso / Grand I</a>
    <a href="https://www.citroen-club.cz/forum-kategorie/jumper-iii-61">Jumper III</a>
  `;

  const categories = discoverCitroenRootCategoriesFromRoot({
    rootUrl: "https://www.citroen-club.cz/forum",
    rootHtml: html,
  });

  const xsara = categories.find((entry) => entry.forum_url.includes("xsara-picasso-9"));
  const picasso = categories.find((entry) => entry.forum_url.includes("c4-picasso-grand-i-53"));
  const jumper = categories.find((entry) => entry.forum_url.includes("jumper-iii-61"));

  assert.equal(xsara.keep, false);
  assert.equal(picasso.keep, true);
  assert.equal(picasso.resolved_model, "C4 Picasso / Grand C4 Picasso I (2006–2013)");
  assert.equal(jumper.keep, true);
  assert.equal(jumper.forum_type, "model_family");
});

test("resolveCitroenVehicleModel resolves exact Citroen forums and stays conservative on Jumper III family", () => {
  const exact = resolveCitroenVehicleModel({
    modelRaw: "C3 II",
    threadTitle: "C3 II 1.4 HDi no start",
    parentForumTitle: "C3 II - Fórum - Citroen klub",
    subforumUrl: "https://www.citroen-club.cz/forum-kategorie/c3-ii-21",
  });
  assert.equal(exact, "C3 II (2009–2016)");

  const yearMatch = resolveCitroenVehicleModel({
    modelRaw: "Jumper III",
    threadTitle: "Citroen Jumper 2021 AdBlue warning",
    parentForumTitle: "Jumper III - Fórum - Citroen klub",
    subforumUrl: "https://www.citroen-club.cz/forum-kategorie/jumper-iii-61",
  });
  assert.equal(yearMatch, "Jumper III 2.0/2.2 BlueHDi (2016–současnost)");

  const ambiguous = resolveCitroenVehicleModel({
    modelRaw: "Jumper III",
    threadTitle: "Citroen Jumper limp mode",
    parentForumTitle: "Jumper III - Fórum - Citroen klub",
    subforumUrl: "https://www.citroen-club.cz/forum-kategorie/jumper-iii-61",
  });
  assert.equal(ambiguous, null);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
