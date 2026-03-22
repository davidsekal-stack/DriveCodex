import assert from "node:assert/strict";

import {
  buildChildArgs,
  normalizeTargetToken,
  parseArgs,
  resolveBatchTargets,
} from "../scripts/forum-seed-batch.mjs";

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

console.log("\n== forum-seed-batch ==");

test("normalizeTargetToken normalizes brand aliases and bare roots", () => {
  assert.equal(normalizeTargetToken("Citroën"), "citroen");
  assert.equal(normalizeTargetToken("https://www.bmw-club.cz/"), "www.bmw-club.cz/forum");
  assert.equal(normalizeTargetToken("https://www.seatclub.cz/forum"), "www.seatclub.cz/forum");
});

test("resolveBatchTargets uses the default club roots when no targets are provided", () => {
  const targets = resolveBatchTargets([]);
  assert.deepEqual(targets.map((target) => target.slug), ["citroen", "bmw", "opel", "seat"]);
});

test("resolveBatchTargets accepts aliases and root URLs and de-duplicates repeated targets", () => {
  const targets = resolveBatchTargets([
    "citroen",
    "https://www.bmw-club.cz/",
    "https://www.club-opel.com/forum",
    "seat",
    "bmw",
  ]);
  assert.deepEqual(targets.map((target) => target.slug), ["citroen", "bmw", "opel", "seat"]);
});

test("parseArgs separates outDir, targets, and forwarded crawler options", () => {
  const args = parseArgs([
    "seed_batch",
    "citroen",
    "seat",
    "--signals-only",
    "--keep-review",
    "--index-pages",
    "999",
    "--min-posts",
    "2",
  ]);

  assert.equal(args.outDir, "seed_batch");
  assert.deepEqual(args.targetTokens, ["citroen", "seat"]);
  assert.deepEqual(args.forwardedArgs, ["--signals-only", "--keep-review", "--index-pages", "999", "--min-posts", "2"]);
});

test("buildChildArgs builds the wrapper command with root input and child output directory", () => {
  const [citroen] = resolveBatchTargets(["citroen"]);
  const args = buildChildArgs(citroen, {
    outDir: "seed_batch",
    forwardedArgs: ["--discover-only", "--index-pages", "999"],
  });

  assert.equal(args[0].endsWith("forum-seed-citroen.mjs"), true);
  assert.equal(args[1], "https://www.citroen-club.cz/forum");
  assert.equal(args[2].endsWith("seed_batch\\citroen"), true);
  assert.deepEqual(args.slice(3), ["--discover-only", "--index-pages", "999"]);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
