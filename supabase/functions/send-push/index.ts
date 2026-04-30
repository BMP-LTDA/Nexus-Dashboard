// @ts-nocheck — Deno runtime
// Envia push notifications via Expo Push API
// Chamado internamente por outros Edge Functions (push-alerts-cron, bagy-webhook)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
}

async function sendToExpo(tokens: string[], msg: PushMessage) {
  const messages = tokens.map(to => ({
    to,
    title: msg.title,
    body: msg.body,
    data: msg.data || {},
    badge: msg.badge ?? 1,
    sound: "default",
    channelId: "nexus-alerts",
  }));

  // Expo aceita até 100 por request — batch se necessário
  const chunks: typeof messages[] = [];
  for (let i = 0; i < messages.length; i += 100) chunks.push(messages.slice(i, i + 100));

  const results = [];
  for (const chunk of chunks) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(chunk),
    });
    const json = await res.json();
    results.push(...(json.data || []));
  }
  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { user_ids, tokens: directTokens, title, body, data } = await req.json();

    let tokens: string[] = directTokens || [];

    // Se user_ids fornecidos, busca tokens desses usuários
    if (user_ids?.length > 0 && tokens.length === 0) {
      const { data: rows } = await supabase
        .from("push_tokens")
        .select("token")
        .in("user_id", user_ids);
      tokens = (rows || []).map((r: any) => r.token);
    }

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, msg: "Sem tokens" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await sendToExpo(tokens, { title, body, data });
    const sent = results.filter((r: any) => r.status === "ok").length;

    console.log(`[send-push] ${sent}/${tokens.length} enviados`);
    return new Response(JSON.stringify({ ok: true, sent, total: tokens.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[send-push]", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
