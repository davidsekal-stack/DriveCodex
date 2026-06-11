-- 020_crawl_forums.sql
-- Online registry of crawl targets (the "online list" of forums + when each
-- was last scraped). The local SQLite agent.db stays the working store for
-- threads/cases; this table is the shared, durable source of truth for which
-- forums exist, their state, and de-duplication by domain across machines.

CREATE TABLE IF NOT EXISTS crawl_forums (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain        text UNIQUE NOT NULL,          -- dedup key (hostname, lowercased)
  root_url      text NOT NULL,
  name          text,
  brands        text[] DEFAULT '{}',
  language      text,
  engine        text,                          -- phpbb | xenforo | invision | woltlab | generic
  status        text DEFAULT 'discovered',     -- discovered|queued|calibrated|active|exhausted|disqualified|blocked|calibration_failed
  discovered_via text,                         -- 'search:<query>' | 'seed' | 'link:<domain>' | 'manual'
  public_readable boolean,
  robots_allowed  boolean,
  threads_crawled integer DEFAULT 0,
  cases_total     integer DEFAULT 0,
  yield_rate      real,
  notes         text,
  discovered_at    timestamptz DEFAULT now(),
  last_calibrated_at timestamptz,
  last_crawled_at    timestamptz,
  cooldown_until     timestamptz,
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crawl_forums_status_idx ON crawl_forums (status);
CREATE INDEX IF NOT EXISTS crawl_forums_last_crawled_idx ON crawl_forums (last_crawled_at);

-- Service-role only (the AI importer). No anon/auth access — this is operator
-- infrastructure, not user-facing data.
ALTER TABLE crawl_forums ENABLE ROW LEVEL SECURITY;
-- (No permissive policy: the service key bypasses RLS; anon/auth get nothing.)

COMMENT ON TABLE crawl_forums IS 'Online registry of forum crawl targets + last-scraped state (agent discovery/dedup).';
