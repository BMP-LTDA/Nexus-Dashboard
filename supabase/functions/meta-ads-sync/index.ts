// @ts-nocheck — Deno runtime (Supabase Edge Functions)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function fetchMetaInsights(adAccountId: string, token: string, datePreset: string) {
  const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const fields = "spend,impressions,clicks,date_start";
  const url = `https://graph.facebook.com/v21.0/${accountId}/insights?fields=${fields}&time_increment=1&date_preset=${datePreset}&access_token=${token}&limit=365`;

  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(`Meta API: ${json.error.message}`);

  // Paginate through all results
  let rows = json.data || [];
  let next = json.paging?.next;
  while (next) {
    const page = await (await fetch(next)).json();
    rows = [...rows, ...(page.data || [])];
    next = page.paging?.next;
  }
  return rows;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");
    if (!META_ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: "META_ACCESS_TOKEN não configurado." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth check — manual syncs exigem JWT do usuário
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401,
      });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401,
      });
    }

    const { accountSlug, datePreset = "last_30d" } = await req.json();
    if (!accountSlug) {
      return new Response(JSON.stringify({ error: "accountSlug é obrigatório" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }

    const { data: account, error: accError } = await supabase
      .from("accounts")
      .select("id, meta_ad_account_id, owner_id")
      .eq("slug", accountSlug)
      .single();

    if (accError || !account) {
      return new Response(JSON.stringify({ error: "Conta não encontrada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404,
      });
    }
    if (account.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403,
      });
    }
    if (!account.meta_ad_account_id) {
      return new Response(JSON.stringify({ error: "meta_ad_account_id não configurado." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }

    const insights = await fetchMetaInsights(account.meta_ad_account_id, META_ACCESS_TOKEN, datePreset);

    // Batch upsert — muito mais eficiente que select+update por linha
    const rows = insights.map((row: any) => ({
      account_id: account.id,
      date: row.date_start,
      platform: "Meta Ads",
      spend: parseFloat(row.spend || "0"),
      impressions: parseInt(row.impressions || "0", 10),
      clicks: parseInt(row.clicks || "0", 10),
    }));

    const { error: upsertError } = await supabase
      .from("daily_ad_spend")
      .upsert(rows, { onConflict: "account_id, date, platform" });

    if (upsertError) throw upsertError;

    return new Response(JSON.stringify({
      success: true,
      message: `Sincronização concluída! ${rows.length} registros processados.`,
      synced: rows.length,
      period: datePreset,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[meta-ads-sync]", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
