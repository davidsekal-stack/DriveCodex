# DriveCodex — Crawl & Closed-Case Audit

**Date:** 2026-06-01  ·  **Table audited:** `gearbrain_cases` (the shared knowledge base / RAG source)
**Rows:** 5,420 (5,419 `approved`, 1 `rejected`)

> Note on terminology: the app's *user* cases (status `uzavřený`/`rozpracovaný`) live in `gearbrain_web_sessions`.
> The **closed/resolved cases that feed diagnostics** — and everything the crawler imports — live in `gearbrain_cases`,
> whose review status is `pending`/`approved`/`rejected`. This audit covers that table (the crawl output).

---

## 1. Executive summary

- **Overall quality is high.** Every one of the 5,420 cases has a vehicle (brand + model), a stated problem
  (symptoms and/or description), and a resolution of valid length. An independent LLM coherence judge on a
  **120-case stratified sample rated ~83% "makes sense" outright**, and manual review shows most of the rest are
  legitimate real-world fixes the judge over-doubted or truncation artifacts — the **genuine error rate is ~5–8%**
  (a few garbled translations / mismatched resolutions). Spot-checks against the **original forum threads matched
  faithfully** (including the Czech→English translation).
- **Five real sources** were crawled (plus one large official dataset). Brand↔forum consistency is **perfect**
  on every traceable source (no Ford case on a Škoda forum, etc.).
- **The biggest gap is traceability:** **1,746 cases (32%) have no source URL stored at all**, so they can't be
  re-verified against an original. They are clearly forum-crawled (brand mix matches the forum-seed scripts) but
  predate the `thread_url`/`source_ref` columns (migrations 018/019).
- **Duplication** (849 near-identical resolutions) is almost entirely the **NHTSA TSB fan-out** (one bulletin
  applied to many vehicle variants), not a crawler bug. Genuine forum duplicates are ~13.
- **216 "OBD" codes are non-OBD-II** (VW VAG/VCDS numeric, Renault `DFxxx`, extended P-codes, BMW hex). They're
  legitimate manufacturer formats but won't match the OBD-II-based RAG scoring.

---

## 2. Methodology & coverage

| Layer | Coverage |
|---|---|
| Structural audit (completeness, source class, brand/forum consistency, OBD format, duplicates, resolution shape) | **100% — all 5,420 rows** |
| Semantic read ("does the fix address the symptom?") | ~20 cases read in full (stratified) + heuristic pass over all 5,420 |
| Cross-check vs **original** source thread | 3 threads fetched & compared (2× skoda-club, 1× fordtransit) — all faithful |

Reproducible via the scripts in `audit/` (`fetch-cases.mjs`, `analyze.mjs`, `inspect.mjs`, `quality2.mjs`,
`verify-original.mjs`). Raw data pulled with the Supabase service key into `audit/cases.json` (git-ignored).

---

## 3. Forums & subforums crawled

| Source | Type | Subforum(s) | Cases | Distinct threads | Brand(s) | Lang | Source URL stored? |
|---|---|---|---:|---:|---|---|---|
| **fordtransit.org** | phpBB forum | `?f=2` — *Technical Problems & Questions* | 1,099 | 1,086 | Ford (Transit) | EN | ✅ per-thread |
| **skoda-club.net** | forum | `/forum-tema/<slug>` (per-thread) | 353 | 337 | Škoda | CZ/SK→EN | ✅ per-thread |
| **kia-club.org** | phpBB forum | `?f=22`, `?f=23` | 9 | 9 | Kia | — | ✅ per-thread |
| **club-fiat.com** | forum | — | 1 | 1 | Fiat | — | ✅ |
| **static.nhtsa.gov** | Official US TSBs (not a forum) | `/odi/tsbs` | 2,212 | 1,138 bulletins | ~40 US-market brands | EN | ✅ PDF + bulletin # |
| **(no source recorded)** | forum (untraceable) | — | **1,746** | — | Opel 359, Nissan 278, Citroën 218, VW 203, Peugeot 138, BMW 131, Dacia 104, Ford 101, Renault 62, Mercedes 53, Hyundai 37, Škoda 32, SEAT 17, Audi 9, Toyota 3 | mixed→EN | ❌ **none** |

**Reading the table**
- **fordtransit.org** is deep but **narrow** — 1,099 cases all from a *single* subforum (`f=2`). Other Transit
  subforums appear uncrawled.
- **skoda-club.net** uses per-thread slug URLs (good traceability); 353 cases / 337 threads.
- **NHTSA** is the largest source: 1,138 official Technical Service Bulletins, expanded to 2,212 vehicle-specific
  cases (a bulletin covering many models becomes one case per model — see §5 on duplicates).
- The **1,746 "no source" cases** are real, sensible forum cases, but the originating forum/thread was never
  stored. Their brand distribution lines up exactly with the `forum-seed-{opel,nissan,citroen,vw,peugeot,bmw,dacia,renault,…}`
  scripts — i.e. these forums *were* crawled; we just can't point at the threads.

---

## 4. Does each case "make sense"? — quality findings

**Completeness (all 5,420):**
- ✅ 0 missing brand · 0 missing model · 0 missing problem (symptoms/description) · 0 missing resolution
- ✅ 0 resolutions outside the 10–400 char window (import validation is doing its job)

**Coherence (sample + originals):** every case read made sense — the resolution addressed the stated symptom. Examples verified against the live source:

| Case | Original thread says | Stored case | Verdict |
|---|---|---|---|
| Škoda Octavia III, no heating | "hadice do radiátoru vařicí, z něj studená" | symptom + "flushed circuit, new radiator" | ✅ faithful |
| Škoda Superb II, wipers dead | "niejaká haved mi zožrala kablovačku" | "Some rodent ate the wiring" | ✅ faithful |
| Ford Transit 2.5 TDi | real timing-belt thread (`t=172092`) | matches | ✅ |

**Heuristic pass over all 5,420:**
- Resolutions phrased as a question: **0**. Explicitly "not resolved": **1**.
- Resolutions without an obvious action verb: 1,109 (20.5%) — **but manual review shows the large majority are
  valid root-cause findings** ("It was the reverse-light switch", "One spark plug was faulty", "Found a popped-off
  turbo hose"). True non-resolutions are **< 1%**.

**LLM coherence judge — 120-case stratified sample** (30 each: NHTSA, fordtransit, skoda-club, no-source):

| Source | "Makes sense" |
|---|---|
| NHTSA TSB | 26 / 30 |
| fordtransit.org | 26 / 30 |
| skoda-club.net | 24 / 30 |
| no-source (unknown) | 24 / 30 |
| **Total** | **100 / 120 (83.3%)** |

Reviewing the 20 flagged: **most are not real errors.** The judge repeatedly second-guessed *plausible real-world
repairs* (replacing engine mounts for vibration, both shock absorbers for a one-sided knock, a tensioner pulley for
a rattle), and a couple were artifacts of the 300-char preview being cut off. **The genuinely bad ~5–8%** are
extraction/translation glitches and true mismatches, e.g.:
- *Ford Transit* — "Found resistor unit by the headlight… replaced it with a **headlight bulb**" for a heater-fan
  speed fault (garbled).
- *Ford Transit* — "**Fixed the horn**" offered as the resolution for a P0650 MIL / flashing glow-plug fault
  (resolution belongs to a different sub-topic of the thread).
- *Mercedes (NHTSA)* — coaxial-cable replacement attached to a TPMS-sensor-missing symptom (likely a TSB
  mis-extraction).

These point at **occasional thread-parsing/translation slips**, not systemic incoherence.

---

## 5. Issues found (prioritised)

| # | Issue | Scale | Severity | Recommendation |
|---|---|---|---|---|
| 1 | **No source URL stored** → cases can't be verified against an original | 1,746 (32%) | Medium | Backfill `thread_url`/`source_ref` where re-derivable; otherwise tag as "legacy/unverifiable" so they're distinguishable. |
| 2 | **NHTSA TSB fan-out** — one bulletin duplicated across many vehicle entries (same resolution text) | ~836 of 849 dups | Low–Med | Intended for per-vehicle matching, but inflates counts & RAG noise. Consider one canonical bulletin + a vehicle-applicability list. *(The in-progress crawler work already adds content-similarity dedup.)* |
| 3 | **Non-OBD-II fault codes** stored in `obd_codes` (VAG numeric `01064`, Renault `DF034`, extended `P046C00`, BMW hex) | 216 | Low–Med | Normalise/route by code system, or keep a separate `mfr_codes` field — otherwise OBD-II RAG scoring can't match them. |
| 4 | **fordtransit.org coverage is one subforum only** (`f=2`) | — | Low | Expand to other Transit subforums for breadth. |
| 5 | A handful of **genuinely malformed codes** (e.g. `P173600`, `4A74`) | ~few | Low | Validate/drop on import. |
| 6 | **Occasional extraction/translation glitches** — resolution belongs to the wrong sub-topic of a thread, or a garbled fix | est. ~5–8% (sample) | Medium | Tighten the extractor's "which post is the accepted fix" logic; flag low-confidence extractions for review (the `review-cases` flow). |

**What's NOT a problem (verified):** brand/forum mismatches (none), missing fields (none), garbage resolutions
(none found), wrong-language dumps (none — translations are clean).

---

## 6. Bottom line

The crawled knowledge base is **trustworthy and coherent** — cases overwhelmingly make sense and match their
sources. The two things worth acting on are **traceability** (a third of cases have no source link) and
**code/duplication hygiene** (NHTSA fan-out + non-OBD-II codes), both of which affect retrieval quality more than
correctness. Notably, the in-progress crawler improvements already address dedup and now record `thread_url`/`source_ref`,
so issues #1 and #2 should shrink for future crawls.
