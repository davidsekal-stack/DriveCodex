import assert from "node:assert/strict";

import {
  classifySeatTopicEntry,
  discoverSeatRootCategoriesFromRoot,
  parseArgs,
  resolveSeatVehicleModel,
} from "../scripts/forum-seed-seat.mjs";

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

console.log("\n== forum-seed-seat ==");

test("parseArgs uses the SEAT root forum by default", () => {
  const args = parseArgs(["out_dir", "--discover-only", "--signals-only", "--min-posts", "3"]);
  assert.equal(args.discoverOnly, true);
  assert.equal(args.signalsOnly, true);
  assert.equal(args.minPosts, 3);
  assert.deepEqual(args.inputs, ["https://www.seatclub.cz/forum"]);
});

test("classifySeatTopicEntry drops manuals and low-post noise", () => {
  assert.equal(classifySeatTopicEntry({ title: "Leon 1.5 TSI oil leak", postCount: 4 }).keep, true);
  assert.equal(classifySeatTopicEntry({ title: "Owners manual", postCount: 9 }).keep, false);
  assert.equal(classifySeatTopicEntry({ title: "Foto", postCount: 12 }).keep, false);
  assert.equal(classifySeatTopicEntry({ title: "Need help", postCount: 1 }).keep, false);
});

test("discoverSeatRootCategoriesFromRoot keeps post-2000 SEAT forums and drops older ones", () => {
  const html = `
    <a href="https://www.seatclub.cz/forum-kategorie/arosa-9">Arosa</a>
    <a href="https://www.seatclub.cz/forum-kategorie/ibiza-iii-6l-21">Ibiza III 6L</a>
    <a href="https://www.seatclub.cz/forum-kategorie/toledo-34">Toledo</a>
    <a href="https://www.seatclub.cz/forum-kategorie/toledo-mk1-typ-1l-35">Toledo Mk1 Typ 1L</a>
  `;

  const categories = discoverSeatRootCategoriesFromRoot({
    rootUrl: "https://www.seatclub.cz/forum",
    rootHtml: html,
  });

  const arosa = categories.find((entry) => entry.forum_url.includes("arosa-9"));
  const ibiza = categories.find((entry) => entry.forum_url.includes("ibiza-iii-6l-21"));
  const toledo = categories.find((entry) => entry.forum_url.includes("toledo-34"));
  const toledoMk1 = categories.find((entry) => entry.forum_url.includes("toledo-mk1-typ-1l-35"));

  assert.equal(arosa.keep, false);
  assert.equal(ibiza.keep, true);
  assert.equal(ibiza.resolved_model, "Ibiza III 6L (2002–2008)");
  assert.equal(toledo.keep, true);
  assert.equal(toledo.forum_type, "model_family");
  assert.equal(toledoMk1.keep, false);
});

test("resolveSeatVehicleModel resolves exact SEAT forums and stays conservative on Toledo family forums", () => {
  const exact = resolveSeatVehicleModel({
    modelRaw: "Leon III 5F",
    threadTitle: "Leon III 2.0 TDI DPF warning",
    parentForumTitle: "Leon III 5F - Fórum - SEAT klub",
    subforumUrl: "https://www.seatclub.cz/forum-kategorie/leon-iii-5f-47",
  });
  assert.equal(exact, "Leon III (2012–2020)");

  const yearMatch = resolveSeatVehicleModel({
    modelRaw: "Toledo",
    threadTitle: "SEAT Toledo 2015 1.2 TSI misfire",
    parentForumTitle: "Toledo - Fórum - SEAT klub",
    subforumUrl: "https://www.seatclub.cz/forum-kategorie/toledo-34",
  });
  assert.equal(yearMatch, "Toledo IV (2012–2019)");

  const ambiguous = resolveSeatVehicleModel({
    modelRaw: "Toledo",
    threadTitle: "SEAT Toledo steering noise",
    parentForumTitle: "Toledo - Fórum - SEAT klub",
    subforumUrl: "https://www.seatclub.cz/forum-kategorie/toledo-34",
  });
  assert.equal(ambiguous, null);

  const exactToledoIv = resolveSeatVehicleModel({
    modelRaw: "Toledo Mk4 Typ NH",
    threadTitle: "SEAT Toledo Mk4 1.2 TSI no start",
    parentForumTitle: "Toledo Mk4 Typ NH - Fórum - SEAT klub",
    subforumUrl: "https://www.seatclub.cz/forum-kategorie/toledo-mk4-typ-nh-38",
  });
  assert.equal(exactToledoIv, "Toledo IV (2012–2019)");

  const excluded = resolveSeatVehicleModel({
    modelRaw: "Leon I Typ 1M",
    threadTitle: "SEAT Leon I clutch problem",
    parentForumTitle: "Leon I Typ 1M - Fórum - SEAT klub",
    subforumUrl: "https://www.seatclub.cz/forum-kategorie/leon-i-typ-1m-23",
  });
  assert.equal(excluded, null);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
