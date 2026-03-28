import assert from "node:assert/strict";

import {
  classifyBmwTopicEntry,
  discoverBmwRootCategoriesFromRoot,
  parseArgs,
  resolveBmwVehicleModel,
} from "../scripts/forum-seed-bmw.mjs";

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

console.log("\n== forum-seed-bmw ==");

test("parseArgs uses the BMW root forum by default", () => {
  const args = parseArgs(["out_dir", "--discover-only", "--signals-only", "--min-posts", "3"]);
  assert.equal(args.discoverOnly, true);
  assert.equal(args.signalsOnly, true);
  assert.equal(args.minPosts, 3);
  assert.deepEqual(args.inputs, ["https://www.bmw-club.cz/forum"]);
});

test("classifyBmwTopicEntry drops manuals and low-post noise", () => {
  assert.equal(classifyBmwTopicEntry({ title: "BMW 320d E90 oil leak", postCount: 4 }).keep, true);
  assert.equal(classifyBmwTopicEntry({ title: "Owners manual", postCount: 9 }).keep, false);
  assert.equal(classifyBmwTopicEntry({ title: "Foto", postCount: 12 }).keep, false);
  assert.equal(classifyBmwTopicEntry({ title: "Need help", postCount: 1 }).keep, false);
});

test("discoverBmwRootCategoriesFromRoot keeps post-2000 BMW forums and drops pre-2000 ones", () => {
  const html = `
    <a href="https://www.bmw-club.cz/forum-kategorie/3-e46-10">3 E46</a>
    <a href="https://www.bmw-club.cz/forum-kategorie/3-e90-e91-e92-e93-11">3 E90/E91/E92/E93</a>
    <a href="https://www.bmw-club.cz/forum-kategorie/z4-12">Z4</a>
  `;

  const categories = discoverBmwRootCategoriesFromRoot({
    rootUrl: "https://www.bmw-club.cz/forum",
    rootHtml: html,
  });

  const e46 = categories.find((entry) => entry.forum_url.includes("3-e46-10"));
  const e90 = categories.find((entry) => entry.forum_url.includes("3-e90-e91-e92-e93-11"));
  const z4 = categories.find((entry) => entry.forum_url.includes("z4-12"));

  assert.equal(e46.keep, false);
  assert.equal(e90.keep, true);
  assert.equal(e90.resolved_model, "3 E90 (2005–2012)");
  assert.equal(z4.keep, true);
  assert.equal(z4.forum_type, "model_family");
});

test("resolveBmwVehicleModel resolves exact BMW forums and stays conservative on shared Z4", () => {
  const exact = resolveBmwVehicleModel({
    modelRaw: "5 F10",
    threadTitle: "BMW 530d F10 drivetrain vibration",
    parentForumTitle: "5 F10/F11 - Fórum - BMW klub",
    subforumUrl: "https://www.bmw-club.cz/forum-kategorie/5-f10-f11-55",
  });
  assert.equal(exact, "5 F10 (2010–2017)");

  const z4Year = resolveBmwVehicleModel({
    modelRaw: "Z4",
    threadTitle: "BMW Z4 2020 B48 coolant warning",
    parentForumTitle: "Z4 - Fórum - BMW klub",
    subforumUrl: "https://www.bmw-club.cz/forum-kategorie/z4-12",
  });
  assert.equal(z4Year, "Z4 G29 (2019–dosud)");

  const ambiguous = resolveBmwVehicleModel({
    modelRaw: "Z4",
    threadTitle: "BMW Z4 roof noise",
    parentForumTitle: "Z4 - Fórum - BMW klub",
    subforumUrl: "https://www.bmw-club.cz/forum-kategorie/z4-12",
  });
  assert.equal(ambiguous, null);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
