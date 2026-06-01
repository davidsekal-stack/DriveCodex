import assert from 'node:assert/strict';
import { isLikelyThreadUrl } from '../scripts/agent/crawl.mjs';

assert.equal(
  isLikelyThreadUrl('https://www.peugeottalk.de/index.php?thread/123-example/'),
  true
);

assert.equal(
  isLikelyThreadUrl('https://www.peugeottalk.de/index.php?board/7-general/'),
  false
);

assert.equal(
  isLikelyThreadUrl('https://example.com/showthread.php?t=1234'),
  true
);

assert.equal(
  isLikelyThreadUrl('https://example.com/news/1234-update'),
  false
);

console.log('agent-thread-url-filter.test.js passed');
