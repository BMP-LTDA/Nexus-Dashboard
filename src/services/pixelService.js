import { supabase } from '../lib/supabase';
import { getPeriodDateRanges } from '../lib/dateUtils';

export const pixelService = {
  async getFunnelMetrics(accountSlug, period, customRange = null) {
    try {
      const { data: account, error: accError } = await supabase
        .from('accounts')
        .select('id')
        .eq('slug', accountSlug)
        .single();

      if (accError || !account?.id) return null;

      const { current, prior } = getPeriodDateRanges(period, customRange);
      const currentStart = current.start.toISOString();
      const currentEnd   = current.end.toISOString();
      const priorStart   = prior.start.toISOString();
      const priorEnd     = prior.end.toISOString();

      // Fetch events for both periods in one query
      const { data: events, error } = await supabase
        .from('events')
        .select('session_id, event, created_at')
        .eq('account_id', account.id)
        .gte('created_at', priorStart)
        .lte('created_at', currentEnd);

      if (error) throw error;
      if (!events || events.length === 0) return null;

      const calcFunnel = (rows) => {
        const sessions    = new Set(rows.map(e => e.session_id));
        const cartSessions     = new Set(rows.filter(e => e.event === 'add_to_cart').map(e => e.session_id));
        const checkoutSessions = new Set(rows.filter(e => e.event === 'begin_checkout').map(e => e.session_id));
        const purchaseSessions = new Set(rows.filter(e => e.event === 'purchase').map(e => e.session_id));

        const s = sessions.size;
        const c = cartSessions.size;
        const ch = checkoutSessions.size;
        const p = purchaseSessions.size;

        return {
          sessions: s,
          cartSessions: c,
          checkoutSessions: ch,
          purchaseSessions: p,
          conversionRate:  s  > 0 ? (p  / s)  * 100 : 0,
          addToCartRate:   s  > 0 ? (c  / s)  * 100 : 0,
          checkoutRate:    c  > 0 ? (ch / c)  * 100 : 0,
          purchaseRate:    ch > 0 ? (p  / ch) * 100 : 0,
        };
      };

      const currentEvents = events.filter(e => e.created_at >= currentStart && e.created_at <= currentEnd);
      const priorEvents   = events.filter(e => e.created_at >= priorStart   && e.created_at <= priorEnd);

      const curr = calcFunnel(currentEvents);
      const prev = calcFunnel(priorEvents);

      const delta = (c, p) => p > 0 ? ((c - p) / p) * 100 : (c > 0 ? 100 : 0);

      const fmt1 = (v) => v.toFixed(1).replace('.', ',') + '%';
      const fmt2 = (v) => v.toFixed(2).replace('.', ',') + '%';

      return {
        // KPIs formatados
        conversionRate:     fmt2(curr.conversionRate),
        conversionChange:   delta(curr.conversionRate, prev.conversionRate),
        addToCartRate:      fmt1(curr.addToCartRate),
        addToCartChange:    delta(curr.addToCartRate, prev.addToCartRate),
        checkoutRate:       fmt1(curr.checkoutRate),
        checkoutChange:     delta(curr.checkoutRate, prev.checkoutRate),
        purchaseRate:       fmt1(curr.purchaseRate),
        purchaseChange:     delta(curr.purchaseRate, prev.purchaseRate),

        // Dados brutos para gráficos
        sessions: curr.sessions,
        sessionsChange: delta(curr.sessions, prev.sessions),

        // Funil em formato de array para o gráfico
        funnelData: [
          { stage: 'Sessões',         value: curr.sessions,          pct: 100,                                     color: '#6366F1' },
          { stage: 'Add to Cart',     value: curr.cartSessions,      pct: parseFloat(curr.addToCartRate.toFixed(1)),  color: '#3B82F6' },
          { stage: 'Checkout',        value: curr.checkoutSessions,  pct: parseFloat(curr.checkoutRate.toFixed(1)),   color: '#F59E0B' },
          { stage: 'Compra',          value: curr.purchaseSessions,  pct: parseFloat(curr.conversionRate.toFixed(2)), color: '#10B981' },
        ],

        // Para o gráfico comparativo de período
        comparison: [
          { stage: 'Conversão Geral', atual: parseFloat(curr.conversionRate.toFixed(2)), anterior: parseFloat(prev.conversionRate.toFixed(2)) },
          { stage: 'Add-to-Cart',     atual: parseFloat(curr.addToCartRate.toFixed(1)),  anterior: parseFloat(prev.addToCartRate.toFixed(1)) },
          { stage: 'Checkout Rate',   atual: parseFloat(curr.checkoutRate.toFixed(1)),   anterior: parseFloat(prev.checkoutRate.toFixed(1)) },
          { stage: 'Purchase Rate',   atual: parseFloat(curr.purchaseRate.toFixed(1)),   anterior: parseFloat(prev.purchaseRate.toFixed(1)) },
        ],

        // Para análise de abandono
        abandonment: [
          {
            from: 'Sessão → Carrinho',
            lost: curr.sessions - curr.cartSessions,
            pct: parseFloat((100 - curr.addToCartRate).toFixed(1)),
            color: '#EF4444',
            insight: 'Principal ponto de abandono — revisar CTAs e preços dos produtos'
          },
          {
            from: 'Carrinho → Checkout',
            lost: curr.cartSessions - curr.checkoutSessions,
            pct: parseFloat((100 - curr.checkoutRate).toFixed(1)),
            color: '#F59E0B',
            insight: 'Considerar simplificação do fluxo de carrinho'
          },
          {
            from: 'Checkout → Compra',
            lost: curr.checkoutSessions - curr.purchaseSessions,
            pct: parseFloat((100 - curr.purchaseRate).toFixed(1)),
            color: '#F59E0B',
            insight: 'Otimizar formas de pagamento e UX do checkout'
          },
        ],

        hasData: curr.sessions > 0,
      };
    } catch (err) {
      console.error('[PixelService] Error getFunnelMetrics:', err);
      return null;
    }
  },
};
