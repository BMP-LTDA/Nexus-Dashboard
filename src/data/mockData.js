import { getBrasiliaNow, formatToBrasiliaDayMonth, getBrasiliaCutoff, getPeriodDateRanges } from '../lib/dateUtils';

export let _currentCustomRange = null;
export const setMockDataCustomRange = (cr) => { _currentCustomRange = cr; };

// ─── Mock Data Central ─────────────────────────────────────────

// ─── Contas / Lojas ───────────────────────────────────────────
export const accounts = [
  { id: 'loja-alpha', name: 'Loja Alpha', icon: '🛍️', color: '#6366F1' },
  { id: 'loja-beta',  name: 'Loja Beta',  icon: '🏪', color: '#10B981' },
  { id: 'cliente-x',  name: 'Cliente X',  icon: '⚡', color: '#F59E0B' },
];

// ─── Period Configuration ─────────────────────────────────────
export const periodConfig = {
  'today':      { days: 1,   multiplier: 0.033, label: 'Hoje'           },
  '7d':         { days: 7,   multiplier: 0.23,  label: 'Últimos 7 dias' },
  '30d':        { days: 30,  multiplier: 1,     label: 'Últimos 30 dias'},
  '90d':        { days: 90,  multiplier: 3.0,   label: 'Últimos 90 dias'},
  'month':      { days: 30,  multiplier: 1.02,  label: 'Este mês'       },
  'prev-month': { days: 30,  multiplier: 0.88,  label: 'Mês anterior'   },
  'year':       { days: 365, multiplier: 12,    label: 'Este ano'       },
  'custom':     { days: 30,  multiplier: 1,     label: 'Personalizado'  },
};

// ─── Base numeric KPIs (30d baseline) ─────────────────────────
const baseKPIs = {
  'loja-alpha': { revenue: 487250, orders: 3842, avgTicket: 126.80, conversion: 3.24, mediaSpend: 68400, cps: 17.80, sessions: 118540, newCustomers: 2187 },
  'loja-beta':  { revenue: 212800, orders: 1654, avgTicket: 128.60, conversion: 2.87, mediaSpend: 32100, cps: 19.40, sessions:  57620, newCustomers:  987 },
  'cliente-x':  { revenue:  94320, orders:  742, avgTicket: 127.10, conversion: 1.94, mediaSpend: 18600, cps: 25.07, sessions:  38240, newCustomers:  418 },
};

const baseChanges = {
  'loja-alpha': { revenue: 12.4, orders: 8.7, avgTicket: 3.4, conversion: -0.8, mediaSpend: 15.2, cps: -5.1, sessions: 9.2, newCustomers: 14.3 },
  'loja-beta':  { revenue:  5.2, orders: 2.1, avgTicket:-1.2, conversion:  0.3, mediaSpend:  8.5, cps:  2.3, sessions: 4.8, newCustomers:  6.1 },
  'cliente-x':  { revenue: -3.1, orders:-5.4, avgTicket: 2.1, conversion: -0.4, mediaSpend: -8.2, cps:  3.4, sessions:-2.7, newCustomers: -7.2 },
};

// ─── Deterministic Seed ───────────────────────────────────────
const getAccountSeed = (accountId) => {
  if (!accountId) return 1;
  let hash = 0;
  const str = String(accountId);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return 0.8 + (Math.abs(hash) % 40) / 100;
};

// ─── Formatters ────────────────────────────────────────────────
const fmtCurrency = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtCurrencySmall = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
const fmtNum = (v) => v.toLocaleString('pt-BR');
const fmtPct = (v) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

// ─── In-memory orders cache (populated by useRealtimeOrders) ───
const _ordersCache = {};
export const setOrdersCache = (accountId, orders) => {
  _ordersCache[accountId] = orders;
};
export const getOrdersCache = (accountId) => _ordersCache[accountId] || null;

const getImportedKPIs = (accountId, period) => {
  try {
    const orders = _ordersCache[accountId];
    if (!orders || orders.length === 0) return null;
    
    const { current, prior } = getPeriodDateRanges(period, _currentCustomRange);

    const isApproved = (o) => {
      const p = (o.paymentStatus || '').toLowerCase();
      const s = (o.status || '').toLowerCase();
      return ['approved', 'paid', 'aprovado', 'pago', 'invoiced', 'shipped', 'faturado', 'enviado', 'entregue', 'concluído', 'concluido'].includes(p) || 
             ['invoiced', 'shipped', 'faturado', 'enviado', 'entregue', 'concluído', 'concluido'].includes(s);
    };

    const periodOrders = orders.filter(o => {
      const d = new Date(o.createdAt);
      return d >= current.start && d <= current.end;
    });
    const priorPeriodOrders = orders.filter(o => {
      const d = new Date(o.createdAt);
      return d >= prior.start && d <= prior.end;
    });

    const approved = periodOrders.filter(isApproved);
    const priorApproved = priorPeriodOrders.filter(isApproved);

    const calcRevenue = (list) => list.reduce((sum, o) => sum + (o.total || 0), 0);
    const revenue = calcRevenue(approved);
    const priorRevenue = calcRevenue(priorApproved);
    const revChange = priorRevenue ? Number((((revenue - priorRevenue) / priorRevenue) * 100).toFixed(1)) : 0;

    const totalOrdersCount = approved.length;
    const priorTotalOrdersCount = priorApproved.length;
    const ordChange = priorTotalOrdersCount ? Number((((totalOrdersCount - priorTotalOrdersCount) / priorTotalOrdersCount) * 100).toFixed(1)) : 0;

    const avgTicketValue = totalOrdersCount > 0 ? revenue / totalOrdersCount : 0;

    const totalRawOrders = periodOrders.length;
    const countByStatus = (list, statuses) => list.filter(o => 
      statuses.includes((o.paymentStatus || '').toLowerCase()) || 
      statuses.includes((o.status || '').toLowerCase())
    ).length;

    const approvedCount = approved.length;
    const canceledCount = countByStatus(periodOrders, ['canceled', 'cancelado', 'refunded', 'estornado', 'erro']);
    const inAnalysisCount = Math.max(0, totalRawOrders - approvedCount - canceledCount);
    const approvalRateValue = totalRawOrders > 0 ? (approvedCount / totalRawOrders) * 100 : 0;

    // Schema unified for all pages
    const result = {
      revenue:      { value: fmtCurrency(revenue),     change: revChange, trend: revChange >= 0 ? 'up' : 'down' },
      rawTotals:    { revenue: revenue },
      orders:       { value: fmtNum(totalOrdersCount), change: ordChange, trend: ordChange >= 0 ? 'up' : 'down' },
      avgTicket:    { value: fmtCurrencySmall(avgTicketValue), change: 0, trend: 'up' },
      conversion:   { value: '0,0%',                   change: 0,         trend: 'up' }, 
      mediaSpend:   { value: 'R$ 0,0',                 change: 0,         trend: 'up' },
      cps:          { value: 'R$ 0,0',                 change: 0,         trend: 'up' },
      sessions:     { value: '0',                      change: 0,         trend: 'up' },
      newCustomers: { value: fmtNum(totalOrdersCount), change: 0,         trend: 'up' },
      // Detail fields for Revenue page
      gross: fmtCurrency(revenue),
      net: fmtCurrency(revenue),
      captured: fmtNum(totalRawOrders),
      billed: fmtNum(totalOrdersCount),
      approvalRate: fmtPct(approvalRateValue),
      cancellations: fmtNum(canceledCount),
      inAnalysis: fmtNum(inAnalysisCount),
      rawAvgTicket: avgTicketValue
    };
    return result;
  } catch(e) {
    console.error('[getImportedKPIs] Error:', e);
    return null;
  }
};

// ─── Period-aware KPIs ─────────────────────────────────────────
export const getKPIsByPeriod = (accountId, period, mOverride) => {
  const imported = getImportedKPIs(accountId, period);
  if (imported) return imported;

  const seed    = getAccountSeed(accountId);
  const base    = baseKPIs[accountId]    || {
    revenue: 487250 * seed, 
    orders: 3842 * seed, 
    avgTicket: 126.80 * (0.8 + seed * 0.2), 
    conversion: 3.24 * (0.7 + seed * 0.3), 
    mediaSpend: 68400 * seed, 
    cps: 17.80, 
    sessions: 118540 * seed, 
    newCustomers: 2187 * seed 
  };
  
  const changes = baseChanges[accountId] || { 
    revenue: 12.4 * (seed > 1 ? 1.1 : 0.9), 
    orders: 8.7, 
    avgTicket: 3.4, 
    conversion: -0.8, 
    mediaSpend: 15.2, 
    cps: -5.1, 
    sessions: 9.2, 
    newCustomers: 14.3 
  };
  
  const m = mOverride !== undefined ? mOverride : (periodConfig[period] || periodConfig['30d']).multiplier;

  return {
    revenue:      { value: fmtCurrency(base.revenue * m),     change: changes.revenue,                        trend: changes.revenue >= 0      ? 'up' : 'down' },
    rawTotals:    { revenue: base.revenue * m },
    orders:       { value: fmtNum(base.orders * m),            change: changes.orders,                         trend: changes.orders >= 0       ? 'up' : 'down' },
    avgTicket:    { value: fmtCurrencySmall(base.avgTicket),   change: Math.abs(changes.avgTicket),            trend: changes.avgTicket >= 0    ? 'up' : 'down' },
    conversion:   { value: fmtPct(base.conversion),            change: Math.abs(changes.conversion),           trend: changes.conversion >= 0   ? 'up' : 'down' },
    mediaSpend:   { value: fmtCurrency(base.mediaSpend * m),   change: changes.mediaSpend,                     trend: changes.mediaSpend >= 0   ? 'up' : 'down' },
    cps:          { value: fmtCurrencySmall(base.cps),         change: Math.abs(changes.cps),                  trend: changes.cps <= 0         ? 'up' : 'down' },
    sessions:     { value: fmtNum(base.sessions * m),          change: changes.sessions,                       trend: changes.sessions >= 0     ? 'up' : 'down' },
    newCustomers: { value: fmtNum(base.newCustomers * m),      change: Math.abs(changes.newCustomers),         trend: changes.newCustomers >= 0  ? 'up' : 'down' },
    approvalRate: fmtPct(84.4), // Default mock value
  };
};

// ─── Revenue KPIs for Receita page ────────────────────────────
export const getRevenueKPIsByPeriod = (accountId, period, mOverride) => {
  const imported = getImportedKPIs(accountId, period);
  if (imported) {
    return {
      gross: imported.revenue.value,
      net: imported.revenue.value,
      captured: imported.orders.value,
      billed: imported.orders.value,
      approvalRate: imported.approvalRate,
      cancellations: imported.cancellations,
      inAnalysis: imported.inAnalysis,
      avgTicket: imported.avgTicket.value
    };
  }

  const seed = getAccountSeed(accountId);
  const m = mOverride !== undefined ? mOverride : (periodConfig[period] || periodConfig['30d']).multiplier;
  return {
    gross:    fmtCurrency(487250 * seed * m),
    net:      fmtCurrency(421800 * seed * m),
    captured: fmtNum(3842 * seed * m),
    billed:   fmtNum(3241 * seed * m),
  };
};

// ─── Traffic KPIs for Tráfego page ────────────────────────────
export const getTrafficKPIsByPeriod = (accountId, period, mOverride) => {
  const seed = getAccountSeed(accountId);
  const m = mOverride !== undefined ? mOverride : (periodConfig[period] || periodConfig['30d']).multiplier;
  return {
    sessions: fmtNum(118540 * seed * m),
    users:    fmtNum(106050 * seed * m),
    newCust:  fmtNum(2187 * seed * m),
  };
};

// ─── Revenue Chart Data ────────────────────────────────────────
export const getRevenueChartData = (accountId, period, mOverride) => {
  try {
    const orders = _ordersCache[accountId];
    if (orders && orders.length > 0) {
      const { current, prior } = getPeriodDateRanges(period, _currentCustomRange);
      
      const isApproved = (o) => {
        const p = (o.paymentStatus || '').toLowerCase();
        const s = (o.status || '').toLowerCase();
        return ['approved', 'paid', 'aprovado', 'pago'].includes(p) || 
               ['invoiced', 'shipped', 'faturado', 'enviado', 'entregue', 'concluído', 'concluido'].includes(s);
      };

      const approvedCurrent = orders.filter(o => {
        const d = new Date(o.createdAt);
        return d >= current.start && d <= current.end && isApproved(o);
      });
      
      const approvedPrior = orders.filter(o => {
        const d = new Date(o.createdAt);
        return d >= prior.start && d <= prior.end && isApproved(o);
      });
      
      const diffTimeMs = current.end.getTime() - current.start.getTime();
      const numDays = Math.max(1, Math.ceil(diffTimeMs / (1000 * 60 * 60 * 24)));
      
      const chartEntries = [];
      for (let i = 0; i < numDays; i++) {
        // Data atual
        const cDate = new Date(current.start);
        cDate.setUTCDate(cDate.getUTCDate() + i);
        const cLabel = formatToBrasiliaDayMonth(cDate);
        
        // Data anterior (pareada por índice)
        const pDate = new Date(prior.start);
        pDate.setUTCDate(pDate.getUTCDate() + i);
        const pLabel = formatToBrasiliaDayMonth(pDate);

        let cSum = 0;
        let pSum = 0;

        approvedCurrent.forEach(o => {
          if (formatToBrasiliaDayMonth(o.createdAt) === cLabel) cSum += (o.total || 0);
        });

        approvedPrior.forEach(o => {
          if (formatToBrasiliaDayMonth(o.createdAt) === pLabel) pSum += (o.total || 0);
        });

        chartEntries.push({
          date: cLabel,
          atual: Math.round(cSum),
          anterior: Math.round(pSum)
        });
      }

      if (chartEntries.length > 0) return chartEntries;
    }
  } catch(e) { console.error(e); }

  const seed = getAccountSeed(accountId);
  const m = mOverride !== undefined ? mOverride : (periodConfig[period] || periodConfig['30d']).multiplier;

  if (period === 'today') {
    return Array.from({ length: 24 }, (_, i) => ({
      date:     `${String(i).padStart(2,'0')}h`,
      atual:    Math.round(487250 * seed / 30 / 24 * (1 + Math.sin(i*0.6)*0.3) + Math.random()*200),
      anterior: Math.round(487250 * seed * 0.88 / 30 / 24 * (1 + Math.sin(i*0.6)*0.3) + Math.random()*150),
    }));
  }
  if (period === 'year') {
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return months.map((date, i) => ({
      date,
      atual:    Math.round(487250 * seed + Math.sin(i*0.5)*40000 + Math.random()*30000),
      anterior: Math.round(487250 * seed * 0.88 + Math.random()*25000),
    }));
  }
  if (period === '90d') {
    return Array.from({ length: 13 }, (_, i) => ({
      date:     `Sem ${i+1}`,
      atual:    Math.round(487250 * seed / 4.3 * (1 + Math.sin(i*0.5)*0.2) + Math.random()*15000),
      anterior: Math.round(487250 * seed * 0.88 / 4.3 + Math.random()*10000),
    }));
  }
  const numDays = period === '7d' ? 7 : 30;
  const length = mOverride ? Math.max(1, Math.round(m * 30)) : numDays;
  return Array.from({ length }, (_, i) => {
    const d     = new Date(2026, 2, i + 1);
    const label = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    const base  = (487250 * seed / 30) * m + Math.sin(i * 0.5) * 2000 * m + Math.random() * 1200 * m;
    return { date: label, atual: Math.round(base), anterior: Math.round(base * 0.88 + Math.random()*800*m) };
  });
};

// ─── Sessions Chart Data ───────────────────────────────────────
export const getSessionsChartData = (accountId, period, mOverride) => {
  const seed = getAccountSeed(accountId);
  const m = mOverride !== undefined ? mOverride : (periodConfig[period] || periodConfig['30d']).multiplier;

  if (period === 'today') {
    return Array.from({ length: 24 }, (_, i) => ({
      date:     `${String(i).padStart(2,'0')}h`,
      sessoes:  Math.round(118540 * seed / 30 / 24 * (1 + Math.sin(i*0.8)*0.4) + Math.random()*20),
      usuarios: Math.round(106050 * seed / 30 / 24 * (1 + Math.sin(i*0.8)*0.4) + Math.random()*15),
    }));
  }
  if (period === 'year') {
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return months.map((date, i) => ({
      date,
      sessoes:  Math.round(118540 * seed + Math.sin(i*0.5)*15000 + Math.random()*10000),
      usuarios: Math.round(106050 * seed + Math.sin(i*0.5)*12000 + Math.random()*8000),
    }));
  }
  if (period === '90d') {
    return Array.from({ length: 13 }, (_, i) => ({
      date:     `Sem ${i+1}`,
      sessoes:  Math.round(118540 * seed / 4.3 * m + Math.sin(i*0.5)*3000 + Math.random()*2000),
      usuarios: Math.round(106050 * seed / 4.3 * m + Math.sin(i*0.5)*2500 + Math.random()*1500),
    }));
  }
  const numDays = period === '7d' ? 7 : 30;
  const length = mOverride ? Math.max(1, Math.round(m * 30)) : numDays;
  return Array.from({ length }, (_, i) => {
    const d     = new Date(2026, 2, i + 1);
    const label = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    return {
      date:     label,
      sessoes:  Math.round(3200 * seed * m + Math.sin(i*0.7)*800*m + Math.random()*600),
      usuarios: Math.round(2800 * seed * m + Math.sin(i*0.7)*700*m + Math.random()*500),
    };
  });
};

// ─── Revenue by Channel (static breakdown) ─────────────────────
export const revenueByChannel = [
  { channel: 'Meta Ads',    value: 187400, pct: 38.4 },
  { channel: 'Google Ads',  value: 122800, pct: 25.2 },
  { channel: 'Orgânico',    value:  98600, pct: 20.2 },
  { channel: 'Email',       value:  42100, pct:  8.6 },
  { channel: 'TikTok Ads',  value:  24300, pct:  5.0 },
  { channel: 'Direto',      value:  12050, pct:  2.6 },
];

export const getRevenueByChannelPeriod = (accountId, period, mOverride) => {
  const seed = getAccountSeed(accountId);
  const m = mOverride !== undefined ? mOverride : (periodConfig[period] || periodConfig['30d']).multiplier;
  return revenueByChannel.map(c => ({ ...c, value: Math.round(c.value * seed * m) }));
};

// ─── Order Status ──────────────────────────────────────────────
export const orderStatus = [
  { status: 'Faturado',   value: 3241, pct: 84.4, color: '#10B981' },
  { status: 'Pendente',   value:  312, pct:  8.1, color: '#F59E0B' },
  { status: 'Cancelado',  value:  187, pct:  4.9, color: '#EF4444' },
  { status: 'Em análise', value:  102, pct:  2.6, color: '#6366F1' },
];

export const getOrderStatusByPeriod = (accountId, period, mOverride) => {
  try {
    const orders = _ordersCache[accountId];
    if (orders && orders.length > 0) {
      // Filter by period
      const { current } = getPeriodDateRanges(period, _currentCustomRange);
      
      const filteredOrders = orders.filter(o => {
        const d = new Date(o.createdAt);
        return d >= current.start && d <= current.end;
      });
      
      const statusMap = {};
      let totalCount = 0;
      
      filteredOrders.forEach(o => {
        const s = o.status || 'created';
        statusMap[s] = (statusMap[s] || 0) + 1;
        totalCount++;
      });
      
      const colors = {
        'aprovado': '#10B981', 'pago': '#10B981', 'approved': '#10B981', 'paid': '#10B981',
        'cancelado': '#EF4444', 'canceled': '#EF4444',
        'pendente': '#F59E0B', 'pending': '#F59E0B',
        'faturado': '#6366F1', 'invoiced': '#6366F1', 'shipped': '#6366F1'
      };

      return Object.entries(statusMap).map(([status, value]) => ({
        status: status.charAt(0).toUpperCase() + status.slice(1),
        value,
        pct: Number(((value / Math.max(1, totalCount)) * 100).toFixed(1)),
        color: colors[status.toLowerCase()] || '#4B5568'
      })).sort((a, b) => b.value - a.value);
    }
  } catch (e) {
    console.error(e);
  }

  const seed = getAccountSeed(accountId);
  const m = mOverride !== undefined ? mOverride : (periodConfig[period] || periodConfig['30d']).multiplier;
  return orderStatus.map(s => ({ ...s, value: Math.round(s.value * seed * m) }));
};

// ─── Traffic Sources ───────────────────────────────────────────
export const trafficSources = [
  { source: 'Meta Ads',   sessions: 42180, users: 38420, bounce: '38,4%', color: '#6366F1' },
  { source: 'Google Ads', sessions: 28640, users: 25810, bounce: '42,1%', color: '#3B82F6' },
  { source: 'Orgânico',   sessions: 22700, users: 20340, bounce: '34,2%', color: '#10B981' },
  { source: 'Direto',     sessions: 14820, users: 12960, bounce: '29,8%', color: '#F59E0B' },
  { source: 'Email',      sessions:  6420, users:  5980, bounce: '25,4%', color: '#06B6D4' },
  { source: 'TikTok',     sessions:  3780, users:  3540, bounce: '51,2%', color: '#EC4899' },
];

export const getTrafficSourcesByPeriod = (accountId, period, mOverride) => {
  const seed = getAccountSeed(accountId);
  const m = mOverride !== undefined ? mOverride : (periodConfig[period] || periodConfig['30d']).multiplier;
  return trafficSources.map(t => ({
    ...t,
    sessions: Math.round(t.sessions * seed * m),
    users:    Math.round(t.users * seed * m),
  }));
};

// ─── Conversion Funnel ─────────────────────────────────────────
export const conversionFunnel = [
  { stage: 'Sessões',           value: 118540, pct: 100,  color: '#6366F1' },
  { stage: 'Visualiz. Produto', value:  64820, pct:  54.7,color: '#8B5CF6' },
  { stage: 'Add ao Carrinho',   value:  21480, pct:  18.1,color: '#A78BFA' },
  { stage: 'Início Checkout',   value:   8920, pct:   7.5,color: '#C4B5FD' },
  { stage: 'Compra Realizada',  value:   3842, pct:   3.24,color: '#10B981'},
];

export const getConversionFunnelByPeriod = (accountId, period, mOverride) => {
  const seed = getAccountSeed(accountId);
  const m = mOverride !== undefined ? mOverride : (periodConfig[period] || periodConfig['30d']).multiplier;
  return conversionFunnel.map(s => ({ ...s, value: Math.round(s.value * seed * m) }));
};

// ─── Top Products ──────────────────────────────────────────────
export const topProducts = [
  { rank:1,  name:'Kit Premium XR-920',      category:'Eletrônicos', revenue:68240, orders:421, avgTicket:162.10, stock:48  },
  { rank:2,  name:'Camiseta Essentials',      category:'Vestuário',   revenue:42180, orders:842, avgTicket:50.10,  stock:312 },
  { rank:3,  name:'Tênis Urbano Pro',         category:'Calçados',    revenue:38400, orders:384, avgTicket:100.00, stock:76  },
  { rank:4,  name:'Fone BT Ultra',            category:'Eletrônicos', revenue:32100, orders:267, avgTicket:120.22, stock:134 },
  { rank:5,  name:'Mochila Adventure 40L',    category:'Acessórios',  revenue:28640, orders:189, avgTicket:151.53, stock:55  },
  { rank:6,  name:'Relógio Smart S3',         category:'Eletrônicos', revenue:24300, orders:142, avgTicket:171.13, stock:28  },
  { rank:7,  name:'Creme Hidratante Premium', category:'Beleza',      revenue:18200, orders:578, avgTicket:31.49,  stock:489 },
  { rank:8,  name:'Cadeira Gamer Pro',        category:'Móveis',      revenue:16800, orders:56,  avgTicket:300.00, stock:12  },
  { rank:9,  name:'Suplemento Total',         category:'Saúde',       revenue:14640, orders:244, avgTicket:60.00,  stock:201 },
  { rank:10, name:'Organizador Modular',      category:'Casa',        revenue:12400, orders:310, avgTicket:40.00,  stock:156 },
];

export const getTopProductsByPeriod = (accountId, period, mOverride) => {
  try {
    const orders = _ordersCache[accountId];
    if (orders && orders.length > 0) {
      // Filter by period using Brasilia context
      const { current } = getPeriodDateRanges(period, _currentCustomRange);

      const filtered = orders.filter(o => {
        const d = new Date(o.createdAt);
        return d >= current.start && d <= current.end;
      });
      
      const approved = filtered.filter(o => {
        const p = (o.paymentStatus || '').toLowerCase();
        const s = (o.status || '').toLowerCase();
        return ['approved', 'paid', 'aprovado', 'pago'].includes(p) || 
               ['invoiced', 'shipped', 'faturado', 'enviado', 'entregue', 'concluído', 'concluido'].includes(s);
      });
      const productMap = new Map();
      
      approved.forEach(o => {
        (o.items || []).forEach(item => {
          const key = item.productId || item.name;
          if (!productMap.has(key)) {
            let category = 'Geral';
            const nl = item.name.toLowerCase();
            if (nl.includes('biquini') || nl.includes('maiô') || nl.includes('praia')) category = 'Moda Praia';
            else if (nl.includes('short') || nl.includes('bermuda')) category = 'Shorts';
            else if (nl.includes('vestido')) category = 'Vestidos';
            else if (nl.includes('calça') || nl.includes('calca')) category = 'Calças';
            else if (nl.includes('blusa') || nl.includes('camisa') || nl.includes('t-shirt') || nl.includes('cropped') || nl.includes('top')) category = 'Blusas';
            else if (nl.includes('conjunto')) category = 'Conjuntos';
            else if (nl.includes('saia')) category = 'Saias';
            else category = 'Vestuário';

            productMap.set(key, { 
              name: item.name, 
              category: category, 
              revenue: 0, 
              orders: 0 
            });
          }
          const p = productMap.get(key);
          p.revenue += item.price * item.quantity;
          p.orders += item.quantity; // approximate
        });
      });
      
      const sorted = Array.from(productMap.values()).sort((a,b) => b.revenue - a.revenue).slice(0, 10);
      if (sorted.length > 0) {
        return sorted.map((p, i) => ({
          rank: i + 1,
          name: p.name,
          category: p.category,
          revenue: Math.round(p.revenue),
          orders: p.orders,
          avgTicket: p.orders > 0 ? (p.revenue / p.orders) : 0,
          stock: 99
        }));
      }
    }
  } catch(e) {}

  const seed = getAccountSeed(accountId);
  const m = mOverride !== undefined ? mOverride : (periodConfig[period] || periodConfig['30d']).multiplier;
  return topProducts.map(p => ({
    ...p,
    revenue: Math.round(p.revenue * seed * m),
    orders:  Math.round(p.orders  * seed * m),
  }));
};

// ─── Customers ────────────────────────────────────────────────
export const customerMetrics = {
  newCustomers:       { value: 2187,        change: +14.3 },
  returningCustomers: { value: 1655,        change:  +5.2 },
  retentionRate:      { value: '43,1%',     change:  +2.8 },
  ltv:                { value: 'R$ 382,40', change:  +8.6 },
  churnRate:          { value: '12,4%',     change:  -1.2 },
  avgOrders:          { value: '1,87',      change:  +0.3 },
};

export const getCustomerMetricsByPeriod = (accountId, period, mOverride) => {
  try {
    const orders = _ordersCache[accountId];
    if (orders && orders.length > 0) {
      // Group by customer
      const customers = new Map();
      const approvedOrders = orders.filter(o => ['approved', 'paid', 'aprovado', 'pago', 'invoiced', 'shipped', 'faturado', 'enviado', 'entregue', 'concluído', 'concluido'].includes((o.paymentStatus || '').toLowerCase()) || ['invoiced', 'shipped', 'faturado', 'enviado', 'entregue', 'concluído', 'concluido'].includes((o.status || '').toLowerCase()));
      
      approvedOrders.forEach(o => {
        const id = o.customerName || 'Desconhecido';
        if (id === 'Desconhecido' || !id) return;
        if (!customers.has(id)) {
          customers.set(id, { count: 0, revenue: 0, firstDate: new Date(o.createdAt) });
        }
        const c = customers.get(id);
        c.count++;
        c.revenue += (o.total || 0);
        if (new Date(o.createdAt) < c.firstDate) c.firstDate = new Date(o.createdAt);
      });

      let totalLtv = 0;
      let returning = 0;
      let totalOrders = 0;

      customers.forEach(c => {
        totalLtv += c.revenue;
        totalOrders += c.count;
        if (c.count > 1) returning++;
      });

      const customerCount = customers.size || 1;
      const ltvValue = totalLtv / customerCount;
      const retentionValue = (returning / customerCount) * 100;
      const avgOrdValue = totalOrders / customerCount;

      return {
        newCustomers:       { value: fmtNum(customerCount - returning), change: 0 },
        returningCustomers: { value: fmtNum(returning), change: 0 },
        retentionRate:      { value: fmtPct(retentionValue), change: 0 },
        ltv:                { value: fmtCurrency(ltvValue), change: 0 },
        churnRate:          { value: fmtPct(Math.max(0, 100 - retentionValue - 10)), change: 0 },
        avgOrders:          { value: avgOrdValue.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1}), change: 0 },
      };
    }
  } catch(e) { console.error(e); }

  const seed = getAccountSeed(accountId);
  const m = mOverride !== undefined ? mOverride : (periodConfig[period] || periodConfig['30d']).multiplier;
  return {
    ...customerMetrics,
    newCustomers:       { value: Math.round(2187 * seed * m).toLocaleString('pt-BR'),  change: +14.3 },
    returningCustomers: { value: Math.round(1655 * seed * m).toLocaleString('pt-BR'),  change:  +5.2 },
  };
};

export const retentionCohortData = [
  { month: 'Jan', m0:100, m1:42, m2:31, m3:24, m4:19, m5:16   },
  { month: 'Fev', m0:100, m1:45, m2:33, m3:26, m4:21, m5:null },
  { month: 'Mar', m0:100, m1:41, m2:30, m3:23, m4:null,m5:null },
  { month: 'Abr', m0:100, m1:44, m2:32, m3:null,m4:null,m5:null},
  { month: 'Mai', m0:100, m1:47, m2:null,m3:null,m4:null,m5:null},
  { month: 'Jun', m0:100, m1:null,m2:null,m3:null,m4:null,m5:null},
];

export const getRetentionCohortByPeriod = (accountId) => {
  try {
    const orders = _ordersCache[accountId];
    if (orders && orders.length > 0) {
      const customers = new Map();
      const approvedOrders = orders.filter(o => ['approved', 'paid', 'aprovado', 'pago', 'invoiced', 'shipped', 'faturado', 'enviado', 'entregue', 'concluído', 'concluido'].includes((o.paymentStatus || '').toLowerCase()) || ['invoiced', 'shipped', 'faturado', 'enviado', 'entregue', 'concluído', 'concluido'].includes((o.status || '').toLowerCase()));
      
      // Step 1: Find first purchase date for each customer
      approvedOrders.forEach(o => {
        const id = o.customerName || 'Desconhecido';
        if (id === 'Desconhecido' || !id) return;
        const d = new Date(o.createdAt);
        if (!customers.has(id)) {
          customers.set(id, { firstPurchase: d, purchases: new Set() });
        } else {
          if (d < customers.get(id).firstPurchase) {
            customers.get(id).firstPurchase = d;
          }
        }
      });

      // Step 2: Register all purchase months relative to first purchase
      approvedOrders.forEach(o => {
        const id = o.customerName || 'Desconhecido';
        if (id === 'Desconhecido' || !id) return;
        const c = customers.get(id);
        const firstM = c.firstPurchase.getFullYear() * 12 + c.firstPurchase.getMonth();
        const d = new Date(o.createdAt);
        const thisM = d.getFullYear() * 12 + d.getMonth();
        const diff = thisM - firstM;
        if (diff >= 0 && diff <= 5) {
          c.purchases.add(diff);
        }
      });

      // Step 3: Aggregate by Cohort Month
      const cohortMap = {}; // "YYYY-MM" -> { total: X, m0: Y, m1: Z... }
      customers.forEach((c) => {
        const monthKey = `${c.firstPurchase.getFullYear()}-${String(c.firstPurchase.getMonth() + 1).padStart(2, '0')}`;
        if (!cohortMap[monthKey]) {
          cohortMap[monthKey] = { total: 0, m0:0, m1:0, m2:0, m3:0, m4:0, m5:0 };
        }
        cohortMap[monthKey].total++;
        c.purchases.forEach(m => {
          cohortMap[monthKey][`m${m}`]++;
        });
      });

      // Step 4: Format array
      const sortedKeys = Object.keys(cohortMap).sort().slice(-6); // last 6 months
      if (sortedKeys.length > 0) {
        return sortedKeys.map(key => {
          const row = cohortMap[key];
          const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
          const mIdx = parseInt(key.split('-')[1], 10) - 1;
          const label = monthNames[mIdx];
          
          return {
            month: label,
            m0: row.total > 0 ? 100 : null,
            m1: row.total > 0 ? Math.round((row.m1 / row.total) * 100) : null,
            m2: row.total > 0 ? Math.round((row.m2 / row.total) * 100) : null,
            m3: row.total > 0 ? Math.round((row.m3 / row.total) * 100) : null,
            m4: row.total > 0 ? Math.round((row.m4 / row.total) * 100) : null,
            m5: row.total > 0 ? Math.round((row.m5 / row.total) * 100) : null,
          };
        });
      }
    }
  } catch(e) { console.error(e); }

  return retentionCohortData;
};

// ─── Paid Media ────────────────────────────────────────────────
export const paidMediaKPIs = {
  totalSpend:  { value: 'R$ 68.400', change: +15.2 },
  roas:        { value: '7,12x',     change:  -0.4 },
  cps:         { value: 'R$ 17,80',  change:  -5.1 },
  avgCpc:      { value: 'R$ 1,84',   change:  +3.2 },
  impressions: { value: '4.280.000', change: +22.4 },
  clicks:      { value: '37.180',    change: +11.6 },
  ctr:         { value: '0,87%',     change:  -0.6 },
};

export const getPaidMediaKPIsByPeriod = (accountId, period, mOverride) => {
  const seed = getAccountSeed(accountId);
  const m = mOverride !== undefined ? mOverride : (periodConfig[period] || periodConfig['30d']).multiplier;
  return {
    ...paidMediaKPIs,
    totalSpend:  { value: `R$ ${Math.round(68400 * seed * m).toLocaleString('pt-BR')}`, change: +15.2 },
    impressions: { value: `${Math.round(4280000 * seed * m).toLocaleString('pt-BR')}`,  change: +22.4 },
    clicks:      { value: `${Math.round(37180 * seed * m).toLocaleString('pt-BR')}`,    change: +11.6 },
  };
};

export const paidByPlatform = [
  { platform:'Meta Ads',   spend:38400, roas:4.88, cps:18.2, clicks:24100, impressions:2840000, ctr:'0,85%', color:'#6366F1' },
  { platform:'Google Ads', spend:22100, roas:5.56, cps:16.8, clicks:10200, impressions:1100000, ctr:'0,93%', color:'#3B82F6' },
  { platform:'TikTok',     spend: 7900, roas:3.08, cps:28.1, clicks: 2880, impressions: 340000, ctr:'0,85%', color:'#EC4899' },
];

export const getPaidByPlatformPeriod = (accountId, period) => {
  const seed = getAccountSeed(accountId);
  const m = (periodConfig[period] || periodConfig['30d']).multiplier;
  return paidByPlatform.map(p => ({
    ...p,
    spend:       Math.round(p.spend * seed * m),
    clicks:      Math.round(p.clicks * seed * m),
    impressions: Math.round(p.impressions * seed * m),
  }));
};

export const roasEvolution = Array.from({ length: 12 }, (_, i) => {
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return {
    month:  months[i],
    meta:   +(3.5 + Math.sin(i*0.6)*1.2 + Math.random()*0.5).toFixed(2),
    google: +(4.2 + Math.sin(i*0.4)*1.0 + Math.random()*0.4).toFixed(2),
    tiktok: +(2.1 + Math.sin(i*0.8)*0.8 + Math.random()*0.3).toFixed(2),
  };
});

// ─── Planning ─────────────────────────────────────────────────
export const getPlanningGoalsByPeriod = (accountId) => {
  const seed = getAccountSeed(accountId);
  return {
    revenueGoal:  { target: Math.round(520000 * seed), current: Math.round(487250 * seed), pct: 93.7 },
    ordersGoal:   { target: Math.round(4200 * seed),   current: Math.round(3842 * seed),   pct: 91.5 },
    mediaROI:     { target: 7.5, current: 7.12, pct: 95.0 },
    newCustomers: { target: Math.round(2500 * seed),   current: Math.round(2187 * seed),   pct: 87.5 },
  };
};

export const getProjectionDataByPeriod = (accountId) => {
  const seed = getAccountSeed(accountId);
  return Array.from({ length: 30 }, (_, i) => {
    const base     = 14800 * seed;
    const actual    = i < 16 ? Math.round(base + Math.sin(i*0.5)*2000 + Math.random()*1500) : null;
    const projected = i >= 14 ? Math.round(base*1.04 + i*180 + Math.random()*800) : null;
    const upper     = projected ? Math.round(projected * 1.12) : null;
    const lower     = projected ? Math.round(projected * 0.88) : null;
    return { day: i+1, actual, projected, upper, lower };
  });
};

// ─── Reports ──────────────────────────────────────────────────
export const getAvailableReportsByPeriod = (accountId) => {
  const seed = getAccountSeed(accountId);
  const stores = ['Alpha', 'Beta', 'Geral', 'Mani', 'Nexus'];
  const storeName = stores[Math.floor(seed * 2.5) % stores.length];

  return [
    { id:1, name:`Relatório Mensal — ${storeName} Março`,  type:'Receita',      date:'01/04/2026', status:'Pronto',        size:'2,4 MB' },
    { id:2, name:`Análise de Funil — ${storeName} Q1`,     type:'Conversão',    date:'31/03/2026', status:'Pronto',        size:'1,8 MB' },
    { id:3, name:`Performance de Mídia — ${storeName}`,    type:'Mídia Paga',   date:'31/03/2026', status:'Pronto',        size:'3,1 MB' },
    { id:4, name:`Cohort de Retenção — ${storeName}`,      type:'Clientes',     date:'30/03/2026', status:'Pronto',        size:'1,2 MB' },
    { id:5, name:`Top 50 Produtos — ${storeName}`,         type:'Produtos',     date:'01/04/2026', status:'Pronto',        size:'0,9 MB' },
    { id:6, name:`Relatório Mensal — ${storeName} Abril`,  type:'Receita',      date:'—',          status:'Em andamento',  size:'—'      },
    { id:7, name:`Projeções ${storeName} Q2 2026`,         type:'Planejamento', date:'—',          status:'Agendado',      size:'—'      },
  ];
};
