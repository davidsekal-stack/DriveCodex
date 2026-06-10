import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnManaged, terminateProcessTree } from './process-utils.mjs';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,cs;q=0.8,de;q=0.7',
};

const BROWSER_BLOCK_STATUSES = new Set([403, 406]);
const BROWSER_FETCH_PATTERNS = [
  /cf-browser-verification/i,
  /checking your browser/i,
  /verify you are human/i,
  /attention required/i,
  /just a moment/i,
  /enable javascript and cookies/i,
];
const BROWSER_ERROR_PATTERNS = [
  /main-frame-error/i,
  /this site can['’]t be reached/i,
  /tato str[aá]nka nen[ií] dostupn[aá]/i,
  /err_[a-z_]+/i,
];
const BROWSER_EXECUTABLE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];

let cachedBrowserExecutable;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isHtmlDocument(value) {
  const text = (value ?? '').toString();
  return /<!doctype html|<html\b/i.test(text);
}

export function isLikelyChallengeHtml(value) {
  const text = (value ?? '').toString();
  return BROWSER_FETCH_PATTERNS.some(pattern => pattern.test(text));
}

export function isLikelyBrowserErrorHtml(value) {
  const text = (value ?? '').toString();
  return BROWSER_ERROR_PATTERNS.some(pattern => pattern.test(text));
}

function resolveOrigin(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}/`;
  } catch {
    return null;
  }
}

function resolveBrowserExecutable() {
  if (cachedBrowserExecutable !== undefined) return cachedBrowserExecutable;

  const localAppData = process.env.LOCALAPPDATA;
  const candidates = [...BROWSER_EXECUTABLE_CANDIDATES];
  if (localAppData) {
    candidates.unshift(join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
  }

  cachedBrowserExecutable = candidates.find(path => {
    try {
      return existsSync(path);
    } catch {
      return false;
    }
  }) || null;
  return cachedBrowserExecutable;
}

function dumpDomWithBrowser(executable, url, userDataDir, timeoutMs) {
  return new Promise((resolve, reject) => {
    const virtualTimeBudget = Math.max(4_000, Math.min(timeoutMs - 2_000, 12_000));
    const args = [
      `--user-data-dir=${userDataDir}`,
      '--headless=new',
      '--disable-gpu',
      `--virtual-time-budget=${virtualTimeBudget}`,
      '--dump-dom',
      url,
    ];
    const child = spawnManaged(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      terminateProcessTree(child);
    }, timeoutMs);

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.on('error', err => {
      clearTimeout(timer);
      err.stdout = stdout;
      err.stderr = stderr;
      reject(err);
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (timedOut) {
        const err = new Error(`Browser fallback timed out after ${timeoutMs}ms`);
        err.code = 'ETIMEDOUT';
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
        return;
      }
      resolve({ code, stdout, stderr });
    });
  });
}

async function tryBrowserFallback(url, options = {}) {
  try {
    return {
      html: await fetchHtmlWithBrowser(url, options),
      error: null,
    };
  } catch (err) {
    return { html: null, error: err };
  }
}

async function fetchHtmlWithBrowser(url, options = {}) {
  const executable = resolveBrowserExecutable();
  if (!executable) return null;

  const profileDir = await mkdtemp(join(tmpdir(), 'agent-browser-'));
  const targetTimeoutMs = options.browserTimeoutMs ?? 30_000;
  const warmupTimeoutMs = options.browserWarmupTimeoutMs ?? 20_000;

  try {
    const origin = resolveOrigin(url);
    if (origin && origin !== url) {
      await dumpDomWithBrowser(executable, origin, profileDir, warmupTimeoutMs).catch(() => null);
    }

    const result = await dumpDomWithBrowser(executable, url, profileDir, targetTimeoutMs);
    const html = result.stdout ?? '';
    if (result.code !== 0 && !isHtmlDocument(html)) {
      const detail = (result.stderr || result.stdout || '').trim().slice(0, 300);
      throw new Error(detail ? `Browser fallback exited ${result.code}: ${detail}` : `Browser fallback exited ${result.code}`);
    }
    if (!isHtmlDocument(html) || isLikelyBrowserErrorHtml(html) || isLikelyChallengeHtml(html)) {
      return null;
    }
    return html;
  } finally {
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function fetchHtml(url, options = {}) {
  const maxRetries = options.maxRetries ?? 2;
  const headers = { ...DEFAULT_HEADERS, ...(options.headers || {}) };
  if (options.cookie) headers.Cookie = options.cookie;
  if (options.referer) headers.Referer = options.referer;

  // Force the headless-browser render (used as a retry when a plain fetch
  // returns a JS-rendered shell with no parseable posts).
  if (options.forceBrowser) {
    const html = await fetchHtmlWithBrowser(url, options);
    if (html) return html;
    throw new Error(`Browser render returned no usable HTML for ${url}`);
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
      let res;
      try {
        res = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
          redirect: 'follow',
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!res.ok) {
        if (options.allowBrowserFallback !== false && BROWSER_BLOCK_STATUSES.has(res.status)) {
          const { html: browserHtml, error: browserError } = await tryBrowserFallback(url, options);
          if (browserHtml) return browserHtml;
          const fallbackDetail = browserError ? `; browser fallback failed: ${browserError.message}` : '';
          const err = new Error(`HTTP ${res.status} fetching ${url}${fallbackDetail}`);
          err.nonRetryable = true;
          throw err;
        }

        if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
          await sleep(2_000 * (attempt + 1));
          continue;
        }

        throw new Error(`HTTP ${res.status} fetching ${url}`);
      }

      const html = await res.text();
      if (options.allowBrowserFallback !== false && isLikelyChallengeHtml(html)) {
        const { html: browserHtml, error: browserError } = await tryBrowserFallback(url, options);
        if (browserHtml) return browserHtml;
        const fallbackDetail = browserError ? `: ${browserError.message}` : '';
        const err = new Error(`Browser challenge fallback failed for ${url}${fallbackDetail}`);
        err.nonRetryable = true;
        throw err;
      }

      return html;
    } catch (err) {
      if (err?.nonRetryable) throw err;
      if (attempt >= maxRetries) throw err;
      await sleep(2_000 * (attempt + 1));
    }
  }

  throw new Error(`Failed to fetch ${url}`);
}
