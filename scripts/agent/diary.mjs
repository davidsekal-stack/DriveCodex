/**
 * diary.mjs — Forum crawl diary writer.
 *
 * After each forum completes a crawl batch, the routed LLM (default: Claude
 * Haiku — see llm.mjs) writes a structured post-mortem diary entry. This
 * diary is then injected as context into Phase 0 prompts for future forums
 * with similar characteristics, enabling the agent to learn from past
 * experience.
 */

import { runLlm } from './llm.mjs';
import { isStoppingError } from './quota.mjs';

const DIARY_TIMEOUT_MS = 90_000;
const DIARY_MAX_TOKENS = 800;

/**
 * Build the prompt asking the LLM to write a forum diary entry.
 */
function buildDiaryPrompt(forum, stats, discardSample) {
  const calibration = (() => {
    try { return JSON.parse(forum.calibration_json || '{}'); } catch { return {}; }
  })();

  const discardLines = discardSample.length > 0
    ? discardSample.map(r => `  - "${r}"`).join('\n')
    : '  (none recorded)';

  return `You are reviewing a completed crawl run for an automotive forum.
Write a concise technical diary entry that will help future crawls of similar forums.

## Forum
- Name: ${forum.name || forum.url}
- URL: ${forum.url}
- Language: ${forum.language || 'unknown'}
- Parser type: ${forum.parser || 'generic'}
- Brands: ${forum.brand || 'multi-brand'}

## Calibration result
${JSON.stringify(calibration, null, 2).slice(0, 800)}

## Crawl statistics
- Threads crawled this batch: ${stats.threads}
- Cases extracted: ${stats.cases}
- Yield rate: ${stats.threads > 0 ? ((stats.cases / stats.threads) * 100).toFixed(1) : '0'}%
- Most common discard reasons:
${discardLines}

## Task
Write a diary entry in markdown with exactly these sections:

### Parser & Struktura
What forum software was detected, what HTML structure was found, which selectors/parser worked.

### Výnos (Yield)
How many threads yielded cases. Was the yield high/low? Likely reason.

### Co fungovalo
Specific things that worked well (section URLs, parser hints, calibration settings).

### Problémy
Any issues encountered: login walls, empty pages, wrong parser, low quality content, etc.

### Doporučení pro podobná fóra
3–5 concrete actionable tips for the next forum with similar software/language/brand.

Keep the entire diary under 400 words. Be specific and technical, not generic.
Output ONLY the markdown diary entry, no other text.`;
}

/**
 * Run the routed LLM to write a diary entry, store it in state.
 * Non-fatal: if the LLM fails, logs a warning but does not throw.
 */
export async function writeDiary(state, forum, stats, discardSample = []) {
  const prompt = buildDiaryPrompt(forum, stats, discardSample);

  let diary = null;
  try {
    const raw = await runLlm('diary', prompt, {
      timeoutMs: DIARY_TIMEOUT_MS,
      maxTokens: DIARY_MAX_TOKENS,
    });
    diary = (raw || '').trim();
  } catch (err) {
    // Re-throw agent-stopping errors (quota/auth) — everything else is non-fatal
    if (isStoppingError(err)) throw err;
    console.warn(`  ⚠ Diary write failed for ${forum.name || forum.url}: ${err.message}`);
    return null;
  }

  if (diary && diary.length > 20) {
    state.setForumDiary(forum.id, diary);
    console.log(`  📓 Diary written for ${forum.name || forum.url} (${diary.length} chars)`);
  }
  return diary;
}

/**
 * Build a "lessons learned" block from past forum diaries,
 * to be injected into Phase 0 prompts for new forums.
 */
export function buildDiaryContext(state, { parser, language }) {
  const diaries = state.getRelevantDiaries({ parser, language, limit: 3 });
  if (diaries.length === 0) return '';

  const lines = diaries.map(d =>
    `### Zkušenosti z fóra: ${d.name || d.url} (parser: ${d.parser}, jazyk: ${d.language})\n${d.diary_md}`
  ).join('\n\n---\n\n');

  return `\n\n## Lessons from previously crawled similar forums\n${lines}\n`;
}
