# Nexus Analytics — Roadmap & Status

> Última atualização: 06 de Maio de 2026

---

## 📝 Log de Ajustes — 06/Mai/2026

### MCP Supabase reconectado ao projeto correto
- O MCP estava conectado a um projeto de finanças pessoais (tabelas `bank_connections`, `budgets`, etc.) em vez do Nexus Dashboard.
- **Fix:** Atualizado `mcp_config.json` com `?project_ref=vvtalmhfdchhwlzqgnvt` para apontar ao projeto correto.
- **Status:** ✅ Resolvido

### Webhook `bagy-webhook` retornando 401 em TODOS os pedidos
- **Causa 1:** A Edge Function estava deployada com `verify_jwt: true`. Como a Bagy não envia JWT, o Supabase rejeitava a request antes de chegar ao código.
- **Causa 2:** A env var `WEBHOOK_SECRET` não estava configurada no servidor. O código não tinha fallback.
- **Fix:** Redeploy via `npx supabase functions deploy bagy-webhook --no-verify-jwt` com fallback hardcoded para o secret.
- **Impacto:** ~8 dias de pedidos perdidos (28/Abr → 06/Mai). Recomenda-se re-importar via CSV.
- **Status:** ✅ Resolvido — novos pedidos já entram normalmente

### Ícones desalinhados em Settings (Integração de Dados)
- Os ícones `Database` e `Globe` na seção de Integrações estavam alinhados à esquerda em vez de centralizados.
- **Fix:** Adicionado `display: 'block'` e `margin: '0 auto'` nos ícones SVG.
- **Status:** ✅ Resolvido

---

## ✅ Fase 0 — Correções de Bugs (Dashboard Web)

### Bug #1 — Novos Clientes nunca populava
- **Arquivo:** `src/pages/Overview/Overview.jsx`
- **Problema:** `ret.newCustomers.value` (undefined) — `getRetentionMetrics` retorna string, não objeto
- **Status:** ✅ Corrigido

### Bug #3 — Cliente identificado só por nome
- **Arquivos:** `src/services/orders.js`, `src/pages/Settings/Settings.jsx`
- **Problema:** Clientes com mesmo nome eram confundidos; homônimos viravam o mesmo cliente
- **Fix:** Usa `customer_email` como chave principal com fallback para `customer_name`
- **Pendente:** Rodar `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT;` no Supabase (já está na migration `20260429000000`)
- **Status:** ✅ Código corrigido | ⚠️ Migration precisa ser aplicada

### Bug #4 — Definição de "Receita" diferente da Bagy
- **Arquivo:** `src/services/orders.js`
- **Problema:** Dashboard mostrava só pedidos `invoiced/approved`; Bagy inclui `shipped`, `entregue`, `pago`, etc.
- **Fix:** Criados `_isBilled()` e `_isCanceled()` centrais com lista completa de statuses
- **Status:** ✅ Corrigido

### Bug #6 — Race condition no ROAS
- **Arquivo:** `src/pages/Overview/Overview.jsx`
- **Problema:** ROAS era calculado com receita do ciclo anterior (dois `useEffect` paralelos)
- **Fix:** Fundidos em um único `Promise.all`
- **Status:** ✅ Corrigido

### Bug #7 — Status mapping inconsistente entre arquivos
- **Arquivos:** `src/services/orders.js`, `src/data/mockData.js`
- **Problema:** Cada método tinha sua própria lista de statuses, causando divergência entre páginas
- **Fix:** `_isBilled()` e `_isCanceled()` compartilhados em `orders.js`; `mockData.js` já era mais permissivo
- **Status:** ✅ Corrigido

### Bug #8 — Realtime refetch agressivo
- **Arquivo:** `src/hooks/useRealtimeOrders.js`
- **Problema:** Qualquer evento Realtime rebaixava TODOS os pedidos, causando lag e estados inconsistentes
- **Fix:** Debounce de 1.5s + flag `isFetchingRef` para bloquear fetches concorrentes
- **Status:** ✅ Corrigido

### Bug #9 — Dados "Carregando" após correção do customer_email
- **Arquivo:** `src/services/orders.js`
- **Problema:** Queries pediam coluna `customer_email` que não existe no banco → Supabase retornava erro 400 → `getRetentionMetrics` retornava null
- **Fix:** Removido `customer_email` dos selects explícitos; mantido `?.` como fallback
- **Status:** ✅ Corrigido

### Itens ainda hardcoded no Dashboard Web
- **Taxa de Conversão:** Mostra `'—'` (aguarda dados do Pixel Nexus)
- **Sessões:** Mostra `'—'` (aguarda conexão GA4 funcional)
- **Receita por Canal:** Usa dados do cache/mock (aguarda GA4 real)
- **Status:** ⚠️ Dependentes do Pixel Nexus e GA4 estarem configurados

---

## ✅ Fase 1 — Pixel Nexus (CRO + Conversão Real)

### Edge Function `track`
- **Arquivo:** `supabase/functions/track/index.ts`
- **O que faz:** Recebe eventos do pixel (page_view, add_to_cart, begin_checkout, purchase) e salva na tabela `events`
- **Status:** ✅ Código criado | ✅ Deploy feito pelo usuário no dashboard Supabase

### Tabela `events`
- **Migration:** `supabase/migrations/20260429000000_create_events_table.sql`
- **Campos:** `account_id`, `session_id`, `event`, `page`, `referrer`, `metadata`, `created_at`
- **Status:** ✅ Migration aplicada pelo usuário

### Script `nexus-pixel.js`
- **Arquivo:** `public/nexus-pixel.js`
- **O que faz:** Script leve (~5KB) embarcado na loja Bagy — rastreia `page_view` automaticamente; expõe `nexusPixel.addToCart()`, `nexusPixel.beginCheckout()`, `nexusPixel.purchase()` para eventos manuais
- **Pendente:** 
  - [ ] Instalar snippet na loja Bagy (Settings → Pixel Nexus → copiar código → colar antes de `</body>` no tema)
  - [ ] Dashboard precisa estar deployado em URL pública (Vercel) para o script ser servido
- **Status:** ✅ Código criado | ⚠️ Instalação na Bagy pendente

### Seção Pixel Nexus em Settings
- **Arquivo:** `src/pages/Settings/Settings.jsx`
- **O que faz:** Gera snippet personalizado com slug da loja, mostra status de eventos rastreados
- **Status:** ✅ Implementado

### Página de Conversão com dados reais
- **Arquivo:** `src/pages/Conversion/Conversion.jsx`
- **Pendente:** 
  - [ ] Conectar a página de Conversão aos dados reais da tabela `events` (funil de sessão → compra)
  - [ ] Calcular taxa de conversão real = `purchase_events / page_view_sessions`
- **Status:** ⚠️ Página existe mas ainda não consome dados do pixel

### Deploy Vercel
- **Arquivos:** `vite.config.js`, `vercel.json`
- **Status:** ✅ Configurados | ⚠️ Confirmar que deploy está ativo e snippet usa URL pública

---

## ✅ Fase 2 — Automações de Mídia

### Meta Ads Sync Manual (refatorado)
- **Arquivo:** `supabase/functions/meta-ads-sync/index.ts`
- **Mudanças:** Substituído loop select+update por upsert em batch; adicionada paginação completa (antes limitava a 100 dias)
- **Status:** ✅ Código atualizado | ⚠️ Fazer redeploy: `supabase functions deploy meta-ads-sync`

### Meta Ads Sync Automático (todas as contas)
- **Arquivo:** `supabase/functions/meta-ads-sync-auto/index.ts`
- **O que faz:** Sincroniza Meta Ads de TODAS as contas com `meta_ad_account_id` configurado — chamado pelo cron, sem auth de usuário
- **Pendente:**
  - [ ] Deploy: `supabase functions deploy meta-ads-sync-auto`
  - [ ] Configurar secret `META_ACCESS_TOKEN` no Supabase Dashboard → Edge Functions → Secrets
- **Status:** ✅ Código criado | ⚠️ Deploy e secret pendentes

### pg_cron — Meta Ads
- **Migration:** `supabase/migrations/20260429000002_setup_ads_cron.sql`
- **Agenda:** Diário às 06:00 UTC (03:00 BRT) + semanal completo aos domingos
- **Pendente:**
  - [ ] Aplicar migration no Supabase SQL Editor
  - [ ] Rodar: `ALTER DATABASE postgres SET "app.service_role_key" = 'sua_service_role_key';`
- **Status:** ⚠️ Migration criada, não aplicada

### Google Ads Sync
- **Arquivo:** `supabase/functions/google-ads-sync/index.ts`
- **O que faz:** Busca gasto diário via Google Ads API REST v18, agrega por campanha, salva em `daily_ad_spend`
- **Pendente:**
  - [ ] Deploy: `supabase functions deploy google-ads-sync`
  - [ ] Configurar secrets: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GCP_CLIENT_ID`, `GCP_CLIENT_SECRET`, `GCP_REFRESH_TOKEN`
  - [ ] Solicitar Developer Token em: developers.google.com/google-ads/api/docs/get-started/introduction
  - [ ] Aplicar migration `20260429000003_add_google_ads_fields.sql` (coluna `google_ads_customer_id`)
  - [ ] Cadastrar Customer ID em Settings → Google Ads
- **Status:** ✅ Código criado | ⚠️ Tudo pendente de setup externo

### Seção Google Ads em Settings
- **Arquivo:** `src/pages/Settings/Settings.jsx`
- **O que faz:** Campo Customer ID + botão de sync manual + status do resultado
- **Status:** ✅ Implementado

---

## ✅ Fase 3 — App Mobile (Expo)

### Estrutura do projeto
- **Pasta:** `mobile/`
- **Stack:** Expo SDK 52, expo-router (file-based navigation), @supabase/supabase-js, expo-notifications
- **Status:** ✅ Criado

### Telas

| Tela | Arquivo | Status |
|---|---|---|
| Login | `mobile/app/login.jsx` | ✅ |
| Painel (Overview) | `mobile/app/(tabs)/index.jsx` | ✅ |
| Receita | `mobile/app/(tabs)/receita.jsx` | ✅ |
| Mídia Paga | `mobile/app/(tabs)/midia.jsx` | ✅ |
| Alertas | `mobile/app/(tabs)/alertas.jsx` | ✅ |

### Serviços mobile
- `mobile/src/services/orders.js` — mesma lógica do web, sem deps de browser ✅
- `mobile/src/services/ads.js` — idem ✅
- `mobile/src/services/pushService.js` — registra Expo Push Token no Supabase ✅
- `mobile/src/lib/supabase.js` — cliente com AsyncStorage (obrigatório no RN) ✅
- `mobile/src/lib/dateUtils.js` — cópia direta do web ✅

### Push Notifications — Backend
- **Tabela:** `push_tokens` (migration `20260430000000_create_push_tokens.sql`)
- **Edge Function `send-push`:** Envia via Expo Push API em batches de 100
- **Edge Function `push-alerts-cron`:** Verifica ROAS, cancelamentos, resumo diário → dispara alertas
- **pg_cron:** Todo dia às 23:00 UTC (20:00 BRT)

### Alertas implementados
| Alerta | Trigger | Status |
|---|---|---|
| Resumo diário | Todo dia às 20h BRT | ✅ |
| ROAS < 4x | Verificado no cron diário | ✅ |
| Pico de cancelamentos (>15%) | Verificado no cron diário | ✅ |
| Novo pedido em tempo real | ⚠️ Pendente (requer lógica no bagy-webhook) | ⚠️ |
| Meta de receita batida | ⚠️ Pendente (sem meta configurável ainda) | ⚠️ |
| Resumo semanal | ⚠️ Pendente (cron separado) | ⚠️ |

### Para rodar o app
```bash
cd mobile
npm install
cp .env.example .env   # preencher EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY
npx expo start
```
- Escanear QR com app **Expo Go**
- Para produção: `npx eas build`

### Pendências do app mobile
- [ ] Aplicar migrations `20260430000000` e `20260430000001` no Supabase
- [ ] Deploy das Edge Functions `send-push` e `push-alerts-cron`
- [ ] Criar arquivo `mobile/assets/icon.png` e `mobile/assets/notification-icon.png` (ícones do app)
- [ ] Configurar EAS (Expo Application Services) para build de produção: `npx eas build:configure`
- [ ] Publicar na App Store / Google Play (requer conta de desenvolvedor Apple/Google)
- [ ] Tela de Retenção/Clientes (ainda não criada no mobile)
- [ ] Suporte a múltiplas contas no seletor de conta de Receita e Mídia (hoje só usa `accounts[0]`)

---

## 🗺️ Backlog — Próximas Implementações

### Pixel Nexus — Conversão real no Dashboard
- Criar serviço `src/services/pixelService.js` para ler tabela `events`
- Conectar `src/pages/Conversion/Conversion.jsx` ao funil real
- Calcular taxa de conversão real no Overview (substituir `'—'`)

### Segmentos RFM → Meta Custom Audiences
- Exportar clientes Champion e At Risk via Meta API
- Edge Function `export-segments`

### Alerta de novo pedido em tempo real
- Webhook Bagy → `bagy-webhook` → chamar `send-push` para o dono da conta
- Já tem infraestrutura, falta conectar

### GA4 — Conectar Traffic page
- `src/pages/Traffic/Traffic.jsx` já chama `analyticsService`
- Requer `GCP_CLIENT_ID`, `GCP_CLIENT_SECRET`, `GCP_REFRESH_TOKEN` configurados no Supabase
- A Edge Function `ga4-proxy` está completa

### Dashboard multi-tenant (Painel de Agência)
- `src/pages/Agency/AgencyPanel.jsx` — existe mas usa dados mock
- Conectar ao Supabase para gerenciar múltiplas contas reais

### Tela de Retenção no Mobile
- Coorte, LTV, novos vs. recorrentes por mês

---

## 📋 Checklist de Deploy Completo

### Supabase
- [x] Aplicar todas as migrations pendentes (SQL Editor)
- [ ] Configurar secrets nas Edge Functions:
  - `META_ACCESS_TOKEN`
  - `GOOGLE_ADS_DEVELOPER_TOKEN`
  - `GCP_CLIENT_ID` / `GCP_CLIENT_SECRET` / `GCP_REFRESH_TOKEN`
  - `CRON_SECRET` (para `meta-ads-sync-auto`)
- [x] Deploy das Edge Functions: `track`, `send-push`, `push-alerts-cron`, `meta-ads-sync-auto`, `google-ads-sync`
- [ ] Configurar `app.service_role_key` no banco para os crons
- [x] Autenticar MCP Supabase (`claude /mcp`) para gerenciar direto do Claude

### Vercel (Dashboard Web)
- [x] Confirmar que deploy está ativo com `vite.config.js` e `vercel.json` novos
- [x] Configurar variáveis de ambiente no Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WEBHOOK_SECRET`

### Bagy (Loja)
- [ ] Instalar snippet do Pixel Nexus antes de `</body>` no tema
- [ ] Configurar webhook da Bagy apontando para a Edge Function `bagy-webhook`
- [ ] Adicionar eventos manuais (`addToCart`, `beginCheckout`, `purchase`) nos locais corretos do tema

### App Mobile
- [x] Resolver dependências do React e instalar `expo-asset` para rodar localmente
- [x] Configurar ambiente local (`mobile/.env` preenchido)
- [x] Configurar EAS: `eas build:configure` (Conta `CLKmkt` conectada com sucesso)
- [x] Teste Local (`npx expo start`) rodando perfeitamente
- [ ] Criar ícones: `mobile/assets/icon.png` e `mobile/assets/notification-icon.png`
- [ ] Debuggar erro no Prebuild do EAS ao gerar o APK na nuvem: `eas build --profile preview --platform android`

---

## 🔐 Setup Externo Pendente (Tokens e Contas)

### Meta Ads
- [ ] Criar Usuário de Sistema no Meta Business Settings
- [ ] Gerar Token de Acesso Permanente (`META_ACCESS_TOKEN`) com permissões `ads_read` e `read_insights`

### Google Ads & Analytics
- [ ] Criar Projeto no Google Cloud Platform (GCP)
- [ ] Ativar Google Ads API e gerar credenciais OAuth (`GCP_CLIENT_ID` / `GCP_CLIENT_SECRET`)
- [ ] Obter `GCP_REFRESH_TOKEN` via OAuth Playground
- [ ] Solicitar `GOOGLE_ADS_DEVELOPER_TOKEN` no Centro de API do Google Ads

### Git & Deploy
- [x] Realizar commit e push do repositório para o GitHub (Para atualizar a Vercel com os últimos arquivos, como o Pixel)

### Expo (App Mobile)
- [x] Criar conta gratuita em expo.dev
- [x] Logar no CLI via `eas login` com o username/senha criados
