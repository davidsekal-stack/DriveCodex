// Recreate the two core tables on the TEST project to match PROD exactly, then
// re-apply the migrations that failed against the stale base. Idempotent.
import fs from "node:fs";
const TOKEN = fs.readFileSync("PASTE-TOKEN-HERE.txt", "utf8").split(/\r?\n/)[0].trim();
const env = Object.fromEntries(fs.readFileSync(".env.test.local", "utf8").split(/\r?\n/).filter(l => l.includes("=")).map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }));
const REF = env.TEST_SUPABASE_PROJECT_REF;

async function applySql(name, sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  console.log(res.ok ? `  OK    ${name}` : `  ERROR ${name}: ${text.slice(0, 200)}`);
  return res.ok;
}

const CORE = `
DROP TABLE IF EXISTS public.gearbrain_web_sessions CASCADE;
CREATE TABLE public.gearbrain_web_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  data jsonb NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  local_id text NOT NULL
);
ALTER TABLE public.gearbrain_web_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY web_select_own ON public.gearbrain_web_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY web_insert_own ON public.gearbrain_web_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY web_update_own ON public.gearbrain_web_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY web_delete_own ON public.gearbrain_web_sessions FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE UNIQUE INDEX IF NOT EXISTS idx_ws_user_local ON public.gearbrain_web_sessions (user_id, local_id);

DROP TABLE IF EXISTS public.gearbrain_cases CASCADE;
CREATE TABLE public.gearbrain_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_brand text,
  vehicle_model text,
  mileage integer,
  symptoms text[] NOT NULL DEFAULT '{}',
  obd_codes text[] NOT NULL DEFAULT '{}',
  description text,
  resolution text NOT NULL,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  local_id text,
  engine_power text,
  user_id uuid,
  thread_url text,
  status text NOT NULL DEFAULT 'pending',
  source_ref text
);
ALTER TABLE public.gearbrain_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_insert ON public.gearbrain_cases FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY web_user_insert_cases ON public.gearbrain_cases FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY web_user_update_cases ON public.gearbrain_cases FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Authenticated users can read case count" ON public.gearbrain_cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can delete own cases" ON public.gearbrain_cases FOR DELETE TO public USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_gearbrain_obd_codes ON public.gearbrain_cases USING GIN (obd_codes);
CREATE INDEX IF NOT EXISTS idx_gearbrain_vehicle_model ON public.gearbrain_cases (vehicle_model);
CREATE INDEX IF NOT EXISTS idx_gearbrain_created_at ON public.gearbrain_cases (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gearbrain_cases_status ON public.gearbrain_cases (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gearbrain_idempotent ON public.gearbrain_cases (user_id, local_id) WHERE local_id IS NOT NULL;
`;

console.log("== recreate core tables to match prod ==");
await applySql("core_tables", CORE);

console.log("== re-apply migrations that depend on cases columns (tolerate errors) ==");
for (const f of ["009_cases_review_status.sql", "011_analytics_functions.sql", "012_analytics_users_top.sql", "013_analytics_brands_exclude_admin.sql", "014_brand_stats_closed_cases.sql"]) {
  await applySql(f, fs.readFileSync(`supabase/migrations/${f}`, "utf8"));
}

console.log("== verify test gearbrain_cases columns ==");
const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: "select column_name from information_schema.columns where table_schema='public' and table_name='gearbrain_cases' order by ordinal_position;" }),
});
const cols = await res.json();
console.log("  cases columns:", Array.isArray(cols) ? cols.map(c => c.column_name).join(", ") : JSON.stringify(cols));
