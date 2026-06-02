# DriveCodex — Automated Testing

Tests run automatically on every push / PR via GitHub Actions (`.github/workflows/test.yml`).
Three layers, increasing in coverage:

| Layer | What it checks | Command |
|---|---|---|
| **App logic** | Validation, AI-reply repair, translations (cs/en/de), OBD/catalog lookups, diagnosis assembly | `node tests/unit.test.js` (+ `ai-i18n`, `validation-i18n`, `i18n`, `utils-i18n`) |
| **Backend integration** | Real round-trips to the **test** database + privacy (VIN/plate stripping, RLS isolation) + edge functions (AI proxy, push-case, search, feedback) | `node tests/supabase-integration.test.js` |
| **End-to-end (browser)** | Real browser drive: login → new case → diagnosis → close/save → DB verify → cleanup | `npm --prefix web run test:e2e` (Playwright) |

## Test database (isolated from production)

A dedicated Supabase project **`drivecodex-test`** (ref `fkznkqrdckbdxsiwbdcv`, eu-central-1) holds all test
data — **production is never touched**. Its structure mirrors prod (base `gearbrain_cases` from `SUPABASE_SETUP.md`
+ migrations; the two core tables were replicated directly from prod to stay faithful). The 7 core edge functions
are deployed to it, and `DEEPSEEK_API_KEY` is set as a project secret.

Local config lives in **`.env.test.local`** (git-ignored): project URL, anon/service keys, DB password, and the
throwaway test login (`e2e@drivecodex.test`). CI uses the same values from GitHub Actions **secrets**.

## Running locally

```bash
set -a; . ./.env.test.local; set +a      # load test config
SKIP_GATED_TESTS=1 node tests/supabase-integration.test.js
```

`SKIP_GATED_TESTS=1` skips two environment-dependent checks (used in CI):
- **manual-lookup** — behind a licensing feature-flag; needs extra config.
- **search-after-push** — a freshly pushed case is `status='pending'` and only searchable once approved, so on an
  empty test DB there's nothing to match.

Cross-user RLS isolation also skips unless `TEST_SECOND_USER_EMAIL` / `TEST_SECOND_USER_PASSWORD` are set.

## End-to-end (Playwright)

A real-browser test in `web/e2e/core-flow.spec.js` drives the core workflow against the **test** project:
login → accept consent → new case (Ford Transit MK7 2.2 TDCi, "Ztráta výkonu" symptom) → diagnosis →
close/save → verify the row landed in `gearbrain_cases` → delete it again.

```bash
npm --prefix web run test:e2e        # headless; auto-starts the Vite dev server on :5180
npm --prefix web run test:e2e:ui     # interactive debug UI
```

- Config lives in `web/playwright.config.js`; it loads `.env.test.local` for local runs (GitHub secrets in CI)
  and points the dev server at the test DB.
- **AI is stubbed** for determinism: `callAI()` in `web/src/lib/storage-edge.js` returns a canned diagnosis when
  a dev build is combined with an explicit opt-in flag (`VITE_TEST_MODE=1` or `localStorage.dc_test_mode='1'`).
  Both gates are required, so the stub is compiled out of the production bundle and can never run live.
- Verification + cleanup use the **test user's own token** (RLS-respecting), so CI needs only the existing
  `TEST_SUPABASE_URL` / `TEST_SUPABASE_ANON_KEY` / `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` secrets — no service key.
- Key UI elements carry `data-testid` attributes (the app otherwise has no stable selectors).

## Known gaps / TODO
- **PDF export** is not yet exercised by the e2e test (the save/close path is).
- **Analytics SQL functions** (migrations 011–013) aren't on the test DB — they read a column the broken
  rename-migration didn't fix; not needed for the core flow.
- Provisioning scripts used to build the test DB: `audit/provision-test-db.mjs`, `audit/fix-test-schema.mjs`
  (require a Supabase access token to re-run).
