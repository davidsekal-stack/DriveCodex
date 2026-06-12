import { test, expect, request as pwRequest } from "@playwright/test";

// ── Test-DB config (from .env.test.local locally, GitHub secrets in CI) ────────
const SUPABASE_URL = process.env.TEST_SUPABASE_URL;
const ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY;
const EMAIL = process.env.TEST_USER_EMAIL;
const PASSWORD = process.env.TEST_USER_PASSWORD;

// Match the vehicle by a stable substring instead of the exact catalog label
// (which contains an en-dash and could be reformatted) — see model selection below.
const MODEL_MATCH = "Transit MK7 2.2 TDCi";
const RESOLUTION_TEXT = "E2E test: provedena nucena regenerace DPF a kontrola tlakoveho cidla.";

// ── REST helpers (verify + cleanup) ────────────────────────────────────────────
// We use the test user's own access token (not a service key) so verification and
// cleanup go through RLS exactly as a real user would. A single request context is
// shared across login/verify/cleanup. CI needs only the anon key + login creds.
let apiCtx = null;
let accessToken = null;

async function login() {
  const res = await apiCtx.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    data: { email: EMAIL, password: PASSWORD },
  });
  if (!res.ok()) throw new Error(`Auth failed: HTTP ${res.status()}`);
  return (await res.json()).access_token;
}

function authHeaders() {
  return { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` };
}

async function caseRows(localId) {
  const res = await apiCtx.get(
    `${SUPABASE_URL}/rest/v1/gearbrain_cases?local_id=eq.${encodeURIComponent(localId)}&select=id,status,local_id`,
    { headers: authHeaders() },
  );
  return res.ok() ? await res.json() : [];
}

async function deleteCase(localId) {
  const res = await apiCtx.delete(
    `${SUPABASE_URL}/rest/v1/gearbrain_cases?local_id=eq.${encodeURIComponent(localId)}`,
    { headers: authHeaders() },
  );
  // Surface cleanup failures loudly — a silent failure leaves orphan rows in the shared test DB.
  if (!res.ok()) console.warn(`[e2e cleanup] failed to delete case ${localId}: HTTP ${res.status()}`);
}

test.beforeAll(async () => {
  const required = { TEST_SUPABASE_URL: SUPABASE_URL, TEST_SUPABASE_ANON_KEY: ANON_KEY, TEST_USER_EMAIL: EMAIL, TEST_USER_PASSWORD: PASSWORD };
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`Missing required env: ${missing.join(", ")}`);
  apiCtx = await pwRequest.newContext();
  accessToken = await login();
});

test.afterAll(async () => {
  if (apiCtx) await apiCtx.dispose();
});

test("core workflow: login -> new case -> diagnosis -> close/save -> DB verify -> cleanup", async ({ page }) => {
  let createdLocalId = null;

  // Safety net: never let the app talk to a Supabase project other than the test one.
  // A stale dev server reused on :5180 could point at prod (see playwright.config.js);
  // aborting any cross-project request means the destructive close-case write can never
  // hit production, and the assertion below turns it into a clear failure.
  const expectedHost = new URL(SUPABASE_URL).host;
  let wrongSupabaseHost = null;
  await page.route(/supabase\.co/, (route) => {
    const host = new URL(route.request().url()).host;
    if (host !== expectedHost) {
      wrongSupabaseHost = host;
      return route.abort();
    }
    return route.continue();
  });

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

    // Pick the model by a stable substring: find its <option> value and select that,
    // so a catalog re-format (dash/spacing/year) doesn't silently break the test.
    const modelSelect = page.getByTestId("vehicle-model-select");
    const modelOption = modelSelect.locator("option", { hasText: MODEL_MATCH });
    await expect(modelOption, `catalog has a "${MODEL_MATCH}" model`).toHaveCount(1);
    await modelSelect.selectOption(await modelOption.getAttribute("value"));

    // Select the "Ztrata vykonu" (loss of power) symptom. Expand the engine category
    // only if it's collapsed ("▶") — clicking a header toggles it, so branching on the
    // real collapsed-state (not transient visibility) avoids closing the default-open one.
    const chip = page.getByTestId("symptom-chip-sym.lossOfPower");
    const engineCat = page.getByTestId("symptom-cat-sym.cat.engine");
    const catLabel = await engineCat.textContent();
    if (catLabel && catLabel.includes("▶")) {
      await engineCat.click();
    }
    await expect(chip).toBeVisible();
    await chip.click();

    // 4. Run diagnosis (stubbed -> deterministic, no DeepSeek call)
    await page.getByTestId("submit-input-btn").click();
    await expect(page.getByTestId("diagnosis-result")).toBeVisible({ timeout: 30_000 });

    // 4b. Repair guide: start it from the fault card and walk the happy path.
    // The canned diagnosis has no recommended tests, so the guide opens in the
    // actions phase with 2 repair OPTIONS: pick the first one, mark it as helped,
    // then confirm the final check as resolved.
    await page.getByTestId("start-repair-guide").first().click();
    await expect(page.getByTestId("repair-guide")).toBeVisible();
    await page.getByTestId("guide-action-choose").first().click();
    await page.getByTestId("guide-action-helped").click();
    await page.getByTestId("guide-final-solved").click();

    // 5. Close / save the case — via the completed guide's CTA (covers the new wiring;
    // the header close button opens the same modal).
    await page.getByTestId("guide-close-case").click();
    await page.getByTestId("resolution-other-input").fill(RESOLUTION_TEXT);
    const confirm = page.getByTestId("confirm-close-btn");
    await expect(confirm).toBeEnabled();

    // Guard: refuse to perform the write if the app ever reached the wrong project.
    expect(wrongSupabaseHost, `app must use the test Supabase project (${expectedHost})`).toBeNull();

    const [pushResponse] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/functions/v1/push-case")),
      confirm.click(),
    ]);
    expect(pushResponse.status(), "push-case should return 200").toBe(200);

    // 6. Verify exactly the row we created reached the test DB, as pending review
    expect(createdLocalId, "captured local_id from push-case request").toBeTruthy();
    const rows = await caseRows(createdLocalId);
    expect(rows.length, "exactly one case row exists in gearbrain_cases").toBe(1);
    expect(rows[0].status, "new case is pending review").toBe("pending");
  } finally {
    // Cleanup — remove the row we created so the test DB stays clean and re-runnable.
    if (createdLocalId) await deleteCase(createdLocalId);
  }
});
