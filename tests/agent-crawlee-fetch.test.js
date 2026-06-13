import assert from 'node:assert/strict';
import { isProxyConfigured, fetchHtmlWithCrawlee } from '../scripts/agent/crawlee-fetch.mjs';

// Proxy detection keys off AGENT_PROXY_URL (residential proxy, owner-provided).
const saved = process.env.AGENT_PROXY_URL;
delete process.env.AGENT_PROXY_URL;
assert.equal(isProxyConfigured(), false, 'no proxy env → false');
process.env.AGENT_PROXY_URL = 'http://user:pass@proxy.example.com:8000';
assert.equal(isProxyConfigured(), true, 'proxy env → true');
if (saved === undefined) delete process.env.AGENT_PROXY_URL; else process.env.AGENT_PROXY_URL = saved;

// Module surface is stable.
assert.equal(typeof fetchHtmlWithCrawlee, 'function', 'fetchHtmlWithCrawlee exported');

// fetch-utils loads cleanly with the lazy crawlee fallback wired in (importing
// crawlee-fetch.mjs must NOT eagerly import crawlee/playwright or launch a browser).
const fu = await import('../scripts/agent/fetch-utils.mjs');
assert.equal(typeof fu.fetchHtml, 'function', 'fetchHtml still exported');
assert.equal(typeof fu.isLikelyChallengeHtml, 'function', 'helpers still exported');

console.log('agent-crawlee-fetch.test.js passed');
