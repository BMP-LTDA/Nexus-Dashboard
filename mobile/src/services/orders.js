// Mesmo serviço do web — sem dependências de browser
import { supabase } from '../lib/supabase';
import { getPeriodDateRanges } from '../lib/dateUtils';

const BILLED_STATUSES   = ['invoiced','shipped','faturado','enviado','entregue','concluído','concluido','completed'];
const APPROVED_PAYMENTS = ['approved','paid','aprovado','pago'];

function isBilled(status, pStatus) {
  return BILLED_STATUSES.includes(status) || APPROVED_PAYMENTS.includes(pStatus);
}
function isCanceled(status, pStatus) {
  return ['canceled','cancelado','refunded','estornado','cancelled'].includes(status) ||
         ['rejected','chargeback','refunded'].includes(pStatus);
}

async function fetchAllOrders(accountId, startStr, endStr, selectCols = '*') {
  let all = [], from = 0;
  while (true) {
    let q = supabase.from('orders').select(selectCols).eq('account_id', accountId);
    if (startStr) q = q.gte('created_at', startStr);
    if (endStr)   q = q.lte('created_at', endStr);
    const { data, error } = await q.range(from, from + 998);
    if (error) throw error;
    if (!data?.length) break;
    all = [...all, ...data];
    if (data.length < 999) break;
    from += 999;
  }
  return all;
}

function calcDelta(curr, prev) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

const fmtBRL = v => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNum = v => v.toLocaleString('pt-BR');
const fmtPct = v => `${v.toFixed(1).replace('.', ',')}%`;

export const ordersService = {
  async getRevenueMetrics(accountSlug, period) {
    try {
      const { data: account } = await supabase.from('accounts').select('id').eq('slug', accountSlug).single();
      if (!account?.id) return null;

      const { current, prior } = getPeriodDateRanges(period);
      const cs = current.start.toISOString(), ce = current.end.toISOString();
      const ps = prior.start.toISOString(),   pe = prior.end.toISOString();

      const records = await fetchAllOrders(account.id, ps, ce);

      let gross = 0, prevGross = 0, net = 0, prevNet = 0;
      let count = 0, prevCount = 0, billed = 0, prevBilled = 0;
      let approvedCount = 0, cancelCount = 0, analysisCount = 0;

      records.forEach(o => {
        const s = (o.status || '').toLowerCase(), p = (o.payment_status || '').toLowerCase();
        const amt = Number(o.amount || 0);
        const canceled = isCanceled(s, p), paid = isBilled(s, p);
        const analysis = ['pending','in_analysis','in_process'].includes(p);

        if (o.created_at >= cs && o.created_at <= ce) {
          count++;
          if (!canceled) gross += amt;
          if (paid) { net += amt; billed++; approvedCount++; }
          if (canceled) cancelCount++;
          if (analysis) analysisCount++;
        } else if (o.created_at >= ps && o.created_at <= pe) {
          prevCount++;
          if (!canceled) prevGross += amt;
          if (paid) { prevNet += amt; prevBilled++; }
        }
      });

      const avgTicket     = billed > 0 ? net / billed : 0;
      const prevAvgTicket = prevBilled > 0 ? prevNet / prevBilled : 0;
      const approvalRate  = count > 0 ? (approvedCount / count) * 100 : 0;

      return {
        gross: fmtBRL(gross),      net: fmtBRL(net),         netChange: calcDelta(net, prevNet),
        captured: fmtNum(count),   capturedChange: calcDelta(count, prevCount),
        billed: fmtNum(billed),    billedChange: calcDelta(billed, prevBilled),
        avgTicket: fmtBRL(avgTicket), avgTicketChange: calcDelta(avgTicket, prevAvgTicket),
        approvalRate: fmtPct(approvalRate),
        cancellations: fmtNum(cancelCount),
        inAnalysis: fmtNum(analysisCount),
        rawTotals: { gross, net, count, billed, avgTicket },
      };
    } catch (e) { console.error('[orders] getRevenueMetrics:', e); return null; }
  },

  async getRetentionMetrics(accountSlug, period) {
    try {
      const { data: account } = await supabase.from('accounts').select('id').eq('slug', accountSlug).single();
      if (!account?.id) return null;

      const records = await fetchAllOrders(account.id, null, null, 'customer_name,created_at,amount,status,payment_status');
      const { current, prior } = getPeriodDateRanges(period);
      const cs = current.start.toISOString(), ce = current.end.toISOString();
      const ps = prior.start.toISOString(),   pe = prior.end.toISOString();

      const customers = {};
      records.forEach(o => {
        const s = (o.status || '').toLowerCase(), p = (o.payment_status || '').toLowerCase();
        if (!isBilled(s, p)) return;
        const key = (o.customer_name || '').trim().toLowerCase() || 'desconhecido';
        if (key === 'desconhecido') return;
        if (!customers[key]) customers[key] = { firstPurchase: o.created_at, purchases: [] };
        customers[key].purchases.push(o.created_at);
      });

      let newC = 0, prevNewC = 0, retC = 0, prevRetC = 0, activeC = 0, prevActiveC = 0;

      Object.values(customers).forEach(c => {
        const inCurr = c.purchases.some(d => d >= cs && d <= ce);
        const inPrev = c.purchases.some(d => d >= ps && d <= pe);
        if (inCurr) { activeC++; if (c.firstPurchase >= cs && c.firstPurchase <= ce) newC++; else retC++; }
        if (inPrev) { prevActiveC++; if (c.firstPurchase >= ps && c.firstPurchase <= pe) prevNewC++; else prevRetC++; }
      });

      const retRate = activeC > 0 ? (retC / activeC) * 100 : 0;
      const prevRetRate = prevActiveC > 0 ? (prevRetC / prevActiveC) * 100 : 0;

      return {
        newCustomers: fmtNum(newC), newCustomersChange: calcDelta(newC, prevNewC),
        returningCustomers: fmtNum(retC), returningCustomersChange: calcDelta(retC, prevRetC),
        retentionRate: fmtPct(retRate), retentionRateChange: calcDelta(retRate, prevRetRate),
        ltv: fmtBRL(0),
      };
    } catch (e) { console.error('[orders] getRetentionMetrics:', e); return null; }
  },
};
