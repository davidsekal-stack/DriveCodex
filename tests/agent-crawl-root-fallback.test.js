import assert from 'node:assert/strict';
import { enumerateThreadUrls } from '../scripts/agent/crawl.mjs';

const forum = {
  url: 'https://example.com/forum-root',
  sections_json: JSON.stringify(['https://example.com/blocked-section']),
};

const fetchCalls = [];
const urls = await enumerateThreadUrls(
  forum,
  {},
  10,
  0,
  {
    fetchHtmlImpl: async (url) => {
      fetchCalls.push(url);
      if (url === 'https://example.com/blocked-section') {
        throw new Error('HTTP 406 fetching https://example.com/blocked-section');
      }
      if (url === 'https://example.com/forum-root') {
        return `<a href="/threads/solved-thread.123/">Solved thread</a>`;
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  }
);

assert.deepEqual(fetchCalls, [
  'https://example.com/blocked-section',
  'https://example.com/forum-root',
]);

assert.deepEqual(
  urls.map(link => link.url),
  ['https://example.com/threads/solved-thread.123/']
);

console.log('agent-crawl-root-fallback.test.js passed');
