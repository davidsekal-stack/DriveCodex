import assert from "node:assert/strict";

import {
  canonicalListingUrl,
  canonicalTopicUrl,
  classifyTopicEntry,
  detectPotentialCatalogHints,
  extractNextPageUrl,
  extractPostsFromPhpbb,
  extractTopicEntriesFromForumPage,
  inferForumInventory,
  normalizeThreadTitle,
  parseArgs,
  resolveTransitFamilyVehicleModel,
  sanitizeResolvedTransitModel,
} from "../scripts/forum-seed-fordtransit.mjs";

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

console.log("\n== forum-seed-fordtransit ==");

test("parseArgs defaults to the Ford Transit technical forum", () => {
  const args = parseArgs(["out_dir", "--discover-only", "--min-replies", "2"]);
  assert.equal(args.discoverOnly, true);
  assert.equal(args.minReplies, 2);
  assert.deepEqual(args.inputs, ["https://fordtransit.org/forum/viewforum.php?f=2"]);
});

test("canonical topic and listing URLs strip session ids and keep pagination", () => {
  assert.equal(
    canonicalTopicUrl("https://fordtransit.org/forum/viewtopic.php?f=2&t=228481&sid=abc#p1849397"),
    "https://fordtransit.org/forum/viewtopic.php?f=2&t=228481",
  );
  assert.equal(
    canonicalListingUrl("https://fordtransit.org/forum/viewforum.php?f=2&sid=abc&start=50"),
    "https://fordtransit.org/forum/viewforum.php?f=2&start=50",
  );
});

test("normalizeThreadTitle strips phpBB page-title chrome", () => {
  assert.equal(
    normalizeThreadTitle("Ford Transit Forum • View topic - Mk 7 2.2 cuts out when cold"),
    "Mk 7 2.2 cuts out when cold",
  );
});

test("classifyTopicEntry drops sticky noise and keeps signal-rich faults", () => {
  assert.equal(classifyTopicEntry({ title: "Radio Codes", replies: 12, rowClass: "row bg1 sticky" }).keep, false);
  assert.equal(classifyTopicEntry({ title: "Slow crank when warm", replies: 4, rowClass: "row bg1" }).keep, true);
  assert.equal(classifyTopicEntry({ title: "help", replies: 5, rowClass: "row bg1" }).keep, false);
  assert.equal(classifyTopicEntry({ title: "Gearbox code difference", replies: 2, rowClass: "row bg1" }).keep, false);
  assert.equal(classifyTopicEntry({ title: "Cruise control retrofit", replies: 3, rowClass: "row bg1" }).keep, false);
  assert.equal(classifyTopicEntry({ title: "Forscan Diagnostics Suggestion", replies: 4, rowClass: "row bg1" }).keep, false);
  assert.equal(classifyTopicEntry({ title: "Forscan throttle position & underboost p0299", replies: 2, rowClass: "row bg1" }).keep, true);
  assert.equal(classifyTopicEntry({ title: "MK5 Paint Code", replies: 2, rowClass: "row bg1" }).keep, false);
  assert.equal(classifyTopicEntry({ title: "350 Leader 130ps and 170ps tow capacity", replies: 1, rowClass: "row bg1" }).keep, false);
  assert.equal(classifyTopicEntry({ title: "Roof rack noise", replies: 3, rowClass: "row bg1" }).keep, false);
});

test("extractTopicEntriesFromForumPage parses phpBB rows and preserves keep flags", () => {
  const html = `
    <li class="row bg1 sticky">
      <dl class="icon">
        <dt><a href="./viewtopic.php?f=2&t=59769&sid=aaa" class="topictitle">Radio Codes</a><br />by tipp3r &raquo; Sun Oct 31, 2010 6:14 pm</dt>
        <dd class="posts">1522 <dfn>Replies</dfn></dd>
        <dd class="views">736207 <dfn>Views</dfn></dd>
        <dd class="lastpost"><span><dfn>Last post </dfn>by loot<br />Sat Dec 22, 2018 3:45 pm</span></dd>
      </dl>
    </li>
    <li class="row bg2">
      <dl class="icon">
        <dt><a href="./viewtopic.php?f=2&t=236558&sid=bbb" class="topictitle">Slow crank when warm</a><br />by VanDuVin &raquo; Sun Mar 29, 2026 7:16 pm</dt>
        <dd class="posts">4 <dfn>Replies</dfn></dd>
        <dd class="views">107 <dfn>Views</dfn></dd>
        <dd class="lastpost"><span><dfn>Last post </dfn>by bortaf<br />Wed Apr 01, 2026 7:07 pm</span></dd>
      </dl>
    </li>
  `;

  const topics = extractTopicEntriesFromForumPage(html, "https://fordtransit.org/forum/viewforum.php?f=2", 1);
  assert.equal(topics.length, 2);
  assert.equal(topics[0].keep, false);
  assert.equal(topics[1].keep, true);
  assert.equal(topics[1].replies, 4);
  assert.equal(topics[1].views, 107);
  assert.equal(topics[1].url, "https://fordtransit.org/forum/viewtopic.php?f=2&t=236558");
});

test("extractNextPageUrl advances listing and topic pagination", () => {
  const html = `
    <a href="./viewforum.php?f=2&start=50">2</a>
    <a href="./viewtopic.php?f=2&t=4713&start=15">2</a>
  `;

  assert.equal(
    extractNextPageUrl(html, "https://fordtransit.org/forum/viewforum.php?f=2", "listing"),
    "https://fordtransit.org/forum/viewforum.php?f=2&start=50",
  );
  assert.equal(
    extractNextPageUrl(html, "https://fordtransit.org/forum/viewtopic.php?f=2&t=4713", "topic"),
    "https://fordtransit.org/forum/viewtopic.php?f=2&t=4713&start=15",
  );
});

test("extractPostsFromPhpbb keeps author metadata and strips quote noise", () => {
  const html = `
    <div id="p1849397" class="post bg2">
      <div class="postbody">
        <p class="author">by <strong><a href="./memberlist.php?u=1">cledthehead</a></strong> &raquo; Fri Jun 14, 2024 12:22 pm </p>
        <div class="content">Hope someone here can help.<br /><blockquote><div>Old quote</div></blockquote>Crank sensor will not insert fully.</div>
      </div>
    </div>
    <div id="p1854874" class="post bg1">
      <div class="postbody">
        <p class="author">by <strong><a href="./memberlist.php?u=1">cledthehead</a></strong> &raquo; Wed Jul 31, 2024 6:56 pm </p>
        <div class="content">Solved. The bracket had a slight kink stopping the sensor being fully inserted. New bracket solved the problem.</div>
      </div>
    </div>
  `;

  const posts = extractPostsFromPhpbb(html, 1);
  assert.equal(posts.length, 2);
  assert.equal(posts[0].author, "cledthehead");
  assert.equal(posts[0].postId, "1849397");
  assert.match(posts[0].text, /Crank sensor will not insert fully/);
  assert.doesNotMatch(posts[0].text, /Old quote/);
});

test("detectPotentialCatalogHints surfaces Tourneo Connect and electric Tourneo variants", () => {
  const hints = detectPotentialCatalogHints("2025 Tourneo Connect PHEV and E-Tourneo Custom discussion");
  assert.ok(hints.includes("Tourneo Connect III 1.5 EcoBoost PHEV (2022–současnost)"));
  assert.ok(hints.includes("E-Tourneo Custom Elektro (2024–současnost)"));
});

test("resolveTransitFamilyVehicleModel recovers obvious Transit generation clues", () => {
  assert.equal(
    resolveTransitFamilyVehicleModel({
      modelRaw: "Transit",
      threadTitle: "Mk 7 2.2 cuts out when cold",
      parentForumTitle: "Technical Problems & Questions",
    }),
    "Transit MK7 2.2 TDCi (2006–2011)",
  );

  assert.equal(
    resolveTransitFamilyVehicleModel({
      modelRaw: "Transit",
      threadTitle: "Crankshaft sensor problem Euro 5",
      parentForumTitle: "Technical Problems & Questions",
      extraText: "2012/2013 Transit 2.2tdci Euro 5 engine code FAF6",
    }),
    "Transit MK7 FL 2.2 TDCi (2011–2014)",
  );

  assert.equal(
    resolveTransitFamilyVehicleModel({
      modelRaw: "Transit",
      threadTitle: "mk6 speedo",
      parentForumTitle: "Technical Problems & Questions",
      extraText: "2002 mk6 jumbo transit",
    }),
    "Transit MK6 2.0/2.4 Diesel (2000–2006)",
  );

  assert.equal(
    resolveTransitFamilyVehicleModel({
      modelRaw: "Transit Connect",
      threadTitle: "05 connect battery light issue",
      parentForumTitle: "Technical Problems & Questions",
      extraText: "2005 Transit Connect TDDI",
    }),
    "Transit Connect I 1.8 TDDi/TDCi (2002–2013)",
  );

  assert.equal(
    resolveTransitFamilyVehicleModel({
      modelRaw: "Transit",
      threadTitle: "2.5 di high reving !",
      parentForumTitle: "Technical Problems & Questions",
      extraText: "banana engine epic diesel",
    }),
    "Transit MK5 2.5 Diesel (1994–2000)",
  );

  assert.equal(
    resolveTransitFamilyVehicleModel({
      modelRaw: "Transit",
      threadTitle: "P1170 Diesel Injection Fault",
      parentForumTitle: "Technical Problems & Questions",
      extraText: "Fault code P1170 electronic switch off solenoid plunger",
    }),
    "Transit MK5 2.5 Diesel (1994–2000)",
  );
});

test("sanitizeResolvedTransitModel drops contradictory fuel-type mappings", () => {
  assert.equal(
    sanitizeResolvedTransitModel(
      "Transit Custom I 1.0 EcoBoost PHEV (2019–2023)",
      "Transit Custom | 2.0 Diesel | weird noise on full lock",
    ),
    null,
  );
});

test("inferForumInventory marks the forum as shared Transit family context", () => {
  const inventory = inferForumInventory({
    forumUrl: "https://fordtransit.org/forum/viewforum.php?f=2&sid=abc",
    forumTitle: "Technical Problems & Questions",
  });
  assert.equal(inventory.forum_type, "shared");
  assert.equal(inventory.resolved_model, null);
  assert.match(inventory.note, /shared phpBB forum/i);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
