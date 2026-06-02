# DriveCodex — Automated Testing

Tests run automatically on every push / PR via GitHub Actions (`.github/workflows/test.yml`).
Three layers, increasing in coverage:

| Layer | What it checks | Command |
|---|---|---|
| **App logic** | Validation, AI-reply repair, translations (cs/en/de), OBD/catalog lookups, diagnosis assembly | `node tests/unit.test.js` (+ `ai-i18n`, `validation-i18n`, `i18n`, `utils-i18n`) |
| **Backend integration** | Real round-trips to the **test** database + privacy (VIN/plate stripping, RLS isolation) + edge functions (AI proxy, push-case, search, feedback) | `node tests/supabase-integration.test.js` |
| **End-to-end (browser)** | Full new-case → diagnosis → PDF → save click-through | *pending — next step* |

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

## Known gaps / TODO
- **Browser end-to-end** walkthrough (new case → diagnosis → PDF → save) — the highest-value remaining layer.
- **Analytics SQL functions** (migrations 011–013) aren't on the test DB — they read a column the broken
  rename-migration didn't fix; not needed for the core flow.
- Provisioning scripts used to build the test DB: `audit/provision-test-db.mjs`, `audit/fix-test-schema.mjs`
  (require a Supabase access token to re-run).
