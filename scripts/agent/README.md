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

Three sources, cheapest first:

- `--forum-url <url>` inserts a forum directly (domain-deduped).
- Static candidates from [`forum-candidates.json`](/C:/GB/scripts/agent/forum-candidates.json) (one seed source, not the only one).
- **Live web discovery** ([`discover.mjs`](/C:/GB/scripts/agent/discover.mjs)): the routed
  `discover` task (Claude + `WebSearch`) finds automotive fault forums by a rotated
  brand × language matrix (EU/CZ front-loaded), triages them in the same call, dedups
  by domain against the registry + local state, and queues survivors as `discovered`.
  Calibration then does the deep accessibility/structure check — discovery doesn't
  duplicate it. Bounded: a couple of queries per run, only when the crawlable pool is
  low and discovery hasn't run in 24 h (set `AGENT_DISABLE_LIVE_DISCOVERY=1` to turn off).

The forum registry is the **online** [`crawl_forums`](/C:/GB/supabase/migrations/020_crawl_forums.sql)
Supabase table (dedup by domain + last-scraped state across machines), accessed via
[`forum-registry.mjs`](/C:/GB/scripts/agent/forum-registry.mjs). Without the migration/service
key it degrades to local-only (SQLite) and discovery still works.

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

**Thread-age gate (the ">=1 year" policy).** Between parse and classify, `processThread`
checks the date of the newest post (`threadLastActivity`, read from the engine
`<time datetime>` ISO timestamps). If the thread's last activity is younger than
~1 year (`AGENT_MIN_THREAD_AGE_DAYS`, default 365), it is **not** judged yet — it
is set aside as `deferred` with a `revisit_after` (= last post + 1 year) instead
of being discarded. The reason: a fresh thread may not carry its fix yet, and
once we discard a thread we never look again, so judging it too early permanently
loses a resolution that lands later. When the year elapses, `reviveDueDeferredThreads`
re-queues it (status → `pending`) and the next batch re-fetches it: if a fix has
since appeared it is extracted, otherwise it is judged normally and closed for
good (a matured thread is **not** re-checked forever). An **unknown/unparseable**
date (localized listings, e.g. generic .cz/.de skins with no `<time>`) falls
through and is processed now — the safe direction is never to silently drop a
thread we cannot date. The gate lives only in the production `processThread`;
calibration probes (`fetchAndParse`/`classify`/`extract` directly) are unaffected,
so a forum is never failed for having young sample threads.

### Phase 4: Validate

Core file: [`validate.mjs`](/C:/GB/scripts/agent/validate.mjs)

This stage is intentionally non-LLM.

It rejects cases if they are missing core fields, use future-tense "will repair / will update" language, have too-short descriptions/resolutions, or claim fault/resolution posts from different authors.

This file is important because it turns the system from "LLM extraction" into "LLM extraction with deterministic guardrails".

### Phase 5: Verify

Core file: [`verify.mjs`](/C:/GB/scripts/agent/verify.mjs)

After deterministic validation, an independent AI auditor (default: DeepSeek —
deliberately a different vendor than the Claude-based extractor) re-reads the
original thread text and scores the case. It is the last automatic gate before
the human review queue (`status='pending'` in Supabase).

This is a second opinion layer, separate from the extraction path.

**Structured per-condition gate (2026-06).** The auditor no longer returns a free
`PASS`/`FAIL` line — that one-line prompt silently passed three classes of bad
case (an early review caught 8 live examples). It now returns a JSON object with
**six strict booleans**, and *code* (not the model) applies an AND-gate — any
false/missing/non-boolean key → `FAIL`:

| condition | catches |
|---|---|
| `in_scope` | non-cars (motorcycle/HGV/marine/quad) on a car+van database |
| `vehicle_matches_cited_posts` | case vehicle ≠ the vehicle in the cited fault/resolution posts (multi-vehicle thread bleed) |
| `is_genuine_fault` | config/menu questions, parts-fitment/where-to-buy, elective upgrades/retrofits/coding-activation, third-party-gadget firmware, preventive-maintenance opinion |
| `repair_performed` | "fixed itself" / "resolved on its own" — no repair action |
| `repair_confirmed` | outcome unknown, fault returned, or root cause never found |
| `actionable` | symptoms/resolution too vague to act on |

Key design points (see the prompt in `verify.mjs`):
- The case's `case_author` + `fault_post_numbers` + `resolution_post_numbers`
  (already in the payload, previously unused) are injected so the auditor judges
  the vehicle/fault/fix from the **cited posts only** — the structural fix for
  multi-vehicle bleed.
- `is_genuine_fault` carries an inline allowlist so genuine repairs are NOT
  rejected: cleaning (incl. ultrasonic), additive/fluid cures, adjustment,
  re-flashing the car's **own** ECU, rodent-wiring re-splice, an emulator that
  **restores** a failed factory function, and worn-part replacement on classic cars.
- A conservative deterministic pre-gate (`isLikelyOutOfScopeVehicle`, exported)
  short-circuits obvious motorcycles/HGV to `FAIL` with no DeepSeek call. It keys
  on the **model string only** (never displacement/age) and the moto-code regexes
  run only for moto-capable makers, so a car like `320d` or `Golf 1.8` never trips.
- Output is parsed with the codebase's `indexOf('{')..lastIndexOf('}')` slice; a
  malformed response triggers **one** repair retry then **fails closed** to
  `verify_rejected` (a bad case is never silently imported). `temperature:0`.
- The classifier (`classify.mjs`) `has_explicit_fault` definition was tightened in
  lockstep to drop the non-fault classes one stage earlier; the verifier is the
  authoritative gate, the human review queue is the final backstop.

Validated against a 67-case live regression (the imports from the prior night):
caught **8/8** known-bad cases, **0** false-rejects on 50 confirmed-good cases,
identical verdicts across two runs (deterministic). Logic is covered by
[`tests/agent-verify.test.js`](/C:/GB/tests/agent-verify.test.js).

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
| verify | `deepseek:deepseek-v4-flash` | [`verify.mjs`](/C:/GB/scripts/agent/verify.mjs) | tiny volume; independent second AI from a different vendor (thinking disabled) |
| calibrate | `claude:sonnet` | [`calibrate.mjs`](/C:/GB/scripts/agent/calibrate.mjs) | rare, needs good HTML reasoning |
| diary | `claude:haiku` | [`diary.mjs`](/C:/GB/scripts/agent/diary.mjs) | short free-form summaries |
| translate | `claude:haiku` | [`backfill-resolution-i18n.mjs`](/C:/GB/scripts/agent/backfill-resolution-i18n.mjs) | high-volume cs/de backfill of resolution texts |

Providers:

- `claude` — the Claude Code CLI in headless print mode
  ([`claude-cli.mjs`](/C:/GB/scripts/agent/claude-cli.mjs)). Auth = the owner's
  Claude subscription: run `claude` once in a plain terminal and log in. Billed
  against the subscription's usage windows. **Do not set `ANTHROPIC_API_KEY` in
  the scheduler account's environment** — the CLI would then bill the metered
  API instead of the subscription, and the usage-limit pause (which keys off
  subscription limit messages) would no longer apply. If the subscription login
  expires, the agent raises an `AuthError`, stops (no pause), and the stall
  alarm reaches the owner — re-run `claude` to log in.
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
   the reset time; unknown reset → retry in 1 hour (DeepSeek balance, which
   needs a human top-up, pauses 6 h). Exit code is 75. The heartbeat is only
   refreshed by a full run (no `--phase`), so a stuck full task still alarms
   even if a phase-limited task keeps "succeeding".
2. [`run-agent-batch.ps1`](/C:/GB/scripts/agent/run-agent-batch.ps1) checks
   `pause-until.txt` first and exits in milliseconds while paused — scheduled
   runs keep firing but cost nothing.
3. The first run after the window passes resumes automatically; a clean full
   run clears the pause and refreshes the `last-success.txt` heartbeat.
4. The Desktop marker `DRIVECODEX-CRAWLER-STOJI-PRECTI-ME.txt` is written when
   the last clean run was >24 h ago **and** it is >6 h past any promised reset
   — or unconditionally after >9 days (so renewing hourly pauses can't suppress
   it forever). It is removed once runs succeed again. Fresh installs that have
   never succeeded are anchored by `first-run.txt`, so a never-working
   deployment alarms too. An expired Claude login (`AuthError`) does not pause,
   so it reaches the >24 h alarm directly.

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

**Calibrated CSS selectors are honored first.** When `calibration_json` has a
`post_selector` (the LLM finds these during calibration), `parseHtml` in
[`crawl.mjs`](/C:/GB/scripts/agent/crawl.mjs) extracts posts with
`selectPosts()` in [`common.mjs`](/C:/GB/scripts/agent/parsers/common.mjs) —
a real tokenizer-backed CSS matcher (post / content / author / date / quote
selectors), not regex. This is what makes modern JS platforms work: VerticalScope
"Fora" sites (VWVortex, ToyotaNation, SwedeSpeed, Audizine) use
`div.MessageCard.js-post` containers that the regex `xenforo` engine parser
cannot match. The engine parsers are the fallback when no selector is set.

**JS-rendered shells get a browser retry.** If a thread page returns HTTP 200
but yields zero parseable posts (an empty SPA shell), `fetchThreadPages`
re-fetches page 1 once via the headless-browser render (`forceBrowser` in
[`fetch-utils.mjs`](/C:/GB/scripts/agent/fetch-utils.mjs)) and re-parses, so
single-page-app forums aren't silently discarded as "Too few posts".

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
  - `deferred` (fetched but too young to judge — set aside until `revisit_after`,
    ~1 year after its last post; revived to `pending` when due)
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
- the **daily coach** (Phase 2) closes the outer loop: it watches the per-forum verified yield over several nights and automatically (reversibly) re-prioritises and re-times the crawl queue — all without ever loosening a quality gate
- **guarded auto-recalibration** (`recalibrate-guarded.mjs`) closes the structural loop: a forum that processes threads but extracts nothing for several nights is re-discovered + re-calibrated against an in-memory shim (the live row is never touched until success), and the new config is kept ONLY if it beats the old yield AND keeps real sections — otherwise it rolls back. Fully reversible.
- the **alert-agent** (`alert-agent.mjs`) closes the precision loop: when the precision auditor raises an alarm it reflects on the flagged cases (plain-Czech diagnosis + a gate-tightening recommendation, report-only) and reversibly **quarantines** the high-confidence bad cases out of the live DB — without ever editing a gate itself

So this is meant to become better over time per forum type, not just run statelessly.

## Helper Scripts

- [`seed-known-forums.mjs`](/C:/GB/scripts/agent/seed-known-forums.mjs): marks previously handled forums as already exhausted so the agent does not duplicate old work
- [`seed-candidates.mjs`](/C:/GB/scripts/agent/seed-candidates.mjs): imports ranked forum candidates into SQLite
- [`reset-forum.mjs`](/C:/GB/scripts/agent/reset-forum.mjs): clears failed calibration state so a forum can be retried
- [`recover-discarded.mjs`](/C:/GB/scripts/agent/recover-discarded.mjs): **one-time** recovery of threads discarded BEFORE the thread-age gate shipped (genuine faults marked "no confirmed resolution" that may have a fix now). Flips the recoverable ones `discarded` → `pending` so the nightly crawl re-judges them under the age-aware pipeline; does no fetching/LLM itself. Dry-run by default (reports buckets: recoverable / too_few / terminal / other); `--apply` flips + writes a backup; `--revert <backup>` restores still-pending ids (CAS — never clobbers a re-processed one). Flags: `--limit`, `--forum`, `--include-too-few`. Run it AFTER the age-gate code is live, else the old pipeline just re-discards them
- [`patch-symptoms.mjs`](/C:/GB/scripts/agent/patch-symptoms.mjs): re-extracts symptoms for already imported cases and patches Supabase/local payloads
- [`backfill-resolution-i18n.mjs`](/C:/GB/scripts/agent/backfill-resolution-i18n.mjs): translates the English `resolution` of approved cases into Czech/German (`resolution_cs`/`resolution_de` + detected `resolution_lang`) for the "Known Faults" panel. Routed via Claude (task `translate`), resumable (queue = `resolution_lang IS NULL`); run nightly as Step 3 of `run-agent-batch.ps1`. Never modifies the canonical English `resolution`
- [`recall-watchdog.mjs`](/C:/GB/scripts/agent/recall-watchdog.mjs): daily recall audit of the verifier — a cross-vendor (Claude) re-check of a sample of recent `verify_rejected` cases to catch the verifier *over-rejecting* good cases (the one failure mode the verifier can't see in itself). Self-gates to 1×/day after `RECALL_AUDIT_HOUR` (07:00); writes `logs/recall-audit-YYYY-MM-DD.md` always, and `recall-alert.txt` only when the wrongly-rejected rate clears a threshold (≥30% of ≥3). Runs as **Step 1 of the dedicated `run-coach-batch.ps1`** morning task (alongside the daily coach + precision auditor), which mirrors the alert to a Desktop marker. Routes via the `AGENT_LLM_RECALL-AUDIT` env override (no change to `llm.mjs`). The agree/disagree judgements accumulate as labelled data for future verifier-prompt tuning
- [`daily-coach.mjs`](/C:/GB/scripts/agent/daily-coach.mjs): the self-improving loop. Runs 1×/morning from the dedicated `DriveCodexDailyCoach` task (via [`run-coach-batch.ps1`](/C:/GB/scripts/agent/run-coach-batch.ps1)) AFTER the night window. Phase 1 = observe (night report + `crawl_metrics`). **Phase 2 = auto-tier adapt** (the planner is [`coach-adapt.mjs`](/C:/GB/scripts/agent/coach-adapt.mjs), a pure module): each night it may apply at most ONE reversible change per forum — **priority_score** (verified-yield ranking) or **cooldown** (shorten/extend within the engine's 24h/168h tiers) — and emits a **shadow re-calibration proposal** for forums that process threads but extract nothing (never auto-applied — it is the one knob not column-reversible). Guardrails: min-volume, 2–3-night hysteresis, 1 change/forum/day, transient guard, 10-day anti-flap, a 50%-of-fleet circuit-breaker, and an 8/night cap. Every applied change is journaled in `coach_journal` (atomic `applyCoachChange`) and reported under "Co jsem automaticky upravil". **It never touches a verify gate, threshold, or prompt** — only crawl order/timing
- [`apply-proposal.mjs`](/C:/GB/scripts/agent/apply-proposal.mjs): undo tool for the coach's reversible changes. `--list` shows revertable changes; `--revert [--date|--forum|--case|--knob priority|cooldown|recalibrate|quarantine] [--dry-run]` rolls them back newest-first via **compare-and-swap** (restores a change only if the row still holds the value the coach wrote, so it never clobbers a newer engine/manual/human edit). Idempotent. Dispatches on `target_kind`: `forum` knobs (priority/cooldown/recalibrate) restore forum columns; `quarantine` restores a case status AND flips the live `gearbrain_cases` row back out of `rejected`. (Applying risky prompt/threshold proposals is still a Phase 4 deliverable, not built yet.)
- [`recalibrate-guarded.mjs`](/C:/GB/scripts/agent/recalibrate-guarded.mjs): **guarded auto-recalibration** (Step 5 of `run-coach-batch.ps1`). Selects ≤`RECAL_MAX_PER_NIGHT` (default 1) "stuck" forums (the coach's `planRecalProposal` signal), skipping profile forums, forums already changed today (1/forum/day), and anything re-calibrated within `RECAL_COOLDOWN_DAYS` (7). For each it snapshots the full config, probes the CURRENT config for an honest baseline, then runs `calibrateForum` against a **buffering state shim** (`makeBufferingState`) so the live forum row is never mutated until the decision; the candidate is committed (one atomic `applyCoachChange`, knob `recalibrate`) ONLY if it passes calibration thresholds, beats the baseline yield by `RECAL_MIN_YIELD_GAIN` (0.2), AND ended up with real sections — otherwise an `applied=0` attempt marker is journaled (drives the anti-flap) and nothing changes. Quota/auth aborts the step (exit 3) so the batch skips the rest and retries tomorrow
- [`alert-agent.mjs`](/C:/GB/scripts/agent/alert-agent.mjs): **cautious follow-up to the precision alarm** (Step 4 of `run-coach-batch.ps1`, only when `precision-alert.txt` exists; self-gates 1×/day). It clusters the flagged labels (`logs/precision-labels.jsonl`), reversibly **quarantines** the HIGH-confidence wrongly-accepted cases (cap `ALERT_MAX_QUARANTINE`, default 8) — live `gearbrain_cases` flipped pending/approved→`rejected` via an atomic CAS keyed by `local_id`, then the local case → `quarantined` + journaled (`applyCaseChange`, knob `quarantine`); live-first with compensation if the local write fails, so a half-action is never left un-revertable. Then it asks Claude for a plain-Czech diagnosis + a gate-tightening **recommendation** appended to the report/marker. It **NEVER edits a gate or prompt** (that stays the human Phase-4 boundary); case ids come only from the structured label log, never model prose. Quarantine runs BEFORE the model call so it survives a tight quota
- [`precision-auditor.mjs`](/C:/GB/scripts/agent/precision-auditor.mjs): the **mirror** of the recall watchdog (daily coach Phase 3). The watchdog catches the verifier *over-rejecting*; this catches it *under-rejecting* — it samples recently APPROVED cases (verified/import_ready/imported) and re-judges them with Claude against the same `QUALITY_BAR`, reporting the rate of **wrongly-ACCEPTED** cases (bad cases that slipped into the live DB — the more dangerous failure). REPORT-ONLY: writes `logs/precision-audit-YYYY-MM-DD.md`, `crawl_metrics precision_*`, and an accumulating `logs/precision-labels.jsonl` (a Claude-judged label seed for the future Phase-4 gate work). The Desktop marker `DRIVECODEX-PRECIZNI-AUDITOR-PRECTI-ME.txt` fires only on a 7-day **pooled** rate or a same-day **cluster on one quality-bar clause** (never single-day noise). Sampling is risk-stratified (newest imports + payload-heuristic riskiest + random). Runs as **Step 3 of `run-coach-batch.ps1`**; routes via `AGENT_LLM_COACH-PRECISION`
- [`quality-bar.mjs`](/C:/GB/scripts/agent/quality-bar.mjs): the single canonical `QUALITY_BAR` definition (the (a)-(e) admission criteria + genuine-repairs allowlist) shared by both daily audits (`recall-watchdog.mjs` re-exports it) so they never drift apart
- [`run-agent-batch.ps1`](/C:/GB/scripts/agent/run-agent-batch.ps1): Windows-safe one-shot batch wrapper with process mutex and daily log files (loads `.env.local` automatically). Post-crawl steps: (1) refresh crawled-index, (2) fault-taxonomy classify, (3) resolution i18n backfill, (4) verifier recall watchdog
- [`register-agent-task.ps1`](/C:/GB/scripts/agent/register-agent-task.ps1): creates or updates a Windows Task Scheduler job that runs the batch wrapper every few minutes
- [`apply-migrations.ps1`](/C:/GB/scripts/agent/apply-migrations.ps1): applies pending Supabase migrations to the linked project non-interactively (reads `SUPABASE_DB_PASSWORD` from `.env.local`); `-DryRun` to preview

## Secrets / Environment

Fill `scripts/agent/.env.local` (copy from
[`.env.local.example`](/C:/GB/scripts/agent/.env.local.example); git-ignored) **once**:

| Var | Used for | Where to get it |
|---|---|---|
| `SUPABASE_SERVICE_KEY` | online registry + case import + crosscheck | Dashboard → Settings → API → service_role |
| `SUPABASE_DB_PASSWORD` | `supabase db push` (migrations) | Dashboard → Settings → Database |
| `DEEPSEEK_API_KEY` | independent verification | DeepSeek console |
| `SUPABASE_URL` | (public) | already set in the template |

Once filled, everything is autonomous: scheduled runs (`run-agent-batch.ps1`) load
it, migrations run via `apply-migrations.ps1`, and the online registry + import
activate. Without it the agent still runs (local-only registry, no import).

## How I Would Operate It

Useful commands (`--env-file` loads the secrets for manual runs):

```bash
node --experimental-sqlite scripts/agent/orchestrator.mjs --stats
node --experimental-sqlite --env-file=scripts/agent/.env.local scripts/agent/orchestrator.mjs --phase calibrate
node --experimental-sqlite --env-file=scripts/agent/.env.local scripts/agent/orchestrator.mjs --phase crawl
node --experimental-sqlite --env-file=scripts/agent/.env.local scripts/agent/orchestrator.mjs --phase verify
node --experimental-sqlite --env-file=scripts/agent/.env.local scripts/agent/orchestrator.mjs --continuous
node --experimental-sqlite scripts/agent/reset-forum.mjs --all-failed

# Apply pending DB migrations (e.g. 020_crawl_forums) to the linked project:
powershell -ExecutionPolicy Bypass -File scripts/agent/apply-migrations.ps1 -DryRun
powershell -ExecutionPolicy Bypass -File scripts/agent/apply-migrations.ps1
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
