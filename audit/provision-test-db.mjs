// Provision the test Supabase project schema: base gearbrain_cases (from SUPABASE_SETUP.md)
// + all migrations in order, via the Management API query endpoint.
import fs from "node:fs";

const TOKEN = fs.readFileSync("PASTE-TOKEN-HERE.txt", "utf8").split(/\r?\n/)[0].trim();
const env = Object.fromEntries(fs.readFileSync(".env.test.local", "utf8").split(/\r?\n/).filter(l => l.includes("=")).map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }));
const REF = env.TEST_SUPABASE_PROJECT_REF;
if (!TOKEN.startsWith("sbp_") || !REF) { console.error("missing token or ref"); process.exit(1); }

async function applySql(name, sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (res.ok) { console.log(`  OK    ${name}`); return true; }
  console.log(`  ERROR ${name}: HTTP ${res.status} ${text.slice(0, 240)}`);
  return false;
}

const BASE = `
CREATE TABLE IF NOT EXISTS public.gearbrain_cases (
  id uuid primary key default gen_random_uuid(),
  local_id text,
  installation_id uuid not null,
  vehicle_brand text,
  vehicle_model text,
  mileage integer,
  symptoms text[] not null default '{}',
  obd_codes text[] not null default '{}',
  description text,
  resolution text not null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_gearbrain_obd_codes ON public.gearbrain_cases USING GIN (obd_codes);
CREATE INDEX IF NOT EXISTS idx_gearbrain_vehicle_model ON public.gearbrain_cases (vehicle_model);
CREATE INDEX IF NOT EXISTS idx_gearbrain_created_at ON public.gearbrain_cases (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gearbrain_idempotent ON public.gearbrain_cases (installation_id, local_id) WHERE local_id IS NOT NULL;
ALTER TABLE public.gearbrain_cases ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gearbrain_cases' AND policyname='anon_select') THEN
    CREATE POLICY "anon_select" ON public.gearbrain_cases FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gearbrain_cases' AND policyname='anon_insert') THEN
    CREATE POLICY "anon_insert" ON public.gearbrain_cases FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;
`;

console.log(`Provisioning test project ${REF}`);
console.log("== base schema (gearbrain_cases) ==");
let ok = await applySql("000_base_schema", BASE);

console.log("== migrations ==");
const files = fs.readdirSync("supabase/migrations").filter(f => f.endsWith(".sql")).sort();
for (const f of files) {
  const sql = fs.readFileSync(`supabase/migrations/${f}`, "utf8");
  const success = await applySql(f, sql);
  ok = ok && success;
}
console.log(ok ? "\nALL APPLIED CLEANLY" : "\nSOME STEPS FAILED (see ERROR lines above)");
