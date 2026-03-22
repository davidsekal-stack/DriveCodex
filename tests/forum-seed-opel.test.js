import assert from "node:assert/strict";

import {
  classifyOpelTopicEntry,
  discoverOpelRootCategoriesFromRoot,
  parseArgs,
  resolveOpelVehicleModel,
} from "../scripts/forum-seed-opel.mjs";

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

console.log("\n== forum-seed-opel ==");

test("parseArgs uses the Opel root forum by default", () => {
  const args = parseArgs(["out_dir", "--discover-only", "--signals-only", "--min-posts", "3"]);
  assert.equal(args.discoverOnly, true);
  assert.equal(args.signalsOnly, true);
  assert.equal(args.minPosts, 3);
  assert.deepEqual(args.inputs, ["https://www.club-opel.com/forum"]);
});

test("classifyOpelTopicEntry drops manuals and low-post noise", () => {
  assert.equal(classifyOpelTopicEntry({ title: "Astra J 2.0 CDTI oil leak", postCount: 4 }).keep, true);
  assert.equal(classifyOpelTopicEntry({ title: "Owners manual", postCount: 9 }).keep, false);
  assert.equal(classifyOpelTopicEntry({ title: "Foto", postCount: 12 }).keep, false);
  assert.equal(classifyOpelTopicEntry({ title: "Need help", postCount: 1 }).keep, false);
});

test("discoverOpelRootCategoriesFromRoot keeps post-2000 Opel forums and drops older ones", () => {
  const html = `
    <a href="https://www.club-opel.com/forum-kategorie/omega-b-9">Omega B</a>
    <a href="https://www.club-opel.com/forum-kategorie/astra-h-21">Astra H</a>
    <a href="https://www.club-opel.com/forum-kategorie/grandland-55">Grandland</a>
  `;

  const categories = discoverOpelRootCategoriesFromRoot({
    rootUrl: "https://www.club-opel.com/forum",
    rootHtml: html,
  });

  const omega = categories.find((entry) => entry.forum_url.includes("omega-b-9"));
  const astra = categories.find((entry) => entry.forum_url.includes("astra-h-21"));
  const grandland = categories.find((entry) => entry.forum_url.includes("grandland-55"));

  assert.equal(omega.keep, false);
  assert.equal(astra.keep, true);
  assert.equal(astra.resolved_model, "Astra H (2004–2010)");
  assert.equal(grandland.keep, true);
  assert.equal(grandland.forum_type, "model_family");
});

test("resolveOpelVehicleModel resolves exact Opel forums and stays conservative on Grandland family", () => {
  const exact = resolveOpelVehicleModel({
    modelRaw: "Astra J",
    threadTitle: "Astra J 2.0 CDTI boost leak",
    parentForumTitle: "Astra J - Fórum - Opel klub",
    subforumUrl: "https://www.club-opel.com/forum-kategorie/astra-j-41",
  });
  assert.equal(exact, "Astra J (2009–2015)");

  const yearMatch = resolveOpelVehicleModel({
    modelRaw: "Grandland",
    threadTitle: "Opel Grandland 2025 hybrid warning",
    parentForumTitle: "Grandland - Fórum - Opel klub",
    subforumUrl: "https://www.club-opel.com/forum-kategorie/grandland-55",
  });
  assert.equal(yearMatch, "Grandland II (2024–dosud)");

  const ambiguous = resolveOpelVehicleModel({
    modelRaw: "Grandland",
    threadTitle: "Grandland steering noise",
    parentForumTitle: "Grandland - Fórum - Opel klub",
    subforumUrl: "https://www.club-opel.com/forum-kategorie/grandland-55",
  });
  assert.equal(ambiguous, null);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
