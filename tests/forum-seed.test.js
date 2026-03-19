import assert from "node:assert/strict";

import {
  buildThreadText,
  extractPostsFromInvision,
  extractTargetChildSections,
  isClassifierApproved,
  isReviewWorthClassifier,
  isReadyRecord,
  parsePostMetaFromThreadText,
  pickEnginePower,
  selectThreadPages,
  selectCatalogForMarket,
  shouldExpandMotorSubforums,
  validateExtractedCaseAuthor,
} from "../scripts/forum-seed.mjs";

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

console.log("\n== forum-seed ==");

test("extractPostsFromInvision keeps author metadata", () => {
  const html = `
    <article class="ipsComment" data-author="Mirek_golf" data-commentid="123">
      <time datetime="2025-02-24T06:18:00+01:00"></time>
      <div data-role="commentContent">
        Motor zhasina na volnobeh. Opraveno po vymene cidla kliky a auto uz nezhasina.
        Popis zavady je dostatecne dlouhy, aby nepropadl kratkemu filtru.
      </div>
    </article>
  `;

  const posts = extractPostsFromInvision(html);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].author, "Mirek_golf");
  assert.equal(posts[0].postId, "123");
});

test("extractTargetChildSections finds target sections from model root", () => {
  const html = `
    <a href="/forum/326-elektrika/">Elektrika</a>
    <a href="/forum/328-podvozek/">Podvozek</a>
    <a href="/forum/327-motor/">Motor</a>
    <a href="/forum/777-elektricky-pohon/">Elektrický pohon</a>
    <a href="/forum/999-karoserie/">Karoserie</a>
  `;
  const sections = extractTargetChildSections(html, "https://forum.skodahome.cz/forum/123-octavia-iii/");
  assert.deepEqual(
    sections.map(section => section.url),
    [
      "https://forum.skodahome.cz/forum/326-elektrika/",
      "https://forum.skodahome.cz/forum/328-podvozek/",
      "https://forum.skodahome.cz/forum/327-motor/",
      "https://forum.skodahome.cz/forum/777-elektricky-pohon/",
    ]
  );
});

test("buildThreadText marks thread author posts", () => {
  const text = buildThreadText({
    url: "https://example.test/topic/1",
    title: "Test thread",
    forumTitle: "Skoda OCTAVIA > Octavia III > Motor",
    subforumTitle: "Motor 2.0 TDI CR",
    subforumName: "Motor 2.0 TDI CR",
    posts: [
      { author: "Mirek_golf", when: "2025-02-24T06:18:00+01:00", postId: "1", text: "Original post text long enough." },
      { author: "HelperUser", when: "2025-02-24T07:00:00+01:00", postId: "2", text: "Helper reply text long enough." },
      { author: "Mirek_golf", when: "2025-02-25T09:00:00+01:00", postId: "3", text: "Confirmed fix text long enough." },
    ],
  });

  assert.match(text, /THREAD_AUTHOR: Mirek_golf/);
  assert.match(text, /FORUM_CONTEXT: Skoda OCTAVIA > Octavia III > Motor/);
  assert.match(text, /SUBFORUM_NAME: Motor 2.0 TDI CR/);
  assert.match(text, /POST 1 \| page: 1 \| author: Mirek_golf \| is_thread_author: true/);
  assert.match(text, /POST 2 \| page: 1 \| author: HelperUser \| is_thread_author: false/);
});

test("isClassifierApproved requires strict true flags and evidence", () => {
  assert.equal(isClassifierApproved({
    should_seed: true,
    is_relevant: true,
    has_explicit_fault: true,
    has_confirmed_resolution: true,
    same_user_confirms_resolution: true,
    has_required_fields: true,
    evidence_post_numbers: [1, 3],
  }), true);

  assert.equal(isClassifierApproved({
    should_seed: true,
    is_relevant: true,
    has_explicit_fault: true,
    has_confirmed_resolution: true,
    same_user_confirms_resolution: false,
    has_required_fields: true,
    evidence_post_numbers: [1, 3],
  }), false);
});

test("isReviewWorthClassifier keeps real fault threads for manual review", () => {
  assert.equal(isReviewWorthClassifier({
    is_relevant: true,
    has_explicit_fault: true,
    has_confirmed_resolution: false,
  }), true);

  assert.equal(isReviewWorthClassifier({
    is_relevant: false,
    has_explicit_fault: true,
  }), false);
});

test("isReadyRecord combines classifier and schema completeness", () => {
  const classifier = {
    should_seed: true,
    is_relevant: true,
    has_explicit_fault: true,
    has_confirmed_resolution: true,
    same_user_confirms_resolution: true,
    has_required_fields: true,
    evidence_post_numbers: [1, 2],
  };

  const complete = {
    vehicle_brand: "Skoda",
    vehicle_model: "Octavia III",
    engine_power: "110 kW - 2.0 TDI",
    symptoms: ["Engine stalls"],
    obd_codes: [],
    description: "Engine stalls at idle.",
    resolution: "Replaced failed crankshaft sensor.",
  };

  const incomplete = { ...complete, engine_power: null };

  assert.equal(isReadyRecord(complete, classifier), true);
  assert.equal(isReadyRecord(incomplete, classifier), false);
});

test("selectCatalogForMarket defaults to EU-like entries", () => {
  const { market, catalog } = selectCatalogForMarket("eu");
  assert.equal(market, "eu");
  assert.ok(catalog.length > 0);
  assert.ok(catalog.some(entry => entry.brand === "Skoda" || entry.brand === "Škoda"));
  assert.ok(!catalog.some(entry => entry.brand.includes("(US)")));
});

test("pickEnginePower can disambiguate from thread and subforum context", () => {
  const { catalog } = selectCatalogForMarket("eu");
  const skoda = catalog.find(entry => entry.brand === "Skoda" || entry.brand === "Škoda" || entry.brand === "Ĺ koda");
  assert.ok(skoda);

  const engine = pickEnginePower(
    skoda,
    "Octavia III (2013–2020)",
    "1.4 TSI 110kW EA211 | Motor 1.4 TSI"
  );

  assert.match(engine, /110 kW.*1\.4 TSI/);
});

test("shouldExpandMotorSubforums only expands one motor level", () => {
  assert.equal(shouldExpandMotorSubforums("motor", 0), true);
  assert.equal(shouldExpandMotorSubforums("motor", 1), false);
  assert.equal(shouldExpandMotorSubforums("elektrika", 0), false);
});

test("selectThreadPages reads the full thread up to the limit", () => {
  assert.deepEqual(selectThreadPages(5, 999), [1, 2, 3, 4, 5]);
  assert.deepEqual(selectThreadPages(8, 3), [1, 2, 3]);
});

test("validateExtractedCaseAuthor accepts same-user case without thread-author restriction", () => {
  const text = buildThreadText({
    url: "https://example.test/topic/2",
    title: "Two users in one thread",
    posts: [
      { author: "UserA", when: "2025-02-24T06:18:00+01:00", postId: "1", text: "Original thread author asks something else long enough." },
      { author: "UserB", when: "2025-02-24T07:00:00+01:00", postId: "2", text: "My car stalls at idle and loses power. This text is long enough to look like a real case." },
      { author: "HelperUser", when: "2025-02-24T08:00:00+01:00", postId: "3", text: "Try checking the throttle body. This helper text is also long enough." },
      { author: "UserB", when: "2025-02-25T09:00:00+01:00", postId: "4", text: "Solved after replacing the throttle body. Confirmed fixed and no more stalling." },
    ],
  });

  const postMeta = parsePostMetaFromThreadText(text);
  const validation = validateExtractedCaseAuthor({
    case_author: "UserB",
    fault_post_numbers: [2],
    resolution_post_numbers: [4],
  }, postMeta);

  assert.equal(validation.ok, true);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
