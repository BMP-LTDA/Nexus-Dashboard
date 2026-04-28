import { supabase } from '../lib/supabase';
import { getPeriodDateRanges } from '../lib/dateUtils';

export const ordersService = {
  /**
   * Busca recursivamente todos os pedidos contornando o limite de 1000 rows do Supabase
   */
  async fetchAllOrders(accountId, startStr, endStr, selectCols = '*') {
    let allRecords = [];
    let from = 0;
    const step = 999;
    
    while (true) {
      let query = supabase
        .from('orders')
        .select(selectCols)
        .eq('account_id', accountId);
        
      if (startStr) query = query.gte('created_at', startStr);
      if (endStr) query = query.lte('created_at', endStr);
      
      const { data, error } = await query.range(from, from + step);
      if (error) throw error;
      
      if (!data || data.length === 0) break;
      
      allRecords = [...allRecords, ...data];
      
      if (data.length <= step) break;
      
      from += step + 1;
    }
    
    return allRecords;
  },

  /**
   * Calcula a diferença percentual
   */
  calcDelta(curr, prev) {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  },

  /**
   * Busca e agrega métricas de receita a partir da tabela 'orders'
   */
  async getRevenueMetrics(accountSlug, period) {
    try {
      const { data: account, error: accError } = await supabase
        .from('accounts')
        .select('id')
        .eq('slug', accountSlug)
        .single();

      if (accError || !account?.id) return null;

      const { current, prior } = getPeriodDateRanges(period);
      const currentStart = current.start.toISOString();
      const currentEnd = current.end.toISOString();
      const priorStart = prior.start.toISOString();
      const priorEnd = prior.end.toISOString();

      const records = await this.fetchAllOrders(account.id, priorStart, currentEnd);

      let gross = 0, prevGross = 0;
      let net = 0, prevNet = 0;
      let count = 0, prevCount = 0;
      let billed = 0, prevBilled = 0;
      
      let approvalCount = 0, cancelCount = 0, analysisCount = 0;
      
      const currentRecords = [];
      const priorRecords = [];

      records.forEach(o => {
        const rowDate = o.created_at;
        const amt = Number(o.amount || 0);
        const status = (o.status || '').toLowerCase();
        const pStatus = (o.payment_status || '').toLowerCase();

        const isCanceled = status === 'canceled' || pStatus === 'rejected' || status === 'cancelado';
        const isBilled = status === 'invoiced' || pStatus === 'approved' || status === 'faturado';
        const isAnalysis = pStatus === 'pending' || pStatus === 'in_analysis';

        if (rowDate >= currentStart && rowDate <= currentEnd) {
          currentRecords.push(o);
          
          if (!isCanceled) gross += amt;
          if (isBilled) net += amt;
          
          count++;
          if (isBilled) billed++;
          
          if (isBilled) approvalCount++;
          if (isCanceled) cancelCount++;
          if (isAnalysis) analysisCount++;
          
        } else if (rowDate >= priorStart && rowDate <= priorEnd) {
          priorRecords.push(o);
          if (!isCanceled) prevGross += amt;
          if (isBilled) prevNet += amt;
          prevCount++;
          if (isBilled) prevBilled++;
        }
      });

      const avgTicket = billed > 0 ? (net / billed) : 0;
      const prevAvgTicket = prevBilled > 0 ? (prevNet / prevBilled) : 0;

      const approvalRate = count > 0 ? (approvalCount / count) * 100 : 0;

      const formatCurrency = (val) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      return {
        gross: formatCurrency(gross),
        grossChange: this.calcDelta(gross, prevGross),
        
        net: formatCurrency(net),
        netChange: this.calcDelta(net, prevNet),
        
        captured: count.toLocaleString('pt-BR'),
        capturedChange: this.calcDelta(count, prevCount),
        
        billed: billed.toLocaleString('pt-BR'),
        billedChange: this.calcDelta(billed, prevBilled),
        
        avgTicket: formatCurrency(avgTicket),
        avgTicketChange: this.calcDelta(avgTicket, prevAvgTicket),
        
        approvalRate: `${approvalRate.toFixed(1).replace('.', ',')}%`,
        cancellations: cancelCount.toLocaleString('pt-BR'),
        inAnalysis: analysisCount.toLocaleString('pt-BR'),

        rawTotals: {
          gross, net, count, billed, avgTicket
        },
        records: currentRecords,
        priorRecords: priorRecords
      };
    } catch (err) {
      console.error('[OrdersService] Error getRevenueMetrics:', err);
      return null;
    }
  },

  /**
   * Calcula retenção e LTV com base nos pedidos
   */
  async getRetentionMetrics(accountSlug, period) {
    try {
      const { data: account, error: accError } = await supabase
        .from('accounts')
        .select('id')
        .eq('slug', accountSlug)
        .single();

      if (accError || !account?.id) return null;

      // Para retenção, precisamos de todo o histórico do cliente, então buscamos sem limite de data
      const records = await this.fetchAllOrders(account.id, null, null, 'customer_name, created_at, amount, status, payment_status');

      const { current, prior } = getPeriodDateRanges(period);
      const currentStart = current.start.toISOString();
      const currentEnd = current.end.toISOString();
      const priorStart = prior.start.toISOString();
      const priorEnd = prior.end.toISOString();

      const customers = {};
      records.forEach(o => {
        const isBilled = o.status === 'invoiced' || o.payment_status === 'approved' || o.status === 'faturado';
        if (!isBilled) return;

        const name = o.customer_name?.trim() || 'Desconhecido';
        if (!customers[name]) {
          customers[name] = { 
            firstPurchase: o.created_at, 
            orders: 0, 
            totalSpent: 0,
            purchases: []
          };
        }
        customers[name].orders++;
        customers[name].totalSpent += Number(o.amount || 0);
        customers[name].purchases.push(o.created_at);
      });

      let newCustomers = 0, prevNewCustomers = 0;
      let returningCustomers = 0, prevReturningCustomers = 0;
      let activeCustomers = 0, prevActiveCustomers = 0;

      Object.values(customers).forEach(c => {
        const isNewInCurrent = c.firstPurchase >= currentStart && c.firstPurchase <= currentEnd;
        const isNewInPrev = c.firstPurchase >= priorStart && c.firstPurchase <= priorEnd;
        
        const hasPurchaseInCurrent = c.purchases.some(d => d >= currentStart && d <= currentEnd);
        const hasPurchaseInPrev = c.purchases.some(d => d >= priorStart && d <= priorEnd);

        if (hasPurchaseInCurrent) activeCustomers++;
        if (hasPurchaseInPrev) prevActiveCustomers++;

        if (isNewInCurrent) newCustomers++;
        if (isNewInPrev) prevNewCustomers++;

        if (hasPurchaseInCurrent && c.firstPurchase < currentStart) returningCustomers++;
        if (hasPurchaseInPrev && c.firstPurchase < priorStart) prevReturningCustomers++;
      });

      const retentionRate = activeCustomers > 0 ? (returningCustomers / activeCustomers) * 100 : 0;
      const prevRetentionRate = prevActiveCustomers > 0 ? (prevReturningCustomers / prevActiveCustomers) * 100 : 0;

      let totalRevenue = 0, totalCustomers = 0;
      Object.values(customers).forEach(c => {
        if (c.totalSpent > 0) {
          totalRevenue += c.totalSpent;
          totalCustomers++;
        }
      });
      const ltv = totalCustomers > 0 ? (totalRevenue / totalCustomers) : 0;

      const formatCurrency = (val) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      return {
        retentionRate: `${retentionRate.toFixed(1).replace('.', ',')}%`,
        retentionRateChange: this.calcDelta(retentionRate, prevRetentionRate),
        
        returningCustomers: returningCustomers.toLocaleString('pt-BR'),
        returningCustomersChange: this.calcDelta(returningCustomers, prevReturningCustomers),
        
        ltv: formatCurrency(ltv),
        ltvChange: 0, 
        
        newCustomers: newCustomers.toLocaleString('pt-BR'),
        newCustomersChange: this.calcDelta(newCustomers, prevNewCustomers)
      };
    } catch (err) {
      console.error('[OrdersService] Error getRetentionMetrics:', err);
      return null;
    }
  },

  /**
   * Busca os produtos mais vendidos baseando-se no JSONB "items" de cada order
   */
  async getTopProducts(accountSlug, period) {
    try {
      const { data: account, error: accError } = await supabase
        .from('accounts')
        .select('id')
        .eq('slug', accountSlug)
        .single();

      if (accError || !account?.id) return null;

      const { current } = getPeriodDateRanges(period);
      const currentStart = current.start.toISOString();
      const currentEnd = current.end.toISOString();

      const records = await this.fetchAllOrders(account.id, currentStart, currentEnd, 'status, payment_status, items');

      const productsMap = {};

      records.forEach(o => {
        const isBilled = o.status === 'invoiced' || o.payment_status === 'approved' || o.status === 'faturado';
        if (!isBilled) return;

        const items = Array.isArray(o.items) ? o.items : [];
        items.forEach(i => {
          const name = i.name || 'Produto Sem Nome';
          const price = Number(i.price || 0);
          const quantity = Number(i.quantity || 1);

          if (!productsMap[name]) {
            productsMap[name] = {
              name,
              category: 'Geral', // Bagy CSV doesnt always give category in items
              orders: 0,
              revenue: 0,
              stock: null // Estoque não disponível via orders — omitido
            };
          }
          productsMap[name].orders += quantity;
          productsMap[name].revenue += price * quantity;
        });
      });

      const arr = Object.values(productsMap);
      arr.sort((a, b) => b.revenue - a.revenue);

      // Add rank and avgTicket
      return arr.map((p, i) => ({
        ...p,
        rank: i + 1,
        avgTicket: p.orders > 0 ? p.revenue / p.orders : 0
      }));

    } catch (err) {
      console.error('[OrdersService] Error getTopProducts:', err);
      return [];
    }
  },

  /**
   * Timeline mensal: Novos vs Recorrentes por mês (dados reais)
   */
  async getMonthlyCustomerTimeline(accountSlug) {
    try {
      const { data: account, error: accError } = await supabase
        .from('accounts')
        .select('id')
        .eq('slug', accountSlug)
        .single();

      if (accError || !account?.id) return [];

      const records = await this.fetchAllOrders(account.id, null, null, 'customer_name, created_at, status, payment_status');

      const isBilled = (o) => {
        const s = (o.status || '').toLowerCase();
        const p = (o.payment_status || '').toLowerCase();
        return s === 'invoiced' || p === 'approved' || s === 'faturado';
      };

      // Primeira compra de cada cliente
      const firstPurchase = {};
      records.filter(isBilled).forEach(o => {
        const name = (o.customer_name || '').trim();
        if (!name || name === 'Desconhecido') return;
        if (!firstPurchase[name] || o.created_at < firstPurchase[name]) {
          firstPurchase[name] = o.created_at;
        }
      });

      // Agrupar por mês
      const monthMap = {};
      const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

      records.filter(isBilled).forEach(o => {
        const name = (o.customer_name || '').trim();
        if (!name || name === 'Desconhecido') return;
        
        const d = new Date(o.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthMap[key]) monthMap[key] = { novosSet: new Set(), recorrentesSet: new Set() };
        
        const fp = new Date(firstPurchase[name]);
        const fpKey = `${fp.getFullYear()}-${String(fp.getMonth() + 1).padStart(2, '0')}`;
        
        if (fpKey === key) {
          monthMap[key].novosSet.add(name);
        } else {
          monthMap[key].recorrentesSet.add(name);
        }
      });

      return Object.keys(monthMap).sort().slice(-12).map(key => {
        const mIdx = parseInt(key.split('-')[1], 10) - 1;
        return {
          month: monthNames[mIdx],
          novos: monthMap[key].novosSet.size,
          recorrentes: monthMap[key].recorrentesSet.size
        };
      });

    } catch (err) {
      console.error('[OrdersService] Error getMonthlyCustomerTimeline:', err);
      return [];
    }
  },

  /**
   * Análise de Coorte real baseada em pedidos
   */
  async getCohortData(accountSlug) {
    try {
      const { data: account, error: accError } = await supabase
        .from('accounts')
        .select('id')
        .eq('slug', accountSlug)
        .single();

      if (accError || !account?.id) return [];

      const records = await this.fetchAllOrders(account.id, null, null, 'customer_name, created_at, status, payment_status');

      const isBilled = (o) => {
        const s = (o.status || '').toLowerCase();
        const p = (o.payment_status || '').toLowerCase();
        return s === 'invoiced' || p === 'approved' || s === 'faturado';
      };

      const customers = {};
      records.filter(isBilled).forEach(o => {
        const name = (o.customer_name || '').trim();
        if (!name || name === 'Desconhecido') return;
        const d = new Date(o.created_at);
        if (!customers[name]) {
          customers[name] = { firstPurchase: d, purchases: new Set() };
        } else {
          if (d < customers[name].firstPurchase) customers[name].firstPurchase = d;
        }
      });

      // Register all purchase months relative to first purchase
      records.filter(isBilled).forEach(o => {
        const name = (o.customer_name || '').trim();
        if (!name || name === 'Desconhecido' || !customers[name]) return;
        const c = customers[name];
        const firstM = c.firstPurchase.getFullYear() * 12 + c.firstPurchase.getMonth();
        const d = new Date(o.created_at);
        const thisM = d.getFullYear() * 12 + d.getMonth();
        const diff = thisM - firstM;
        if (diff >= 0 && diff <= 5) c.purchases.add(diff);
      });

      // Aggregate by cohort month
      const cohortMap = {};
      Object.values(customers).forEach(c => {
        const key = `${c.firstPurchase.getFullYear()}-${String(c.firstPurchase.getMonth() + 1).padStart(2, '0')}`;
        if (!cohortMap[key]) cohortMap[key] = { total: 0, m0: 0, m1: 0, m2: 0, m3: 0, m4: 0, m5: 0 };
        cohortMap[key].total++;
        c.purchases.forEach(m => { cohortMap[key][`m${m}`]++; });
      });

      const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      const sortedKeys = Object.keys(cohortMap).sort().slice(-6);

      return sortedKeys.map(key => {
        const row = cohortMap[key];
        const mIdx = parseInt(key.split('-')[1], 10) - 1;
        const year = key.split('-')[0].slice(2);
        return {
          month: `${monthNames[mIdx]}/${year}`,
          m0: row.total > 0 ? 100 : null,
          m1: row.m1 > 0 ? Math.round((row.m1 / row.total) * 100) : (row.total > 0 ? 0 : null),
          m2: row.m2 > 0 ? Math.round((row.m2 / row.total) * 100) : null,
          m3: row.m3 > 0 ? Math.round((row.m3 / row.total) * 100) : null,
          m4: row.m4 > 0 ? Math.round((row.m4 / row.total) * 100) : null,
          m5: row.m5 > 0 ? Math.round((row.m5 / row.total) * 100) : null,
        };
      });

    } catch (err) {
      console.error('[OrdersService] Error getCohortData:', err);
      return [];
    }
  },

  /**
   * Segmentos: Champion (alto valor, recorrente) e At Risk (não comprou recentemente)
   */
  async getCustomerSegments(accountSlug) {
    try {
      const { data: account, error: accError } = await supabase
        .from('accounts')
        .select('id')
        .eq('slug', accountSlug)
        .single();

      if (accError || !account?.id) return { champion: 0, atRisk: 0 };

      const records = await this.fetchAllOrders(account.id, null, null, 'customer_name, created_at, amount, status, payment_status');

      const isBilled = (o) => {
        const s = (o.status || '').toLowerCase();
        const p = (o.payment_status || '').toLowerCase();
        return s === 'invoiced' || p === 'approved' || s === 'faturado';
      };

      const customers = {};
      records.filter(isBilled).forEach(o => {
        const name = (o.customer_name || '').trim();
        if (!name || name === 'Desconhecido') return;
        if (!customers[name]) customers[name] = { orders: 0, revenue: 0, lastPurchase: o.created_at };
        customers[name].orders++;
        customers[name].revenue += Number(o.amount || 0);
        if (o.created_at > customers[name].lastPurchase) customers[name].lastPurchase = o.created_at;
      });

      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      let champion = 0, atRisk = 0;
      Object.values(customers).forEach(c => {
        // Champion: 3+ pedidos e receita acima da média
        const avgRevenue = Object.values(customers).reduce((s, x) => s + x.revenue, 0) / Object.keys(customers).length;
        if (c.orders >= 3 && c.revenue >= avgRevenue) champion++;
        // At Risk: comprou antes mas não comprou nos últimos 90 dias
        if (c.orders >= 1 && new Date(c.lastPurchase) < ninetyDaysAgo) atRisk++;
      });

      return { champion, atRisk };

    } catch (err) {
      console.error('[OrdersService] Error getCustomerSegments:', err);
      return { champion: 0, atRisk: 0 };
    }
  }
};
