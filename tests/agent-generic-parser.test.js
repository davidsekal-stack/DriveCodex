import assert from 'node:assert/strict';
import { hasCalibrationHints, parseGeneric } from '../scripts/agent/parsers/generic.mjs';

const html = `
  <section class="entry" data-author="Alice">
    <div class="body">
      The engine stalled while driving, the tachometer fell to zero, and the warning light stayed on for several trips home.
    </div>
  </section>
  <section class="entry" data-author="Alice">
    <div class="body">
      The crankshaft position sensor was replaced and the vehicle has not stalled again after a full week of commuting.
    </div>
  </section>
`;

assert.equal(hasCalibrationHints({ post_selector: '.entry' }), true);

const parsed = parseGeneric(html, { post_selector: '.entry' }, 1);
assert.equal(parsed.posts.length, 2);
assert.equal(parsed.posts[0].author, 'Alice');
assert.match(parsed.posts[1].text, /crankshaft position sensor/i);

console.log('agent-generic-parser.test.js passed');
