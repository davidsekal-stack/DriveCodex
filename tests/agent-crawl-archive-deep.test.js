import assert from 'node:assert/strict';
import { enumerateThreadUrlsDeep } from '../scripts/agent/crawl.mjs';

const forum = {
  url: 'https://example.com/forum',
  sections_json: JSON.stringify(['https://example.com/forum']),
};

// A 3-page archive. Listing pages are newest-first; we want to walk ALL of
// them in order, deep into the archive, not just re-read page 1.
const page1 = `
  <a href="/viewtopic.php?f=1&t=100&sid=abc">Newest solved thread</a>
  <a href="/viewtopic.php?f=1&t=101&sid=abc">Another newest</a>
  <a class="next" href="/forum?page=2&sid=abc">Next</a>
`;
const page2 = `
  <a href="/viewtopic.php?f=1&t=200&sid=def">Older thread</a>
  <a class="next" href="/forum?page=3&sid=def">Next</a>
`;
const page3 = `
  <a href="/viewtopic.php?f=1&t=300&sid=ghi">Oldest thread (archive floor)</a>
`;

const fetchCalls = [];
const fetchHtmlImpl = async (url) => {
  fetchCalls.push(url);
  if (url === 'https://example.com/forum') return page1;
  if (url === 'https://example.com/forum?page=2') return page2;
  if (url === 'https://example.com/forum?page=3') return page3;
  throw new Error(`Unexpected URL: ${url}`);
};

// ── Batch 1: start fresh, walk one page ──
const b1 = await enumerateThreadUrlsDeep(forum, {}, { pagesPerBatch: 1, fetchHtmlImpl });
assert.deepEqual(
  b1.links.map(l => l.url),
  ['https://example.com/viewtopic.php?f=1&t=100', 'https://example.com/viewtopic.php?f=1&t=101'],
  'batch 1 collects EVERY thread on page 1 (gap-free, whole-page)'
);
assert.equal(b1.complete, false, 'archive not complete after one page');
const key = 'https://example.com/forum';
assert.equal(b1.cursor.sections[key].next, 'https://example.com/forum?page=2', 'cursor parked at page 2');
assert.equal(b1.cursor.sections[key].done, false);

// ── Batch 2: resume from cursor, must NOT refetch page 1 ──
const b2 = await enumerateThreadUrlsDeep(forum, {}, { cursor: b1.cursor, pagesPerBatch: 1, fetchHtmlImpl });
assert.deepEqual(b2.links.map(l => l.url), ['https://example.com/viewtopic.php?f=1&t=200'], 'batch 2 reads the NEXT page deeper into the archive');
assert.equal(b2.complete, false);
assert.equal(b2.cursor.sections[key].next, 'https://example.com/forum?page=3');

// ── Batch 3: reach the last page → section done → archive complete ──
const b3 = await enumerateThreadUrlsDeep(forum, {}, { cursor: b2.cursor, pagesPerBatch: 1, fetchHtmlImpl });
assert.deepEqual(b3.links.map(l => l.url), ['https://example.com/viewtopic.php?f=1&t=300']);
assert.equal(b3.cursor.sections[key].done, true, 'section marked done at the archive floor');
assert.equal(b3.complete, true, 'archive complete once every section is walked to its last page');

// No listing page was ever fetched twice across the three batches.
assert.deepEqual(fetchCalls, [
  'https://example.com/forum',
  'https://example.com/forum?page=2',
  'https://example.com/forum?page=3',
], 'each listing page fetched exactly once — no re-reading the newest threads');

// ── A finished section is skipped on the next deep batch ──
const b4 = await enumerateThreadUrlsDeep(forum, {}, { cursor: b3.cursor, pagesPerBatch: 1, fetchHtmlImpl });
assert.deepEqual(b4.links, [], 'completed archive yields nothing in deep mode');
assert.equal(b4.complete, true);

// ── Head-scan re-reads page 1 for brand-new threads WITHOUT disturbing the cursor ──
const headFetches = [];
const head = await enumerateThreadUrlsDeep(
  forum,
  {},
  {
    cursor: b3.cursor,
    pagesPerBatch: 1,
    headScan: true,
    fetchHtmlImpl: async (url) => { headFetches.push(url); return fetchHtmlImpl(url); },
  }
);
assert.deepEqual(head.links.map(l => l.url), ['https://example.com/viewtopic.php?f=1&t=100', 'https://example.com/viewtopic.php?f=1&t=101'], 'head-scan reads the section head');
assert.deepEqual(headFetches, ['https://example.com/forum'], 'head-scan only touches page 1');
assert.equal(head.cursor.sections[key].done, true, 'head-scan leaves the deep cursor (done) intact');

console.log('agent-crawl-archive-deep.test.js passed');
