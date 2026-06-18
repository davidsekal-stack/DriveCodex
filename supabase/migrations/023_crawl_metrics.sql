-- 023_crawl_metrics.sql
-- Nightly self-improvement loop ("daily coach") storage.
--   crawl_metrics      — long-format metrics time-series (one row per night/scope/metric),
--                        the durable source of truth for measuring how each metric evolves.
--   crawl_daily_report — one plain-text daily report per night, shown in the app's
--                        admin Analytics panel.
-- Local SQLite (agent.db) stays the working store; these mirror it off-machine so the
-- data survives and the report is visible in the app. Operator infrastructure — service
-- role only, no anon/auth access.

CREATE TABLE IF NOT EXISTS crawl_metrics (
  date       text NOT NULL,                  -- night date YYYY-MM-DD (local)
  scope      text NOT NULL DEFAULT 'global', -- 'global' or a forum id
  metric     text NOT NULL,                  -- e.g. cases_verified, yield_rate, verify_reject:<cond>
  value      double precision,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (date, scope, metric)          -- supports PostgREST upsert (on_conflict=date,scope,metric)
);

CREATE INDEX IF NOT EXISTS crawl_metrics_metric_idx ON crawl_metrics (metric, scope, date);

CREATE TABLE IF NOT EXISTS crawl_daily_report (
  date         text PRIMARY KEY,             -- one report per night (on_conflict=date)
  report_md    text NOT NULL,
  metrics_json jsonb,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE crawl_metrics      ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_daily_report ENABLE ROW LEVEL SECURITY;
-- No permissive policy: the service key (coach writer + analytics edge fn reader)
-- bypasses RLS; anon/auth get nothing.

COMMENT ON TABLE crawl_metrics      IS 'Nightly crawl metrics time-series (daily coach); long format date/scope/metric/value.';
COMMENT ON TABLE crawl_daily_report IS 'Plain-text daily night-run report (daily coach); shown in admin Analytics panel.';
