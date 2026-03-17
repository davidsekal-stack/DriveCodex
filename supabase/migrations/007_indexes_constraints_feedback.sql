-- Migration 007: Add missing indexes, UNIQUE constraint, and formalize gearbrain_feedback

-- ── 1. Performance indexes for gearbrain_cases (used by search-cases) ────────

CREATE INDEX IF NOT EXISTS idx_gearbrain_obd_codes
  ON public.gearbrain_cases USING GIN (obd_codes);

CREATE INDEX IF NOT EXISTS idx_gearbrain_vehicle_model
  ON public.gearbrain_cases (vehicle_model);

CREATE INDEX IF NOT EXISTS idx_gearbrain_closed_at
  ON public.gearbrain_cases (closed_at DESC);

-- ── 2. UNIQUE index for push-case idempotence ───────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_gearbrain_user_local_id_unique
  ON public.gearbrain_cases (user_id, local_id)
  WHERE local_id IS NOT NULL;

-- ── 3. Formalize gearbrain_feedback table ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.gearbrain_feedback (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message    TEXT NOT NULL,
  user_email TEXT,
  lang       TEXT DEFAULT 'cs',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gearbrain_feedback ENABLE ROW LEVEL SECURITY;
