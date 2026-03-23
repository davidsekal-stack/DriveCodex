-- ═══════════════════════════════════════════════════════════════════════════════
-- GearBrain — Review workflow pro uzavřené případy
--
-- Nové případy přicházejí se statusem 'pending' a musí být schváleny adminem
-- před zařazením do RAG databáze. search-cases filtruje WHERE status = 'approved'.
--
-- Existující záznamy (historická data) dostanou status = 'approved'.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1) Přidat status sloupec s defaultem 'pending'
ALTER TABLE public.gearbrain_cases
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- 2) Existující záznamy = důvěryhodná data → approved
UPDATE public.gearbrain_cases SET status = 'approved' WHERE status = 'pending';

-- 3) Index pro rychlé filtrování pending případů (admin review)
CREATE INDEX IF NOT EXISTS idx_gearbrain_cases_status
  ON public.gearbrain_cases (status);

-- 4) Composite index pro search-cases (jen approved + řazení)
CREATE INDEX IF NOT EXISTS idx_gearbrain_cases_approved_closed
  ON public.gearbrain_cases (closed_at DESC)
  WHERE status = 'approved';

-- 5) View pro admin review — joinuje email z auth.users
--    (service_role přístup, RLS neblokuje)
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
  c.created_at
FROM public.gearbrain_cases c
LEFT JOIN auth.users u ON u.id = c.user_id;
