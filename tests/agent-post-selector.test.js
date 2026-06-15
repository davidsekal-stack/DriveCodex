import assert from 'node:assert/strict';
import { selectPosts, selectElements } from '../scripts/agent/parsers/common.mjs';

// Faithful VerticalScope "Fora" markup (vwvortex/toyotanation/swedespeed/audizine).
// The regex xenforo parser misses this because the container class is
// "MessageCard js-post" (no \bmessage\b word boundary) — selectPosts must catch it.
const FORA_HTML = `
<!DOCTYPE html><html><body>
<div qid="thread-main-section">
  <div class="MessageCard js-post" id="js-post-1001" data-author="Alice">
    <header class="message-attribution">
      <h4 class="message-name"><span class="username">Alice</span></h4>
      <time class="u-dt">2026-05-01</time>
    </header>
    <div class="message-userContent">
      <article class="message-body">
        <div class="bbWrapper">
          <blockquote class="bbCodeBlock--quote">Bob said: try resetting it</blockquote>
          My 2014 Golf had a rough idle and a flashing EPC light after a cold start.
        </div>
      </article>
    </div>
  </div>
  <div class="MessageCard js-post" id="js-post-1002" data-author="Alice">
    <header class="message-attribution">
      <h4 class="message-name"><span class="username">Alice</span></h4>
      <time class="u-dt">2026-05-02</time>
    </header>
    <div class="message-userContent">
      <article class="message-body">
        <div class="bbWrapper">
          Replaced the throttle body and recalibrated it. Idle is smooth now, EPC light gone. Fixed!
        </div>
      </article>
    </div>
  </div>
</div>
</body></html>`;

const FORA_CALIBRATION = {
  parser: 'xenforo',
  post_selector: 'div.MessageCard.js-post',
  content_selector: 'article.message-body .bbWrapper',
  author_selector: 'h4.message-name .username',
  date_selector: 'time.u-dt',
  quote_selector: 'blockquote.bbCodeBlock--quote',
  min_post_length: 20,
};

function testForaExtraction() {
  const posts = selectPosts(FORA_HTML, FORA_CALIBRATION);
  assert.equal(posts.length, 2, 'should extract both MessageCard posts');

  // Author from the nested .username span
  assert.equal(posts[0].author, 'Alice');
  assert.equal(posts[0].when, '2026-05-01');
  assert.equal(posts[0].postId, '1001');

  // Quote block must be stripped from content
  assert.ok(!posts[0].text.includes('Bob said'), 'quoted text must be removed');
  assert.ok(posts[0].text.includes('rough idle'), 'real content kept');
  assert.ok(posts[1].text.includes('throttle body'));
}

function testNoSelectorReturnsEmpty() {
  // Without a post_selector, selectPosts returns [] so callers fall back to engine parser
  assert.deepEqual(selectPosts(FORA_HTML, { parser: 'xenforo' }), []);
}

function testNestedSameTagContainers() {
  // Outermost match wins; an inner matching div must not double-count
  const html = `<div class="post" id="p1">outer text long enough to keep
    <div class="post" id="pInner">nested should be skipped</div>
  </div>
  <div class="post" id="p2">second post body that is long enough</div>`;
  const els = selectElements(html, 'div.post');
  assert.equal(els.length, 2, 'nested same-class div is skipped (outermost wins)');
  assert.equal(els[0].attrText.includes('p1'), true);
  assert.equal(els[1].attrText.includes('p2'), true);
}

function testMinLengthFilter() {
  const html = `
    <div class="msg"><div class="body">ok</div></div>
    <div class="msg"><div class="body">this body is comfortably over the minimum length threshold</div></div>`;
  const posts = selectPosts(html, { post_selector: 'div.msg', content_selector: '.body', min_post_length: 30 });
  assert.equal(posts.length, 1, 'too-short post filtered out');
}

// IPS4-style: the author lives in the data-mentionname attribute on an anchor
// that wraps only an avatar image (no text). Without the attribute fallback the
// author is empty → same-author validation rejects every case (real OctaviaClub
// failure). The date sits in a <time datetime="..."> with no text too.
function testAuthorFromAttribute() {
  const html = `
    <article data-role="comment" id="comment-501">
      <aside class="ipsComment_author">
        <a data-mentionname="HynekTomas" href="/profile/42-hynektomas/"><img src="/avatar.jpg" alt=""></a>
      </aside>
      <div class="ipsComment_content">
        <time datetime="2026-04-10T08:00:00Z"></time>
        <div class="cPost_contentWrap">After a cold start the engine ran rough and the EPC light flashed; replacing the throttle body fixed it for good.</div>
      </div>
    </article>`;
  const cal = {
    post_selector: "article[data-role='comment']",
    content_selector: '.cPost_contentWrap',
    author_selector: 'a[data-mentionname]',
    date_selector: 'time[datetime]',
    min_post_length: 20,
  };
  const posts = selectPosts(html, cal);
  assert.equal(posts.length, 1, 'extracts the IPS4 comment');
  assert.equal(posts[0].author, 'HynekTomas', 'author read from data-mentionname attribute');
  assert.equal(posts[0].when, '2026-04-10T08:00:00Z', 'date read from datetime attribute');
}

testForaExtraction();
testNoSelectorReturnsEmpty();
testNestedSameTagContainers();
testMinLengthFilter();
testAuthorFromAttribute();

console.log('agent-post-selector.test.js passed');
