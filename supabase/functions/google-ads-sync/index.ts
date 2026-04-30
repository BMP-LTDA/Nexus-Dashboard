// @ts-nocheck — Deno runtime (Supabase Edge Functions)
// Google Ads API v18 — sincroniza gasto diário por conta
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function getGoogleAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     Deno.env.get("GCP_CLIENT_ID")!,
      client_secret: Deno.env.get("GCP_CLIENT_SECRET")!,
      refresh_token: Deno.env.get("GCP_REFRESH_TOKEN")!,
      grant_type:    "refresh_token",
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`OAuth: ${json.error} — ${json.error_description}`);
  return json.access_token;
}

function getDateRange(datePreset: string): { start: string; end: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const sub = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - days);
    return d;
  };

  switch (datePreset) {
    case "last_7d":   return { start: fmt(sub(7)),   end: fmt(sub(1)) };
    case "last_30d":  return { start: fmt(sub(30)),  end: fmt(sub(1)) };
    case "last_90d":  return { start: fmt(sub(90)),  end: fmt(sub(1)) };
    default:          return { start: fmt(sub(30)),  end: fmt(sub(1)) };
  }
}

async function fetchGoogleAdsInsights(
  customerId: string,
  accessToken: string,
  developerToken: string,
  datePreset: string
) {
  const { start, end } = getDateRange(datePreset);

  // Remove hifens do customer ID (Google Ads aceita com ou sem)
  const cleanCustomerId = customerId.replace(/-/g, "");

  const query = `
    SELECT
      segments.date,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions
    FROM campaign
    WHERE segments.date BETWEEN '${start}' AND '${end}'
      AND campaign.status != 'REMOVED'
  `;

  const res = await fetch(
    `https://googleads.googleapis.com/v18/customers/${cleanCustomerId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        "Authorization":       `Bearer ${accessToken}`,
        "developer-token":     developerToken,
        "Content-Type":        "application/json",
        // login-customer-id necessário apenas se usar conta gerenciadora (MCC)
        ...(Deno.env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID")
          ? { "login-customer-id": Deno.env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID") }
          : {}),
      },
      body: JSON.stringify({ query }),
    }
  );

  const json = await res.json();
  if (!res.ok) {
    const msg = json.error?.message || JSON.stringify(json);
    throw new Error(`Google Ads API: ${msg}`);
  }

  // Agrupa por data (pode haver múltiplas campanhas por dia)
  const dailyMap: Record<string, { spend: number; clicks: number; impressions: number }> = {};

  for (const row of json.results || []) {
    const date  = row.segments?.date;
    const spend = (parseInt(row.metrics?.costMicros || "0", 10)) / 1_000_000; // micros → BRL
    const clicks = parseInt(row.metrics?.clicks || "0", 10);
    const impr  = parseInt(row.metrics?.impressions || "0", 10);

    if (!date) continue;
    if (!dailyMap[date]) dailyMap[date] = { spend: 0, clicks: 0, impressions: 0 };
    dailyMap[date].spend       += spend;
    dailyMap[date].clicks      += clicks;
    dailyMap[date].impressions += impr;
  }

  return Object.entries(dailyMap).map(([date, m]) => ({ date, ...m }));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const DEVELOPER_TOKEN = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN");
    if (!DEVELOPER_TOKEN) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_ADS_DEVELOPER_TOKEN não configurado. Acesse developers.google.com/google-ads/api/docs/get-started/introduction" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401,
      });
    }
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) {
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

    const { data: account } = await supabase
      .from("accounts")
      .select("id, google_ads_customer_id, owner_id")
      .eq("slug", accountSlug)
      .single();

    if (!account) {
      return new Response(JSON.stringify({ error: "Conta não encontrada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404,
      });
    }
    if (account.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403,
      });
    }
    if (!account.google_ads_customer_id) {
      return new Response(JSON.stringify({ error: "google_ads_customer_id não configurado." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }

    const accessToken = await getGoogleAccessToken();
    const insights = await fetchGoogleAdsInsights(
      account.google_ads_customer_id,
      accessToken,
      DEVELOPER_TOKEN,
      datePreset
    );

    const rows = insights.map(r => ({
      account_id:  account.id,
      date:        r.date,
      platform:    "Google Ads",
      spend:       r.spend,
      impressions: r.impressions,
      clicks:      r.clicks,
    }));

    if (rows.length > 0) {
      const { error: upsertErr } = await supabase
        .from("daily_ad_spend")
        .upsert(rows, { onConflict: "account_id, date, platform" });
      if (upsertErr) throw upsertErr;
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Google Ads sincronizado! ${rows.length} dias processados.`,
      synced: rows.length,
      period: datePreset,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[google-ads-sync]", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
