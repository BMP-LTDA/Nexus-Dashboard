import { supabase } from '../lib/supabase';
import { getPeriodDateRanges } from '../lib/dateUtils';

export const adsService = {
  /**
   * Fetches ad spend data for a given account and period, including previous period for deltas
   */
  async getAdMetrics(accountSlug, period) {
    try {
      // 1. Get the account ID
      const { data: account, error: accError } = await supabase
        .from('accounts')
        .select('id')
        .eq('slug', accountSlug)
        .single();

      if (accError || !account?.id) {
        return null;
      }

      const { current, prior } = getPeriodDateRanges(period);
      const currentStartStr = current.start.toISOString().split('T')[0];
      const currentEndStr = current.end.toISOString().split('T')[0];
      const priorStartStr = prior.start.toISOString().split('T')[0];
      const priorEndStr = prior.end.toISOString().split('T')[0];

      // 2. Fetch ad spend from Supabase for current AND previous period
      const { data, error } = await supabase
        .from('daily_ad_spend')
        .select('*')
        .eq('account_id', account.id)
        .gte('date', priorStartStr)
        .lte('date', currentEndStr);

      if (error) throw error;

      const records = data || [];
      
      let totalSpend = 0;
      let totalImpressions = 0;
      let totalClicks = 0;

      let prevSpend = 0;
      let prevImpressions = 0;
      let prevClicks = 0;
      
      const platformMap = {};
      const currentRecords = [];
      
      records.forEach(row => {
        const rowDate = row.date;
        if (rowDate >= currentStartStr && rowDate <= currentEndStr) {
          // Current period
          currentRecords.push(row);
          totalSpend += Number(row.spend || 0);
          totalImpressions += Number(row.impressions || 0);
          totalClicks += Number(row.clicks || 0);
          
          if (!platformMap[row.platform]) {
            platformMap[row.platform] = { spend: 0, impressions: 0, clicks: 0, name: row.platform };
          }
          platformMap[row.platform].spend += Number(row.spend || 0);
          platformMap[row.platform].impressions += Number(row.impressions || 0);
          platformMap[row.platform].clicks += Number(row.clicks || 0);
        } else if (rowDate >= priorStartStr && rowDate <= priorEndStr) {
          // Previous period
          prevSpend += Number(row.spend || 0);
          prevImpressions += Number(row.impressions || 0);
          prevClicks += Number(row.clicks || 0);
        }
      });

      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const cpc = totalClicks > 0 ? (totalSpend / totalClicks) : 0;

      const prevCtr = prevImpressions > 0 ? (prevClicks / prevImpressions) * 100 : 0;
      const prevCpc = prevClicks > 0 ? (prevSpend / prevClicks) : 0;

      const calcDelta = (curr, prev) => {
        if (prev === 0) return curr > 0 ? 100 : 0;
        return ((curr - prev) / prev) * 100;
      };

      const deltas = {
        spend: calcDelta(totalSpend, prevSpend),
        impressions: calcDelta(totalImpressions, prevImpressions),
        clicks: calcDelta(totalClicks, prevClicks),
        cpc: calcDelta(cpc, prevCpc), // negative delta is good for cpc
        ctr: calcDelta(ctr, prevCtr)
      };

      const formatDelta = (val, invertColors = false) => {
        const isPositive = val > 0;
        const color = isPositive 
          ? (invertColors ? '#EF4444' : '#10B981') 
          : (val < 0 ? (invertColors ? '#10B981' : '#EF4444') : '#6B7280');
        const sign = isPositive ? '+' : '';
        return { text: `${sign}${val.toFixed(1)}%`, color, value: val };
      };

      const platforms = Object.values(platformMap).map(p => ({
        platform: p.name,
        spend: p.spend,
        impressions: p.impressions,
        clicks: p.clicks,
        ctr: p.impressions > 0 ? ((p.clicks / p.impressions) * 100).toFixed(2) + '%' : '0%',
        color: p.name.includes('Meta') ? '#6366F1' : (p.name.includes('Google') ? '#3B82F6' : '#EC4899')
      }));

      return {
        kpis: {
          totalSpend: `R$ ${totalSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          impressions: totalImpressions.toLocaleString('pt-BR'),
          clicks: totalClicks.toLocaleString('pt-BR'),
          avgCpc: `R$ ${cpc.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          ctr: `${ctr.toFixed(2)}%`,
        },
        deltas: {
          totalSpend: formatDelta(deltas.spend),
          impressions: formatDelta(deltas.impressions),
          clicks: formatDelta(deltas.clicks),
          avgCpc: formatDelta(deltas.cpc, true), // for cpc, up is red, down is green
          ctr: formatDelta(deltas.ctr)
        },
        rawTotals: {
          spend: totalSpend,
          impressions: totalImpressions,
          clicks: totalClicks,
        },
        platforms,
        records: currentRecords
      };

    } catch (err) {
      console.error('[AdsService] Error fetching ad metrics:', err);
      return null;
    }
  }
};
