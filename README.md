# GearBrain — AI Vehicle Diagnostics

Web app for AI-powered automotive fault diagnosis. Combines symptoms, OBD codes, and mechanic notes with LLM analysis and a database of verified repairs (RAG).

Supports 30+ vehicle brands (EU + US market), 3 languages (CS/EN/DE).

## Quick Start

```bash
cd web
npm install
npm run dev       # → http://localhost:5173
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
```

## Project Structure

```
gearbrain/
├── web/                         React SPA (Vite)
│   ├── src/
│   │   ├── App.jsx              View routing, theme, sidebar
│   │   ├── components/          23 UI components
│   │   ├── hooks/               9 custom hooks (business logic)
│   │   ├── lib/                 22 modules (AI, RAG, storage, validation)
│   │   ├── i18n/                Localization (CS/EN/DE)
│   │   └── constants/           Vehicle catalogs, OBD codes, symptoms
│   └── package.json
├── supabase/
│   ├── functions/
│   │   ├── deepseek-proxy/      AI API proxy + rate limiting
│   │   ├── push-case/           Save closed case to RAG (pending review)
│   │   ├── search-cases/        RAG scoring + retrieval
│   │   ├── review-cases/        Admin approve/reject
│   │   └── send-feedback/       User feedback
│   └── migrations/              SQL migrations (002–009)
├── tests/                       Unit + integration tests
├── CLAUDE.md                    Claude Code instructions
├── HANDOVER.md                  Architecture & data flow docs
└── package.json
```

## Documentation

- [HANDOVER.md](HANDOVER.md) — architecture, data flow, deployment, known issues
- [SUPABASE_SETUP.md](SUPABASE_SETUP.md) — Supabase project setup
- [SUPABASE_GATEKEEPER.md](SUPABASE_GATEKEEPER.md) — RLS & security
