-- Requires pg_cron extension (enabled in Supabase dashboard → Extensions).
-- Calls the settle edge function every hour to finalize markets past the dispute window.

SELECT cron.schedule(
  'settle-resolving-markets',
  '0 * * * *',  -- every hour
  $$
  SELECT net.http_post(
    url    := current_setting('app.supabase_url') || '/functions/v1/settle',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body   := '{}'::jsonb
  );
  $$
);

-- Also lock expired open markets every 5 minutes.
SELECT cron.schedule(
  'lock-expired-markets',
  '*/5 * * * *',
  $$ SELECT lock_expired_markets(); $$
);
