/**
 * forum-recon.mjs — dev nástroj pro průzkum fóra při psaní profilu
 * (scripts/agent/forum-profiles.json). NEpoužívá se v běžné pipeline.
 *
 *   node scripts/agent/forum-recon.mjs root    <url> [--browser]
 *       → délka, engine, generator, title, tvary URL, kandidátní sekce
 *   node scripts/agent/forum-recon.mjs section <url> [--browser]
 *       → odkazy na vlákna na stránce sekce + možné stránkování
 *   node scripts/agent/forum-recon.mjs parse   <thread-url> [--browser]
 *       [--post=SEL --author=SEL --content=SEL --header=SEL --engine=KEY]
 *       → naparsuje příspěvky (autor + text); bez --post zkusí engine parser
 */
import { fetchHtml } from './fetch-utils.mjs';
import { selectPosts } from './parsers/common.mjs';
import { detectForumType } from './parsers/detect.mjs';
import { parseInvision } from './parsers/invision.mjs';
import { parseXenforo } from './parsers/xenforo.mjs';
import { parsePhpbb } from './parsers/phpbb.mjs';
import { parseGeneric } from './parsers/generic.mjs';
import { parseWoltlab } from './parsers/woltlab.mjs';

const ENGINES = { invision: parseInvision, xenforo: parseXenforo, phpbb: parsePhpbb, generic: parseGeneric, woltlab: parseWoltlab };
const argv = process.argv.slice(2);
const mode = argv[0];
const url = argv[1];
const opt = (n) => { const a = argv.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : undefined; };
const browser = argv.includes('--browser');
const clip = (s, n) => (s ? String(s).replace(/\s+/g, ' ').trim().slice(0, n) : '');

function detectEngine(html) {
  const sig = [['XenForo', /xenforo|data-xf-|js-post/i], ['vBulletin', /vbulletin|bbsessionhash|vb_/i],
    ['phpBB', /phpbb|viewforum\.php|viewtopic\.php/i], ['WoltLab', /woltlab|wcfContent|burning board|wbb/i],
    ['Discourse', /discourse-/i], ['IPB/Invision', /invision|ipboard|ips\.community|data-ipsquote/i], ['SMF', /simplemachines/i]];
  return sig.filter(([, re]) => re.test(html)).map(([n]) => n);
}

const html = await fetchHtml(url, { maxRetries: 2, forceBrowser: browser }).catch(e => { console.log('FETCH ERROR:', e.message); return ''; });
if (!html) process.exit(1);

if (mode === 'root') {
  console.log('len:', html.length, '| browser:', browser);
  console.log('detect.mjs engine:', detectForumType(html, url));
  console.log('signatures:', detectEngine(html).join(', ') || '(none)');
  const gen = html.match(/name=["']generator["'][^>]+content=["']([^"']+)/i);
  console.log('generator:', gen ? gen[1] : '(none)', '| title:', clip((html.match(/<title>([^<]*)/i) || [])[1], 70));
  const links = [...html.matchAll(/href=["']([^"'#]+)["'][^>]*>([^<]{0,50})/gi)];
  const norm = links.map(m => { try { const u = new URL(m[1], url); return { p: u.pathname.replace(/\d+/g, 'N'), ex: u.pathname + (u.search ? '?' + u.search.slice(1) : ''), t: clip(m[2], 40) }; } catch { return null; } }).filter(Boolean);
  const shapes = {};
  for (const x of norm) (shapes[x.p] ||= []).push(x);
  console.log('\nURL tvary (top 22):');
  Object.entries(shapes).sort((a, b) => b[1].length - a[1].length).slice(0, 22).forEach(([k, v]) => console.log(`  ${String(v.length).padStart(3)}  ${k}  | ${clip(v[0].ex, 70)}  "${v[0].t}"`));
} else if (mode === 'section') {
  const links = [...new Set([...html.matchAll(/href=["']([^"']+)["']/gi)].map(m => { try { return new URL(m[1], url).href; } catch { return ''; } }))];
  const threadish = links.filter(h => /topic|thread|viewtopic|showthread|\/t\d|\/p\d|posts\//i.test(h));
  console.log('odkazů celkem:', links.length, '| thread-like:', threadish.length);
  threadish.slice(0, 12).forEach(h => console.log('  ', h.replace(url, '')));
} else if (mode === 'parse') {
  let posts;
  if (opt('post')) {
    posts = selectPosts(html, { post_selector: opt('post'), author_selector: opt('author'), content_selector: opt('content'), header_selector: opt('header'), min_post_length: 20 }, 1);
    console.log('selectPosts:', posts.length, 'příspěvků');
  } else {
    const eng = opt('engine') || detectForumType(html, url);
    const res = (ENGINES[eng] || parseGeneric)(html, {}, 1);
    posts = Array.isArray(res) ? res : (res?.posts ?? []);
    console.log(`engine parser "${eng}":`, posts.length, 'příspěvků');
  }
  posts.slice(0, 4).forEach((p, i) => console.log(`  [${i + 1}] autor="${clip(p.author, 30)}" | text="${clip(p.text, 110)}"`));
} else {
  console.log('mode: root | section | parse');
}
