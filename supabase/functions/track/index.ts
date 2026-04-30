// @ts-nocheck — Deno runtime (Supabase Edge Functions)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

// Pixel é chamado cross-origin desde a loja — CORS aberto intencionalmente
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VALID_EVENTS = new Set([
  "page_view",
  "add_to_cart",
  "remove_from_cart",
  "begin_checkout",
  "purchase",
  "search",
  "view_item",
]);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { account, event, session_id, page, referrer, metadata } = body;

    // Validação mínima — não expor erros detalhados (surface pública)
    if (!account || !event || !session_id) {
      return new Response(JSON.stringify({ error: "Bad request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!VALID_EVENTS.has(event)) {
      return new Response(JSON.stringify({ error: "Unknown event" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // session_id mínimo de 8 chars para evitar spam trivial
    if (session_id.length < 8 || session_id.length > 128) {
      return new Response(JSON.stringify({ error: "Invalid session_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve account_id pelo slug — valida que a conta existe
    const { data: accountData, error: accountError } = await supabase
      .from("accounts")
      .select("id")
      .eq("slug", String(account).slice(0, 64))
      .single();

    if (accountError || !accountData) {
      // Retorna 200 mesmo assim — não revelar quais slugs existem
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertError } = await supabase.from("events").insert({
      account_id: accountData.id,
      session_id: String(session_id).slice(0, 128),
      event,
      page: page ? String(page).slice(0, 512) : null,
      referrer: referrer ? String(referrer).slice(0, 512) : null,
      metadata: metadata && typeof metadata === "object" ? metadata : {},
    });

    if (insertError) {
      console.error("[track] Insert error:", insertError.message);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[track] Unexpected error:", err.message);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
