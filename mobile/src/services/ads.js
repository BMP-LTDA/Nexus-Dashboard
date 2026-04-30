import { supabase } from '../lib/supabase';
import { getPeriodDateRanges } from '../lib/dateUtils';

export const adsService = {
  async getAdMetrics(accountSlug, period) {
    try {
      const { data: account } = await supabase.from('accounts').select('id').eq('slug', accountSlug).single();
      if (!account?.id) return null;

      const { current, prior } = getPeriodDateRanges(period);
      const cs = current.start.toISOString().split('T')[0];
      const ce = current.end.toISOString().split('T')[0];
      const ps = prior.start.toISOString().split('T')[0];
      const pe = prior.end.toISOString().split('T')[0];

      const { data } = await supabase
        .from('daily_ad_spend')
        .select('*')
        .eq('account_id', account.id)
        .gte('date', ps)
        .lte('date', ce);

      const records = data || [];
      let spend = 0, impr = 0, clicks = 0;
      let pSpend = 0, pImpr = 0, pClicks = 0;
      const platformMap = {}, currentRecords = [];

      records.forEach(r => {
        if (r.date >= cs && r.date <= ce) {
          currentRecords.push(r);
          spend += Number(r.spend || 0);
          impr  += Number(r.impressions || 0);
          clicks += Number(r.clicks || 0);
          if (!platformMap[r.platform]) platformMap[r.platform] = { spend: 0, impressions: 0, clicks: 0, name: r.platform };
          platformMap[r.platform].spend += Number(r.spend || 0);
          platformMap[r.platform].impressions += Number(r.impressions || 0);
          platformMap[r.platform].clicks += Number(r.clicks || 0);
        } else if (r.date >= ps && r.date <= pe) {
          pSpend += Number(r.spend || 0); pImpr += Number(r.impressions || 0); pClicks += Number(r.clicks || 0);
        }
      });

      const ctr = impr > 0 ? (clicks / impr) * 100 : 0;
      const cpc = clicks > 0 ? spend / clicks : 0;
      const pCtr = pImpr > 0 ? (pClicks / pImpr) * 100 : 0;
      const pCpc = pClicks > 0 ? pSpend / pClicks : 0;

      const delta = (c, p) => p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100;

      const platforms = Object.values(platformMap).map(p => ({
        platform: p.name,
        spend: p.spend,
        impressions: p.impressions,
        clicks: p.clicks,
        ctr: p.impressions > 0 ? `${((p.clicks / p.impressions) * 100).toFixed(2)}%` : '0%',
        color: p.name.includes('Meta') ? '#6366F1' : p.name.includes('Google') ? '#3B82F6' : '#EC4899',
      }));

      const fmtBRL = v => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

      return {
        kpis: {
          totalSpend: fmtBRL(spend),
          impressions: impr.toLocaleString('pt-BR'),
          clicks: clicks.toLocaleString('pt-BR'),
          avgCpc: fmtBRL(cpc),
          ctr: `${ctr.toFixed(2)}%`,
        },
        deltas: {
          totalSpend:  { value: delta(spend, pSpend)   },
          impressions: { value: delta(impr, pImpr)     },
          clicks:      { value: delta(clicks, pClicks) },
          avgCpc:      { value: delta(cpc, pCpc)       },
          ctr:         { value: delta(ctr, pCtr)       },
        },
        rawTotals: { spend, impressions: impr, clicks },
        platforms,
        records: currentRecords,
      };
    } catch (e) { console.error('[ads] getAdMetrics:', e); return null; }
  },
};
