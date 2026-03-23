# GearBrain — Project Handover

Last updated: 2026-03-23

## Architecture

```
Browser (React SPA)
  ├── App.jsx ─── view routing, theme, sidebar
  ├── hooks/ ──── business logic (7 custom hooks)
  ├── lib/ ────── pure functions (22 modules)
  ├── constants/ ─ vehicle catalogs, OBD codes
  └── i18n/ ───── CS, EN, DE (~170 keys each)

Supabase
  ├── Edge Functions (Deno)
  │   ├── deepseek-proxy ── AI API proxy (rate limiting)
  │   ├── push-case ─────── save closed case (pending → review)
  │   ├── search-cases ──── RAG scoring (approved cases only)
  │   ├── review-cases ──── admin approve/reject
  │   └── send-feedback ─── user feedback
  ├── Tables
  │   ├── gearbrain_cases ────────── RAG database (status: pending/approved/rejected)
  │   ├── gearbrain_web_sessions ── active user cases (JSONB)
  │   ├── gearbrain_ai_usage ────── rate limiting
  │   ├── gearbrain_feedback ────── user feedback
  │   └── gearbrain_violations ──── abuse tracking
  └── Views
      └── gearbrain_cases_review ── cases + user email (for admin UI)
```

## Data Flow

### Diagnosis
```
User input (vehicle + symptoms + OBD codes)
  → search-cases (RAG: find similar approved cases)
  → deepseek-proxy (AI: generate diagnosis with RAG context)
  → Client renders diagnosis cards
```

### Case Lifecycle
```
New → rozpracovaný (in-progress) → uzavřený (closed)
  → push-case → gearbrain_cases (status: pending)
  → Admin review → approved (enters RAG) or rejected
```

### RAG Scoring (search-cases + rag.js)
```
Pre-filter: brand + model (mandatory), OBD overlap
Scoring weights:
  +3   model match
  +2   engine power match
  +2/1 mileage ±30%/±50%
  +5   manufacturer-specific OBD (P1/P3/C/B/U)
  +2   generic OBD (P0/P2)
  +1.5 symptom match
  +0.3 text keyword (max +2)

Thresholds:
  Dynamic: min(8, inputMax × 0.7)
  F1 bidirectional ratio ≥ 50%
```

## Supabase Config
- Project ref: `nmvjthfezyjcwuzphiuu`
- Secrets: `DEEPSEEK_API_KEY`, `ADMIN_USER_IDS` (email)
- RLS: users see only own sessions; cases accessed via edge functions (service role)

## Known Issues
- **OBD BLE reader** — only works with BLE adapters, not Classic Bluetooth (Web Bluetooth API limitation)
- **ESLint peer dep** — eslint@10 vs eslint-plugin-react (needs ^9.7). Deferred.
- **Integration tests** — test account password unknown, skipped on push
- **Bundle size** — main chunk ~990 KB (no code splitting yet)

## Codebase Stats (2026-03-23)
- 8,786 lines JS/JSX across 85 source files
- 23 React components, 9 custom hooks, 22 lib modules
- 3,402 lines of tests (unit + i18n + validation + catalog + integration)
- 3 languages (CS, EN, DE)
- ~920 closed cases in RAG database
- 5 Supabase edge functions, 7 DB migrations (002–009)
