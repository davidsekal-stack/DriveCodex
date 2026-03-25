-- ═══════════════════════════════════════════════════════════════════════════════
-- GearBrain — Analytics: registrovaní uživatelé + top uživatelé podle tokenů
-- ═══════════════════════════════════════════════════════════════════════════════

-- Celkový počet registrovaných uživatelů (z auth.users)
CREATE OR REPLACE FUNCTION analytics_registered_users()
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
  FROM auth.users;
$$;

-- Top uživatelé podle spotřeby tokenů (za dané období)
CREATE OR REPLACE FUNCTION analytics_top_users(since_date TIMESTAMPTZ, lim INTEGER DEFAULT 10)
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
    coalesce(a.email::text, u.user_id::text)  AS user_email,
    count(*)                       AS calls,
    coalesce(sum(u.input_tokens), 0)  AS input_tok,
    coalesce(sum(u.output_tokens), 0) AS output_tok,
    coalesce(sum(u.input_tokens), 0) + coalesce(sum(u.output_tokens), 0) AS total_tok
  FROM public.gearbrain_ai_usage u
  LEFT JOIN auth.users a ON a.id = u.user_id::uuid
  WHERE u.created_at >= since_date
  GROUP BY u.user_id, a.email
  ORDER BY total_tok DESC
  LIMIT lim;
$$;
