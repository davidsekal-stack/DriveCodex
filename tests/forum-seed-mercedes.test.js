import assert from "node:assert/strict";

import {
  classifyMercedesTopicEntry,
  discoverMercedesRootCategoriesFromRoot,
  parseArgs,
  resolveMercedesVehicleModel,
} from "../scripts/forum-seed-mercedes.mjs";

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

console.log("\n== forum-seed-mercedes ==");

test("parseArgs uses the Mercedes root forum by default", () => {
  const args = parseArgs(["out_dir", "--discover-only", "--signals-only", "--min-posts", "3"]);
  assert.equal(args.discoverOnly, true);
  assert.equal(args.signalsOnly, true);
  assert.equal(args.minPosts, 3);
  assert.deepEqual(args.inputs, ["https://www.mercedesclub.cz/forum"]);
});

test("classifyMercedesTopicEntry drops manuals and low-post noise", () => {
  assert.equal(classifyMercedesTopicEntry({ title: "W211 220 CDI no start", postCount: 4 }).keep, true);
  assert.equal(classifyMercedesTopicEntry({ title: "Owners manual", postCount: 9 }).keep, false);
  assert.equal(classifyMercedesTopicEntry({ title: "Foto", postCount: 12 }).keep, false);
  assert.equal(classifyMercedesTopicEntry({ title: "Need help", postCount: 1 }).keep, false);
});

test("discoverMercedesRootCategoriesFromRoot keeps verified post-2000 forums and drops older or mixed sections", () => {
  const html = `
    <a href="https://www.mercedesclub.cz/forum-kategorie/a-class-w168-19">A-Class W168</a>
    <a href="https://www.mercedesclub.cz/forum-kategorie/a-class-w169-54">A-Class W169</a>
    <a href="https://www.mercedesclub.cz/forum-kategorie/c-class-w203-33">C-Class W203</a>
    <a href="https://www.mercedesclub.cz/forum-kategorie/c-class-w202-32">C-Class W202</a>
    <a href="https://www.mercedesclub.cz/forum-kategorie/gla-class-69">GLA-Class</a>
    <a href="https://www.mercedesclub.cz/forum-kategorie/sprinter-25">Sprinter</a>
    <a href="https://www.mercedesclub.cz/forum-kategorie/vaneo-w414-21">Vaneo W414</a>
  `;

  const categories = discoverMercedesRootCategoriesFromRoot({
    rootUrl: "https://www.mercedesclub.cz/forum",
    rootHtml: html,
  });

  const w168 = categories.find((entry) => entry.forum_url.includes("a-class-w168-19"));
  const w169 = categories.find((entry) => entry.forum_url.includes("a-class-w169-54"));
  const w203 = categories.find((entry) => entry.forum_url.includes("c-class-w203-33"));
  const w202 = categories.find((entry) => entry.forum_url.includes("c-class-w202-32"));
  const gla = categories.find((entry) => entry.forum_url.includes("gla-class-69"));
  const sprinter = categories.find((entry) => entry.forum_url.includes("sprinter-25"));
  const vaneo = categories.find((entry) => entry.forum_url.includes("vaneo-w414-21"));

  assert.equal(w168.keep, false);
  assert.equal(w169.keep, true);
  assert.equal(w169.resolved_model, "A-Class W169 (2004–2012)");
  assert.equal(w203.keep, true);
  assert.equal(w203.resolved_model, "C-Class W203 (2000–2007)");
  assert.equal(w202.keep, false);
  assert.equal(gla.keep, true);
  assert.equal(gla.forum_type, "model_family");
  assert.deepEqual(gla.candidate_models, ["GLA X156 (2013–2020)", "GLA H247 (2020–současnost)"]);
  assert.equal(sprinter.keep, false);
  assert.equal(vaneo.keep, true);
  assert.equal(vaneo.resolved_model, "Vaneo W414 (2001–2005)");
});

test("resolveMercedesVehicleModel resolves exact codes and stays conservative on ambiguous shared forums", () => {
  const exact = resolveMercedesVehicleModel({
    modelRaw: "W211",
    threadTitle: "E280 CDI W211 limp mode",
    parentForumTitle: "E-Class W211 - Fórum - Mercedes klub",
    subforumUrl: "https://www.mercedesclub.cz/forum-kategorie/e-class-w211-41",
  });
  assert.equal(exact, "E-Class W211 (2002–2009)");

  const familyByYear = resolveMercedesVehicleModel({
    modelRaw: "GLA",
    threadTitle: "Mercedes GLA 2018 AdBlue warning",
    parentForumTitle: "GLA-Class - Fórum - Mercedes klub",
    subforumUrl: "https://www.mercedesclub.cz/forum-kategorie/gla-class-69",
  });
  assert.equal(familyByYear, "GLA X156 (2013–2020)");

  const claByForumAndYear = resolveMercedesVehicleModel({
    modelRaw: "CLA",
    threadTitle: "CLA 250 2021 transmission warning",
    parentForumTitle: "A-Class CLA - Fórum - Mercedes klub",
    subforumUrl: "https://www.mercedesclub.cz/forum-kategorie/a-class-cla-38",
  });
  assert.equal(claByForumAndYear, "CLA C118 (2019–současnost)");

  const glByForumAndYear = resolveMercedesVehicleModel({
    modelRaw: "GL 500",
    threadTitle: "GL 500 2013 jerking 7G-Tronic",
    parentForumTitle: "GLS-Class - Fórum - Mercedes klub",
    subforumUrl: "https://www.mercedesclub.cz/forum-kategorie/gls-class-95",
  });
  assert.equal(glByForumAndYear, "GL / GLS X166 (2012–2019)");

  const vClassByAlias = resolveMercedesVehicleModel({
    modelRaw: "V-class",
    threadTitle: "V-class W447 frozen MBUX screen",
    parentForumTitle: "Vito/Viano W447 - Fórum - Mercedes klub",
    subforumUrl: "https://www.mercedesclub.cz/forum-kategorie/vito-viano-w447-67",
  });
  assert.equal(vClassByAlias, "V-Class W447 (2014–současnost)");

  const ambiguous = resolveMercedesVehicleModel({
    modelRaw: "GLA",
    threadTitle: "Mercedes GLA no start",
    parentForumTitle: "GLA-Class - Fórum - Mercedes klub",
    subforumUrl: "https://www.mercedesclub.cz/forum-kategorie/gla-class-69",
  });
  assert.equal(ambiguous, null);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
