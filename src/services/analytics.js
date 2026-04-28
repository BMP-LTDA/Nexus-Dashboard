import { supabase } from '../lib/supabase';

/**
 * Service to interact with Google Analytics 4 via Supabase Edge Functions
 */
export const analyticsService = {
  /**
   * Fetches core metrics (sessions, users, conversion rate) for a given account and period
   */
  async getMetrics(accountSlug, period) {
    try {
      // 1. Get the account's GA Property ID
      const { data: account, error: accError } = await supabase
        .from('accounts')
        .select('ga_property_id')
        .eq('slug', accountSlug)
        .single();

      if (accError || !account?.ga_property_id) {
        console.warn(`[AnalyticsService] No GA Property ID found for account: ${accountSlug}`);
        return null;
      }

      // 2. Call the Supabase Edge Function (Proxy)
      const { data, error: functionError } = await supabase.functions.invoke('ga4-proxy', {
        body: { 
          propertyId: account.ga_property_id,
          period: period 
        }
      });

      if (functionError) throw functionError;

      // Format data for the UI
      return {
        kpis: {
          sessions: Number(data.totals.sessions).toLocaleString('pt-BR'),
          users: Number(data.totals.users).toLocaleString('pt-BR'),
          newCust: Number(data.totals.newCust).toLocaleString('pt-BR'),
        },
        sessionsChart: data.daily,
        trafficSources: data.sources,
        funnelData: data.funnel
      };
    } catch (err) {
      console.error('[AnalyticsService] Error fetching GA metrics:', err);
      return null;
    }
  }
};
