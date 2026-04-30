-- Habilita extensões necessárias para sync automático de Ads
-- pg_cron: agenda jobs SQL periódicos
-- pg_net:  faz chamadas HTTP de dentro do banco (invoca Edge Functions)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove job anterior se existir (idempotente)
SELECT cron.unschedule('meta-ads-daily-sync') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'meta-ads-daily-sync'
);

-- Agenda sync diário às 06:00 UTC (03:00 BRT)
-- Chama a Edge Function meta-ads-sync-auto com service role key
SELECT cron.schedule(
  'meta-ads-daily-sync',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://vvtalmhfdchhwlzqgnvt.supabase.co/functions/v1/meta-ads-sync-auto',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := '{"datePreset": "last_7d"}'::jsonb
  )
  $$
);

-- Agenda também aos domingos às 07:00 UTC para reprocessar o mês completo
SELECT cron.schedule(
  'meta-ads-weekly-full-sync',
  '0 7 * * 0',
  $$
  SELECT net.http_post(
    url     := 'https://vvtalmhfdchhwlzqgnvt.supabase.co/functions/v1/meta-ads-sync-auto',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := '{"datePreset": "last_30d"}'::jsonb
  )
  $$
);

-- IMPORTANTE: Configure a variável com a service role key do seu projeto:
-- No Supabase Dashboard → SQL Editor, rode:
-- ALTER DATABASE postgres SET "app.service_role_key" = 'sua_service_role_key_aqui';
