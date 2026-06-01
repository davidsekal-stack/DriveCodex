import assert from 'node:assert/strict';
import {
  isLikelyBrowserErrorHtml,
  isLikelyChallengeHtml,
} from '../scripts/agent/fetch-utils.mjs';

assert.equal(
  isLikelyChallengeHtml('<html><title>Just a moment...</title><body>Checking your browser before accessing</body></html>'),
  true
);

assert.equal(
  isLikelyChallengeHtml('<html><body><article class="message-body">Real forum thread</article></body></html>'),
  false
);

assert.equal(
  isLikelyBrowserErrorHtml('<html><body><main id="main-frame-error">This site can’t be reached ERR_HTTP_RESPONSE_CODE_FAILURE</main></body></html>'),
  true
);

assert.equal(
  isLikelyBrowserErrorHtml('<html><body><div class="structItem structItem--thread">Thread list</div></body></html>'),
  false
);

console.log('agent-fetch-utils.test.js passed');
