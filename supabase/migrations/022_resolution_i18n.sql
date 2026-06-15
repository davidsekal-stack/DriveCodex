-- ============================================================================
-- 022_resolution_i18n.sql — Lokalizované texty oprav pro panel „Známé závady"
--
-- Panel „Známé závady tohoto vozu" (migrace 021) zobrazuje text potvrzené
-- opravy (gearbrain_cases.resolution). Ten je ale v DB VŽDY anglicky:
-- push-case i crawl agent překládají vstup do angličtiny kvůli jazykově
-- nezávislému RAG vyhledávání. Rozhraní se tedy přepne, ale text opravy
-- zůstal anglicky.
--
-- Řešení: vedle kanonického anglického `resolution` (zůstává beze změny —
-- RAG na něm závisí) přidat lokalizované varianty, které se plní při importu
-- (push-case přes DeepSeek) a doplňují u starých záznamů (Claude sweep,
-- scripts/agent/backfill-resolution-i18n.mjs):
--   resolution_cs / resolution_de — česká / německá verze (NULL = nepřeloženo)
--   resolution_lang               — detekovaný jazyk ORIGINÁLU vstupu
--                                   (do shodného jazyka se nepřekládá, uloží
--                                    se původní text); slouží i jako značka
--                                    „zpracováno" pro resumovatelný backfill.
-- Angličtina nemá vlastní sloupec — kanonickou anglickou verzí je `resolution`.
--
-- Výběr jazyka probíhá na klientu (web/src/lib/known-faults.js → localizeResolution),
-- stejně jako u názvů závad (pickFaultLabel). Edge fn known-faults proto vrací
-- všechny varianty; known_fault_cases je musí umět vrátit.
-- ============================================================================

-- ── Nové sloupce ────────────────────────────────────────────────────────────
ALTER TABLE public.gearbrain_cases
  ADD COLUMN IF NOT EXISTS resolution_cs   TEXT,
  ADD COLUMN IF NOT EXISTS resolution_de   TEXT,
  ADD COLUMN IF NOT EXISTS resolution_lang TEXT;

-- ── known_fault_cases — vrátit i lokalizované varianty ──────────────────────
-- RETURNS TABLE se rozšiřuje, takže funkci je nutné dropnout a vytvořit znovu
-- (CREATE OR REPLACE nedovolí změnu návratového typu). Tělo je identické s
-- migrací 021 + tři nové sloupce v obou SELECT seznamech.
DROP FUNCTION IF EXISTS public.known_fault_cases(TEXT, TEXT, TEXT, TEXT, TEXT, INT);

CREATE FUNCTION public.known_fault_cases(
  p_brand    TEXT,
  p_model    TEXT,
  p_fault_id TEXT,
  p_band     TEXT DEFAULT NULL,
  p_gen      TEXT DEFAULT 'exact',
  p_limit    INT  DEFAULT 10
)
RETURNS TABLE (
  id              UUID,
  resolution      TEXT,
  resolution_cs   TEXT,
  resolution_de   TEXT,
  resolution_lang TEXT,
  mileage         INT,
  closed_at       TIMESTAMPTZ,
  thread_url      TEXT,
  source_ref      TEXT,
  engine_power    TEXT,
  vehicle_model   TEXT,
  obd_codes       JSONB
) LANGUAGE sql STABLE AS $$
  WITH q AS (
    SELECT public.normalize_model_family(p_model) AS fam,
           public.extract_model_gen(p_model)      AS gen,
           public.extract_model_year(p_model)     AS yr
  )
  -- Deduplikace podle source_ref (stejně jako počty v known_faults_for_vehicle),
  -- aby seznam v detailu nezobrazoval N fan-out kopií pod počtem, který je
  -- spočítal jako jeden. Stabilní pořadí: closed_at DESC, pak id (tiebreaker).
  SELECT d.id, d.resolution, d.resolution_cs, d.resolution_de, d.resolution_lang,
         d.mileage, d.closed_at, d.thread_url, d.source_ref,
         d.engine_power, d.vehicle_model, d.obd_codes
  FROM (
    SELECT DISTINCT ON (coalesce(nullif(c.source_ref, ''), c.id::text))
           c.id, c.resolution, c.resolution_cs, c.resolution_de, c.resolution_lang,
           c.mileage, c.closed_at, c.thread_url, c.source_ref,
           c.engine_power, c.vehicle_model, to_jsonb(c.obd_codes) AS obd_codes
    FROM public.gearbrain_cases c, q
    WHERE c.status = 'approved'
      AND c.vehicle_brand = p_brand
      AND c.model_base = q.fam
      AND c.canonical_fault_id = p_fault_id
      AND (p_band IS NULL OR public.mileage_band(c.mileage) = p_band)
      AND (
        p_gen <> 'exact'
        OR (q.gen IS NOT NULL
            AND coalesce(c.model_gen, c.vehicle_generation) = q.gen)
        OR ((q.gen IS NULL OR coalesce(c.model_gen, c.vehicle_generation) IS NULL)
            AND q.yr IS NOT NULL
            AND coalesce(c.model_year,
                  CASE WHEN c.vehicle_generation ~ '^(19|20)[0-9]{2}$'
                       THEN c.vehicle_generation END) = q.yr)
      )
    ORDER BY coalesce(nullif(c.source_ref, ''), c.id::text), c.closed_at DESC NULLS LAST, c.id
  ) d
  ORDER BY d.closed_at DESC NULLS LAST, d.id
  LIMIT LEAST(GREATEST(coalesce(p_limit, 10), 1), 25);
$$;
