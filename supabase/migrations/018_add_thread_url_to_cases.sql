-- Migration 009: persist optional source thread URL for imported and cloud cases

ALTER TABLE public.gearbrain_cases
  ADD COLUMN IF NOT EXISTS thread_url TEXT;
