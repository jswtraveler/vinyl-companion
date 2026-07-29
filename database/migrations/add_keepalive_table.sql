-- Keepalive table for the GitHub Actions "Supabase Keep-Alive" workflow.
--
-- Supabase's free tier pauses a project after 7 days with no activity.
-- The workflow (.github/workflows/supabase-keepalive.yml) PATCHes row id=1
-- of this table on a schedule to register activity and keep the DB awake.
--
-- Unlike every other table in this app, this one holds NO user data, so it is
-- intentionally readable/updatable by the `anon` role (the workflow only has
-- the anon key). Exposing a single dummy timestamp row is harmless.

CREATE TABLE IF NOT EXISTS public.keepalive (
  id BIGINT PRIMARY KEY,
  last_ping TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the single row the workflow updates.
INSERT INTO public.keepalive (id, last_ping)
VALUES (1, NOW())
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.keepalive ENABLE ROW LEVEL SECURITY;

-- Allow the anon key to update the single keepalive row.
DROP POLICY IF EXISTS "anon can update keepalive" ON public.keepalive;
CREATE POLICY "anon can update keepalive"
  ON public.keepalive
  FOR UPDATE
  TO anon
  USING (id = 1)
  WITH CHECK (id = 1);

-- Allow the anon key to read it (useful for manual verification).
DROP POLICY IF EXISTS "anon can read keepalive" ON public.keepalive;
CREATE POLICY "anon can read keepalive"
  ON public.keepalive
  FOR SELECT
  TO anon
  USING (id = 1);
