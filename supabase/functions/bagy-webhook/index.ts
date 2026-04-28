// @ts-nocheck — Este arquivo roda no Deno (Supabase Edge Functions), não em Node.js
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

// ── Security: Webhook Secret Token ──────────────────────────────────
// A Bagy (ou qualquer chamador externo) DEVE enviar este token como
// query parameter ?secret=<TOKEN> para que a requisição seja aceita.
// O secret DEVE ser configurado via env var — sem fallback hardcoded.
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');

// ── CORS: Usa env var ALLOWED_ORIGINS ou fallback '*' em dev ────────
const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS') || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const parseCurrency = (val) => {
  if (!val) return 0;
  let str = String(val).trim();
  const lastDot = str.lastIndexOf('.');
  const lastComma = str.lastIndexOf(',');
  if (lastComma > lastDot) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    str = str.replace(/,/g, '');
  }
  return parseFloat(str) || 0;
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 0. Validate Secret Token ────────────────────────────────────
    if (!WEBHOOK_SECRET) {
      console.error('WEBHOOK_SECRET env var is not set. Rejecting all requests.');
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration: webhook secret not set.' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 500 }
      );
    }

    const url = new URL(req.url);
    const secret = url.searchParams.get('secret');

    if (!secret || secret !== WEBHOOK_SECRET) {
      console.warn('Webhook rejected: invalid or missing secret token.');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: invalid secret token.' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    console.log("Webhook received payload:", JSON.stringify(payload).substring(0, 500));

    const orderData = payload.order || payload.data || payload;

    // The Dashboard passes the string slug (e.g. ?account=loja-alpha)
    const accountSlug = url.searchParams.get("account") || url.searchParams.get("account_id") || payload.account_id || 'loja-alpha';

    // 1. Resolve Account UUID from the slug
    const { data: accountData, error: accountError } = await supabase
        .from('accounts')
        .select('id')
        .eq('slug', accountSlug)
        .single();
        
    if (accountError || !accountData) {
        throw new Error(`Account UUID not found for slug: ${accountSlug}`);
    }
    const accountId = accountData.id;

    // 2. Parse Order ID
    const orderId = orderData.id || orderData.ID || orderData.id_pedido;
    if (!orderId) {
       console.log("No order ID found in payload, ignoring.");
       return new Response(JSON.stringify({ error: "Missing order ID" }), { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 400 });
    }

    // 3. Map order to database schema (using 'amount' and 'external_order_id')
    const newOrder = {
      account_id: accountId,
      external_order_id: String(orderId),
      created_at: orderData.created_at || orderData.data || new Date().toISOString(),
      amount: parseCurrency(orderData.total || orderData.valor_total || '0'),
      customer_name: orderData.customer?.name || orderData.cliente?.nome || orderData.customer_name || 'Desconhecido',
      payment_status: (orderData.payment_status || orderData.status_pagamento || orderData.status || 'approved').toLowerCase(),
      status: (orderData.status || orderData.status_pedido || 'created').toLowerCase(),
      items: orderData.items || orderData.produtos || []
    };

    // 4. Safely Upsert
    const { error } = await supabase.from('orders').upsert(newOrder, { onConflict: 'account_id, external_order_id' });

    if (error) throw error;

    console.log(`Order ${orderId} processed successfully for account ${accountSlug}.`);

    return new Response(
      JSON.stringify({ success: true, message: `Order ${orderId} processed.` }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 200 }
    );

  } catch (error: any) {
    console.error("Webhook processing error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 500,
    });
  }
});
