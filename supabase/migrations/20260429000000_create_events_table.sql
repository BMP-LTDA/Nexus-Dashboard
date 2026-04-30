-- Tabela de eventos do pixel próprio (Nexus Pixel)
-- Registra page_view, add_to_cart, begin_checkout, purchase por sessão
CREATE TABLE IF NOT EXISTS public.events (
    id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id     UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    session_id     TEXT NOT NULL,
    event          TEXT NOT NULL,
    page           TEXT,
    referrer       TEXT,
    metadata       JSONB DEFAULT '{}',
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para as queries mais comuns (funil por conta + período, sessões por evento)
CREATE INDEX IF NOT EXISTS events_account_period_idx ON public.events (account_id, created_at);
CREATE INDEX IF NOT EXISTS events_session_event_idx  ON public.events (session_id, event);

-- Adiciona coluna customer_email à tabela orders (identificador mais confiável que nome)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
CREATE INDEX IF NOT EXISTS orders_customer_email_idx ON public.orders (account_id, customer_email);

-- RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Leitura: apenas usuários autenticados da conta dona dos eventos
CREATE POLICY "Users can read own account events"
    ON public.events FOR SELECT
    USING (
        account_id IN (
            SELECT id FROM public.accounts WHERE owner_id = auth.uid()
        )
    );

-- Escrita via service_role (Edge Function track) — sem policy necessária para service_role
-- Para inserção via cliente anon (pixel), usamos a Edge Function como proxy
