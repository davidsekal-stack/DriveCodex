import assert from "node:assert/strict";

import {
  classifyPeugeotTopicEntry,
  extractPeugeotTopicEntriesFromForumPage,
  extractRelNextUrl,
  inferPeugeotForumInventory,
  parseArgs,
  resolvePeugeotVehicleModel,
} from "../scripts/forum-seed-peugeot.mjs";

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

console.log("\n== forum-seed-peugeot ==");

test("parseArgs uses default Peugeot inputs and supports discovery flags", () => {
  const args = parseArgs(["out_dir", "--discover-only", "--signals-only", "--min-posts", "3"]);
  assert.equal(args.discoverOnly, true);
  assert.equal(args.signalsOnly, true);
  assert.equal(args.minPosts, 3);
  assert.equal(args.inputs.length, 27);
  assert.equal(args.inputs[0], "https://www.peugeotclub.eu/forum-kategorie/107-17");
  assert.equal(args.inputs.includes("https://www.peugeotclub.eu/forum-kategorie/301-61"), true);
});

test("classifyPeugeotTopicEntry drops low-post, manual and title-noise topics", () => {
  assert.equal(classifyPeugeotTopicEntry({ title: "Peugeot 308 oil leak", postCount: 4 }).keep, true);
  assert.equal(classifyPeugeotTopicEntry({ title: "Owners manual", postCount: 10 }).keep, false);
  assert.equal(classifyPeugeotTopicEntry({ title: "Need help", postCount: 1 }).keep, false);
  assert.equal(classifyPeugeotTopicEntry({ title: "Foto", postCount: 14 }).keep, false);
});

test("extractPeugeotTopicEntriesFromForumPage reads titles and post counts from listing rows", () => {
  const html = `
    <tr>
      <td>
        <a href="https://www.peugeotclub.eu/forum-tema/308-t9-oil-leak-100">308 T9 oil leak</a>
      </td>
      <td align="right">8</td>
    </tr>
    <tr>
      <td>
        <a href="https://www.peugeotclub.eu/forum-tema/owners-manual-101">Owners manual</a>
      </td>
      <td align="right">9</td>
    </tr>
    <tr>
      <td>
        <a href="https://www.peugeotclub.eu/forum-tema/207-p0300-102">207 P0300 misfire</a>
      </td>
      <td align="right">1</td>
    </tr>
  `;

  const topics = extractPeugeotTopicEntriesFromForumPage(html, "https://www.peugeotclub.eu/forum-kategorie/308-ii-t9-57", 2);
  assert.equal(topics.length, 3);
  assert.equal(topics[0].title, "308 T9 oil leak");
  assert.equal(topics[0].post_count, 8);
  assert.equal(topics[0].keep, true);
  assert.equal(topics[1].keep, false);
  assert.match(topics[1].discard_reason, /non-diagnostic/i);
  assert.equal(topics[2].keep, false);
  assert.match(topics[2].discard_reason, /Only 1 post/);
});

test("extractRelNextUrl keeps listing pagination on category pages", () => {
  const html = `
    <link rel="next" href="https://www.peugeotclub.eu/forum-kategorie/308-ii-t9-57?kols=2">
    <a href="https://www.peugeotclub.eu/forum-kategorie/308-ii-t9-57?kols=2">2</a>
  `;

  const nextListing = extractRelNextUrl(html, "https://www.peugeotclub.eu/forum-kategorie/308-ii-t9-57");
  assert.equal(nextListing, "https://www.peugeotclub.eu/forum-kategorie/308-ii-t9-57?kols=2");
});

test("inferPeugeotForumInventory resolves exact and ambiguous forums conservatively", () => {
  const exact = inferPeugeotForumInventory({
    forumUrl: "https://www.peugeotclub.eu/forum-kategorie/107-17",
    forumTitle: "107 - Fórum - Peugeot klub",
  });
  assert.equal(exact.forum_type, "model");
  assert.equal(exact.resolved_model, "107");

  const generic = inferPeugeotForumInventory({
    forumUrl: "https://www.peugeotclub.eu/forum-kategorie/208-23",
    forumTitle: "208 - Fórum - Peugeot klub",
  });
  assert.equal(generic.forum_type, "model_family");
  assert.equal(generic.resolved_model, null);
  assert.deepEqual(generic.candidate_models, ["208 I (2012–2019)", "208 II (2019–dosud)"]);

  const shared = inferPeugeotForumInventory({
    forumUrl: "https://www.peugeotclub.eu/forum-kategorie/expert-traveller-iii-70",
    forumTitle: "Expert + Traveller III - Fórum - Peugeot klub",
  });
  assert.equal(shared.forum_type, "shared");
  assert.equal(shared.resolved_model, null);
  assert.deepEqual(shared.candidate_models, ["Expert III (2016–dosud)", "Traveller (2016–dosud)"]);
});

test("resolvePeugeotVehicleModel resolves exact Peugeot model forums", () => {
  const exact = resolvePeugeotVehicleModel({
    modelRaw: "307",
    threadTitle: "307 1.6 HDi loss of power",
    parentForumTitle: "307 - Fórum - Peugeot klub",
    subforumUrl: "https://www.peugeotclub.eu/forum-kategorie/307-29",
  });
  assert.equal(exact, "307");
});

test("resolvePeugeotVehicleModel keeps family forums conservative but uses explicit years", () => {
  const family = resolvePeugeotVehicleModel({
    modelRaw: "208",
    threadTitle: "Peugeot 208 II 2020 PureTech misfire",
    parentForumTitle: "208 - Fórum - Peugeot klub",
    subforumUrl: "https://www.peugeotclub.eu/forum-kategorie/208-23",
  });
  assert.equal(family, "208 II (2019–dosud)");
});

test("resolvePeugeotVehicleModel maps Boxer II forum to catalog Boxer III", () => {
  const boxer = resolvePeugeotVehicleModel({
    modelRaw: "Boxer II",
    threadTitle: "Peugeot Boxer 2018 2.2 HDi glow plug fault",
    parentForumTitle: "Boxer II - Fórum - Peugeot klub",
    subforumUrl: "https://www.peugeotclub.eu/forum-kategorie/boxer-ii-58",
  });
  assert.equal(boxer, "Boxer III (2006–dosud)");
});

test("resolvePeugeotVehicleModel resolves Traveller in shared forum only when explicit", () => {
  const traveller = resolvePeugeotVehicleModel({
    modelRaw: "Traveller",
    threadTitle: "Traveller 2019 AdBlue warning",
    parentForumTitle: "Expert + Traveller III - Fórum - Peugeot klub",
    subforumUrl: "https://www.peugeotclub.eu/forum-kategorie/expert-traveller-iii-70",
  });
  assert.equal(traveller, "Traveller (2016–dosud)");

  const ambiguous = resolvePeugeotVehicleModel({
    modelRaw: "",
    threadTitle: "2.0 BlueHDi overheating",
    parentForumTitle: "Expert + Traveller III - Fórum - Peugeot klub",
    subforumUrl: "https://www.peugeotclub.eu/forum-kategorie/expert-traveller-iii-70",
  });
  assert.equal(ambiguous, null);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
