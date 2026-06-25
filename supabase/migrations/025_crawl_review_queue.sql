-- 025_crawl_review_queue.sql
-- Intake triage queue for the crawl agent's nightly auto-approval.
--
-- The triage step (scripts/agent/triage.mjs) re-judges each `pending` gearbrain_cases
-- row with an independent model: CLEAR cases are auto-approved (status→approved), and
-- DISPUTABLE ones stay `pending` and get a row HERE carrying WHY (the failing quality-bar
-- clause + a plain-Czech note) and the real forum QUOTES the judgement rests on. The
-- admin review screen reads this to show the owner only the disputable cases with their
-- evidence; approving/rejecting marks the row resolved.
--
-- Operator infrastructure — service role only, no anon/auth access. One row per case
-- (PRIMARY KEY on the agent local_id) so a re-triage upserts rather than duplicates.

CREATE TABLE IF NOT EXISTS crawl_review_queue (
  case_local_id text PRIMARY KEY,            -- = gearbrain_cases.local_id (the agent case id)
  vehicle_brand text,
  vehicle_model text,
  clause        text,                        -- failing quality-bar clause a–e (why it's disputable)
  ai_note       text,                        -- plain-Czech "why it's disputable", for the owner
  evidence_json jsonb,                       -- [{post, author, text}] — real forum quotes
  thread_url    text,
  created_at    timestamptz DEFAULT now(),
  resolved_at   timestamptz,                 -- set when the owner decides
  decision      text                         -- 'approved' | 'rejected' (the owner's call)
);

-- Open (unresolved) items the review screen shows.
CREATE INDEX IF NOT EXISTS crawl_review_queue_open_idx
  ON crawl_review_queue (resolved_at) WHERE resolved_at IS NULL;

ALTER TABLE crawl_review_queue ENABLE ROW LEVEL SECURITY;
-- No permissive policy: the service key (triage writer + review-cases edge fn reader)
-- bypasses RLS; anon/auth get nothing.

COMMENT ON TABLE crawl_review_queue IS 'Intake-triage queue: disputable pending cases needing human review, with the failing clause + AI note + real forum quotes. Written by scripts/agent/triage.mjs.';
