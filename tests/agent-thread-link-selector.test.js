import assert from 'node:assert/strict';
import { extractThreadLinksBySelector, findNextPageLink } from '../scripts/agent/parsers/common.mjs';

const html = `
  <div class="wbbBoardNode__lastPost">
    <a class="wbbBoardNode__lastPostLink wbbTopicLink" href="/index.php?thread/123-example/">
      Solved injector issue
    </a>
  </div>
  <table class="wbbThreadList">
    <tr>
      <td>
        <a class="messageGroupLink wbbTopicLink" href="/index.php?thread/456-second-example/">
          ABS warning fixed
        </a>
      </td>
    </tr>
  </table>
  <a class="wbbTopicLink" href="/index.php?board/7-general/">General board</a>
`;

const links = extractThreadLinksBySelector(
  html,
  'https://www.peugeottalk.de/',
  '.wbbBoardNode__lastPostLink.wbbTopicLink, .messageGroupLink.wbbTopicLink'
);

assert.deepEqual(
  links.map(link => link.url),
  [
    'https://www.peugeottalk.de/index.php?thread/123-example/',
    'https://www.peugeottalk.de/index.php?thread/456-second-example/',
  ]
);

const nestedOnly = extractThreadLinksBySelector(
  html,
  'https://www.peugeottalk.de/',
  '.wbbThreadList a.messageGroupLink.wbbTopicLink'
);

assert.deepEqual(
  nestedOnly.map(link => link.url),
  ['https://www.peugeottalk.de/index.php?thread/456-second-example/']
);

const attrOnly = extractThreadLinksBySelector(
  html,
  'https://www.peugeottalk.de/',
  `a[href*='?thread/']`
);

assert.deepEqual(
  attrOnly.map(link => link.url),
  [
    'https://www.peugeottalk.de/index.php?thread/123-example/',
    'https://www.peugeottalk.de/index.php?thread/456-second-example/',
  ]
);

const domAwareHtml = `
  <div class="wbbThreadList"></div>
  <div class="otherContainer">
    <a class="messageGroupLink wbbTopicLink" href="/index.php?thread/999-outside-list/">
      Wrong outside list
    </a>
  </div>
  <table class="wbbThreadList">
    <tr>
      <td>
        <a class="messageGroupLink wbbTopicLink" href="/index.php?thread/777-correct-list-item/">
          Correct inside list
        </a>
      </td>
    </tr>
  </table>
`;

const domAware = extractThreadLinksBySelector(
  domAwareHtml,
  'https://www.peugeottalk.de/',
  '.wbbThreadList a.messageGroupLink.wbbTopicLink'
);

assert.deepEqual(
  domAware.map(link => link.url),
  ['https://www.peugeottalk.de/index.php?thread/777-correct-list-item/']
);

const quotedMarkupHtml = `
  <!-- <div class="wbbThreadList"> -->
  <div data-template="<div class='wbbThreadList'><a class='messageGroupLink wbbTopicLink' href='/index.php?thread/111-poison/'>Poison</a></div>">
    Placeholder
  </div>
  <div class="otherContainer">
    <a class="messageGroupLink wbbTopicLink" href="/index.php?thread/998-outside-list/">
      Wrong outside list
    </a>
  </div>
  <table class="wbbThreadList">
    <tr>
      <td>
        <a class="messageGroupLink wbbTopicLink" href="/index.php?thread/778-inside-real-list/">
          Correct inside real list
        </a>
      </td>
    </tr>
  </table>
`;

const domAwareQuotedMarkup = extractThreadLinksBySelector(
  quotedMarkupHtml,
  'https://www.peugeottalk.de/',
  '.wbbThreadList a.messageGroupLink.wbbTopicLink'
);

assert.deepEqual(
  domAwareQuotedMarkup.map(link => link.url),
  ['https://www.peugeottalk.de/index.php?thread/778-inside-real-list/']
);

const phpbbHtml = `
  <div class="forumbg">
    <ul class="topiclist topics">
      <li class="row sticky">
        <a class="topictitle" href="/viewtopic.php?f=22&t=1">Sticky thread</a>
      </li>
      <li class="row">
        <a class="topictitle" href="/viewtopic.php?f=22&t=2">Real thread</a>
      </li>
      <li class="row">
        <a class="topictitle" href="/viewtopic.php?p=999">Direct post link</a>
      </li>
    </ul>
  </div>
`;

const phpbbLinks = extractThreadLinksBySelector(
  phpbbHtml,
  'https://www.kia-club.org/',
  ".forumbg .topiclist.topics li.row:not([class*='sticky']):not([class*='announce']) a.topictitle[href*='viewtopic.php']:not([href*='p='])"
);

assert.deepEqual(
  phpbbLinks.map(link => link.url),
  ['https://www.kia-club.org/viewtopic.php?f=22&t=2']
);

const paginationHtml = `
  <a class="next" href="/wrong-page">Global next outside pager</a>
  <nav class="pageNav">
    <a class="pageNav-jump pageNav-jump--next" href="/forum/page-2">Next page</a>
  </nav>
`;

assert.equal(
  findNextPageLink(paginationHtml, 'https://example.com/forum', '.pageNav a.pageNav-jump--next'),
  'https://example.com/forum/page-2'
);

console.log('agent-thread-link-selector.test.js passed');
