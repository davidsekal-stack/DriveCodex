# GearBrain — Project Handover

Last updated: 2026-03-25

## Architecture

```
Browser (React SPA)
  ├── App.jsx ─── view routing, theme, sidebar, admin detection
  ├── hooks/ ──── business logic (custom hooks)
  ├── lib/ ────── pure functions (AI, storage, validation)
  ├── constants/ ─ vehicle catalogs, OBD codes, enums, timing
  └── i18n/ ───── CS, EN, DE (~180 keys each)

Supabase
  ├── Edge Functions (Deno)
  │   ├── _shared/ ─────── CORS, auth, response helpers, client factory
  │   ├── analytics ────── admin dashboard data (daily AI/sessions/tokens/users)
  │   ├── deepseek-proxy ─ AI API proxy (rate limiting: 50/day/user)
  │   ├── push-case ────── save closed case (pending → review)
  │   ├── search-cases ─── RAG scoring (approved cases only)
  │   ├── review-cases ─── admin approve/reject
  │   ├── send-feedback ── user feedback + email notification
  │   └── share-case ───── shareable links + OG meta tags
  ├── Tables
  │   ├── gearbrain_cases ────────── RAG database (status: pending/approved/rejected)
  │   ├── gearbrain_web_sessions ── active user cases (JSONB)
  │   ├── gearbrain_ai_usage ────── token tracking + rate limiting
  │   ├── gearbrain_feedback ────── user feedback
  │   ├── gearbrain_violations ──── abuse tracking
  │   └── shared_cases ──────────── shareable diagnostic snapshots
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

### RAG Scoring (search-cases edge function only)
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

NOTE: Scoring logic lives ONLY in search-cases/index.ts.
Frontend rag.js contains only extractSignals() for prompt building.
```

### Shareable Links
```
User clicks Share → POST share-case → snapshot stored in shared_cases
Visitor opens /share/:id → SPA renders read-only SharedCaseView
Social bots → Vercel rewrite → share-case GET → HTML with OG tags
```

## Edge Function Shared Helpers

All 7 edge functions import from `supabase/functions/_shared/`:
- `cors.ts` — `CORS_HEADERS`, `optionsResponse()`
- `response.ts` — `json()`, `html()` response builders
- `auth.ts` — `getAuthUser()`, `isAdmin()` for admin endpoints
- `client.ts` — `getServiceClient()` Supabase service-role factory

## Admin Configuration

- **Frontend**: `VITE_ADMIN_EMAILS` env var (fallback: `davidsekal@gmail.com`)
- **Edge functions**: `ADMIN_USER_IDS` Supabase secret (email or UUID, comma-separated)
- **Feedback email**: `FEEDBACK_EMAIL` Supabase secret

## Enum Constants

Centralized in `web/src/constants/enums.js`:
- `MSG.INPUT`, `MSG.DIAGNOSIS` — message types
- `CASE_STATUS.OPEN`, `CASE_STATUS.CLOSED` — case status strings
- `REVIEW_STATUS.PENDING`, `REVIEW_STATUS.APPROVED`, `REVIEW_STATUS.REJECTED`

## Supabase Config
- Project ref: `nmvjthfezyjcwuzphiuu`
- Secrets: `DEEPSEEK_API_KEY`, `ADMIN_USER_IDS`, `FEEDBACK_EMAIL`, `RESEND_API_KEY`, `FRONTEND_URL`
- RLS: users see only own sessions; cases accessed via edge functions (service role)
- SQL migrations: 002–012

## Known Issues
- **OBD BLE reader** — only works with BLE adapters, not Classic Bluetooth (Web Bluetooth API limitation)
- **ESLint peer dep** — eslint@10 vs eslint-plugin-react (needs ^9.7). Deferred.
- **Integration tests** — test account password unknown, skipped on push
- **Bundle size** — main chunk ~990 KB (no code splitting yet)
- **Share link encoding** — OG tags had UTF-8 issues (edge function charset fix deployed)
- **Toyota test** — `resolveToyotaVehicleModel` "dosud" → open range change has 1 failing test
