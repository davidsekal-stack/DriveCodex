-- 026_review_human_note.sql
-- Free-text human reasoning on a review decision.
--
-- The intake-triage review screen previously let the owner pick only one of a few
-- preset reject reason CODES. To build a learning signal (owner's call 2026-06-29),
-- we also capture a free-text note explaining WHY the owner approved or rejected a
-- disputable case. Stored on the queue row so each resolved row is a complete labeled
-- example: what the AI flagged (clause + ai_note + evidence) vs. the human decision
-- (decision + reason code + free-text note). This is the raw material the daily-coach
-- gold-set / triage calibration learns from.
--
-- decision_reason mirrors gearbrain_cases.review_reason onto the queue row so the whole
-- decision is self-contained in the log (no join needed to read the reason code).

ALTER TABLE crawl_review_queue ADD COLUMN IF NOT EXISTS human_note      text;
ALTER TABLE crawl_review_queue ADD COLUMN IF NOT EXISTS decision_reason text;

COMMENT ON COLUMN crawl_review_queue.human_note IS 'Free-text reasoning the owner gave when approving/rejecting — learning signal for triage calibration.';
COMMENT ON COLUMN crawl_review_queue.decision_reason IS 'Reject reason code chosen by the owner (mirrors gearbrain_cases.review_reason), co-located with the decision for the learning log.';
