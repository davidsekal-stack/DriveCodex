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

// phpBB-style session id glued onto the PATH with '&' and no leading '?'
// (observed on audiklub.cz) — must be stripped, not treated as part of the slug.
assert.equal(
  canonicalizeThreadUrl('https://audiklub.cz/forum/tema/412417-dpf-a6-c6-3-0-tdi-171kw-abs&sid=ff953b4edd9e72a252edd9eddbfdec0f'),
  'https://audiklub.cz/forum/tema/412417-dpf-a6-c6-3-0-tdi-171kw-abs'
);
// Two visits with different per-request sids must canonicalize to the SAME URL,
// otherwise the crawler re-imports the same thread every night (duplicate floods).
assert.equal(
  canonicalizeThreadUrl('https://audiklub.cz/forum/tema/412417-dpf-a6-c6-3-0-tdi-171kw-abs&sid=ff953b4edd9e72a252edd9eddbfdec0f'),
  canonicalizeThreadUrl('https://audiklub.cz/forum/tema/412417-dpf-a6-c6-3-0-tdi-171kw-abs&sid=ba0ca3d469092e3cf9f1a0481ec6411b')
);
// A genuine query param glued onto the path alongside a session id: keep the
// param, drop the session id.
assert.equal(
  canonicalizeThreadUrl('https://example.com/topic/123-some-fault&t=123&sid=deadbeef'),
  'https://example.com/topic/123-some-fault?t=123'
);

console.log('agent-url-utils.test.js passed');
