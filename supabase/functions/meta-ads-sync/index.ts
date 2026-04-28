import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN');
    if (!META_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'META_ACCESS_TOKEN não configurado.' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 500 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 401
      });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 401
      });
    }

    const body = await req.json();
    const { accountSlug, datePreset = 'last_30d' } = body;

    if (!accountSlug) {
      return new Response(JSON.stringify({ error: 'accountSlug é obrigatório' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400
      });
    }

    const { data: account, error: accError } = await supabase
      .from('accounts')
      .select('id, meta_ad_account_id, owner_id')
      .eq('slug', accountSlug)
      .single();

    if (accError || !account) {
      return new Response(JSON.stringify({ error: 'Conta não encontrada' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 404
      });
    }

    if (account.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Sem permissão' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 403
      });
    }

    if (!account.meta_ad_account_id) {
      return new Response(JSON.stringify({ error: 'meta_ad_account_id não configurado.' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400
      });
    }

    const adAccountId = account.meta_ad_account_id.startsWith('act_')
      ? account.meta_ad_account_id
      : `act_${account.meta_ad_account_id}`;

    const fields = 'spend,impressions,clicks';
    const apiVersion = 'v21.0';
    const metaUrl = `https://graph.facebook.com/${apiVersion}/${adAccountId}/insights?fields=${fields}&time_increment=1&date_preset=${datePreset}&access_token=${META_ACCESS_TOKEN}&limit=100`;

    const metaResponse = await fetch(metaUrl);
    const metaData = await metaResponse.json();

    if (metaData.error) {
      return new Response(JSON.stringify({
        error: `Meta API: ${metaData.error.message}`,
        type: metaData.error.type,
        code: metaData.error.code
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400
      });
    }

    const insights = metaData.data || [];
    let synced = 0, errors = 0;

    for (const row of insights) {
      const date = row.date_start;
      const spend = parseFloat(row.spend || '0');
      const impressions = parseInt(row.impressions || '0', 10);
      const clicks = parseInt(row.clicks || '0', 10);

      const { data: existing } = await supabase
        .from('daily_ad_spend')
        .select('id')
        .eq('account_id', account.id)
        .eq('date', date)
        .eq('platform', 'Meta Ads')
        .maybeSingle();

      if (existing) {
        const { error: upErr } = await supabase
          .from('daily_ad_spend')
          .update({ spend, impressions, clicks })
          .eq('id', existing.id);
        if (upErr) errors++; else synced++;
      } else {
        const { error: insErr } = await supabase
          .from('daily_ad_spend')
          .insert({ account_id: account.id, date, platform: 'Meta Ads', spend, impressions, clicks });
        if (insErr) errors++; else synced++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Sincronização concluída! ${synced} registros processados.`,
      synced, errors, period: datePreset, adAccount: adAccountId
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (err) {
    console.error('[meta-ads-sync] Error:', err);
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 500
    });
  }
});
