-- ═══════════════════════════════════════════════════════════════════════════════
-- GearBrain — přidání local_id sloupce do gearbrain_web_sessions
--
-- Umožňuje spolehlivý UPSERT (insert-or-update) bez závislosti na
-- JSONB operátoru data->>id, který může být nespolehlivý.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1) Přidat local_id sloupec (nullable zatím — backfillujeme)
ALTER TABLE public.gearbrain_web_sessions
  ADD COLUMN IF NOT EXISTS local_id TEXT;

-- 2) Doplnit hodnoty ze stávajících JSONB záznamů
UPDATE public.gearbrain_web_sessions
  SET local_id = data->>'id'
  WHERE local_id IS NULL;

-- 3) Nastavit NOT NULL (po backfillu)
ALTER TABLE public.gearbrain_web_sessions
  ALTER COLUMN local_id SET NOT NULL;

-- 4) Unique constraint pro UPSERT onConflict
ALTER TABLE public.gearbrain_web_sessions
  ADD CONSTRAINT gbs_user_local_id_unique UNIQUE (user_id, local_id);
