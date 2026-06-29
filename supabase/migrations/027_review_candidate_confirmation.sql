-- 027_review_candidate_confirmation.sql
-- Assisted review: a CANDIDATE confirmation quote for a disputable case.
--
-- Owner's call (2026-06-29): do NOT auto-loosen the bar (proven unsafe — a lenient
-- judge approves unconfirmed/pending repairs). Instead, for cases held back on clause
-- (d) "repair not confirmed", a finder pass extracts a VERBATIM quote from the thread
-- that MIGHT confirm the fix worked, and stores it here. The review screen surfaces it
-- ("možné potvrzení: «...»") so the human decides at a glance instead of re-reading the
-- whole thread. Nothing is auto-approved — the human is still the gate.
--
-- Nullable: most rows have no candidate (no plausible confirmation found), and that's
-- fine — the screen just shows nothing extra for them.

ALTER TABLE crawl_review_queue ADD COLUMN IF NOT EXISTS candidate_confirmation text;

COMMENT ON COLUMN crawl_review_queue.candidate_confirmation IS 'Verbatim forum quote that MIGHT confirm the repair worked, surfaced to speed up human review. Not a decision — the human still confirms. Written by scripts/agent/enrich-review-confirmations.mjs.';
