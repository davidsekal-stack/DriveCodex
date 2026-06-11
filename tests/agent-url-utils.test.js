import assert from 'node:assert/strict';
import { canonicalizeThreadUrl } from '../scripts/agent/url-utils.mjs';

assert.equal(
  canonicalizeThreadUrl('https://www.kia-club.org/viewtopic.php?f=22&t=11419&sid=abc123'),
  'https://www.kia-club.org/viewtopic.php?f=22&t=11419'
);

assert.equal(
  canonicalizeThreadUrl('https://example.com/index.php?thread/123-test/&utm_source=test#reply'),
  'https://example.com/index.php?thread/123-test/'
);

assert.equal(
  canonicalizeThreadUrl('https://www.fiat-forum.de/forum/thread/16746-fiat-pandina-der-fortschrittlichste-fiat-panda-aller-zeiten/?postID=66602'),
  'https://www.fiat-forum.de/forum/thread/16746-fiat-pandina-der-fortschrittlichste-fiat-panda-aller-zeiten/'
);

assert.equal(
  canonicalizeThreadUrl('https://www.kia-club.org/viewtopic.php?f=22&t=11419&p=55555'),
  'https://www.kia-club.org/viewtopic.php?f=22&t=11419'
);

// XenForo thread-position suffixes → canonical thread root (also dodges WAFs
// that block the /latest jump endpoint, e.g. toyotanation.com)
assert.equal(
  canonicalizeThreadUrl('https://www.toyotanation.com/threads/rough-idle-fix.123456/latest'),
  'https://www.toyotanation.com/threads/rough-idle-fix.123456/'
);
assert.equal(
  canonicalizeThreadUrl('https://www.toyotanation.com/threads/rough-idle-fix.123456/unread'),
  'https://www.toyotanation.com/threads/rough-idle-fix.123456/'
);
assert.equal(
  canonicalizeThreadUrl('https://www.toyotanation.com/threads/rough-idle-fix.123456/post-9876543'),
  'https://www.toyotanation.com/threads/rough-idle-fix.123456/'
);
assert.equal(
  canonicalizeThreadUrl('https://www.toyotanation.com/threads/rough-idle-fix.123456/page-7'),
  'https://www.toyotanation.com/threads/rough-idle-fix.123456/'
);
// Invision style /page/2/
assert.equal(
  canonicalizeThreadUrl('https://example.com/topic/123-some-fault/page/2/'),
  'https://example.com/topic/123-some-fault/'
);
// Suffix words must NOT be stripped outside thread paths (section listing pages)
assert.equal(
  canonicalizeThreadUrl('https://example.com/forums/engine-tech/page-3'),
  'https://example.com/forums/engine-tech/page-3'
);
// Thread slug that merely ENDS with a suffix-like word keeps its identity
assert.equal(
  canonicalizeThreadUrl('https://example.com/threads/whats-the-latest.99/'),
  'https://example.com/threads/whats-the-latest.99/'
);

console.log('agent-url-utils.test.js passed');
