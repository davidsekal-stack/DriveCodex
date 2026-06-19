-- ═══════════════════════════════════════════════════════════════════════════════
-- GearBrain — Důvod zamítnutí při admin review (sběr lidských štítků pro Fázi 4)
--
-- Když admin v "Kontrola případů" zamítne případ, uloží se DŮVOD. Reason kódy 1:1
-- mapují na 6 podmínek verifikátoru (verify.mjs), takže pozdější ladění brány (Fáze 4)
-- pozná, KTERÁ podmínka propouští špatné případy:
--   not_car          → in_scope
--   vehicle_mismatch → vehicle_matches_cited_posts
--   not_a_fault      → is_genuine_fault
--   no_repair        → repair_performed
--   unconfirmed      → repair_confirmed
--   vague            → actionable
--   other            → (volné/jiné)
-- Schválené případy mají reason NULL. Tato data + text vlákna (lokální agent.db,
-- párováno přes thread_url/source_ref) tvoří lidsky ověřený gold-set pro gold-eval.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1) Sloupce: důvod zamítnutí + čas rozhodnutí (oddělí skutečná lidská rozhodnutí
--    od historických záznamů hromadně označených 'approved' migrací 009).
ALTER TABLE public.gearbrain_cases
  ADD COLUMN IF NOT EXISTS review_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- 2) Recreate review view — vystavit reason/reviewed_at + thread_url/source_ref,
--    aby šel gold-set vyexportovat a spárovat s textem vlákna.
--    POZN.: CREATE OR REPLACE VIEW vyžaduje zachovat pořadí/typ stávajících sloupců
--    a nové smí přidat jen NA KONEC — proto review_reason/reviewed_at/thread_url/
--    source_ref následují až za původními (…closed_at, created_at).
CREATE OR REPLACE VIEW public.gearbrain_cases_review AS
SELECT
  c.id,
  c.local_id,
  c.user_id,
  u.email AS user_email,
  c.vehicle_brand,
  c.vehicle_model,
  c.mileage,
  c.engine_power,
  c.symptoms,
  c.obd_codes,
  c.description,
  c.resolution,
  c.status,
  c.closed_at,
  c.created_at,
  c.review_reason,
  c.reviewed_at,
  c.thread_url,
  c.source_ref
FROM public.gearbrain_cases c
LEFT JOIN auth.users u ON u.id = c.user_id;
