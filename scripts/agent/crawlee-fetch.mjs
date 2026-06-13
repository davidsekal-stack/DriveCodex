/**
 * crawlee-fetch.mjs — Anti-bot browser fetch for forums whose WAF blocks both a
 * plain fetch AND the system-Chrome DOM dump (e.g. VerticalScope: VWVortex,
 * Audizine, ToyotaNation, SwedeSpeed — these return HTTP 406 to anything that
 * looks automated).
 *
 * Uses Crawlee's PlaywrightCrawler, which injects realistic browser fingerprints
 * (TLS, headers, canvas, etc.) by default — the thing the headless --dump-dom
 * fallback in fetch-utils.mjs lacks. An optional RESIDENTIAL PROXY (clean IP)
 * defeats IP-reputation blocks; set it in scripts/agent/.env.local:
 *
 *   AGENT_PROXY_URL=http://USER:PASS@proxy.host:PORT
 *
 * Without the proxy, only fingerprinting is applied (helps with header/TLS-based
 * WAFs, but not IP-reputation ones).
 *
 * This module is imported LAZILY (only when a forum is actually blocked) so the
 * normal crawl path stays dependency-free and fast.
 */

let crawleeMod = null;
async function loadCrawlee() {
  if (!crawleeMod) crawleeMod = await import('crawlee');
  return crawleeMod;
}

/** Is a residential/datacenter proxy configured? */
export function isProxyConfigured() {
  return Boolean(process.env.AGENT_PROXY_URL);
}

/**
 * Fetch a URL through a fingerprinted (and optionally proxied) real browser.
 * Returns the rendered HTML, or throws if nothing usable came back.
 *
 * @param {string} url
 * @param {object} [options]
 * @param {number} [options.timeoutMs=45000]
 * @param {number} [options.settleMs=2500] - extra wait after load for JS challenges
 * @param {number} [options.retries=1]
 * @returns {Promise<string>}
 */
export async function fetchHtmlWithCrawlee(url, options = {}) {
  const { PlaywrightCrawler, ProxyConfiguration, Configuration } = await loadCrawlee();

  const timeoutMs = options.timeoutMs ?? 45_000;
  const timeoutSecs = Math.max(15, Math.ceil(timeoutMs / 1000));
  const proxyUrl = process.env.AGENT_PROXY_URL;

  let capturedHtml = null;
  let capturedStatus = null;
  let failureReason = null;

  // In-memory storage so one-off fallback fetches never litter ./storage or
  // collide between concurrent calls.
  const config = new Configuration({ persistStorage: false });

  const crawler = new PlaywrightCrawler(
    {
      headless: true,
      maxRequestRetries: options.retries ?? 1,
      requestHandlerTimeoutSecs: timeoutSecs,
      navigationTimeoutSecs: timeoutSecs,
      // Fingerprint injection is on by default; set explicitly for clarity.
      browserPoolOptions: { useFingerprints: true },
      proxyConfiguration: proxyUrl
        ? new ProxyConfiguration({ proxyUrls: [proxyUrl] })
        : undefined,
      async requestHandler({ page, response }) {
        capturedStatus = response?.status?.() ?? null;
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        if (options.settleMs !== 0) await page.waitForTimeout(options.settleMs ?? 2500);
        capturedHtml = await page.content();
      },
      failedRequestHandler({ request }, err) {
        failureReason = err?.message || `failed after ${request.retryCount} retries`;
      },
    },
    config,
  );

  try {
    await crawler.run([url]);
  } finally {
    // Release the browser pool; ignore teardown races.
    await crawler.teardown?.().catch?.(() => {});
  }

  if (!capturedHtml) {
    const detail = [
      capturedStatus ? `status ${capturedStatus}` : null,
      failureReason,
      proxyUrl ? 'via proxy' : 'no proxy (fingerprint only)',
    ].filter(Boolean).join('; ');
    throw new Error(`Crawlee fetch returned no HTML for ${url}${detail ? ` (${detail})` : ''}`);
  }
  return capturedHtml;
}
