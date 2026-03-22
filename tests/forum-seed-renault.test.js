import assert from "node:assert/strict";

import {
  classifyRenaultTopicEntry,
  extractRelNextUrl,
  extractRenaultTopicEntriesFromForumPage,
  inferRenaultForumInventory,
  parseArgs,
  resolveRenaultVehicleModel,
} from "../scripts/forum-seed-renault.mjs";

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

console.log("\n== forum-seed-renault ==");

test("parseArgs uses default Renault inputs and supports discovery flags", () => {
  const args = parseArgs(["out_dir", "--discover-only", "--signals-only", "--min-posts", "3"]);
  assert.equal(args.discoverOnly, true);
  assert.equal(args.signalsOnly, true);
  assert.equal(args.minPosts, 3);
  assert.equal(args.inputs.length, 32);
  assert.equal(args.inputs[0], "https://cs.renault-club.cz/forum-kategorie/scenic-ii-48");
  assert.equal(args.inputs.includes("https://cs.renault-club.cz/forum-kategorie/captur-66"), true);
});

test("classifyRenaultTopicEntry drops low-post, manual and title-noise topics", () => {
  assert.equal(classifyRenaultTopicEntry({ title: "Megane III 1.5 dCi oil leak", postCount: 4 }).keep, true);
  assert.equal(classifyRenaultTopicEntry({ title: "Owners manual", postCount: 10 }).keep, false);
  assert.equal(classifyRenaultTopicEntry({ title: "Need help", postCount: 1 }).keep, false);
  assert.equal(classifyRenaultTopicEntry({ title: "Foto", postCount: 14 }).keep, false);
});

test("extractRenaultTopicEntriesFromForumPage reads titles and post counts from listing rows", () => {
  const html = `
    <tr>
      <td>
        <a href="https://cs.renault-club.cz/forum-tema/megane-iii-oil-leak-100">Megane III oil leak</a>
      </td>
      <td align="right">8</td>
    </tr>
    <tr>
      <td>
        <a href="https://cs.renault-club.cz/forum-tema/owners-manual-101">Owners manual</a>
      </td>
      <td align="right">9</td>
    </tr>
    <tr>
      <td>
        <a href="https://cs.renault-club.cz/forum-tema/clio-iv-p0300-102">Clio IV P0300 misfire</a>
      </td>
      <td align="right">1</td>
    </tr>
  `;

  const topics = extractRenaultTopicEntriesFromForumPage(html, "https://cs.renault-club.cz/forum-kategorie/megane-iii-79", 2);
  assert.equal(topics.length, 3);
  assert.equal(topics[0].title, "Megane III oil leak");
  assert.equal(topics[0].post_count, 8);
  assert.equal(topics[0].keep, true);
  assert.equal(topics[1].keep, false);
  assert.match(topics[1].discard_reason, /non-diagnostic/i);
  assert.equal(topics[2].keep, false);
  assert.match(topics[2].discard_reason, /Only 1 post/);
});

test("extractRelNextUrl keeps listing pagination on Renault category pages", () => {
  const html = `
    <link rel="next" href="https://cs.renault-club.cz/forum-kategorie/megane-iii-79?kols=2">
    <a href="https://cs.renault-club.cz/forum-kategorie/megane-iii-79?kols=2">2</a>
  `;

  const nextListing = extractRelNextUrl(html, "https://cs.renault-club.cz/forum-kategorie/megane-iii-79");
  assert.equal(nextListing, "https://cs.renault-club.cz/forum-kategorie/megane-iii-79?kols=2");
});

test("inferRenaultForumInventory resolves exact and family forums conservatively", () => {
  const exact = inferRenaultForumInventory({
    forumUrl: "https://cs.renault-club.cz/forum-kategorie/megane-ii-27",
    forumTitle: "Megane II - Fórum - Renault klub",
  });
  assert.equal(exact.forum_type, "model");
  assert.equal(exact.resolved_model, "Megane II (2002–2009)");

  const family = inferRenaultForumInventory({
    forumUrl: "https://cs.renault-club.cz/forum-kategorie/captur-66",
    forumTitle: "Captur - Fórum - Renault klub",
  });
  assert.equal(family.forum_type, "model_family");
  assert.equal(family.resolved_model, null);
  assert.deepEqual(family.candidate_models, ["Captur I (2013–2019)", "Captur II (2019–dosud)"]);
});

test("resolveRenaultVehicleModel resolves exact Renault generation forums", () => {
  const exact = resolveRenaultVehicleModel({
    modelRaw: "Megane II",
    threadTitle: "Megane II 1.9 dCi power loss",
    parentForumTitle: "Megane II - Fórum - Renault klub",
    subforumUrl: "https://cs.renault-club.cz/forum-kategorie/megane-ii-27",
  });
  assert.equal(exact, "Megane II (2002–2009)");
});

test("resolveRenaultVehicleModel keeps family forums conservative but uses explicit years", () => {
  const family = resolveRenaultVehicleModel({
    modelRaw: "Captur",
    threadTitle: "Renault Captur 2021 1.3 TCe misfire",
    parentForumTitle: "Captur - Fórum - Renault klub",
    subforumUrl: "https://cs.renault-club.cz/forum-kategorie/captur-66",
  });
  assert.equal(family, "Captur II (2019–dosud)");

  const ambiguous = resolveRenaultVehicleModel({
    modelRaw: "Captur",
    threadTitle: "Captur engine vibration",
    parentForumTitle: "Captur - Fórum - Renault klub",
    subforumUrl: "https://cs.renault-club.cz/forum-kategorie/captur-66",
  });
  assert.equal(ambiguous, null);
});

test("resolveRenaultVehicleModel maps Renault 5 forum to the electric model label", () => {
  const model = resolveRenaultVehicleModel({
    modelRaw: "Renault 5",
    threadTitle: "Renault 5 E-Tech charging fault",
    parentForumTitle: "5 (2023) - Fórum - Renault klub",
    subforumUrl: "https://cs.renault-club.cz/forum-kategorie/5-2023-118",
  });
  assert.equal(model, "Renault 5 E-Tech Electric (2024–dosud)");
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
