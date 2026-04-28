import React, { useMemo, useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  DollarSign, ShoppingCart, TrendingUp, MousePointerClick,
  Megaphone, Target, Users, Globe, ArrowUpRight
} from 'lucide-react';
import KPICard from '../../components/UI/KPICard';
import ChartCard from '../../components/UI/ChartCard';
import PeriodFilter from '../../components/UI/PeriodFilter';
import { useFilter } from '../../contexts/FilterContext';
import { getRevenueChartData, getRevenueByChannelPeriod, getOrderStatusByPeriod } from '../../data/mockData';
import { adsService } from '../../services/ads';
import { ordersService } from '../../services/orders';
import './Overview.css';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="tooltip-value">
          {p.name}: R$ {p.value.toLocaleString('pt-BR')}
        </p>
      ))}
    </div>
  );
};

export default function Overview({ currentAccount }) {
  const { period, multiplier, dataVersion } = useFilter();

  const [kpis, setKpis] = useState(null);
  
  // Real ad spend data
  const [adSpend, setAdSpend] = useState({ spend: 'R$ 0,00', cps: 'R$ 0,00', hasData: false });

  // Re-compute charts/tables
  const revenueChartData  = useMemo(() => getRevenueChartData(currentAccount, period, multiplier),    [currentAccount, period, multiplier, dataVersion]);
  const revenueByChannelData = useMemo(() => getRevenueByChannelPeriod(currentAccount, period, multiplier),           [currentAccount, period, multiplier, dataVersion]);
  const orderStatusData   = useMemo(() => getOrderStatusByPeriod(currentAccount, period, multiplier),                 [currentAccount, period, multiplier, dataVersion]);

  useEffect(() => {
    async function loadKpis() {
      if (!currentAccount) return;
      const rev = await ordersService.getRevenueMetrics(currentAccount, period);
      const ret = await ordersService.getRetentionMetrics(currentAccount, period);
      if (rev && ret) {
        setKpis({
          revenue: { value: rev.net, change: rev.netChange, trend: rev.netChange >= 0 ? 'up' : 'down' },
          orders: { value: rev.billed, change: rev.billedChange, trend: rev.billedChange >= 0 ? 'up' : 'down' },
          avgTicket: { value: rev.avgTicket, change: rev.avgTicketChange, trend: rev.avgTicketChange >= 0 ? 'up' : 'down' },
          conversion: { value: '2.1%', change: 0.2, trend: 'up' }, // Ainda manual (requer sessions reais de Traffic pra cruzar com orders)
          newCustomers: { value: ret.newCustomers.value, change: ret.newCustomers.change, trend: ret.newCustomers.change >= 0 ? 'up' : 'down' },
          sessions: { value: '42.841', change: 15.3, trend: 'up' }, // Mock para placeholder do GA4 real, seria calculado dividindo orders por conv
          rawTotals: {
            orders: rev.rawTotals.billed,
            revenue: rev.rawTotals.net
          }
        });
      }
    }
    loadKpis();
  }, [currentAccount, period, multiplier, dataVersion]);

  useEffect(() => {
    async function loadAds() {
      if (!currentAccount) return;
      const metrics = await adsService.getAdMetrics(currentAccount, period);
      if (metrics && metrics.rawTotals.spend > 0) {
        const totalSpend = metrics.rawTotals.spend;
        
        const totalRevenueStr = String(kpis?.revenue?.value || "0");
        const totalRevenue = parseFloat(totalRevenueStr.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
        const roasVal = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : '0.00';

        const orders = kpis?.rawTotals?.orders || kpis?.orders?.value?.replace(/\D/g, '') || 1;
        const ordersNum = typeof orders === 'number' ? orders : parseInt(orders, 10) || 1;
        const cpsVal = ordersNum > 0 ? (totalSpend / ordersNum) : 0;
        
        const spendDeltaValue = metrics.deltas.totalSpend.value || 0;

        setAdSpend({
          spend: metrics.kpis.totalSpend,
          spendChange: spendDeltaValue,
          spendTrend: spendDeltaValue > 0 ? 'up' : spendDeltaValue < 0 ? 'down' : 'neutral',
          cps: `R$ ${cpsVal.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
          cpsChange: 0,
          cpsTrend: 'neutral',
          roasVal: parseFloat(roasVal),
          hasData: true
        });
      } else {
        setAdSpend({ spend: 'R$ 0,00', spendChange: 0, spendTrend: 'neutral', cps: 'R$ 0,00', cpsChange: 0, cpsTrend: 'neutral', roasVal: 0, hasData: false });
      }
    }
    loadAds();
  }, [currentAccount, period, multiplier, dataVersion]);

  return (
    <div className="overview-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Painel Inicial</h1>
          <p className="page-subtitle">Visão executiva do desempenho geral do e-commerce</p>
        </div>
        <PeriodFilter />
      </div>

      {/* KPI Grid */}
      <div className="section-grid-4" style={{ marginBottom: 24 }}>
        <KPICard title="Receita Total"      value={kpis?.revenue?.value || "Carregando"}    change={kpis?.revenue?.change || 0}    trend={kpis?.revenue?.trend || 'neutral'}    icon={DollarSign}        color="primary" />
        <KPICard title="Pedidos"            value={kpis?.orders?.value || "Carregando"}     change={kpis?.orders?.change || 0}     trend={kpis?.orders?.trend || 'neutral'}     icon={ShoppingCart}      color="blue"    />
        <KPICard title="Ticket Médio"       value={kpis?.avgTicket?.value || "Carregando"}  change={kpis?.avgTicket?.change || 0}  trend={kpis?.avgTicket?.trend || 'neutral'}  icon={TrendingUp}        color="green"   />
        <KPICard title="Taxa de Conversão"  value={kpis?.conversion?.value || "Carregando"} change={kpis?.conversion?.change || 0} trend={kpis?.conversion?.trend || 'neutral'} icon={MousePointerClick} color={kpis?.conversion?.trend === 'up' ? 'green' : 'red'} requiresGA4={true} />
      </div>
      <div className="section-grid-4" style={{ marginBottom: 24 }}>
        <KPICard title="Investimento Mídia" value={adSpend.spend}    change={adSpend.spendChange}    trend={adSpend.spendTrend}    icon={Megaphone}  color="amber" />
        <KPICard title="CPS"                value={adSpend.cps}      change={adSpend.cpsChange}      trend={adSpend.cpsTrend}      icon={Target}     color="cyan" />
        <KPICard title="Sessões"            value={kpis?.sessions?.value || "0"}      change={kpis?.sessions?.change || 0}      trend={kpis?.sessions?.trend || 'neutral'}      icon={Globe}      color="primary" requiresGA4={true} />
        <KPICard title="Novos Clientes"     value={kpis?.newCustomers?.value || "0"}  change={kpis?.newCustomers?.change || 0}  trend={kpis?.newCustomers?.trend || 'neutral'}  icon={Users}      color="green"  />
      </div>

      {/* Main Charts Row */}
      <div className="charts-row" style={{ marginBottom: 24 }}>
        {/* Revenue Evolution */}
        <ChartCard
          title="Evolução de Receita"
          subtitle="Período atual vs. período anterior"
          tooltip="Comparação diária de receita entre os dois últimos períodos selecionados."
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradAtual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0}   />
                </linearGradient>
                <linearGradient id="gradAnterior" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#4B5568" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#4B5568" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: '#4B5568', fontSize: 10 }} axisLine={false} tickLine={false} interval={period === '30d' ? 4 : 0} />
              <YAxis tick={{ fill: '#4B5568', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(v) => <span style={{ color: '#8B95A8', fontSize: 12 }}>{v === 'atual' ? 'Período atual' : 'Período anterior'}</span>}
              />
              <Area type="monotone" dataKey="anterior" name="anterior" stroke="#4B5568" strokeWidth={1.5} fill="url(#gradAnterior)" strokeDasharray="4 2" dot={false} />
              <Area type="monotone" dataKey="atual"    name="atual"    stroke="#6366F1" strokeWidth={2}   fill="url(#gradAtual)"    dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Order Status */}
        <ChartCard title="Status dos Pedidos" subtitle="Distribuição por status no período">
          <div className="order-status-list">
            {orderStatusData.map(s => (
              <div key={s.status} className="order-status-item">
                <div className="order-status-top">
                  <div className="order-status-label">
                    <span className="order-dot" style={{ background: s.color }} />
                    <span>{s.status}</span>
                  </div>
                  <div className="order-status-values">
                    <span className="order-count">{s.value.toLocaleString('pt-BR')}</span>
                    <span className="order-pct">{s.pct}%</span>
                  </div>
                </div>
                <div className="order-bar-track">
                  <div className="order-bar-fill" style={{ width: `${s.pct}%`, background: s.color }} />
                </div>
              </div>
            ))}
          </div>

          {/* Quick metrics */}
          <div className="approval-rate">
            <span className="approval-label">Taxa de Aprovação</span>
            <span className="approval-value">{kpis?.approvalRate || '84.4%'}</span>
          </div>
        </ChartCard>
      </div>

      {/* Bottom Row */}
      <div className="charts-row-equal" style={{ marginBottom: 0 }}>
        {/* Revenue by Channel */}
        <ChartCard title="Receita por Canal" subtitle="Distribuição de receita por origem" requiresGA4={true}>
          <div className="channel-list">
            {revenueByChannelData.map((c, i) => (
              <div key={c.channel} className="channel-item">
                <div className="channel-rank">#{i + 1}</div>
                <div className="channel-info">
                  <div className="channel-name-row">
                    <span className="channel-name">{c.channel}</span>
                    <span className="channel-pct">{c.pct}%</span>
                  </div>
                  <div className="channel-bar-track">
                    <div className="channel-bar-fill" style={{ width: `${c.pct}%`, background: `hsl(${240 - i * 36}, 70%, 65%)` }} />
                  </div>
                </div>
                <span className="channel-value">R$ {(c.value / 1000).toFixed(0)}k</span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Semáforo de Métricas */}
        <ChartCard title="Status das Métricas" subtitle="Resumo executivo de performance" requiresGA4={true}>
          <div className="metrics-status-list">
            {[
              { label: 'Receita',        status: (kpis?.revenue?.change >= 0) ? 'success' : 'warning', text: kpis?.revenue?.change >= 0 ? `+${kpis?.revenue?.change || 0}% acima da média` : `${kpis?.revenue?.change || 0}% abaixo da meta`,    value: kpis?.revenue?.value || '0' },
              { label: 'Conversão',      status: kpis?.conversion?.trend === 'up' ? 'success' : 'warning', text: kpis?.conversion?.trend === 'up' ? `Crescimento de ${kpis?.conversion?.change}%` : `Leve queda (-${kpis?.conversion?.change}%)`, value: kpis?.conversion?.value || '0%' },
              { label: 'ROAS',           status: adSpend.hasData ? (adSpend.roasVal > 4 ? 'success' : 'warning') : 'info', text: adSpend.hasData ? 'Calculado via Ads + Receita' : 'Aguardando CSV Ads', value: adSpend.hasData ? `${adSpend.roasVal}x` : '0.00x' },
              { label: 'CPS',            status: 'success', text: 'Custo por Sessão', value: adSpend.cps },
              { label: 'Investimento',   status: adSpend.spendTrend === 'down' ? 'success' : 'warning', text: adSpend.spendTrend === 'down' ? 'Economia no período' : 'Gastos elevados', value: adSpend.spend },
              { label: 'Novos Clientes', status: 'success', text: `Crescimento constante`, value: kpis?.newCustomers?.value || '0' },
            ].map(m => (
              <div key={m.label} className="metric-status-item">
                <div className={`metric-status-dot dot-${m.status}`} />
                <div className="metric-status-info">
                  <span className="metric-status-label">{m.label}</span>
                  <span className="metric-status-text">{m.text}</span>
                </div>
                <span className={`metric-status-value value-${m.status}`}>{m.value}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
