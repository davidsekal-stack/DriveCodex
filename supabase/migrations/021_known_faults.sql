-- ============================================================================
-- 021_known_faults.sql — Číselník závad + generační normalizace modelů
--
-- Podklad pro panel „Známé závady tohoto vozu":
--   1. gearbrain_fault_taxonomy — kanonické názvy závad (cs/en/de), plní skript
--      scripts/agent/fault-taxonomy.mjs (--seed), v migraci se NEseeduje.
--   2. gearbrain_cases.canonical_fault_id — zařazení případu do číselníku
--      (NULL = zatím neklasifikováno, 'other' = nezařaditelné).
--   3. gearbrain_cases.vehicle_generation — generace doplněná backfillem tam,
--      kde ji nejde vyčíst z vehicle_model (NULL = neurčeno).
--   4. normalize_model_family / extract_model_gen / extract_model_year —
--      IMMUTABLE normalizace heterogenních model stringů
--      („Octavia II (2006–2013)" vs „Octavia II (2004–2013)" → octavia + 2).
--      POZOR: změna těchto funkcí NEpřepočítá generované sloupce — je nutné
--      sloupce model_base/model_gen/model_year dropnout a přidat znovu.
--   5. known_faults_for_vehicle / known_fault_cases — agregace pro panel.
--      Živý dotaz (žádný materialized view) — ~5,4k řádků + parciální index.
-- ============================================================================

-- ── 1. Číselník závad ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.gearbrain_fault_taxonomy (
  id         TEXT PRIMARY KEY,
  label_cs   TEXT NOT NULL,
  label_en   TEXT NOT NULL,
  label_de   TEXT NOT NULL,
  category   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Jen service role (stejný vzor jako crawl_forums) — klienti čtou přes edge fn.
ALTER TABLE public.gearbrain_fault_taxonomy ENABLE ROW LEVEL SECURITY;

-- ── 2.+3. Nové sloupce na případech ─────────────────────────────────────────

ALTER TABLE public.gearbrain_cases
  ADD COLUMN IF NOT EXISTS canonical_fault_id TEXT
    REFERENCES public.gearbrain_fault_taxonomy(id) ON DELETE SET NULL;

ALTER TABLE public.gearbrain_cases
  ADD COLUMN IF NOT EXISTS vehicle_generation TEXT;

CREATE INDEX IF NOT EXISTS idx_gearbrain_canonical_fault
  ON public.gearbrain_cases (canonical_fault_id)
  WHERE canonical_fault_id IS NOT NULL;

-- ── 4. Normalizace modelu ───────────────────────────────────────────────────
-- Tokenizace ověřená proti živým datům (scripts/agent/fault-taxonomy.mjs
-- obsahuje JS zrcadlo téže logiky pro backfill a testy).

CREATE OR REPLACE FUNCTION public.normalize_model_tokens(p_model TEXT)
RETURNS TEXT[] LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE norm TEXT;
BEGIN
  norm := lower(coalesce(p_model, ''));
  norm := translate(norm,
    'áàâäãåčçćďéèêëěíìîïňñóòôöõøřšśťúùûüůýžź',
    'aaaaaacccdeeeeeiiiinnoooooorsstuuuuuyzz');
  norm := regexp_replace(norm, '\(.*?\)', ' ', 'g');
  norm := regexp_replace(norm, '[^a-z0-9]+', ' ', 'g');
  RETURN regexp_split_to_array(btrim(norm), '\s+');
END $$;

CREATE OR REPLACE FUNCTION public.is_model_gen_token(tok TEXT, is_first BOOLEAN)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  -- Rok ('2008') NESMÍ být generační token, je-li PRVNÍ — jinak by se model
  -- pojmenovaný číslem (Peugeot 2008/3008/5008) parsoval jako rok a zmizel.
  SELECT tok IN ('fl', 'facelift')
      OR tok ~ '^(mk|mark)[0-9ivxl]*$'
      OR (NOT is_first AND (
           tok ~ '^(19|20)[0-9]{2}$'
        OR tok ~ '^[ivxl]{1,4}$'
        OR tok ~ '^[a-z]$'
        OR tok ~ '^[a-z]{1,2}[0-9]{1,3}[a-z]?$'
        OR tok ~ '^[0-9]{1,2}[a-z]{1,2}$'));
$$;

CREATE OR REPLACE FUNCTION public.roman_to_arabic(tok TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE tok
    WHEN 'i' THEN '1' WHEN 'ii' THEN '2' WHEN 'iii' THEN '3'
    WHEN 'iv' THEN '4' WHEN 'v' THEN '5' WHEN 'vi' THEN '6'
    WHEN 'vii' THEN '7' WHEN 'viii' THEN '8' WHEN 'ix' THEN '9'
    WHEN 'x' THEN '10' ELSE NULL END;
$$;

-- Rodina modelu: tokeny před prvním generačním tokenem, bez duplicit po sobě.
-- „Octavia II (2006–2013)" → 'octavia'; „Transit MK7 2.2 TDCi (…)" → 'transit';
-- „206 / 206+" → '206'.
CREATE OR REPLACE FUNCTION public.normalize_model_family(p_model TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE toks TEXT[]; tok TEXT; result TEXT := ''; prev TEXT := '';
BEGIN
  toks := public.normalize_model_tokens(p_model);
  FOREACH tok IN ARRAY toks LOOP
    CONTINUE WHEN tok = '';
    EXIT WHEN public.is_model_gen_token(tok, result = '');
    IF tok <> prev THEN
      result := result || CASE WHEN result = '' THEN '' ELSE ' ' END || tok;
      prev := tok;
    END IF;
  END LOOP;
  RETURN NULLIF(result, '');
END $$;

-- Generační token: „Octavia II" → '2'; „Transit MK5"/„Mondeo MK III" → 'mk5'/'mk3';
-- „Almera N16" → 'n16'; „Astra H" → 'h'; bez tokenu → NULL.
CREATE OR REPLACE FUNCTION public.extract_model_gen(p_model TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE toks TEXT[]; tok TEXT; nxt TEXT; i INT; started BOOLEAN := FALSE;
BEGIN
  toks := public.normalize_model_tokens(p_model);
  FOR i IN 1 .. coalesce(array_length(toks, 1), 0) LOOP
    tok := toks[i];
    CONTINUE WHEN tok = '';
    IF public.is_model_gen_token(tok, NOT started) THEN
      IF tok ~ '^(19|20)[0-9]{2}$' OR tok IN ('fl', 'facelift') THEN
        RETURN NULL;
      END IF;
      IF tok IN ('mk', 'mark') THEN
        nxt := toks[i + 1];
        IF nxt IS NOT NULL AND public.roman_to_arabic(nxt) IS NOT NULL THEN
          RETURN 'mk' || public.roman_to_arabic(nxt);
        END IF;
        RETURN NULL;
      END IF;
      IF tok ~ '^(mk|mark)[ivxl]+$' THEN
        RETURN 'mk' || public.roman_to_arabic(regexp_replace(tok, '^(mk|mark)', ''));
      END IF;
      IF tok ~ '^mark([0-9]+)$' THEN
        RETURN 'mk' || regexp_replace(tok, '^mark', '');
      END IF;
      IF tok ~ '^[ivxl]{1,4}$' AND public.roman_to_arabic(tok) IS NOT NULL THEN
        RETURN public.roman_to_arabic(tok);
      END IF;
      RETURN tok;
    END IF;
    started := TRUE;
  END LOOP;
  RETURN NULL;
END $$;

-- Počáteční rok z labelu: „Compass (2017–present)" → '2017'; bez závorky → NULL.
CREATE OR REPLACE FUNCTION public.extract_model_year(p_model TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT (regexp_match(coalesce(p_model, ''), '\([^0-9)]*((19|20)[0-9]{2})'))[1];
$$;

-- Tři generované sloupce v jednom ALTER → jediný rewrite tabulky / jeden zámek.
ALTER TABLE public.gearbrain_cases
  ADD COLUMN IF NOT EXISTS model_base TEXT
    GENERATED ALWAYS AS (public.normalize_model_family(vehicle_model)) STORED,
  ADD COLUMN IF NOT EXISTS model_gen TEXT
    GENERATED ALWAYS AS (public.extract_model_gen(vehicle_model)) STORED,
  ADD COLUMN IF NOT EXISTS model_year TEXT
    GENERATED ALWAYS AS (public.extract_model_year(vehicle_model)) STORED;

CREATE INDEX IF NOT EXISTS idx_gearbrain_brand_model_base
  ON public.gearbrain_cases (vehicle_brand, model_base)
  WHERE status = 'approved';

-- ── Pásma nájezdu ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mileage_band(p_mileage INT)
RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN p_mileage IS NULL OR p_mileage <= 0 THEN 'unknown'
    WHEN p_mileage < 100000 THEN '0-100'
    WHEN p_mileage < 150000 THEN '100-150'
    WHEN p_mileage < 200000 THEN '150-200'
    ELSE '200+' END;
$$;

-- ── 5. Agregace pro panel ───────────────────────────────────────────────────
-- gen_match: 'exact'   = stejná generace jako dotaz (token, nebo rok když
--                        token chybí na některé straně),
--            'unknown' = případ bez určitelné generace,
--            'other'   = jiná generace téže rodiny (pro fallback „všechny
--                        generace" na klientu).
-- Deduplikace počtů přes source_ref (NHTSA fan-out nesmí nafukovat čísla).

CREATE OR REPLACE FUNCTION public.known_faults_for_vehicle(
  p_brand TEXT,
  p_model TEXT
)
RETURNS TABLE (
  fault_id  TEXT,
  label_cs  TEXT,
  label_en  TEXT,
  label_de  TEXT,
  category  TEXT,
  band      TEXT,
  gen_match TEXT,
  cnt       BIGINT
) LANGUAGE sql STABLE AS $$
  WITH q AS (
    SELECT public.normalize_model_family(p_model) AS fam,
           public.extract_model_gen(p_model)      AS gen,
           public.extract_model_year(p_model)     AS yr
  ),
  matched AS (
    SELECT
      c.canonical_fault_id,
      public.mileage_band(c.mileage) AS band,
      CASE
        WHEN q.gen IS NOT NULL
             AND coalesce(c.model_gen, c.vehicle_generation) = q.gen
          THEN 'exact'
        WHEN (q.gen IS NULL OR coalesce(c.model_gen, c.vehicle_generation) IS NULL)
             AND q.yr IS NOT NULL
             AND coalesce(c.model_year,
                   CASE WHEN c.vehicle_generation ~ '^(19|20)[0-9]{2}$'
                        THEN c.vehicle_generation END) = q.yr
          THEN 'exact'
        WHEN coalesce(c.model_gen, c.vehicle_generation) IS NULL
             AND coalesce(c.model_year,
                   CASE WHEN c.vehicle_generation ~ '^(19|20)[0-9]{2}$'
                        THEN c.vehicle_generation END) IS NULL
          THEN 'unknown'
        ELSE 'other'
      END AS gen_match,
      coalesce(nullif(c.source_ref, ''), c.id::text) AS dedup_key
    FROM public.gearbrain_cases c, q
    WHERE c.status = 'approved'
      AND c.vehicle_brand = p_brand
      AND c.model_base = q.fam
  )
  -- Pozn.: dedup (count DISTINCT source_ref) je v rámci bucketu (závada × pásmo ×
  -- gen_match). Jeden source_ref rozprostřený do VÍCE pásem by se tak v součtu
  -- counts.all započítal vícekrát. V praxi zanedbatelné — ~90 % případů má
  -- prázdný nájezd (jediné pásmo 'unknown') a NHTSA fan-out sdílí prázdný nájezd.
  SELECT m.canonical_fault_id, t.label_cs, t.label_en, t.label_de, t.category,
         m.band, m.gen_match,
         count(DISTINCT m.dedup_key) AS cnt
  FROM matched m
  LEFT JOIN public.gearbrain_fault_taxonomy t ON t.id = m.canonical_fault_id
  GROUP BY 1, 2, 3, 4, 5, 6, 7;
$$;

CREATE OR REPLACE FUNCTION public.known_fault_cases(
  p_brand    TEXT,
  p_model    TEXT,
  p_fault_id TEXT,
  p_band     TEXT DEFAULT NULL,
  p_gen      TEXT DEFAULT 'exact',
  p_limit    INT  DEFAULT 10
)
RETURNS TABLE (
  id            UUID,
  resolution    TEXT,
  mileage       INT,
  closed_at     TIMESTAMPTZ,
  thread_url    TEXT,
  source_ref    TEXT,
  engine_power  TEXT,
  vehicle_model TEXT,
  obd_codes     JSONB
) LANGUAGE sql STABLE AS $$
  WITH q AS (
    SELECT public.normalize_model_family(p_model) AS fam,
           public.extract_model_gen(p_model)      AS gen,
           public.extract_model_year(p_model)     AS yr
  )
  -- Deduplikace podle source_ref (stejně jako počty v known_faults_for_vehicle),
  -- aby seznam v detailu nezobrazoval N fan-out kopií pod počtem, který je
  -- spočítal jako jeden. Stabilní pořadí: closed_at DESC, pak id (tiebreaker).
  SELECT d.id, d.resolution, d.mileage, d.closed_at, d.thread_url, d.source_ref,
         d.engine_power, d.vehicle_model, d.obd_codes
  FROM (
    SELECT DISTINCT ON (coalesce(nullif(c.source_ref, ''), c.id::text))
           c.id, c.resolution, c.mileage, c.closed_at, c.thread_url, c.source_ref,
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
