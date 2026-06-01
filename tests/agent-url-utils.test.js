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

console.log('agent-url-utils.test.js passed');
