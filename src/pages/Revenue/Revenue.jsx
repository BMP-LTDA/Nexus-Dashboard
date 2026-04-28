import React, { useMemo, useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { DollarSign, ShoppingBag, CheckCircle, Clock, XCircle, TrendingUp } from 'lucide-react';
import KPICard from '../../components/UI/KPICard';
import ChartCard from '../../components/UI/ChartCard';
import DataTable from '../../components/UI/DataTable';
import StatusBadge from '../../components/UI/StatusBadge';
import PeriodFilter from '../../components/UI/PeriodFilter';
import { useFilter } from '../../contexts/FilterContext';
import { getRevenueByChannelPeriod } from '../../data/mockData';
import { ordersService } from '../../services/orders';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: 13, fontWeight: 600 }}>
          {p.name}: R$ {p.value?.toLocaleString('pt-BR')}
        </p>
      ))}
    </div>
  );
};

const channelTableCols = [
  { key: 'channel', label: 'Canal', sortable: true },
  { key: 'value', label: 'Receita', sortable: true, align: 'right',
    render: v => `R$ ${Number(v).toLocaleString('pt-BR')}` },
  { key: 'pct', label: '% do Total', sortable: true, align: 'right',
    render: v => `${v}%` },
  { key: 'trend', label: 'Tendência', align: 'right',
    render: () => <StatusBadge value="↑ Alta" type="success" /> },
];

export default function Revenue({ currentAccount }) {
  const { period, multiplier, dataVersion } = useFilter();
  const [kpis, setKpis] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [orderStatusData, setOrderStatusData] = useState([]);
  
  const channelData = useMemo(() => getRevenueByChannelPeriod(currentAccount, period, multiplier).map(c => ({ ...c, trend: 'up' })), [currentAccount, period, multiplier, dataVersion]);

  useEffect(() => {
    async function loadData() {
      if (!currentAccount) return;
      const rev = await ordersService.getRevenueMetrics(currentAccount, period);
      if (rev) {
        setKpis(rev);

        // Map status
        const total = rev.rawTotals.count || 1;
        setOrderStatusData([
          { status: 'Aprovados', value: rev.rawTotals.billed, pct: Math.round((rev.rawTotals.billed / total) * 100), color: '#10B981' },
          { status: 'Cancelados', value: parseInt(rev.cancellations.replace(/\D/g,'')) || 0, pct: Math.round(((parseInt(rev.cancellations.replace(/\D/g,'')) || 0) / total) * 100), color: '#EF4444' },
          { status: 'Em Análise', value: parseInt(rev.inAnalysis.replace(/\D/g,'')) || 0, pct: Math.round(((parseInt(rev.inAnalysis.replace(/\D/g,'')) || 0) / total) * 100), color: '#F59E0B' }
        ]);

        // Simple chart grouping logic based on records
        const grouped = {};
        const priorGrouped = {};
        rev.records.forEach(r => {
          const d = r.created_at.split('T')[0];
          if (!grouped[d]) grouped[d] = 0;
          if (r.status === 'invoiced' || r.payment_status === 'approved') {
            grouped[d] += Number(r.amount);
          }
        });
        // Período anterior real (se disponível)
        if (rev.priorRecords && rev.priorRecords.length > 0) {
          rev.priorRecords.forEach(r => {
            const d = r.created_at.split('T')[0];
            if (!priorGrouped[d]) priorGrouped[d] = 0;
            if (r.status === 'invoiced' || r.payment_status === 'approved') {
              priorGrouped[d] += Number(r.amount);
            }
          });
        }
        const priorValues = Object.keys(priorGrouped).sort().map(k => priorGrouped[k]);
        const cData = Object.keys(grouped).sort().map((k, idx) => ({
          date: k.substring(8,10) + '/' + k.substring(5,7),
          atual: grouped[k],
          anterior: priorValues[idx] || 0
        }));
        setChartData(cData.slice(-15)); // show last 15 days
      }
    }
    loadData();
  }, [currentAccount, period, multiplier, dataVersion]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Receita & Faturamento</h1>
          <p className="page-subtitle">Análise detalhada de receita, pedidos e aprovações</p>
        </div>
        <PeriodFilter />
      </div>

      <div className="section-grid-4">
        <KPICard title="Receita Bruta"     value={kpis?.gross || 'R$ 0,00'}    change={kpis?.grossChange || 0} trend={kpis?.grossChange >= 0 ? "up" : "down"}   icon={DollarSign}  color="primary" />
        <KPICard title="Receita Líquida"   value={kpis?.net || 'R$ 0,00'}      change={kpis?.netChange || 0} trend={kpis?.netChange >= 0 ? "up" : "down"}   icon={TrendingUp}  color="green"   />
        <KPICard title="Pedidos Captados"  value={kpis?.captured || '0'} change={kpis?.capturedChange || 0}  trend={kpis?.capturedChange >= 0 ? "up" : "down"}   icon={ShoppingBag} color="blue"    />
        <KPICard title="Pedidos Faturados" value={kpis?.billed || '0'}   change={kpis?.billedChange || 0}  trend={kpis?.billedChange >= 0 ? "up" : "down"}   icon={CheckCircle} color="green"   />
      </div>

      <div className="section-grid-4">
        <KPICard title="Aprovação"      value={kpis?.approvalRate || "0,0%"} change={0}  trend="neutral"   icon={CheckCircle} color="green" />
        <KPICard title="Cancelamentos"  value={kpis?.cancellations || "0"}    change={0} trend="neutral"   icon={XCircle}     color="red"   />
        <KPICard title="Em Análise"     value={kpis?.inAnalysis || "0"}       change={0} trend="neutral"   icon={Clock}       color="amber" />
        <KPICard title="Ticket Médio"   value={kpis?.avgTicket || "R$ 0,00"}  change={kpis?.avgTicketChange || 0}  trend={kpis?.avgTicketChange >= 0 ? "up" : "down"}   icon={TrendingUp}  color="cyan"  />
      </div>

      <div className="charts-row">
        <ChartCard title="Receita Diária" subtitle="Evolução de receita no período selecionado">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: '#4B5568', fontSize: 10 }} axisLine={false} tickLine={false} interval={period === '30d' ? 4 : 0} />
              <YAxis tick={{ fill: '#4B5568', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="atual" name="Receita" fill="#6366F1" radius={[4,4,0,0]} />
              <Bar dataKey="anterior" name="Anterior" fill="#252A3A" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Status dos Pedidos" subtitle="Volume por status">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {orderStatusData.map(s => (
              <div key={s.status}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                  <span style={{fontSize:13, color:'var(--text-primary)'}}>{s.status}</span>
                  <span style={{fontSize:13, fontWeight:600, color:'var(--text-primary)'}}>{s.value.toLocaleString('pt-BR')} <span style={{fontSize:11,color:'var(--text-muted)'}}>({s.pct}%)</span></span>
                </div>
                <div style={{ height:5, background:'var(--bg-tertiary)', borderRadius:99, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${s.pct}%`, background:s.color, borderRadius:99 }} />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Receita por Canal" subtitle="Detalhamento por fonte de receita" className="card">
        <DataTable columns={channelTableCols} data={channelData} />
      </ChartCard>
    </div>
  );
}
