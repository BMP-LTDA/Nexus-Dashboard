// @ts-nocheck — Deno runtime (Supabase Edge Functions)
// Chamado automaticamente pelo pg_cron — NÃO requer JWT de usuário.
// Sincroniza Meta Ads para TODAS as contas configuradas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

async function fetchMetaInsights(adAccountId: string, token: string, datePreset: string) {
  const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const fields = "spend,impressions,clicks,date_start";
  const url = `https://graph.facebook.com/v21.0/${accountId}/insights?fields=${fields}&time_increment=1&date_preset=${datePreset}&access_token=${token}&limit=365`;

  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(`Meta API (${accountId}): ${json.error.message}`);

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
  // Aceita chamada do pg_cron (sem auth) ou manual com service role key
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization") || "";

  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isServiceRole = authHeader === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;

  if (!isCron && !isServiceRole) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      headers: { "Content-Type": "application/json" }, status: 401,
    });
  }

  const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");
  if (!META_ACCESS_TOKEN) {
    return new Response(JSON.stringify({ error: "META_ACCESS_TOKEN não configurado." }), {
      headers: { "Content-Type": "application/json" }, status: 500,
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const datePreset = body.datePreset || "last_30d";

  // Busca todas as contas com Meta Ads configurado
  const { data: accounts, error: accErr } = await supabase
    .from("accounts")
    .select("id, slug, meta_ad_account_id")
    .not("meta_ad_account_id", "is", null);

  if (accErr) {
    return new Response(JSON.stringify({ error: accErr.message }), {
      headers: { "Content-Type": "application/json" }, status: 500,
    });
  }

  const results: any[] = [];

  for (const account of accounts || []) {
    try {
      const insights = await fetchMetaInsights(account.meta_ad_account_id, META_ACCESS_TOKEN, datePreset);

      const rows = insights.map((row: any) => ({
        account_id: account.id,
        date: row.date_start,
        platform: "Meta Ads",
        spend: parseFloat(row.spend || "0"),
        impressions: parseInt(row.impressions || "0", 10),
        clicks: parseInt(row.clicks || "0", 10),
      }));

      if (rows.length > 0) {
        const { error } = await supabase
          .from("daily_ad_spend")
          .upsert(rows, { onConflict: "account_id, date, platform" });
        if (error) throw error;
      }

      results.push({ slug: account.slug, synced: rows.length, ok: true });
    } catch (err: any) {
      console.error(`[meta-ads-sync-auto] Conta ${account.slug}:`, err.message);
      results.push({ slug: account.slug, ok: false, error: err.message });
    }
  }

  const totalSynced = results.filter(r => r.ok).reduce((s, r) => s + r.synced, 0);
  console.log(`[meta-ads-sync-auto] Concluído. ${results.length} contas, ${totalSynced} registros.`);

  return new Response(JSON.stringify({
    success: true,
    accounts: results.length,
    totalSynced,
    results,
    runAt: new Date().toISOString(),
  }), { headers: { "Content-Type": "application/json" } });
});
