import assert from "node:assert/strict";

import {
  classifyDaciaTopicEntry,
  discoverDaciaRootCategoriesFromRoot,
  parseArgs,
  resolveDaciaVehicleModel,
} from "../scripts/forum-seed-dacia.mjs";

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

console.log("\n== forum-seed-dacia ==");

test("parseArgs uses the Dacia root forum by default", () => {
  const args = parseArgs(["out_dir", "--discover-only", "--signals-only", "--min-posts", "3"]);
  assert.equal(args.discoverOnly, true);
  assert.equal(args.signalsOnly, true);
  assert.equal(args.minPosts, 3);
  assert.deepEqual(args.inputs, ["https://www.daciaclub.cz/forum"]);
});

test("classifyDaciaTopicEntry drops manuals and low-post noise", () => {
  assert.equal(classifyDaciaTopicEntry({ title: "Duster II 1.5 dCi oil leak", postCount: 4 }).keep, true);
  assert.equal(classifyDaciaTopicEntry({ title: "Owners manual", postCount: 9 }).keep, false);
  assert.equal(classifyDaciaTopicEntry({ title: "Foto", postCount: 12 }).keep, false);
  assert.equal(classifyDaciaTopicEntry({ title: "Need help", postCount: 1 }).keep, false);
  assert.equal(classifyDaciaTopicEntry({ title: "Jakou diagnostiku na OBD2 ??", postCount: 12 }).keep, false);
  assert.equal(classifyDaciaTopicEntry({ title: "Výměna žárovky H7", postCount: 8 }).keep, false);
  assert.equal(classifyDaciaTopicEntry({ title: "Kontrolka motoru oranžová", postCount: 5 }).keep, true);
  assert.equal(classifyDaciaTopicEntry({ title: "Skákání motoru 1.0 TCe za studena", postCount: 5 }).keep, true);
});

test("discoverDaciaRootCategoriesFromRoot keeps post-2000 Dacia forums and drops old or unverified ones", () => {
  const html = `
    <a href="https://www.daciaclub.cz/forum-kategorie/1300-1310-11">1300 / 1310</a>
    <a href="https://www.daciaclub.cz/forum-kategorie/logan-ii-25">Logan II</a>
    <a href="https://www.daciaclub.cz/forum-kategorie/bigster-39">Bigster</a>
    <a href="https://www.daciaclub.cz/forum-kategorie/duster-oroch-38">Duster Oroch</a>
    <a href="https://www.daciaclub.cz/forum-kategorie/sandero-iv-40">Sandero IV</a>
    <a href="https://www.daciaclub.cz/forum-kategorie/technicky-koutek-6">Technický koutek</a>
  `;

  const categories = discoverDaciaRootCategoriesFromRoot({
    rootUrl: "https://www.daciaclub.cz/forum",
    rootHtml: html,
  });

  const oldDacia = categories.find((entry) => entry.forum_url.includes("1300-1310-11"));
  const logan = categories.find((entry) => entry.forum_url.includes("logan-ii-25"));
  const bigster = categories.find((entry) => entry.forum_url.includes("bigster-39"));
  const oroch = categories.find((entry) => entry.forum_url.includes("duster-oroch-38"));
  const sanderoIv = categories.find((entry) => entry.forum_url.includes("sandero-iv-40"));
  const tech = categories.find((entry) => entry.forum_url.includes("technicky-koutek-6"));

  assert.equal(oldDacia.keep, false);
  assert.equal(logan.keep, true);
  assert.equal(logan.resolved_model, "Logan II (2012–2020)");
  assert.equal(bigster.keep, true);
  assert.equal(bigster.resolved_model, "Bigster (2025–dosud)");
  assert.equal(oroch.keep, false);
  assert.equal(sanderoIv.keep, false);
  assert.equal(tech.keep, false);
});

test("resolveDaciaVehicleModel resolves exact Dacia forums and stays conservative on excluded sections", () => {
  const exact = resolveDaciaVehicleModel({
    modelRaw: "Duster II",
    threadTitle: "Duster II 1.5 dCi injector issue",
    parentForumTitle: "Duster II - Fórum - Dacia klub",
    subforumUrl: "https://www.daciaclub.cz/forum-kategorie/duster-ii-32",
  });
  assert.equal(exact, "Duster II (2018–2024)");

  const bigster = resolveDaciaVehicleModel({
    modelRaw: "Bigster",
    threadTitle: "Bigster hybrid warning",
    parentForumTitle: "Bigster - Fórum - Dacia klub",
    subforumUrl: "https://www.daciaclub.cz/forum-kategorie/bigster-39",
  });
  assert.equal(bigster, "Bigster (2025–dosud)");

  const excluded = resolveDaciaVehicleModel({
    modelRaw: "Duster Oroch",
    threadTitle: "Duster Oroch no-start",
    parentForumTitle: "Duster Oroch - Fórum - Dacia klub",
    subforumUrl: "https://www.daciaclub.cz/forum-kategorie/duster-oroch-38",
  });
  assert.equal(excluded, null);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
