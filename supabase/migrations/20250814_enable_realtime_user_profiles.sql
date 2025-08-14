-- Ensure Postgres Realtime is enabled for public.user_profiles
DO $$
BEGIN
  -- Attempt to add the table to the default realtime publication
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles';
EXCEPTION
  WHEN duplicate_object THEN
    -- Table already in publication; ignore
    NULL;
  WHEN undefined_object THEN
    -- Publication may not exist (older projects); ignore
    NULL;
END $$;

-- Optional comment for traceability
COMMENT ON TABLE public.user_profiles IS 'Included in supabase_realtime publication for live subscription updates.';

