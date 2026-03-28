import assert from "node:assert/strict";

import {
  classifyHyundaiTopicEntry,
  extractHyundaiForumEntriesFromHtml,
  extractHyundaiTopicEntriesFromForumPage,
  extractPostsFromHyundaiThreadHtml,
  inferHyundaiForumInventory,
  parseArgs,
  resolveHyundaiVehicleModel,
} from "../scripts/forum-seed-hyundai.mjs";

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

console.log("\n== forum-seed-hyundai ==");

test("parseArgs uses Hyundai root by default", () => {
  const args = parseArgs(["out_dir", "--discover-only", "--signals-only", "--min-posts", "3"]);
  assert.equal(args.discoverOnly, true);
  assert.equal(args.signalsOnly, true);
  assert.equal(args.minPosts, 3);
  assert.deepEqual(args.inputs, ["https://www.hyundai-club.eu/forums/"]);
});

test("extractHyundaiForumEntriesFromHtml finds forum links under /forums", () => {
  const html = `
    <a href="/forums/i20.276/" data-shortcut="node-description">i20</a>
    <a href="/forums/i20-2015-2020.265/" class="subNodeLink subNodeLink--forum">i20 (2015-2020)</a>
    <a href="/forums/presentazione-nuovi-arrivati.11/" data-shortcut="node-description">Presentazione nuovi arrivati</a>
  `;
  const entries = extractHyundaiForumEntriesFromHtml(html, "https://www.hyundai-club.eu/forums/");
  assert.deepEqual(
    entries.map((item) => item.forum_url),
    [
      "https://www.hyundai-club.eu/forums/i20.276/",
      "https://www.hyundai-club.eu/forums/i20-2015-2020.265/",
      "https://www.hyundai-club.eu/forums/presentazione-nuovi-arrivati.11/",
    ]
  );
});

test("inferHyundaiForumInventory keeps verified post-2000 Hyundai sections and rejects mixed forums", () => {
  const html = `
    <a href="/forums/i20-2015-2020.265/" data-shortcut="node-description">i20 (2015-2020)</a>
    <a href="/forums/santa-fe-modelli-2000-2012.13/" class="subNodeLink subNodeLink--forum">Santa Fe (modelli 2000-2012)</a>
    <a href="/forums/ioniq-5-5n.338/" data-shortcut="node-description">Ioniq 5 / 5N</a>
    <a href="/forums/coupe-rd-gk.19/" data-shortcut="node-description">Coupe RD/GK</a>
    <a href="/forums/genesis-xg30-i50.23/" data-shortcut="node-description">Genesis/XG30/i50</a>
    <a href="/forums/presentazione-nuovi-arrivati.11/" data-shortcut="node-description">Presentazione nuovi arrivati!</a>
  `;

  const inventory = inferHyundaiForumInventory({
    rootUrl: "https://www.hyundai-club.eu/forums/",
    rootHtml: html,
  });

  const i20 = inventory.find((entry) => entry.forum_url.includes("i20-2015-2020.265"));
  const santaFe = inventory.find((entry) => entry.forum_url.includes("santa-fe-modelli-2000-2012.13"));
  const ioniq5 = inventory.find((entry) => entry.forum_url.includes("ioniq-5-5n.338"));
  const coupe = inventory.find((entry) => entry.forum_url.includes("coupe-rd-gk.19"));
  const genesis = inventory.find((entry) => entry.forum_url.includes("genesis-xg30-i50.23"));
  const hello = inventory.find((entry) => entry.forum_url.includes("presentazione-nuovi-arrivati.11"));

  assert.equal(i20.keep, true);
  assert.equal(i20.resolved_model, "i20 II GB (2014–2020)");
  assert.equal(santaFe.keep, true);
  assert.equal(santaFe.forum_type, "model_family");
  assert.deepEqual(santaFe.candidate_models, ["Santa Fe I SM (2000–2006)", "Santa Fe II CM (2006–2012)"]);
  assert.equal(ioniq5.keep, true);
  assert.equal(ioniq5.resolved_model, "IONIQ 5 NE (2021–)");
  assert.equal(coupe.keep, false);
  assert.equal(genesis.keep, false);
  assert.equal(hello.keep, false);
});

test("classifyHyundaiTopicEntry drops manuals and low-post threads, keeps strong fault titles", () => {
  assert.equal(classifyHyundaiTopicEntry({ title: "Problemi catena distribuzione", postCount: 24, minPosts: 2, signalsOnly: true }).keep, true);
  assert.equal(classifyHyundaiTopicEntry({ title: "Owners manual", postCount: 9, minPosts: 2, signalsOnly: false }).keep, false);
  assert.equal(classifyHyundaiTopicEntry({ title: "Foto", postCount: 12, minPosts: 2, signalsOnly: false }).keep, false);
  assert.equal(classifyHyundaiTopicEntry({ title: "Salve a tutti, ho una i20 2009 1.4 benzina", postCount: 1, minPosts: 2, signalsOnly: true }).keep, false);
});

test("extractHyundaiTopicEntriesFromForumPage parses XenForo thread rows and filters by signals", () => {
  const html = `
    <div class="structItem structItem--thread js-inlineModContainer js-threadListItem-12968" data-author="pessi">
      <div class="structItem-title"><a href="/threads/risolto-pedale-frizione-duro-problema-frizione-e-versioni-successive-2008-2020.12968/">[Risolto] Pedale frizione duro, problema frizione?</a></div>
      <dt>Risposte</dt><dd>469</dd>
    </div>
    <div class="structItem structItem--thread js-inlineModContainer js-threadListItem-3933" data-author="MaxSilver">
      <div class="structItem-title"><a href="/threads/scheda-tagliandi-i20.3933/">Scheda Tagliandi i20</a></div>
      <dt>Risposte</dt><dd>60</dd>
    </div>
    <div class="structItem structItem--thread js-inlineModContainer js-threadListItem-43061" data-author="Gaetano@">
      <div class="structItem-title"><a href="/threads/salve-a-tutti-ho-una-i20-2009-1-4-benzina.43061/">Salve a tutti, ho una i20 2009 1.4 benzina</a></div>
      <dt>Risposte</dt><dd>1</dd>
    </div>
  `;
  const topics = extractHyundaiTopicEntriesFromForumPage(html, "https://www.hyundai-club.eu/forums/i20-motore-alimentazione-tagliandi.113/", {
    minPosts: 2,
    signalsOnly: true,
  });
  assert.equal(topics.length, 3);
  assert.equal(topics[0].keep, true);
  assert.equal(topics[1].keep, false);
  assert.equal(topics[2].keep, false);
});

test("resolveHyundaiVehicleModel uses forum generation and explicit year hints conservatively", () => {
  const i20n = resolveHyundaiVehicleModel({
    modelRaw: "i20 N",
    threadTitle: "i20 N 2022 boost pressure issue",
    parentForumTitle: "i20 N",
    subforumTitle: "i20 N",
    subforumUrl: "https://www.hyundai-club.eu/forums/i20-n.319/",
  });
  assert.equal(i20n, "i20 III BC3 (2020–)");

  const santaFeOld = resolveHyundaiVehicleModel({
    modelRaw: "Santa Fe",
    threadTitle: "Santa Fe 2005 CRDi ABS warning",
    parentForumTitle: "Santa Fe",
    subforumTitle: "Santa Fe (modelli 2000-2012)",
    subforumUrl: "https://www.hyundai-club.eu/forums/santa-fe-modelli-2000-2012.13/",
  });
  assert.equal(santaFeOld, "Santa Fe I SM (2000–2006)");

  const ix35 = resolveHyundaiVehicleModel({
    modelRaw: "ix35",
    threadTitle: "ix35 2013 2.0 CRDi limp mode",
    parentForumTitle: "Tucson / ix35",
    subforumTitle: "Tucson / ix35",
    subforumUrl: "https://www.hyundai-club.eu/forums/tucson-ix35.278/",
  });
  assert.equal(ix35, "Tucson II LM / ix35 (2009–2015)");

  const ioniq5 = resolveHyundaiVehicleModel({
    modelRaw: "",
    threadTitle: "IONIQ 5 N inverter warning",
    parentForumTitle: "Ioniq 5 / 5N",
    subforumTitle: "Ioniq 5 / 5N",
    subforumUrl: "https://www.hyundai-club.eu/forums/ioniq-5-5n.338/",
  });
  assert.equal(ioniq5, "IONIQ 5 NE (2021–)");
});

test("extractPostsFromHyundaiThreadHtml parses XenForo posts", () => {
  const html = `
    <article class="message message--post js-post js-inlineModContainer" data-author="UserA" data-content="post-101" id="js-post-101">
      <article class="message-body js-selectToQuote">
        <div class="bbWrapper">Engine jerks when warm.<br />ABS light is on.</div>
      </article>
      <time datetime="2026-03-21T12:00:00+0100"></time>
    </article>
    <article class="message message--post js-post js-inlineModContainer" data-author="UserA" data-content="post-102" id="js-post-102">
      <article class="message-body js-selectToQuote">
        <div class="bbWrapper">Solved after replacing the wheel speed sensor.</div>
      </article>
      <time datetime="2026-03-22T12:00:00+0100"></time>
    </article>
  `;
  const posts = extractPostsFromHyundaiThreadHtml(html);
  assert.equal(posts.length, 2);
  assert.equal(posts[0].author, "UserA");
  assert.equal(posts[0].postId, "101");
  assert.match(posts[1].text, /wheel speed sensor/i);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
