import assert from 'node:assert/strict';
import {
  isTransientCrawlerError,
  parseCalibrationResponse,
  parseStructureDiscoveryResponse,
  stripNoiseHtml,
} from '../scripts/agent/calibrate.mjs';

const structure = parseStructureDiscoveryResponse(`
Analysis first.
{"qualified":false,"qualification_reason":"Login wall","requires_login":true}
`);

assert.equal(structure.qualified, false);
assert.equal(structure.requires_login, true);

const discovered = parseStructureDiscoveryResponse(`
\`\`\`json
{
  "qualified": true,
  "forum_type": "phpbb",
  "sections": [
    { "url": "https://example.com/forum/engine", "name": "Engine", "relevance": "high" }
  ]
}
\`\`\`
`);

assert.equal(discovered.forum_type, 'phpbb');
assert.equal(discovered.sections.length, 1);

assert.equal(parseCalibrationResponse('{"qualified":false}'), null);
assert.deepEqual(
  parseCalibrationResponse('{"thread_list_selector":".threadList a"}'),
  { thread_list_selector: '.threadList a' }
);
assert.equal(isTransientCrawlerError(new Error('HTTP 406 fetching https://example.com')), true);
assert.equal(isTransientCrawlerError(new Error('parser returned <2 posts')), false);

// stripNoiseHtml: drops script/style/svg/comments + collapses whitespace,
// but keeps section anchor links so discovery can still see them.
const noisy = `<body>
  <script>var a = 1; /* lots of js */</script>
  <style>.x{color:red}</style>
  <!-- comment -->
  <a href="/forum/zavady">Závady</a>
  <svg><path d="M0"/></svg>
  <a href="/forum/technika">Technika</a>
</body>`;
const cleaned = stripNoiseHtml(noisy);
assert.ok(!/<script/i.test(cleaned), 'script removed');
assert.ok(!/<style/i.test(cleaned), 'style removed');
assert.ok(!/<svg/i.test(cleaned), 'svg removed');
assert.ok(!/<!--/.test(cleaned), 'comment removed');
assert.ok(cleaned.includes('href="/forum/zavady"'), 'fault link kept');
assert.ok(cleaned.includes('href="/forum/technika"'), 'technical link kept');
assert.ok(cleaned.length < noisy.length, 'collapsed shorter');
assert.equal(stripNoiseHtml(undefined), '', 'undefined safe');

console.log('agent-calibrate-response.test.js passed');
