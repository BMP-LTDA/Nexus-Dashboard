// @ts-nocheck — Deno runtime
// Verifica KPIs de todas as contas e dispara alertas push via send-push
// Agendado via pg_cron: todo dia às 20:00 BRT (23:00 UTC)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sendPush(user_ids: string[], title: string, body: string, data = {}) {
  await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ user_ids, title, body, data }),
  });
}

Deno.serve(async (req: Request) => {
  // Aceita service role key como auth (chamado pelo cron)
  const auth = req.headers.get("Authorization") || "";
  if (auth !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Busca todas as contas com owner
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, slug, name, owner_id");

  if (!accounts?.length) {
    return new Response(JSON.stringify({ ok: true, msg: "Sem contas" }), { status: 200 });
  }

  const alertsSent: any[] = [];

  for (const account of accounts) {
    if (!account.owner_id) continue;
    const userId = account.owner_id;

    try {
      // ── 1. Receita do dia ──────────────────────────────────────────────
      const today = new Date().toISOString().split("T")[0];
      const { data: todayOrders } = await supabase
        .from("orders")
        .select("amount, status, payment_status")
        .eq("account_id", account.id)
        .gte("created_at", `${today}T00:00:00Z`)
        .lte("created_at", `${today}T23:59:59Z`);

      const BILLED = ["invoiced","shipped","faturado","enviado","entregue","concluído","concluido","completed","approved","paid"];
      const billedToday = (todayOrders || []).filter(o =>
        BILLED.includes((o.status || "").toLowerCase()) ||
        BILLED.includes((o.payment_status || "").toLowerCase())
      );
      const revenueToday = billedToday.reduce((s, o) => s + Number(o.amount || 0), 0);
      const ordersToday  = billedToday.length;

      // ── Alerta: Resumo Diário ──────────────────────────────────────────
      if (ordersToday > 0) {
        await sendPush(
          [userId],
          `📊 Resumo de hoje — ${account.name}`,
          `${ordersToday} pedidos · R$ ${revenueToday.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em receita`,
          { accountSlug: account.slug, screen: "receita" }
        );
        alertsSent.push({ account: account.slug, type: "daily_summary" });
      }

      // ── 2. ROAS (últimos 7 dias) ───────────────────────────────────────
      const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 7);
      const sevenAgoStr = sevenAgo.toISOString().split("T")[0];

      const { data: adSpend } = await supabase
        .from("daily_ad_spend")
        .select("spend")
        .eq("account_id", account.id)
        .gte("date", sevenAgoStr);

      const totalSpend = (adSpend || []).reduce((s, r) => s + Number(r.spend || 0), 0);

      if (totalSpend > 0) {
        const { data: weekOrders } = await supabase
          .from("orders")
          .select("amount, status, payment_status")
          .eq("account_id", account.id)
          .gte("created_at", `${sevenAgoStr}T00:00:00Z`);

        const weekRevenue = (weekOrders || [])
          .filter(o => BILLED.includes((o.status || "").toLowerCase()) || BILLED.includes((o.payment_status || "").toLowerCase()))
          .reduce((s, o) => s + Number(o.amount || 0), 0);

        const roas = totalSpend > 0 ? weekRevenue / totalSpend : 0;

        if (roas < 4 && roas > 0) {
          await sendPush(
            [userId],
            `⚠️ ROAS abaixo da meta — ${account.name}`,
            `ROAS dos últimos 7 dias: ${roas.toFixed(2)}x (meta: 4x) · Gasto: R$ ${totalSpend.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`,
            { accountSlug: account.slug, screen: "midia" }
          );
          alertsSent.push({ account: account.slug, type: "roas_drop", roas });
        }
      }

      // ── 3. Pico de cancelamentos ──────────────────────────────────────
      const CANCELED = ["canceled","cancelado","refunded","estornado","cancelled","rejected"];
      const allToday = todayOrders || [];
      const cancelCount = allToday.filter(o =>
        CANCELED.includes((o.status || "").toLowerCase()) ||
        CANCELED.includes((o.payment_status || "").toLowerCase())
      ).length;
      const cancelRate = allToday.length > 0 ? (cancelCount / allToday.length) * 100 : 0;

      if (cancelRate > 15 && allToday.length >= 5) {
        await sendPush(
          [userId],
          `🚨 Pico de cancelamentos — ${account.name}`,
          `${cancelCount} cancelamentos hoje (${cancelRate.toFixed(0)}% dos pedidos)`,
          { accountSlug: account.slug, screen: "receita" }
        );
        alertsSent.push({ account: account.slug, type: "cancel_spike", rate: cancelRate });
      }

    } catch (err: any) {
      console.error(`[push-alerts-cron] Conta ${account.slug}:`, err.message);
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    accounts: accounts.length,
    alertsSent: alertsSent.length,
    detail: alertsSent,
    runAt: new Date().toISOString(),
  }), { headers: { "Content-Type": "application/json" } });
});
