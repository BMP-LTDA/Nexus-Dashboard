-- Agenda push-alerts-cron todo dia às 23:00 UTC (20:00 BRT)
SELECT cron.unschedule('push-alerts-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'push-alerts-daily'
);

SELECT cron.schedule(
  'push-alerts-daily',
  '0 23 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://vvtalmhfdchhwlzqgnvt.supabase.co/functions/v1/push-alerts-cron',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := '{}'::jsonb
  )
  $$
);
