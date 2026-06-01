import assert from 'node:assert/strict';
import {
  isTransientCrawlerError,
  parseCalibrationResponse,
  parseStructureDiscoveryResponse,
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

console.log('agent-calibrate-response.test.js passed');
