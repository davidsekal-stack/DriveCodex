import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load test config for LOCAL runs ───────────────────────────────────────────
// The repo-root `.env.test.local` (git-ignored) holds the test-DB URL/keys and the
// throwaway test login. In CI these come from GitHub Actions secrets instead, so the
// file is absent and this block is a no-op.
const envFile = path.resolve(dirname, "..", ".env.test.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

const PORT = 5180;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    // Trace already embeds DOM snapshots + screenshots; a standalone screenshot is a
    // cheap quick-glance artifact. Video would mostly duplicate the trace, so it's off.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Start the Vite dev server pointed at the TEST Supabase project.
  // VITE_TEST_MODE=1 + the dev-only build flag double-gate the canned AI response
  // so it can never run in the production bundle that Vercel ships.
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: process.env.TEST_SUPABASE_URL || "",
      VITE_SUPABASE_ANON_KEY: process.env.TEST_SUPABASE_ANON_KEY || "",
      VITE_TEST_MODE: "1",
    },
  },
});
