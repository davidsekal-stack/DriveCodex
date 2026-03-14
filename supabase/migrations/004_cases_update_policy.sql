-- ═══════════════════════════════════════════════════════════════════════════════
-- GearBrain — UPDATE policy pro gearbrain_cases (web uživatelé)
--
-- pushClosedCase() dělá UPSERT (insert + update při konfliktu).
-- Supabase potřebuje UPDATE policy stejně jako INSERT policy.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Web uživatelé mohou aktualizovat jen svoje záznamy v RAG databázi
CREATE POLICY "web_user_update_cases" ON public.gearbrain_cases
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
