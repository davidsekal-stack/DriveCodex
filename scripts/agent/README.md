# Autonomous Crawl Agent Notes

Reviewed: 2026-06-10 (Claude-first LLM routing + usage-limit pause/resume)

## What This Folder Is

This folder is a self-improving forum crawler for building high-confidence automotive fault-resolution cases.

The idea is not "scrape everything and trust the parser". The design is:

1. discover or seed a forum
2. calibrate that forum first
3. crawl only threads that look promising
4. extract structured cases
5. reject weak cases with deterministic gates
6. run an independent AI audit (different vendor than the extractor)
7. dedupe against Supabase
8. import only the survivors

So the real concept is a staged quality pipeline, not a generic scraper.

## My Mental Model

Think of the system as a small queue-based agent with SQLite memory:

- `forums` = crawl targets and their per-forum configuration
- `threads` = raw units of work discovered under each forum
- `cases` = extracted structured repair cases
- `runs` = execution history
- `agent_log` = persistent operator log

The database in this folder, [`agent.db`](/C:/GB/scripts/agent/agent.db), is the local memory that lets the agent resume after failures or quota stops.

## End-to-End Flow

The main entrypoint is [`orchestrator.mjs`](/C:/GB/scripts/agent/orchestrator.mjs).

### Phase 1: Discover

- Current implementation is mostly manual seeding.
- `--forum-url <url>` inserts a forum directly.
- Automatic web discovery is still a TODO in the orchestrator.
- Candidate lists can be bulk-seeded from [`forum-candidates.json`](/C:/GB/scripts/agent/forum-candidates.json) via [`seed-candidates.mjs`](/C:/GB/scripts/agent/seed-candidates.mjs).

### Phase 2: Calibrate

Core file: [`calibrate.mjs`](/C:/GB/scripts/agent/calibrate.mjs)

This is the key concept in the whole system.

Before crawling at scale, the agent asks:

- Is this forum worth crawling at all?
- Which subforums are actually technical / fault-related?
- What forum engine is this?
- Which selectors or parser hints are needed?

Calibration has two sub-parts:

1. Structure discovery with the routed LLM (the script fetches the root page
   itself and embeds the HTML in the prompt)
   - qualify/disqualify the forum
   - detect engine type
   - identify the best technical section URLs
   - store parser hints
2. Probe run
   - sample a few threads
   - parse them
   - classify them
   - extract cases
   - validate them
   - measure success rates

Thresholds are explicitly encoded:

- parser success >= 60%
- classifier pass >= 10%
- extractor yield >= 5%

If the probe is weak, the LLM is asked to diagnose failures and suggest better calibration JSON.

If calibration still fails after 3 attempts, the forum is marked `calibration_failed`.

### Phase 3: Crawl

Core file: [`crawl.mjs`](/C:/GB/scripts/agent/crawl.mjs)

The crawl pipeline is:

1. enumerate candidate thread URLs from section pages
2. skip threads already processed
3. fetch thread pages, including pagination
4. parse posts into a normalized thread text format
5. classify thread relevance (routed LLM, default Claude Haiku)
6. extract one or more candidate cases (routed LLM, default Claude Sonnet)
7. run deterministic validation on each case
8. store valid cases in SQLite

Important detail: the thread is normalized into a text format like:

```text
THREAD_URL: ...
TITLE: ...
THREAD_AUTHOR: ...

POST 1 | page: 1 | author: Alice | is_thread_author: true:
...
```

That normalized format is the evidence backbone for classification, extraction, and author-consistency validation.

### Phase 4: Validate

Core file: [`validate.mjs`](/C:/GB/scripts/agent/validate.mjs)

This stage is intentionally non-LLM.

It rejects cases if they are missing core fields, use future-tense "will repair / will update" language, have too-short descriptions/resolutions, or claim fault/resolution posts from different authors.

This file is important because it turns the system from "LLM extraction" into "LLM extraction with deterministic guardrails".

### Phase 5: Verify

Core file: [`verify.mjs`](/C:/GB/scripts/agent/verify.mjs)

After deterministic validation, an independent AI auditor (default: DeepSeek —
deliberately a different vendor than the Claude-based extractor) re-reads the
original thread text and must return exactly `PASS` or `FAIL: reason`.

This is a second opinion layer, separate from the extraction path.

### Phase 6: Crosscheck

Implemented in [`orchestrator.mjs`](/C:/GB/scripts/agent/orchestrator.mjs).

Verified cases are compared against existing Supabase cases using a fail-closed REST query plus semantic-ish similarity over resolution, description, symptoms, and source URL.

If a case looks duplicated, it is not imported.

### Phase 7: Import

Also implemented in [`orchestrator.mjs`](/C:/GB/scripts/agent/orchestrator.mjs).

`import_ready` cases are pushed to the Supabase edge function `push-case`.

Runtime credentials are intentionally not stored in code. Crosscheck requires `SUPABASE_SERVICE_KEY` or `SUPABASE_ANON_KEY`; import requires `SUPABASE_SERVICE_KEY` or `SUPABASE_FUNCTION_KEY`. If those env vars are missing, the run fails closed instead of importing.

## Where AI Is Used

Every AI call goes through the router in [`llm.mjs`](/C:/GB/scripts/agent/llm.mjs).
Default routing (override per task via `AGENT_LLM_<TASK>=provider:model`):

| Task | Default route | Module | Why |
|---|---|---|---|
| classify | `claude:haiku` | [`classify.mjs`](/C:/GB/scripts/agent/classify.mjs) | high volume → cheapest subscription model |
| extract | `claude:sonnet` | [`extract.mjs`](/C:/GB/scripts/agent/extract.mjs) | ~18 % of threads, quality matters |
| verify | `deepseek:deepseek-chat` | [`verify.mjs`](/C:/GB/scripts/agent/verify.mjs) | tiny volume; independent second AI from a different vendor |
| calibrate | `claude:sonnet` | [`calibrate.mjs`](/C:/GB/scripts/agent/calibrate.mjs) | rare, needs good HTML reasoning |
| diary | `claude:haiku` | [`diary.mjs`](/C:/GB/scripts/agent/diary.mjs) | short free-form summaries |

Providers:

- `claude` — the Claude Code CLI in headless print mode
  ([`claude-cli.mjs`](/C:/GB/scripts/agent/claude-cli.mjs)). Auth = the owner's
  Claude subscription: run `claude` once in a plain terminal and log in.
  No API key, billed against the subscription's usage windows.
- `deepseek` — HTTP API, needs `DEEPSEEK_API_KEY`.

The design intent:

- cheap Claude models do the first-pass semantic work in volume
- deterministic code does strict rule enforcement
- the verifier stays on a *different vendor* than the extractor on purpose —
  an independent second opinion has independent blind spots (it caught real
  extractor over-leniency in practice; keep it cross-vendor)

## Usage Limits = Pause, Not Death

Historical failure: in April 2026 the Codex CLI hit its subscription limit and
the agent stayed silently dead for 7 weeks (runs "succeeded" with exit 0 every
5 minutes). The current design treats limits as a self-healing pause:

1. A `QuotaError` (from either provider) makes the orchestrator persist
   `pause_until` + `pause_reason` into the `agent_meta` table and write
   `pause-until.txt` next to `agent.db`. Claude limit messages are parsed for
   the reset time; unknown reset → retry in 1 hour. Exit code is 75.
2. [`run-agent-batch.ps1`](/C:/GB/scripts/agent/run-agent-batch.ps1) checks
   `pause-until.txt` first and exits in milliseconds while paused — scheduled
   runs keep firing but cost nothing.
3. The first run after the window passes resumes automatically; a clean run
   clears the pause and refreshes the `last-success.txt` heartbeat.
4. If the agent has not succeeded for >24 h beyond any legitimate pause — or
   >9 days no matter what (renewing hourly pauses must not suppress the alarm
   forever) — the wrapper drops `DRIVECODEX-CRAWLER-STOJI-PRECTI-ME.txt` on
   the Desktop with plain-language instructions, and removes it once runs
   succeed again. Fresh installs that have never succeeded are anchored by
   `first-run.txt`, so a never-working deployment alarms too.

## Parser Layer

Parser files live in [`parsers`](/C:/GB/scripts/agent/parsers).

Supported/specialized engines:

- [`invision.mjs`](/C:/GB/scripts/agent/parsers/invision.mjs)
- [`phpbb.mjs`](/C:/GB/scripts/agent/parsers/phpbb.mjs)
- [`xenforo.mjs`](/C:/GB/scripts/agent/parsers/xenforo.mjs)
- [`woltlab.mjs`](/C:/GB/scripts/agent/parsers/woltlab.mjs)
- generic fallback: [`generic.mjs`](/C:/GB/scripts/agent/parsers/generic.mjs)

Detection is handled by [`detect.mjs`](/C:/GB/scripts/agent/parsers/detect.mjs).

The parser contract is simple: produce normalized post objects with fields like:

- `author`
- `postId`
- `when`
- `pageNumber`
- `text`

Everything downstream assumes that shape.

## State Machine

Practical statuses I saw in code:

- forums
  - `discovered`
  - `queued`
  - `active`
  - `disqualified`
  - `calibration_failed`
  - `exhausted`
- threads
  - `pending`
  - `discarded`
  - `extracted`
  - `error`
- cases
  - `ai_approved`
  - `verified`
  - `verify_rejected`
  - `verify_skipped`
  - `verify_error`
  - `crosscheck_dupe`
  - `import_ready`
  - `imported`
  - `import_failed`

The queue is not implemented as a separate broker. SQLite itself is the queue and checkpoint layer.

## Learning Loop

The most interesting part of the design is the feedback loop:

- calibration learns parser hints per forum
- diary entries summarize what worked on previous forums
- diary context is injected into future structure-discovery prompts
- cooldown logic prevents wasting cycles on mostly exhausted forums

So this is meant to become better over time per forum type, not just run statelessly.

## Helper Scripts

- [`seed-known-forums.mjs`](/C:/GB/scripts/agent/seed-known-forums.mjs): marks previously handled forums as already exhausted so the agent does not duplicate old work
- [`seed-candidates.mjs`](/C:/GB/scripts/agent/seed-candidates.mjs): imports ranked forum candidates into SQLite
- [`reset-forum.mjs`](/C:/GB/scripts/agent/reset-forum.mjs): clears failed calibration state so a forum can be retried
- [`patch-symptoms.mjs`](/C:/GB/scripts/agent/patch-symptoms.mjs): re-extracts symptoms for already imported cases and patches Supabase/local payloads
- [`run-agent-batch.ps1`](/C:/GB/scripts/agent/run-agent-batch.ps1): Windows-safe one-shot batch wrapper with process mutex and daily log files
- [`register-agent-task.ps1`](/C:/GB/scripts/agent/register-agent-task.ps1): creates or updates a Windows Task Scheduler job that runs the batch wrapper every few minutes

## How I Would Operate It

Useful commands:

```bash
node --experimental-sqlite scripts/agent/orchestrator.mjs --stats
node --experimental-sqlite scripts/agent/seed-candidates.mjs
node --experimental-sqlite scripts/agent/orchestrator.mjs --phase calibrate
node --experimental-sqlite scripts/agent/orchestrator.mjs --phase crawl
node --experimental-sqlite scripts/agent/orchestrator.mjs --phase verify
node --experimental-sqlite scripts/agent/orchestrator.mjs --continuous
node --experimental-sqlite scripts/agent/reset-forum.mjs --all-failed
```

If I were onboarding myself fast, I would read files in this order:

1. [`orchestrator.mjs`](/C:/GB/scripts/agent/orchestrator.mjs)
2. [`state.mjs`](/C:/GB/scripts/agent/state.mjs)
3. [`calibrate.mjs`](/C:/GB/scripts/agent/calibrate.mjs)
4. [`crawl.mjs`](/C:/GB/scripts/agent/crawl.mjs)
5. [`validate.mjs`](/C:/GB/scripts/agent/validate.mjs)
6. [`verify.mjs`](/C:/GB/scripts/agent/verify.mjs)

## Unattended Windows Operation

For long-running operation, do not keep the agent inside one forever terminal process.
Use short batch runs under Task Scheduler so every run starts cleanly and resumes from
[`agent.db`](/C:/GB/scripts/agent/agent.db).

Recommended setup:

```powershell
powershell -ExecutionPolicy Bypass -File C:\GB\scripts\agent\register-agent-task.ps1
```

That creates a task named `DriveCodexAgentBatch` for the current Windows user with:

- repeat interval: every 5 minutes
- overlap policy: `IgnoreNew`
- wrapper-level protection: named mutex in [`run-agent-batch.ps1`](/C:/GB/scripts/agent/run-agent-batch.ps1)
- log files: `C:\GB\scripts\agent\logs\agent-batch-YYYY-MM-DD.log`

Useful variants:

```powershell
powershell -ExecutionPolicy Bypass -File C:\GB\scripts\agent\register-agent-task.ps1 -IntervalMinutes 10
powershell -ExecutionPolicy Bypass -File C:\GB\scripts\agent\register-agent-task.ps1 -BatchSize 3 -RunNow
powershell -ExecutionPolicy Bypass -File C:\GB\scripts\agent\run-agent-batch.ps1 -Phase verify
```

Important operational note:

- the scheduled task is registered with `Interactive` logon for the current user, which is the safest mode for reusing the same user-level environment, the Claude CLI login, and API keys
- if the machine is logged out, the task will not keep running until that user logs back in

## What Looks Real vs What Looks Planned

Verified from code:

- SQLite-backed state and resumability are real
- staged pipeline structure is real
- LLM-routed classification/extraction hooks are real (Claude CLI by default)
- independent verification and LLM calibration hooks are real
- cooldown and forum exhaustion logic are real
- parser support for multiple forum engines is real

Still weak or unfinished:

- automatic forum discovery currently seeds from `forum-candidates.json`; it is not live web search yet
- dedupe logic now uses broader similarity, but it can still miss duplicates when brand/source data is inconsistent
- parser extraction is regex-heavy and fragile on HTML shape changes
- dedicated regression tests exist under [`tests`](/C:/GB/tests) for crawler utilities and state handling
- service credentials are expected from environment variables, not hardcoded defaults

## Bottom-Line Concept

My concise understanding is:

This folder implements an autonomous forum-ingestion agent whose main job is to transform messy automotive discussion threads into high-confidence structured repair cases by combining:

- parser heuristics
- LLM semantic filtering/extraction (Claude, cheap models in volume)
- deterministic validation
- independent cross-vendor AI review/adaptation
- SQLite persistence
- Supabase import

The important design choice is that it does not trust any single layer. Every stage is supposed to narrow quality before data reaches the final database.
