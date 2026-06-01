import assert from 'node:assert/strict';
import { enumerateThreadUrls } from '../scripts/agent/crawl.mjs';

const forum = {
  url: 'https://example.com/forum',
  sections_json: JSON.stringify(['https://example.com/forum']),
};

const page1 = `
  <a href="/viewtopic.php?f=1&t=100&sid=abc123">First solved thread</a>
  <a class="next" href="/forum?page=2&sid=abc123">Next</a>
`;

const page2 = `
  <a href="/viewtopic.php?f=1&t=200&sid=def456">Second solved thread</a>
`;

const fetchCalls = [];
const urls = await enumerateThreadUrls(
  forum,
  {},
  10,
  0,
  {
    fetchHtmlImpl: async (url) => {
      fetchCalls.push(url);
      if (url === 'https://example.com/forum') return page1;
      if (url === 'https://example.com/forum?page=2') return page2;
      throw new Error(`Unexpected URL: ${url}`);
    },
  }
);

assert.deepEqual(fetchCalls, [
  'https://example.com/forum',
  'https://example.com/forum?page=2',
]);

assert.deepEqual(
  urls.map(link => link.url),
  [
    'https://example.com/viewtopic.php?f=1&t=100',
    'https://example.com/viewtopic.php?f=1&t=200',
  ]
);

console.log('agent-crawl-pagination.test.js passed');
