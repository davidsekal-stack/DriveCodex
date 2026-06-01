# Already-Extracted Index — don't crawl the same thing twice

A single, **DB-derived** list of everything already extracted into `gearbrain_cases`, so no crawler
re-extracts the same forum thread, subforum, or NHTSA bulletin. The production DB is the source of truth
(it can't drift); this is a refreshable snapshot of it.

## Files
| File | Role |
|---|---|
| `build-crawled-index.mjs` | Generator — pulls `thread_url`/`source_ref` from `gearbrain_cases`, canonicalises, writes the snapshot. |
| `crawled-index.json` | The snapshot (git-ignored, regenerate on demand). Forum thread URLs + NHTSA bulletin IDs. |
| `crawled-index.mjs` | Loader + checkers: `loadCrawledIndex()`, `isThreadAlreadyExtracted(url, idx)`, `isNhtsaDone(idOrUrl, idx)`, `filterNewThreadUrls(urls, idx)`. |

## Refresh (run before a crawl, or wire into the batch runner)
```bash
SUPABASE_SERVICE_KEY=... node scripts/agent/build-crawled-index.mjs
```
Current snapshot: **1,431 forum threads + 1,138 NHTSA bulletins** indexed.
URL matching uses `canonicalizeThreadUrl` (strips session ids, post pointers, tracking params), so noisy URLs still match.

## Integration

**Autonomous agent — already wired** (`orchestrator.mjs`, crawl phase): every enumerated thread is checked with
`isThreadAlreadyExtracted` and skipped if present (logged as "via cross-source index"). This covers threads first
extracted by the legacy `forum-seed-*` scripts and prior agent runs, not just this run's local state.

**Legacy `forum-seed-*.mjs`** — add before processing each thread:
```js
import { loadCrawledIndex, isThreadAlreadyExtracted } from "./agent/crawled-index.mjs";
const idx = loadCrawledIndex();
// …
if (isThreadAlreadyExtracted(threadUrl, idx)) continue;   // skip
```

**NHTSA scripts (`nhtsa-supercrawler.mjs`, `tsb-seed-nhtsa.mjs`)** — skip bulletins already imported:
```js
import { loadCrawledIndex, isNhtsaDone } from "./agent/crawled-index.mjs";
const idx = loadCrawledIndex();
// …
if (isNhtsaDone(odiNumber /* or the PDF url */, idx)) continue;   // skip
```

## Known limitation
**1,746 legacy cases (~32%) have no stored `thread_url`/`source_ref`** and therefore can't be indexed by URL — if
their source forums are re-crawled, those specific threads could be re-extracted (caught only by the slower
case-level content-similarity dedup). Going forward this shrinks: new crawls record `thread_url`/`source_ref`,
so they self-register in the next index rebuild.
