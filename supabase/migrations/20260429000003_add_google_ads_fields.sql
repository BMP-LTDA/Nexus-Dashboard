-- Adiciona suporte a Google Ads na tabela accounts
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS google_ads_customer_id TEXT;

-- Índice para o sync automático (busca contas com Google Ads configurado)
CREATE INDEX IF NOT EXISTS accounts_google_ads_idx
  ON public.accounts (google_ads_customer_id)
  WHERE google_ads_customer_id IS NOT NULL;

-- Adiciona Google Ads ao cron automático (semanal, às 07:30 UTC aos domingos)
-- Requer que GOOGLE_ADS_DEVELOPER_TOKEN esteja configurado nas secrets da Edge Function
SELECT cron.schedule(
  'google-ads-weekly-sync',
  '30 7 * * 0',
  $$
  SELECT net.http_post(
    url     := 'https://vvtalmhfdchhwlzqgnvt.supabase.co/functions/v1/google-ads-sync-auto',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := '{"datePreset": "last_30d"}'::jsonb
  )
  $$
);
