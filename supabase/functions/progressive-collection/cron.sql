-- Supabase Edge Function Scheduled Trigger
-- This sets up a cron job to run the progressive-collection Edge Function nightly
-- Requires pg_cron extension to be enabled

-- Enable pg_cron extension (run as superuser/service_role)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the progressive collection to run nightly at 2 AM UTC
-- This fetches Last.fm metadata for all users' collections
SELECT cron.schedule(
    'progressive-collection-nightly',  -- Job name
    '0 2 * * *',                       -- Cron expression: 2 AM UTC every day
    $$
    SELECT
      net.http_post(
          url:='https://your-project-ref.supabase.co/functions/v1/progressive-collection',
          headers:=jsonb_build_object(
              'Content-Type','application/json',
              'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
          ),
          body:=jsonb_build_object('scheduled', true)
      ) as request_id;
    $$
);

-- Alternative: Using Supabase's built-in pg_net for HTTP requests
-- Uncomment this if the above doesn't work

-- SELECT cron.schedule(
--     'progressive-collection-nightly',
--     '0 2 * * *',
--     $$
--     SELECT extensions.http((
--         'POST',
--         'https://your-project-ref.supabase.co/functions/v1/progressive-collection',
--         ARRAY[extensions.http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))],
--         'application/json',
--         '{"scheduled": true}'
--     )::extensions.http_request);
--     $$
-- );

-- View scheduled jobs
SELECT * FROM cron.job;

-- Unschedule the job (if needed for updates)
-- SELECT cron.unschedule('progressive-collection-nightly');

-- Manual trigger for testing (run as authenticated user)
-- SELECT
--   net.http_post(
--       url:='https://your-project-ref.supabase.co/functions/v1/progressive-collection',
--       headers:=jsonb_build_object(
--           'Content-Type','application/json',
--           'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
--       ),
--       body:=jsonb_build_object('manual_trigger', true)
--   );
