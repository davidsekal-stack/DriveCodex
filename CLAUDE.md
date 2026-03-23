# GearBrain — Claude Code Instructions

## Project Overview
AI-powered automotive diagnostic web app. React SPA + Supabase backend + Deno edge functions.

## Before Every Push
Pre-push hook runs automatically (ESLint + Vite build). Do NOT skip with `--no-verify`.

## Documentation Updates
After completing any significant feature, refactoring, or architectural change:
1. Update `README.md` — keep project structure, setup instructions, and feature list current
2. Update `HANDOVER.md` — architecture decisions, data flow, deployment notes, known issues
3. Keep both files concise and accurate. Remove stale information.

## Code Style
- **Inline styles** — the project uses inline `style={{}}` objects everywhere. Follow this pattern.
- **Theme** — use `t.bg`, `t.text`, `t.accent` etc. from theme.js. Never hardcode colors.
- **i18n** — all user-visible strings go through `tr()`. Add keys to cs.js, en.js, de.js.
- **No CSS files** — no Tailwind, no styled-components, no .css imports.

## Architecture
- `web/src/App.jsx` — view routing, theme, sidebar. NOT a god component — delegates to hooks.
- `web/src/hooks/` — business logic (case CRUD, diagnosis workflow, auth).
- `web/src/lib/` — pure functions (AI prompts, RAG scoring, validation, storage adapters).
- `web/src/constants/` — vehicle catalogs, OBD codes, symptoms.
- `supabase/functions/` — Deno edge functions (AI proxy, push-case, search-cases, review-cases).
- `supabase/migrations/` — sequential SQL migrations (numbered 002–009).

## Key Conventions
- Status strings: `"rozpracovaný"` (in-progress), `"uzavřený"` (closed)
- Message types: `"input"`, `"diagnosis"`
- RAG scoring constants must stay in sync between `web/src/lib/rag.js` and `supabase/functions/search-cases/index.ts`
- Edge function URL: `https://nmvjthfezyjcwuzphiuu.supabase.co/functions/v1/<name>`
- Admin check: `ADMIN_USER_IDS` env var in Supabase (email or UUID)

## Testing
```bash
npm test              # unit + i18n + validation + catalog tests
npm run test:unit     # just unit tests
npm run test:integration  # Supabase integration (needs TEST_USER_EMAIL + TEST_USER_PASSWORD)
```

## Deployment
- Push to `main` → Vercel auto-deploy (frontend)
- Edge functions: `npx supabase functions deploy <name> --no-verify-jwt --project-ref nmvjthfezyjcwuzphiuu`
- DB migrations: `npx supabase db push --linked`
