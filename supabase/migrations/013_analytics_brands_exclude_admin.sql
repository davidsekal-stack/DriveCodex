-- ═══════════════════════════════════════════════════════════════════════════════
-- GearBrain — Analytics: statistika značek + filtrování admin účtů
-- ═══════════════════════════════════════════════════════════════════════════════

-- Top značky podle počtu diagnostických sessions
-- Čerpá z gearbrain_web_sessions.data->vehicle->brand
CREATE OR REPLACE FUNCTION analytics_brand_stats(
  since_date TIMESTAMPTZ,
  exclude_emails TEXT[] DEFAULT '{}'
)
RETURNS TABLE (
  brand       TEXT,
  sessions    BIGINT
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    data->'vehicle'->>'brand' AS brand,
    count(*)                  AS sessions
  FROM public.gearbrain_web_sessions s
  LEFT JOIN auth.users a ON a.id = s.user_id
  WHERE s.created_at >= since_date
    AND data->'vehicle'->>'brand' IS NOT NULL
    AND data->'vehicle'->>'brand' <> ''
    AND (array_length(exclude_emails, 1) IS NULL
         OR a.email IS NULL
         OR a.email <> ALL(exclude_emails))
  GROUP BY brand
  ORDER BY sessions DESC
  LIMIT 20;
$$;

-- ── Aktualizace existujících funkcí — přidání exclude_emails parametru ────────

-- Denní AI volání + spotřeba tokenů (bez admin účtů)
CREATE OR REPLACE FUNCTION analytics_ai_daily(
  since_date TIMESTAMPTZ,
  exclude_emails TEXT[] DEFAULT '{}'
)
RETURNS TABLE (
  day         DATE,
  calls       BIGINT,
  input_tok   BIGINT,
  output_tok  BIGINT,
  users       BIGINT
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    u.created_at::date AS day,
    count(*)           AS calls,
    coalesce(sum(u.input_tokens), 0)  AS input_tok,
    coalesce(sum(u.output_tokens), 0) AS output_tok,
    count(DISTINCT u.user_id) AS users
  FROM public.gearbrain_ai_usage u
  LEFT JOIN auth.users a ON a.id = u.user_id::uuid
  WHERE u.created_at >= since_date
    AND (array_length(exclude_emails, 1) IS NULL
         OR a.email IS NULL
         OR a.email <> ALL(exclude_emails))
  GROUP BY day
  ORDER BY day;
$$;

-- Denní aktivní sessions (bez admin účtů)
CREATE OR REPLACE FUNCTION analytics_sessions_daily(
  since_date TIMESTAMPTZ,
  exclude_emails TEXT[] DEFAULT '{}'
)
RETURNS TABLE (
  day          DATE,
  new_sessions BIGINT,
  active_users BIGINT
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    s.updated_at::date AS day,
    count(*) FILTER (WHERE s.created_at::date = s.updated_at::date) AS new_sessions,
    count(DISTINCT s.user_id) AS active_users
  FROM public.gearbrain_web_sessions s
  LEFT JOIN auth.users a ON a.id = s.user_id
  WHERE s.updated_at >= since_date
    AND (array_length(exclude_emails, 1) IS NULL
         OR a.email IS NULL
         OR a.email <> ALL(exclude_emails))
  GROUP BY day
  ORDER BY day;
$$;

-- Top uživatelé podle spotřeby tokenů (bez admin účtů)
CREATE OR REPLACE FUNCTION analytics_top_users(
  since_date TIMESTAMPTZ,
  lim INTEGER DEFAULT 10,
  exclude_emails TEXT[] DEFAULT '{}'
)
RETURNS TABLE (
  user_id     TEXT,
  user_email  TEXT,
  calls       BIGINT,
  input_tok   BIGINT,
  output_tok  BIGINT,
  total_tok   BIGINT
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    u.user_id,
    coalesce(a.email::text, u.user_id::text) AS user_email,
    count(*)                       AS calls,
    coalesce(sum(u.input_tokens), 0)  AS input_tok,
    coalesce(sum(u.output_tokens), 0) AS output_tok,
    coalesce(sum(u.input_tokens), 0) + coalesce(sum(u.output_tokens), 0) AS total_tok
  FROM public.gearbrain_ai_usage u
  LEFT JOIN auth.users a ON a.id = u.user_id::uuid
  WHERE u.created_at >= since_date
    AND (array_length(exclude_emails, 1) IS NULL
         OR a.email IS NULL
         OR a.email <> ALL(exclude_emails))
  GROUP BY u.user_id, a.email
  ORDER BY total_tok DESC
  LIMIT lim;
$$;

-- Registrovaní uživatelé (bez admin účtů)
CREATE OR REPLACE FUNCTION analytics_registered_users(
  exclude_emails TEXT[] DEFAULT '{}'
)
RETURNS TABLE (
  total_users   BIGINT,
  users_today   BIGINT,
  users_7d      BIGINT,
  users_30d     BIGINT
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    count(*)                                                          AS total_users,
    count(*) FILTER (WHERE created_at::date = current_date)           AS users_today,
    count(*) FILTER (WHERE created_at >= now() - interval '7 days')   AS users_7d,
    count(*) FILTER (WHERE created_at >= now() - interval '30 days')  AS users_30d
  FROM auth.users
  WHERE (array_length(exclude_emails, 1) IS NULL
         OR email IS NULL
         OR email <> ALL(exclude_emails));
$$;
