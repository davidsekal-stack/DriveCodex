-- ═══════════════════════════════════════════════════════════════════════════════
-- GearBrain — SQL funkce pro analytics dashboard
-- ═══════════════════════════════════════════════════════════════════════════════

-- Denní AI volání + spotřeba tokenů
CREATE OR REPLACE FUNCTION analytics_ai_daily(since_date TIMESTAMPTZ)
RETURNS TABLE (
  day         DATE,
  calls       BIGINT,
  input_tok   BIGINT,
  output_tok  BIGINT,
  users       BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT
    created_at::date AS day,
    count(*)         AS calls,
    coalesce(sum(input_tokens), 0)  AS input_tok,
    coalesce(sum(output_tokens), 0) AS output_tok,
    count(DISTINCT user_id) AS users
  FROM public.gearbrain_ai_usage
  WHERE created_at >= since_date
  GROUP BY day
  ORDER BY day;
$$;

-- Denní aktivní sessions (unikátní uživatelé)
CREATE OR REPLACE FUNCTION analytics_sessions_daily(since_date TIMESTAMPTZ)
RETURNS TABLE (
  day          DATE,
  new_sessions BIGINT,
  active_users BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT
    updated_at::date AS day,
    count(*) FILTER (WHERE created_at::date = updated_at::date) AS new_sessions,
    count(DISTINCT user_id)                                      AS active_users
  FROM public.gearbrain_web_sessions
  WHERE updated_at >= since_date
  GROUP BY day
  ORDER BY day;
$$;

-- Celkové statistiky případů
CREATE OR REPLACE FUNCTION analytics_case_stats()
RETURNS TABLE (
  total     BIGINT,
  pending   BIGINT,
  approved  BIGINT,
  rejected  BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT
    count(*)                                  AS total,
    count(*) FILTER (WHERE status = 'pending')  AS pending,
    count(*) FILTER (WHERE status = 'approved') AS approved,
    count(*) FILTER (WHERE status = 'rejected') AS rejected
  FROM public.gearbrain_cases;
$$;
