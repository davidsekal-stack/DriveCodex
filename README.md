# DriveCodex — AI Vehicle Diagnostics

Web app for AI-powered automotive fault diagnosis. Combines symptoms, OBD codes, and mechanic notes with LLM analysis and a database of verified repairs (RAG).

Supports 30+ vehicle brands (EU + US market), 3 languages (CS/EN/DE).

## Quick Start

```bash
cd web
npm install
npm run dev       # → http://localhost:5180
```

## Build & Deploy

```bash
cd web
npm run build     # → web/dist/
```

- Push to `main` → Vercel auto-deploy (production)
- Edge functions: `npx supabase functions deploy <name> --no-verify-jwt --project-ref nmvjthfezyjcwuzphiuu`

## Tests

```bash
npm test                # unit + i18n + validation + catalog
npm run test:unit       # unit tests only
npm run test:integration  # Supabase integration (needs env vars)
npm --prefix web run test:e2e   # Playwright browser end-to-end (see TEST_SETUP.md)
```

Three layers run in CI on every push/PR (`.github/workflows/test.yml`): app-logic unit tests, backend
integration against an isolated test DB, and a Playwright browser walkthrough of the core workflow.
See `TEST_SETUP.md` for details.

## Project Structure

```
drivecodex/
├── web/                         React SPA (Vite)
│   ├── src/
│   │   ├── App.jsx              View routing, theme, sidebar
│   │   ├── components/          UI components (incl. admin panels)
│   │   ├── hooks/               Custom hooks (business logic)
│   │   ├── lib/                 Pure functions (AI, RAG, storage, validation)
│   │   ├── i18n/                Localization (CS/EN/DE)
│   │   └── constants/           Vehicle catalogs, OBD codes, symptoms, enums
│   └── package.json
├── supabase/
│   ├── functions/
│   │   ├── _shared/             Shared helpers (CORS, auth, response, client)
│   │   ├── analytics/           Admin analytics dashboard data
│   │   ├── deepseek-proxy/      AI API proxy + rate limiting
│   │   ├── push-case/           Save closed case to RAG (pending review)
│   │   ├── search-cases/        RAG scoring + retrieval
│   │   ├── review-cases/        Admin approve/reject
│   │   ├── send-feedback/       User feedback
│   │   └── share-case/          Shareable diagnostic links + OG tags
│   └── migrations/              SQL migrations (002–020)
├── scripts/
│   ├── agent/                   Autonomous crawl agent (builds the RAG DB) — see scripts/agent/README.md
│   ├── forum-seed-*.mjs         One-shot per-brand forum seeders (legacy)
│   └── nhtsa-*.mjs              NHTSA TSB ingestion pipeline
├── tests/                       Unit + integration + crawl-agent tests
├── CLAUDE.md                    Claude Code instructions
├── HANDOVER.md                  Architecture & data flow docs
└── package.json
```

## Features

- **AI Diagnosis** — DeepSeek-powered analysis with structured fault cards (probability, parts, OBD codes, repair steps)
- **Repair Guide** — guided repair flow built from a diagnosed fault, in craft-correct order: verify the cause (recommended tests first) → pick ONE of the suggested repairs (they are alternatives, not a sequence) → "did it help?" → final check with an honest outcome (resolved / fault persists). Every step is undoable until the case closes, failed attempts are archived with the case (never deleted), parts are shown as a hint (not a buy-first step), and each suggestion is labeled by source (verified DB cases vs. AI)
- **RAG Database** — thousands of verified cases, scored by vehicle/OBD/symptom similarity
- **Autonomous Crawl Agent** — Claude-first pipeline that discovers automotive forums, extracts resolved fault cases, and feeds the RAG DB through a staged quality gate (classify → extract → validate → independent verify → dedup → import). See [scripts/agent/README.md](scripts/agent/README.md)
- **Admin Review** — Cases go through pending → approved/rejected workflow before entering RAG
- **Admin Analytics** — Usage stats, token consumption, registered users, top users
- **Shareable Links** — Read-only diagnostic snapshots with OG meta tags for social media
- **Terms of Service** — Consent gate with localized ToS/EULA
- **PDF Export** — Full diagnostic report export
- **OBD BLE Reader** — Web Bluetooth integration for reading OBD codes
- **3 Languages** — Czech, English, German (all UI strings via i18n)

## Documentation

**Start here.** This is the index to every doc in the repo — each lives next to
the thing it describes, but they're all linked from here.

**Architecture & operations**
- [HANDOVER.md](HANDOVER.md) — architecture, data flow, deployment, known issues
- [CLAUDE.md](CLAUDE.md) — Claude Code working instructions & conventions
- [scripts/agent/README.md](scripts/agent/README.md) — the autonomous crawl agent (pipeline, providers, pause/resume, discovery, registry)

**Crawl & data quality**
- [CRAWL_AUDIT.md](CRAWL_AUDIT.md) — audit of the crawled RAG database (quality, coverage, issues)
- [NHTSA_SUPERCRAWLER_SPEC.md](NHTSA_SUPERCRAWLER_SPEC.md) — NHTSA TSB ingestion pipeline spec
- [NHTSA_STATUS.md](NHTSA_STATUS.md) — NHTSA ingestion progress/status
- [scripts/agent/CRAWLED_INDEX.md](scripts/agent/CRAWLED_INDEX.md) — cross-source "already-extracted" index notes

**Supabase**
- [SUPABASE_SETUP.md](SUPABASE_SETUP.md) — Supabase project setup
- [SUPABASE_GATEKEEPER.md](SUPABASE_GATEKEEPER.md) — RLS & security
- [SUPABASE_EDGE_FUNCTION.md](SUPABASE_EDGE_FUNCTION.md) — edge function notes

**Testing**
- [TEST_SETUP.md](TEST_SETUP.md) — test environment & CI setup
