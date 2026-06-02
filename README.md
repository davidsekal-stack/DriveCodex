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
│   └── migrations/              SQL migrations (002–012)
├── tests/                       Unit + integration tests
├── CLAUDE.md                    Claude Code instructions
├── HANDOVER.md                  Architecture & data flow docs
└── package.json
```

## Features

- **AI Diagnosis** — DeepSeek-powered analysis with structured fault cards (probability, parts, OBD codes, repair steps)
- **RAG Database** — ~920 verified cases, scored by vehicle/OBD/symptom similarity
- **Admin Review** — Cases go through pending → approved/rejected workflow before entering RAG
- **Admin Analytics** — Usage stats, token consumption, registered users, top users
- **Shareable Links** — Read-only diagnostic snapshots with OG meta tags for social media
- **Terms of Service** — Consent gate with localized ToS/EULA
- **PDF Export** — Full diagnostic report export
- **OBD BLE Reader** — Web Bluetooth integration for reading OBD codes
- **3 Languages** — Czech, English, German (all UI strings via i18n)

## Documentation

- [HANDOVER.md](HANDOVER.md) — architecture, data flow, deployment, known issues
- [SUPABASE_SETUP.md](SUPABASE_SETUP.md) — Supabase project setup
- [SUPABASE_GATEKEEPER.md](SUPABASE_GATEKEEPER.md) — RLS & security
