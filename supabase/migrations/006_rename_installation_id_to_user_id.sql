-- Migration: rename installation_id → user_id across all GearBrain tables
-- installation_id was a desktop-era concept; web app uses Supabase auth user.id (UUID)

-- 1. gearbrain_ai_usage
ALTER TABLE public.gearbrain_ai_usage
  RENAME COLUMN installation_id TO user_id;

DROP INDEX IF EXISTS idx_ai_usage_installation_id;
CREATE INDEX idx_ai_usage_user_id ON public.gearbrain_ai_usage(user_id, created_at);

-- 2. gearbrain_cases
ALTER TABLE public.gearbrain_cases
  RENAME COLUMN installation_id TO user_id;

-- 3. gearbrain_web_sessions (if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'gearbrain_web_sessions'
      AND column_name = 'installation_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.gearbrain_web_sessions RENAME COLUMN installation_id TO user_id';
  END IF;
END $$;

-- 4. gearbrain_violations (if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'gearbrain_violations'
      AND column_name = 'installation_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.gearbrain_violations RENAME COLUMN installation_id TO user_id';
  END IF;
END $$;
