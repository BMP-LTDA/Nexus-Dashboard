import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// ── CORS: Usa env var ALLOWED_ORIGINS ou fallback '*' em dev ────────
const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS') || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ----- OAuth helper -----

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`OAuth error: ${data.error} - ${data.error_description}`);
  }
  return data.access_token;
}

// ----- GA4 Data API -----

async function runReport(accessToken: string, propertyId: string, body: object): Promise<any> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`GA4 API error (${response.status}): ${err}`);
  }
  return response.json();
}

function getDateRange(period: string): { startDate: string; endDate: string } {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = today.getMonth(); // 0-indexed

  switch (period) {
    case 'today': return { startDate: 'today', endDate: 'today' };
    case '7d':    return { startDate: '7daysAgo', endDate: 'today' };
    case '30d':   return { startDate: '30daysAgo', endDate: 'today' };
    case '90d':   return { startDate: '90daysAgo', endDate: 'today' };
    case 'year':  return { startDate: '365daysAgo', endDate: 'today' };
    case 'month': {
      // First day of current month → today
      const firstDay = `${yyyy}-${String(mm + 1).padStart(2, '0')}-01`;
      return { startDate: firstDay, endDate: 'today' };
    }
    case 'prev-month': {
      // First and last day of previous month
      const prevMonth = mm === 0 ? 11 : mm - 1;
      const prevYear = mm === 0 ? yyyy - 1 : yyyy;
      const firstDay = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
      const endDay = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { startDate: firstDay, endDate: endDay };
    }
    default:      return { startDate: '30daysAgo', endDate: 'today' };
  }
}

// Channel mapping
const channelMap: Record<string, { name: string; color: string }> = {
  'Paid Social':    { name: 'Meta Ads',    color: '#6366F1' },
  'Paid Search':    { name: 'Google Ads',  color: '#3B82F6' },
  'Organic Search': { name: 'Orgânico',    color: '#10B981' },
  'Direct':         { name: 'Direto',      color: '#F59E0B' },
  'Email':          { name: 'Email',       color: '#06B6D4' },
  'Organic Social': { name: 'Social',      color: '#EC4899' },
  'Referral':       { name: 'Referral',    color: '#8B5CF6' },
  'Display':        { name: 'Display',     color: '#EF4444' },
  'Organic Video':  { name: 'Vídeo',       color: '#F97316' },
  'Unassigned':     { name: 'Outros',      color: '#64748B' },
};

function mapChannel(gaChannel: string): { name: string; color: string } {
  return channelMap[gaChannel] || { name: gaChannel, color: '#64748B' };
}

function extractMetricValue(row: any, index: number): number {
  return parseInt(row.metricValues?.[index]?.value || '0', 10);
}

function extractMetricFloat(row: any, index: number): number {
  return parseFloat(row.metricValues?.[index]?.value || '0');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { propertyId, period } = await req.json()

    if (!propertyId) {
      return new Response(JSON.stringify({ error: 'Property ID is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Get credentials from secrets
    const clientId = Deno.env.get('GCP_CLIENT_ID');
    const clientSecret = Deno.env.get('GCP_CLIENT_SECRET');
    const refreshToken = Deno.env.get('GCP_REFRESH_TOKEN');

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('GCP OAuth credentials not configured. Set GCP_CLIENT_ID, GCP_CLIENT_SECRET and GCP_REFRESH_TOKEN.');
    }

    // Get access token via Refresh Flow
    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
    const dateRange = getDateRange(period || '30d');

    // Run 3 reports in parallel
    const [totalsReport, dailyReport, sourcesReport] = await Promise.all([
      // Report 1: Totals + ecommerce funnel metrics
      runReport(accessToken, propertyId, {
        dateRanges: [dateRange],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'newUsers' },
          { name: 'screenPageViews' },
          { name: 'addToCarts' },
          { name: 'checkouts' },
          { name: 'ecommercePurchases' },
        ],
      }),
      // Report 2: Daily breakdown
      runReport(accessToken, propertyId, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
        ],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }),
      // Report 3: Traffic sources
      runReport(accessToken, propertyId, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'bounceRate' },
        ],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),
    ]);

    // --- Parse Totals ---
    const totalsRow = totalsReport.rows?.[0];
    const totalSessions = extractMetricValue(totalsRow, 0);
    const totalUsers = extractMetricValue(totalsRow, 1);
    const newUsers = extractMetricValue(totalsRow, 2);
    const pageViews = extractMetricValue(totalsRow, 3);
    const addToCarts = extractMetricValue(totalsRow, 4);
    const checkoutsCount = extractMetricValue(totalsRow, 5);
    const purchases = extractMetricValue(totalsRow, 6);

    // --- Parse Daily ---
    const daily = (dailyReport.rows || []).map((row: any) => {
      const rawDate = row.dimensionValues?.[0]?.value || '';
      const day = rawDate.substring(6, 8);
      const month = rawDate.substring(4, 6);
      const label = `${day}/${month}`;
      return {
        date: label,
        sessoes: extractMetricValue(row, 0),
        usuarios: extractMetricValue(row, 1),
      };
    });

    // --- Parse Sources ---
    const sources = (sourcesReport.rows || []).map((row: any) => {
      const gaChannel = row.dimensionValues?.[0]?.value || 'Unknown';
      const mapped = mapChannel(gaChannel);
      const sessions = extractMetricValue(row, 0);
      const users = extractMetricValue(row, 1);
      const bounceRate = extractMetricFloat(row, 2);
      return {
        source: mapped.name,
        sessions,
        users,
        bounce: `${(bounceRate * 100).toFixed(1)}%`,
        color: mapped.color,
      };
    });

    // --- Build Funnel ---
    const viewItems = Math.max(pageViews, Math.floor(totalSessions * 0.55));
    const funnel = [
      { stage: 'Sessões',           value: totalSessions, pct: 100, color: '#6366F1' },
      { stage: 'Visualiz. Produto', value: viewItems,     pct: totalSessions > 0 ? parseFloat(((viewItems / totalSessions) * 100).toFixed(1)) : 0, color: '#8B5CF6' },
      { stage: 'Add ao Carrinho',   value: addToCarts,    pct: totalSessions > 0 ? parseFloat(((addToCarts / totalSessions) * 100).toFixed(1)) : 0, color: '#A78BFA' },
      { stage: 'Início Checkout',   value: checkoutsCount,pct: totalSessions > 0 ? parseFloat(((checkoutsCount / totalSessions) * 100).toFixed(1)) : 0, color: '#C4B5FD' },
      { stage: 'Compra Realizada',  value: purchases,     pct: totalSessions > 0 ? parseFloat(((purchases / totalSessions) * 100).toFixed(1)) : 0, color: '#10B981' },
    ];

    const gaData = {
      totals: { sessions: totalSessions, users: totalUsers, newCust: newUsers },
      sources,
      daily,
      funnel,
    };

    return new Response(JSON.stringify(gaData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('[ga4-proxy] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
