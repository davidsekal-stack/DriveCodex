-- ═══════════════════════════════════════════════════════════════════════════════
-- GearBrain — Rozšíření brand_stats o počet uzavřených případů v DB
-- ═══════════════════════════════════════════════════════════════════════════════

-- Return type se změnil (přidáno closed_cases) — musíme dropnout starou verzi
DROP FUNCTION IF EXISTS analytics_brand_stats(TIMESTAMPTZ, TEXT[]);

CREATE OR REPLACE FUNCTION analytics_brand_stats(
  since_date TIMESTAMPTZ,
  exclude_emails TEXT[] DEFAULT '{}'
)
RETURNS TABLE (
  brand          TEXT,
  sessions       BIGINT,
  closed_cases   BIGINT
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH sess AS (
    SELECT
      data->'vehicle'->>'brand' AS brand,
      count(*) AS cnt
    FROM public.gearbrain_web_sessions s
    LEFT JOIN auth.users a ON a.id = s.user_id
    WHERE s.created_at >= since_date
      AND data->'vehicle'->>'brand' IS NOT NULL
      AND data->'vehicle'->>'brand' <> ''
      AND (array_length(exclude_emails, 1) IS NULL
           OR a.email IS NULL
           OR a.email <> ALL(exclude_emails))
    GROUP BY brand
  ),
  cases AS (
    SELECT
      c.vehicle_brand AS brand,
      count(*) AS cnt
    FROM public.gearbrain_cases c
    LEFT JOIN auth.users a ON a.id = c.user_id
    WHERE c.status = 'approved'
      AND c.vehicle_brand IS NOT NULL
      AND c.vehicle_brand <> ''
      AND (array_length(exclude_emails, 1) IS NULL
           OR a.email IS NULL
           OR a.email <> ALL(exclude_emails))
    GROUP BY c.vehicle_brand
  )
  SELECT
    coalesce(s.brand, ca.brand)    AS brand,
    coalesce(s.cnt, 0)             AS sessions,
    coalesce(ca.cnt, 0)            AS closed_cases
  FROM sess s
  FULL OUTER JOIN cases ca ON ca.brand = s.brand
  ORDER BY sessions DESC, closed_cases DESC
  LIMIT 20;
$$;
