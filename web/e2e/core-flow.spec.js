import { test, expect, request as pwRequest } from "@playwright/test";

// ── Test-DB config (from .env.test.local locally, GitHub secrets in CI) ────────
const SUPABASE_URL = process.env.TEST_SUPABASE_URL;
const ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY;
const EMAIL = process.env.TEST_USER_EMAIL;
const PASSWORD = process.env.TEST_USER_PASSWORD;

const MODEL_LABEL = "Transit MK7 2.2 TDCi (2006–2011)"; // en-dash between years
const RESOLUTION_TEXT = "E2E test: provedena nucena regenerace DPF a kontrola tlakoveho cidla.";

// ── REST helpers (verify + cleanup) ────────────────────────────────────────────
// We use the test user's own access token (not a service key) so verification and
// cleanup go through RLS exactly as a real user would — the same pattern the backend
// integration harness uses. This also means CI needs only the anon key + login creds.
let accessToken = null;

async function login() {
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    data: { email: EMAIL, password: PASSWORD },
  });
  if (!res.ok()) throw new Error(`Auth failed: HTTP ${res.status()}`);
  const body = await res.json();
  await ctx.dispose();
  return body.access_token;
}

function authHeaders() {
  return { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` };
}

async function caseRows(localId) {
  const ctx = await pwRequest.newContext();
  const res = await ctx.get(
    `${SUPABASE_URL}/rest/v1/gearbrain_cases?local_id=eq.${encodeURIComponent(localId)}&select=id,status,local_id`,
    { headers: authHeaders() },
  );
  const body = res.ok() ? await res.json() : [];
  await ctx.dispose();
  return body;
}

async function deleteCase(localId) {
  const ctx = await pwRequest.newContext();
  await ctx.delete(
    `${SUPABASE_URL}/rest/v1/gearbrain_cases?local_id=eq.${encodeURIComponent(localId)}`,
    { headers: authHeaders() },
  );
  await ctx.dispose();
}

test.beforeAll(async () => {
  const required = { TEST_SUPABASE_URL: SUPABASE_URL, TEST_SUPABASE_ANON_KEY: ANON_KEY, TEST_USER_EMAIL: EMAIL, TEST_USER_PASSWORD: PASSWORD };
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`Missing required env: ${missing.join(", ")}`);
  accessToken = await login();
});

test("core workflow: login -> new case -> diagnosis -> close/save -> DB verify -> cleanup", async ({ page }) => {
  let createdLocalId = null;

  // Enable the canned AI stub before any app code runs (double-gated: dev build only).
  await page.addInitScript(() => {
    try { localStorage.setItem("dc_test_mode", "1"); } catch { /* ignore */ }
  });

  // Capture the local_id the app sends to push-case so we can verify/clean the exact row.
  page.on("request", (req) => {
    if (req.method() === "POST" && req.url().includes("/functions/v1/push-case")) {
      try {
        const body = req.postDataJSON();
        if (body?.local_id) createdLocalId = body.local_id;
      } catch { /* ignore non-JSON */ }
    }
  });

  try {
    await page.goto("/");

    // 1. Login
    await page.getByTestId("login-email").fill(EMAIL);
    await page.getByTestId("login-password").fill(PASSWORD);
    await page.getByTestId("login-submit").click();

    // 2. Accept the GDPR consent gate (required, or close-case won't push to the DB)
    await page.getByTestId("consent-accept").click();

    // 3. New case
    await page.getByTestId("new-case-btn").click();
    await page.getByTestId("vehicle-brand-select").selectOption("Ford");
    await page.getByTestId("vehicle-model-select").selectOption(MODEL_LABEL);

    // Select the "Ztrata vykonu" (loss of power) symptom. The engine accordion is open
    // by default, but ensure it's expanded before clicking the chip.
    const chip = page.getByTestId("symptom-chip-sym.lossOfPower");
    if (!(await chip.isVisible())) {
      await page.getByTestId("symptom-cat-sym.cat.engine").click();
    }
    await chip.click();

    // 4. Run diagnosis (stubbed -> deterministic, no DeepSeek call)
    await page.getByTestId("submit-input-btn").click();
    await expect(page.getByTestId("diagnosis-result")).toBeVisible({ timeout: 30_000 });

    // 5. Close / save the case
    await page.getByTestId("close-case-btn").click();
    await page.getByTestId("resolution-other-input").fill(RESOLUTION_TEXT);
    const confirm = page.getByTestId("confirm-close-btn");
    await expect(confirm).toBeEnabled();

    const [pushResponse] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/functions/v1/push-case")),
      confirm.click(),
    ]);
    expect(pushResponse.status(), "push-case should return 200").toBe(200);

    // 6. Verify the row reached the test DB
    expect(createdLocalId, "captured local_id from push-case request").toBeTruthy();
    const rows = await caseRows(createdLocalId);
    expect(rows.length, "case row exists in gearbrain_cases").toBeGreaterThan(0);
    expect(rows[0].status, "new case is pending review").toBe("pending");
  } finally {
    // Cleanup — remove the row we created so the test DB stays clean and re-runnable.
    if (createdLocalId) await deleteCase(createdLocalId);
  }
});
