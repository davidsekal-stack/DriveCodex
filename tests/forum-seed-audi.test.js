import assert from "node:assert/strict";

import {
  classifyAudiTopicEntry,
  extractAudiTopicEntriesFromForumPage,
  extractRelNextUrl,
  inferAudiForumInventory,
  parseArgs,
  resolveAudiVehicleModel,
} from "../scripts/forum-seed-audi.mjs";

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

console.log("\n== forum-seed-audi ==");

test("parseArgs uses default Audi inputs and supports discovery flags", () => {
  const args = parseArgs(["out_dir", "--discover-only", "--signals-only", "--min-posts", "3"]);
  assert.equal(args.discoverOnly, true);
  assert.equal(args.signalsOnly, true);
  assert.equal(args.minPosts, 3);
  assert.equal(args.inputs.length, 47);
  assert.equal(args.inputs[0], "https://www.audiclub.eu/forum-kategorie/a1-8x-16");
  assert.equal(args.inputs.includes("https://www.audiclub.eu/forum-kategorie/rs7-51"), true);
});

test("classifyAudiTopicEntry drops low-post, manual and title-noise topics", () => {
  assert.equal(classifyAudiTopicEntry({ title: "Audi A4 B8 2.0 TDI oil leak", postCount: 4 }).keep, true);
  assert.equal(classifyAudiTopicEntry({ title: "Owners manual", postCount: 10 }).keep, false);
  assert.equal(classifyAudiTopicEntry({ title: "Need help", postCount: 1 }).keep, false);
  assert.equal(classifyAudiTopicEntry({ title: "Foto", postCount: 14 }).keep, false);
});

test("extractAudiTopicEntriesFromForumPage reads titles and post counts from listing rows", () => {
  const html = `
    <tr>
      <td>
        <a href="https://www.audiclub.eu/forum-tema/a4-b8-oil-leak-100">A4 B8 2.0 TDI oil leak</a>
      </td>
      <td align="right">8</td>
    </tr>
    <tr>
      <td>
        <a href="https://www.audiclub.eu/forum-tema/owners-manual-101">Owners manual</a>
      </td>
      <td align="right">9</td>
    </tr>
    <tr>
      <td>
        <a href="https://www.audiclub.eu/forum-tema/rs6-p0299-102">RS6 P0299 underboost</a>
      </td>
      <td align="right">1</td>
    </tr>
  `;

  const topics = extractAudiTopicEntriesFromForumPage(html, "https://www.audiclub.eu/forum-kategorie/a4-b8-28", 2);
  assert.equal(topics.length, 3);
  assert.equal(topics[0].title, "A4 B8 2.0 TDI oil leak");
  assert.equal(topics[0].post_count, 8);
  assert.equal(topics[0].keep, true);
  assert.equal(topics[1].keep, false);
  assert.match(topics[1].discard_reason, /non-diagnostic/i);
  assert.equal(topics[2].keep, false);
  assert.match(topics[2].discard_reason, /Only 1 post/);
});

test("extractRelNextUrl keeps listing pagination on Audi category pages", () => {
  const html = `
    <link rel="next" href="https://www.audiclub.eu/forum-kategorie/a4-b8-28?kols=2">
    <a href="https://www.audiclub.eu/forum-kategorie/a4-b8-28?kols=2">2</a>
  `;

  const nextListing = extractRelNextUrl(html, "https://www.audiclub.eu/forum-kategorie/a4-b8-28");
  assert.equal(nextListing, "https://www.audiclub.eu/forum-kategorie/a4-b8-28?kols=2");
});

test("inferAudiForumInventory resolves exact, shared and e-tron forums conservatively", () => {
  const exact = inferAudiForumInventory({
    forumUrl: "https://www.audiclub.eu/forum-kategorie/a3-8v-35",
    forumTitle: "A3 (8V) - F\u00f3rum - Audi klub",
  });
  assert.equal(exact.forum_type, "model");
  assert.equal(exact.resolved_model, "A3 8V (2012\u20132020)");

  const shared = inferAudiForumInventory({
    forumUrl: "https://www.audiclub.eu/forum-kategorie/rs6-44",
    forumTitle: "RS6 - F\u00f3rum - Audi klub",
  });
  assert.equal(shared.forum_type, "shared");
  assert.equal(shared.resolved_model, null);
  assert.deepEqual(shared.candidate_models, ["A6 C6 (2006\u20132011)", "A6 C7 (2011\u20132018)", "A6 C8 (2018\u2013dosud)"]);

  const etron = inferAudiForumInventory({
    forumUrl: "https://www.audiclub.eu/forum-kategorie/e-tron-80",
    forumTitle: "e-tron - F\u00f3rum - Audi klub",
  });
  assert.equal(etron.forum_type, "shared");
  assert.equal(etron.resolved_model, null);
  assert.deepEqual(etron.candidate_models, ["e-tron 55 (2019\u20132023)", "Q8 e-tron (2023\u2013dosud)"]);
});

test("resolveAudiVehicleModel resolves exact Audi generation forums", () => {
  const exact = resolveAudiVehicleModel({
    modelRaw: "A4 B8",
    threadTitle: "A4 B8 2.0 TDI balance shaft noise",
    parentForumTitle: "A4 (B8) - F\u00f3rum - Audi klub",
    subforumUrl: "https://www.audiclub.eu/forum-kategorie/a4-b8-28",
  });
  assert.equal(exact, "A4 B8 (2008\u20132015)");
});

test("resolveAudiVehicleModel uses explicit years inside shared performance forums", () => {
  const rs3 = resolveAudiVehicleModel({
    modelRaw: "RS3",
    threadTitle: "Audi RS3 2019 2.5 TFSI misfire",
    parentForumTitle: "RS3 - F\u00f3rum - Audi klub",
    subforumUrl: "https://www.audiclub.eu/forum-kategorie/rs3-42",
  });
  assert.equal(rs3, "A3 8V (2012\u20132020)");

  const ambiguous = resolveAudiVehicleModel({
    modelRaw: "RS3",
    threadTitle: "RS3 cold start rattle",
    parentForumTitle: "RS3 - F\u00f3rum - Audi klub",
    subforumUrl: "https://www.audiclub.eu/forum-kategorie/rs3-42",
  });
  assert.equal(ambiguous, null);
});

test("resolveAudiVehicleModel distinguishes e-tron SUV generations conservatively", () => {
  const q8 = resolveAudiVehicleModel({
    modelRaw: "e-tron",
    threadTitle: "Audi Q8 e-tron 2024 charging fault",
    parentForumTitle: "e-tron - F\u00f3rum - Audi klub",
    subforumUrl: "https://www.audiclub.eu/forum-kategorie/e-tron-80",
  });
  assert.equal(q8, "Q8 e-tron (2023\u2013dosud)");

  const etron55 = resolveAudiVehicleModel({
    modelRaw: "e-tron",
    threadTitle: "Audi e-tron 55 2021 coolant warning",
    parentForumTitle: "e-tron - F\u00f3rum - Audi klub",
    subforumUrl: "https://www.audiclub.eu/forum-kategorie/e-tron-80",
  });
  assert.equal(etron55, "e-tron 55 (2019\u20132023)");

  const ambiguous = resolveAudiVehicleModel({
    modelRaw: "e-tron",
    threadTitle: "Audi e-tron battery warning",
    parentForumTitle: "e-tron - F\u00f3rum - Audi klub",
    subforumUrl: "https://www.audiclub.eu/forum-kategorie/e-tron-80",
  });
  assert.equal(ambiguous, null);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
