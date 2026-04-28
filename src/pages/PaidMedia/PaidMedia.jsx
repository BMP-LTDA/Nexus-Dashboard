import React, { useState, useEffect, useMemo } from 'react';
import { Megaphone, TrendingUp, Target, MousePointer, Eye, DollarSign, AlertCircle } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import KPICard from '../../components/UI/KPICard';
import ChartCard from '../../components/UI/ChartCard';
import DataTable from '../../components/UI/DataTable';
import PeriodFilter from '../../components/UI/PeriodFilter';
import { useFilter } from '../../contexts/FilterContext';
import { adsService } from '../../services/ads';
import { ordersService } from '../../services/orders';
import './PaidMedia.css';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{ color:p.color, fontSize:13, fontWeight:600 }}>{p.name}: R$ {Number(p.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
      ))}
    </div>
  );
};

const SpendTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{ color:p.color, fontSize:13, fontWeight:600 }}>{p.name}: R$ {Number(p.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
      ))}
    </div>
  );
};

const platformCols = [
  { key: 'platform',    label: 'Plataforma', sortable: true,
    render: (v, row) => (
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ width:10, height:10, borderRadius:'50%', background:row.color, display:'inline-block' }} />
        <span style={{ fontWeight:600 }}>{v}</span>
      </div>
    )
  },
  { key: 'spend',       label: 'Investimento', sortable: true, align:'right', render: v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
  { key: 'roas',        label: 'ROAS',         sortable: true, align:'right', render: v => <span style={{ color:'var(--accent-green)', fontWeight:700 }}>{v}x</span> },
  { key: 'cps',         label: 'CPS',          sortable: true, align:'right', render: v => `R$ ${Number(v).toFixed(1).replace('.',',')}` },
  { key: 'clicks',      label: 'Cliques',      sortable: true, align:'right', render: v => Number(v).toLocaleString('pt-BR') },
  { key: 'impressions', label: 'Impressões',   sortable: true, align:'right', render: v => `${(Number(v)/1000).toFixed(1)}k` },
  { key: 'ctr',         label: 'CTR',          sortable: true, align:'right' },
];

const EmptyState = () => (
  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'48px 24px', gap:12, opacity:0.6 }}>
    <AlertCircle size={36} style={{ color:'var(--text-muted)' }} />
    <p style={{ fontSize:14, color:'var(--text-secondary)', fontWeight:500 }}>Nenhum dado de mídia paga encontrado</p>
    <p style={{ fontSize:12, color:'var(--text-muted)' }}>Importe dados na página de Configurações para visualizar as métricas.</p>
  </div>
);

export default function PaidMedia({ currentAccount }) {
  const { period, multiplier, dataVersion } = useFilter();
  
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [kpis, setKpis] = useState(null);
  const [platformData, setPlatformData] = useState([]);
  const [spendData, setSpendData] = useState([]);
  const [dailyData, setDailyData] = useState([]);

  useEffect(() => {
    async function loadData() {
      if (!currentAccount) return;
      setLoading(true);
      
      const salesKpis = await ordersService.getRevenueMetrics(currentAccount, period);
      const totalRevenue = salesKpis?.rawTotals?.net || 0;
      const totalOrders = salesKpis?.rawTotals?.billed || 0;
      
      const adsMetrics = await adsService.getAdMetrics(currentAccount, period);
      
      if (adsMetrics && adsMetrics.rawTotals.spend > 0) {
        setHasData(true);
        const totalSpend = adsMetrics.rawTotals.spend || 0;
        const roasVal = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : '0.00';
        const cpsVal = totalOrders > 0 ? (totalSpend / totalOrders).toFixed(2) : '0.00';
        
        const getTrend = (val) => val > 0 ? 'up' : val < 0 ? 'down' : 'neutral';
        const getInvertedTrend = (val) => val > 0 ? 'down' : val < 0 ? 'up' : 'neutral';

        setKpis({
          totalSpend:  { value: adsMetrics.kpis.totalSpend, change: adsMetrics.deltas.totalSpend.value, trend: getTrend(adsMetrics.deltas.totalSpend.value) },
          roas:        { value: `${roasVal}x`, change: 0, trend: 'neutral' }, // ROAS variation can be tricky, neutral for now
          cps:         { value: `R$ ${cpsVal.replace('.', ',')}`, change: 0, trend: 'neutral' }, 
          avgCpc:      { value: adsMetrics.kpis.avgCpc, change: adsMetrics.deltas.avgCpc.value, trend: getInvertedTrend(adsMetrics.deltas.avgCpc.value) },
          impressions: { value: adsMetrics.kpis.impressions, change: adsMetrics.deltas.impressions.value, trend: getTrend(adsMetrics.deltas.impressions.value) },
          clicks:      { value: adsMetrics.kpis.clicks, change: adsMetrics.deltas.clicks.value, trend: getTrend(adsMetrics.deltas.clicks.value) },
          ctr:         { value: adsMetrics.kpis.ctr, change: adsMetrics.deltas.ctr.value, trend: getTrend(adsMetrics.deltas.ctr.value) }
        });
        
        const enrichedPlatforms = adsMetrics.platforms.map(p => {
          // Calcular ROAS proporcional: receita atribuída pela participação no gasto
          const platformShareOfSpend = totalSpend > 0 ? (p.spend / totalSpend) : 0;
          const attributedRevenue = totalRevenue * platformShareOfSpend;
          const pRoas = p.spend > 0 ? (attributedRevenue / p.spend).toFixed(2) : '0.00';
          const pCps = p.clicks > 0 ? (p.spend / p.clicks).toFixed(2) : 0;
          return {
            ...p,
            roas: pRoas,
            cps: parseFloat(pCps)
          };
        });
        
        setPlatformData(enrichedPlatforms);
        setSpendData(enrichedPlatforms.map(p => ({ platform: p.platform, investimento: p.spend, color: p.color })));

        // Transform records into daily chart format
        const dailyMap = {};
        adsMetrics.records.forEach(r => {
           const d = r.date.split('T')[0];
           const dd = d.substring(8,10) + '/' + d.substring(5,7);
           if (!dailyMap[dd]) dailyMap[dd] = { date: dd, meta: 0, google: 0, tiktok: 0 };
           if (r.platform.toLowerCase().includes('meta') || r.platform.toLowerCase().includes('facebook')) dailyMap[dd].meta += r.spend;
           if (r.platform.toLowerCase().includes('google')) dailyMap[dd].google += r.spend;
           if (r.platform.toLowerCase().includes('tiktok')) dailyMap[dd].tiktok += r.spend;
        });
        setDailyData(Object.values(dailyMap).slice(-15));

      } else {
        setHasData(false);
        setKpis(null);
        setPlatformData([]);
        setSpendData([]);
        setDailyData([]);
      }
      setLoading(false);
    }
    loadData();
  }, [currentAccount, period, dataVersion, multiplier]);

  if (!loading && !hasData) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Mídia Paga</h1>
            <p className="page-subtitle">Performance de investimentos em plataformas de mídia paga</p>
          </div>
          <PeriodFilter />
        </div>
        <div className="card" style={{ marginTop: 24 }}>
          <EmptyState />
        </div>
      </div>
    );
  }

  return (
    <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mídia Paga</h1>
          <p className="page-subtitle">Performance de investimentos em plataformas de mídia paga</p>
        </div>
        <PeriodFilter />
      </div>

      <div className="section-grid-4">
        <KPICard title="Investimento Total" value={kpis?.totalSpend?.value || 'R$ 0,00'}  change={kpis?.totalSpend?.change || 0}  trend={kpis?.totalSpend?.trend || "neutral"}   icon={DollarSign}   color="primary" />
        <KPICard title="ROAS Geral"         value={kpis?.roas?.value || '0.00x'}        change={kpis?.roas?.change || 0} trend={kpis?.roas?.trend || "neutral"} icon={TrendingUp}    color="amber" />
        <KPICard title="CPS"                value={kpis?.cps?.value || 'R$ 0,00'}         change={kpis?.cps?.change || 0}  trend={kpis?.cps?.trend || "neutral"}   icon={Target}        color="green" />
        <KPICard title="CPC Médio"          value={kpis?.avgCpc?.value || 'R$ 0,00'}      change={kpis?.avgCpc?.change || 0}      trend={kpis?.avgCpc?.trend || "neutral"} icon={MousePointer}  color="red" />
      </div>
      <div className="section-grid-4">
        <KPICard title="Impressões"  value={kpis?.impressions?.value || '0'} change={kpis?.impressions?.change || 0} trend={kpis?.impressions?.trend || "neutral"}   icon={Eye}      color="blue" />
        <KPICard title="Cliques"     value={kpis?.clicks?.value || '0'}      change={kpis?.clicks?.change || 0}      trend={kpis?.clicks?.trend || "neutral"}   icon={MousePointer} color="cyan" />
        <KPICard title="CTR"         value={kpis?.ctr?.value || '0.00%'}         change={kpis?.ctr?.change || 0} trend={kpis?.ctr?.trend || "neutral"} icon={Megaphone} color="amber" />
        <div className="card roas-highlight" style={{ padding:20, position: 'relative' }}>
          <p style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8, fontWeight:500 }}>Melhor Plataforma</p>
          <p style={{ fontSize:18, fontWeight:700, color:'var(--accent-primary)', marginBottom:4 }}>{platformData.length > 0 ? platformData.reduce((prev, current) => (prev.roas > current.roas) ? prev : current).platform : '-'}</p>
          <p style={{ fontSize:12, color:'var(--accent-green)', fontWeight:500 }}>Top Performer ↑</p>
        </div>
      </div>

      <div className="charts-row">
        <ChartCard title="Investimento Diário" subtitle="Gasto mensal por plataforma">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dailyData} margin={{ top:10, right:10, left:0, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill:'#4B5568', fontSize:10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'#4B5568', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>`R$${v}`} />
              <Tooltip content={<SpendTooltip />} />
              <Legend formatter={v => <span style={{ color:'#8B95A8', fontSize:12 }}>{v.charAt(0).toUpperCase()+v.slice(1)}</span>} />
              <Line type="monotone" dataKey="meta"   name="meta"   stroke="#6366F1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="google" name="google" stroke="#3B82F6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="tiktok" name="tiktok" stroke="#EC4899" strokeWidth={2} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Investimento por Plataforma" subtitle="Distribuição de budget">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={spendData} margin={{ top:10, right:10, left:0, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="platform" tick={{ fill:'#4B5568', fontSize:10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'#4B5568', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<SpendTooltip />} />
              <Bar dataKey="investimento" name="Investimento" radius={[6,6,0,0]}>
                {spendData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Breakdown por Plataforma" subtitle="Performance detalhada por canal de mídia">
        <DataTable columns={platformCols} data={platformData} />
      </ChartCard>
    </div>
  );
}
