import assert from "node:assert/strict";

import {
  classifyFordTopicEntry,
  extractRelNextUrl,
  extractFordTopicEntriesFromForumPage,
  inferFordForumInventory,
  parseArgs,
  resolveFordVehicleModel,
} from "../scripts/forum-seed-ford.mjs";

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

console.log("\n== forum-seed-ford ==");

test("parseArgs enables discover-only mode and default Ford inputs", () => {
  const args = parseArgs(["out_dir", "--discover-only", "--min-posts", "3"]);
  assert.equal(args.discoverOnly, true);
  assert.equal(args.minPosts, 3);
  assert.equal(args.inputs.length, 18);
  assert.equal(args.inputs[0], "https://www.fordclub.eu/forum-kategorie/transit-obecne-22");
});

test("classifyFordTopicEntry drops low-post and manual threads", () => {
  assert.equal(classifyFordTopicEntry({ title: "Mondeo MK4 oil leak", postCount: 4 }).keep, true);
  assert.equal(classifyFordTopicEntry({ title: "Owners manual", postCount: 12 }).keep, false);
  assert.equal(classifyFordTopicEntry({ title: "Need help", postCount: 1 }).keep, false);
});

test("classifyFordTopicEntry drops generic technical-corner megathreads but keeps fault topics", () => {
  const generic = classifyFordTopicEntry({
    title: "Ford obecně * jaký motorový olej",
    postCount: 41,
    listingUrl: "https://www.fordclub.eu/forum-kategorie/technicky-koutek-6",
  });
  const fault = classifyFordTopicEntry({
    title: "Ford obecně * problémy se startem",
    postCount: 181,
    listingUrl: "https://www.fordclub.eu/forum-kategorie/technicky-koutek-6",
  });

  assert.equal(generic.keep, false);
  assert.match(generic.reason, /technical-corner/i);
  assert.equal(fault.keep, true);
});

test("extractFordTopicEntriesFromForumPage reads titles and post counts from listing rows", () => {
  const html = `
    <tr>
      <td>
        <a href="https://www.fordclub.eu/forum-tema/mondeo-mk4-oil-leak-100">Mondeo MK4 oil leak</a>
      </td>
      <td align="right">8</td>
    </tr>
    <tr>
      <td>
        <a href="https://www.fordclub.eu/forum-tema/owners-manual-101">Owners manual</a>
      </td>
      <td align="right">9</td>
    </tr>
    <tr>
      <td>
        <a href="https://www.fordclub.eu/forum-tema/fiesta-p0300-102">Fiesta P0300 misfire</a>
      </td>
      <td align="right">1</td>
    </tr>
    <tr>
      <td>
        <a href="https://www.fordclub.eu/forum-tema/jaky-motorovy-olej-103">Ford obecně * jaký motorový olej</a>
      </td>
      <td align="right">41</td>
    </tr>
  `;

  const topics = extractFordTopicEntriesFromForumPage(html, "https://www.fordclub.eu/forum-kategorie/technicky-koutek-6", 2);
  assert.equal(topics.length, 4);
  assert.equal(topics[0].title, "Mondeo MK4 oil leak");
  assert.equal(topics[0].post_count, 8);
  assert.equal(topics[0].keep, true);
  assert.equal(topics[1].keep, false);
  assert.match(topics[1].discard_reason, /non-diagnostic/i);
  assert.equal(topics[2].keep, false);
  assert.match(topics[2].discard_reason, /Only 1 post/);
  assert.equal(topics[3].keep, false);
  assert.match(topics[3].discard_reason, /technical-corner/i);
});

test("extractRelNextUrl keeps listing pagination on category pages", () => {
  const html = `
    <link rel="next" href="https://www.fordclub.eu/forum-kategorie/mondeo-mk-v-46?kols=2">
    <a href="https://www.fordclub.eu/forum-kategorie/mondeo-mk-v-46?kols=2">2</a>
    <a href="https://www.fordclub.eu/forum-tema/info-mondeo-v-98220?kols=3">3</a>
  `;

  const nextListing = extractRelNextUrl(html, "https://www.fordclub.eu/forum-kategorie/mondeo-mk-v-46", "listing");
  const nextTopic = extractRelNextUrl(html, "https://www.fordclub.eu/forum-tema/info-mondeo-v-98220", "topic");

  assert.equal(nextListing, "https://www.fordclub.eu/forum-kategorie/mondeo-mk-v-46?kols=2");
  assert.equal(nextTopic, "https://www.fordclub.eu/forum-tema/info-mondeo-v-98220?kols=3");
});

test("resolveFordVehicleModel maps explicit Ford generations and new Tourneo variants", () => {
  const mondeo = resolveFordVehicleModel({
    modelRaw: "Mondeo MK IV",
    threadTitle: "Mondeo MK IV 2.0 TDCi vibration under load",
    parentForumTitle: "Mondeo MK IV - Fórum - Ford klub",
  });
  assert.equal(mondeo, "Mondeo MK4 (2007–2014)");

  const ka = resolveFordVehicleModel({
    modelRaw: "Ka II",
    threadTitle: "KA II 2010 1.2 MPI stalls when warm",
    parentForumTitle: "Ka II - Fórum - Ford klub",
  });
  assert.equal(ka, "Ka II (2008–2016)");

  const tourneoCustom = resolveFordVehicleModel({
    modelRaw: "Tourneo Custom",
    threadTitle: "Tourneo Custom 2024 2.0 EcoBlue power loss",
    parentForumTitle: "Transit / Tourneo Custom - Fórum - Ford klub",
  });
  assert.equal(tourneoCustom, "Tourneo Custom II 2.0 EcoBlue (2023–současnost)");
});

test("resolveFordVehicleModel keeps generic Ford model forums ambiguous", () => {
  const kuga = resolveFordVehicleModel({
    modelRaw: "Kuga",
    threadTitle: "Kuga vibration at 90 km/h",
    parentForumTitle: "Kuga - Fórum - Ford klub",
  });
  assert.equal(kuga, null);

  const smax = resolveFordVehicleModel({
    modelRaw: "S-MAX",
    threadTitle: "S-MAX steering knock",
    parentForumTitle: "S-MAX - Fórum - Ford klub",
  });
  assert.equal(smax, null);
});

test("inferFordForumInventory marks shared Tourneo forum as non-exact", () => {
  const inventory = inferFordForumInventory({
    forumUrl: "https://www.fordclub.eu/forum-kategorie/tourneo-26",
    forumTitle: "Tourneo - Fórum - Ford klub",
  });
  assert.equal(inventory.forum_type, "shared");
  assert.equal(inventory.resolved_model, null);
  assert.match(inventory.note, /shared forum/i);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
