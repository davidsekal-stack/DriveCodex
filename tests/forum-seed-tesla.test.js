import assert from "node:assert/strict";

import {
  classifyTeslaTopicEntry,
  discoverTeslaRootCategoriesFromRoot,
  parseArgs,
  resolveTeslaVehicleModel,
} from "../scripts/forum-seed-tesla.mjs";

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

console.log("\n== forum-seed-tesla ==");

test("parseArgs uses the Tesla root forum by default", () => {
  const args = parseArgs(["out_dir", "--discover-only", "--signals-only", "--min-posts", "3"]);
  assert.equal(args.discoverOnly, true);
  assert.equal(args.signalsOnly, true);
  assert.equal(args.minPosts, 3);
  assert.deepEqual(args.inputs, ["https://cs.tesla-club.eu/forum"]);
});

test("classifyTeslaTopicEntry drops manuals and low-post noise", () => {
  assert.equal(classifyTeslaTopicEntry({ title: "Model 3 HV battery warning", postCount: 4 }).keep, true);
  assert.equal(classifyTeslaTopicEntry({ title: "Owners manual", postCount: 9 }).keep, false);
  assert.equal(classifyTeslaTopicEntry({ title: "Foto", postCount: 12 }).keep, false);
  assert.equal(classifyTeslaTopicEntry({ title: "Need help", postCount: 1 }).keep, false);
});

test("discoverTeslaRootCategoriesFromRoot keeps only produced Tesla model forums", () => {
  const html = `
    <a href="https://cs.tesla-club.eu/forum-kategorie/model-s-23">Model S</a>
    <a href="https://cs.tesla-club.eu/forum-kategorie/model-y-27">Model Y</a>
    <a href="https://cs.tesla-club.eu/forum-kategorie/cybertruck-29">Cybertruck</a>
    <a href="https://cs.tesla-club.eu/forum-kategorie/roadster-i-22">Roadster I</a>
    <a href="https://cs.tesla-club.eu/forum-kategorie/roadster-ii-30">Roadster II</a>
    <a href="https://cs.tesla-club.eu/forum-kategorie/cybercab-robotaxi-31">Cybercab / Robotaxi</a>
    <a href="https://cs.tesla-club.eu/forum-kategorie/pokec-vseobecny-2">Pokec všeobecný</a>
  `;

  const categories = discoverTeslaRootCategoriesFromRoot({
    rootUrl: "https://cs.tesla-club.eu/forum",
    rootHtml: html,
  });

  const modelS = categories.find((entry) => entry.forum_url.includes("model-s-23"));
  const modelY = categories.find((entry) => entry.forum_url.includes("model-y-27"));
  const cybertruck = categories.find((entry) => entry.forum_url.includes("cybertruck-29"));
  const roadsterI = categories.find((entry) => entry.forum_url.includes("roadster-i-22"));
  const roadsterII = categories.find((entry) => entry.forum_url.includes("roadster-ii-30"));
  const cybercab = categories.find((entry) => entry.forum_url.includes("cybercab-robotaxi-31"));
  const pokec = categories.find((entry) => entry.forum_url.includes("pokec-vseobecny-2"));

  assert.equal(modelS.keep, true);
  assert.equal(modelS.forum_type, "model_family");
  assert.deepEqual(modelS.candidate_models, ["Model S (2012–2020)", "Model S (2021–dosud)"]);
  assert.equal(modelY.keep, true);
  assert.equal(modelY.forum_type, "model_family");
  assert.deepEqual(modelY.candidate_models, ["Model Y (2020–2024)", "Model Y Juniper (2025–dosud)"]);
  assert.equal(cybertruck.keep, true);
  assert.equal(cybertruck.resolved_model, "Cybertruck (2023–dosud)");
  assert.equal(roadsterI.keep, true);
  assert.equal(roadsterI.resolved_model, "Roadster I (2008–2012)");
  assert.equal(roadsterII.keep, false);
  assert.equal(cybercab.keep, false);
  assert.equal(pokec.keep, false);
});

test("resolveTeslaVehicleModel uses year hints conservatively on family forums", () => {
  const model3Highland = resolveTeslaVehicleModel({
    modelRaw: "Model 3",
    threadTitle: "Tesla Model 3 2025 heat pump issue",
    parentForumTitle: "Model 3 - Fórum - Tesla klub",
    subforumUrl: "https://cs.tesla-club.eu/forum-kategorie/model-3-26",
  });
  assert.equal(model3Highland, "Model 3 Highland (2024–dosud)");

  const modelYOld = resolveTeslaVehicleModel({
    modelRaw: "Model Y",
    threadTitle: "Model Y 2023 charge port flap stuck",
    parentForumTitle: "Model Y - Fórum - Tesla klub",
    subforumUrl: "https://cs.tesla-club.eu/forum-kategorie/model-y-27",
  });
  assert.equal(modelYOld, "Model Y (2020–2024)");

  const ambiguous = resolveTeslaVehicleModel({
    modelRaw: "Model S",
    threadTitle: "Tesla Model S charging problem",
    parentForumTitle: "Model S - Fórum - Tesla klub",
    subforumUrl: "https://cs.tesla-club.eu/forum-kategorie/model-s-23",
  });
  assert.equal(ambiguous, null);

  const cybertruck = resolveTeslaVehicleModel({
    modelRaw: "Cybertruck",
    threadTitle: "Cybertruck steering warning",
    parentForumTitle: "Cybertruck - Fórum - Tesla klub",
    subforumUrl: "https://cs.tesla-club.eu/forum-kategorie/cybertruck-29",
  });
  assert.equal(cybertruck, "Cybertruck (2023–dosud)");

  const roadsterII = resolveTeslaVehicleModel({
    modelRaw: "Roadster II",
    threadTitle: "Roadster II preorder discussion",
    parentForumTitle: "Roadster II - Fórum - Tesla klub",
    subforumUrl: "https://cs.tesla-club.eu/forum-kategorie/roadster-ii-30",
  });
  assert.equal(roadsterII, null);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
