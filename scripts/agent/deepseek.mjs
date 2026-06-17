/**
 * deepseek.mjs — Single DeepSeek chat/completions client for the offline pipeline.
 *
 * Collapses the ~11 hand-rolled `deepseekChatJson` copies that used to live in
 * every forum-seed and retry-skoda script (each with NO retry and NO timeout) into
 * one resilient, messages-based client. The crawl-agent router (llm.mjs) keeps
 * its own prompt-based `deepseekChat`, but both now source the model name and
 * endpoint from here, so a future model swap is a one-line change.
 *
 * `thinking` is a top-level DeepSeek v4 field (NOT extra_body). For the
 * structured-JSON offline tasks (classify/extract/translate/audit/review) it is
 * disabled by default for speed and reliable parsing.
 */

import { assertDeepSeekNotQuotaError } from "./quota.mjs";

/** Single source of truth for the offline DeepSeek model (was duplicated in ~16 files). */
export const OFFLINE_DEEPSEEK_MODEL = "deepseek-v4-flash";

/** DeepSeek chat/completions endpoint (was inlined in every hand-rolled copy). */
export const DEEPSEEK_CHAT_URL = "https://api.deepseek.com/v1/chat/completions";

// Transient HTTP statuses worth retrying; everything else throws immediately.
const DEFAULT_RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_TIMEOUT_MS = 120_000;

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * POST a chat/completions request to DeepSeek and return the raw assistant
 * message content (untrimmed — callers parse the JSON themselves).
 *
 * Retries transient failures (thrown fetch/timeout errors and retryable HTTP
 * statuses) with linear backoff; surfaces quota/billing exhaustion as a
 * permanent QuotaError (so the crawl agent can pause cleanly) without retrying.
 *
 * @param {object} opts
 * @param {string} opts.apiKey                 - DeepSeek API key
 * @param {string} [opts.model]                - defaults to OFFLINE_DEEPSEEK_MODEL
 * @param {Array}  opts.messages               - chat messages array
 * @param {number} [opts.maxTokens=1400]
 * @param {number} [opts.temperature=0.2]
 * @param {object|null} [opts.thinking]        - top-level v4 toggle; default { type: "disabled" }, pass null to omit
 * @param {number} [opts.timeoutMs=120000]     - per-attempt hard timeout
 * @param {number} [opts.maxRetries=5]
 * @param {Set<number>} [opts.retryableStatus] - HTTP statuses to retry
 * @param {Function} [opts.fetchFn=fetch]      - injectable for tests
 * @param {Function} [opts.sleepFn]            - injectable for tests
 * @returns {Promise<string>} raw assistant content
 * @throws {QuotaError} when DeepSeek reports quota/billing exhaustion
 */
export async function deepseekChatJson({
  apiKey,
  model = OFFLINE_DEEPSEEK_MODEL,
  messages,
  maxTokens = 1400,
  temperature = 0.2,
  thinking = { type: "disabled" },
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRetries = DEFAULT_MAX_RETRIES,
  retryableStatus = DEFAULT_RETRYABLE_STATUS,
  fetchFn = fetch,
  sleepFn = defaultSleep,
}) {
  let lastError = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let res;
    try {
      res = await fetchFn(DEEPSEEK_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages,
          temperature,
          ...(thinking ? { thinking } : {}),
        }),
        // Hard per-attempt timeout so a stalled connection cannot hang a crawl.
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      // Network failure / timeout — transient, retry with backoff.
      lastError = err;
      if (attempt === maxRetries - 1) throw err;
      await sleepFn(Math.min(20_000, 2_000 * (attempt + 1)));
      continue;
    }

    if (res.ok) {
      const data = await res.json();
      return (data?.choices?.[0]?.message?.content ?? "").toString();
    }

    const body = await res.text().catch(() => "");
    // Quota/billing exhaustion is permanent — surface before spending retries.
    assertDeepSeekNotQuotaError(res.status, body);
    const error = new Error(`DeepSeek API error ${res.status}: ${body.slice(0, 400)}`);
    if (!retryableStatus.has(res.status) || attempt === maxRetries - 1) {
      throw error;
    }
    lastError = error;
    await sleepFn(Math.min(20_000, 2_000 * (attempt + 1)));
  }
  throw lastError ?? new Error("DeepSeek API request failed.");
}
