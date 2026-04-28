import React, { useState, useEffect, useMemo } from 'react';
import { Globe, Users, ArrowDownRight, Wifi } from 'lucide-react';
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import KPICard from '../../components/UI/KPICard';
import ChartCard from '../../components/UI/ChartCard';
import DataTable from '../../components/UI/DataTable';
import PeriodFilter from '../../components/UI/PeriodFilter';
import { useFilter } from '../../contexts/FilterContext';
import { analyticsService } from '../../services/analytics';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{ color:p.color, fontSize:13, fontWeight:600 }}>{p.name}: {Number(p.value).toLocaleString('pt-BR')}</p>
      ))}
    </div>
  );
};

const RADIAN = Math.PI / 180;
const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
  if (percent < 0.06) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{`${(percent*100).toFixed(0)}%`}</text>;
};

export default function Traffic({ currentAccount }) {
  const { period, dataVersion } = useFilter();
  
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ sessions: '0', users: '0', newCust: '0' });
  const [sessionsChartData, setSessionsChartData] = useState([]);
  const [trafficData, setTrafficData] = useState([]);

  useEffect(() => {
    async function loadData() {
      if (!currentAccount) return;
      setLoading(true);
      
      const data = await analyticsService.getMetrics(currentAccount, period);
      if (data) {
        setKpis(data.kpis);
        setSessionsChartData(data.sessionsChart);
        setTrafficData(data.trafficSources);
      }
      setLoading(false);
    }
    loadData();
  }, [currentAccount, period, dataVersion]);

  const totalSessions = useMemo(() => trafficData.reduce((a, b) => a + b.sessions, 0), [trafficData]);
  const organic = useMemo(() => trafficData.find(t => t.source === 'Orgânico')?.sessions || 0, [trafficData]);
  const organicPct = totalSessions > 0 ? ((organic / totalSessions) * 100).toFixed(1) : 0;

  const trafficCols = [
    { key: 'source',   label: 'Fonte',           sortable: true },
    { key: 'sessions', label: 'Sessões',          sortable: true, align:'right', render: v => Number(v).toLocaleString('pt-BR') },
    { key: 'users',    label: 'Usuários Únicos',  sortable: true, align:'right', render: v => Number(v).toLocaleString('pt-BR') },
    { key: 'bounce',   label: 'Bounce Rate',      sortable: true, align:'right' },
    { key: 'pct', label: 'Share %', align:'right',
      render: (_, row) => {
        const pct = totalSessions > 0 ? ((row.sessions / totalSessions) * 100).toFixed(1) : 0;
        return (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8 }}>
            <div style={{ width:60, height:4, background:'var(--bg-tertiary)', borderRadius:99, overflow:'hidden' }}>
              <div style={{ width:`${pct}%`, height:'100%', background: row.color, borderRadius:99 }} />
            </div>
            <span>{pct}%</span>
          </div>
        );
      }
    },
  ];

  return (
    <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tráfego & Aquisição</h1>
          <p className="page-subtitle">Análise de sessões, origens e comportamento dos usuários</p>
        </div>
        <PeriodFilter />
      </div>

      <div className="section-grid-4">
        <KPICard title="Total de Sessões"  value={kpis.sessions}  change={9.2}   trend="up"   icon={Globe}  color="primary" requiresGA4={true} />
        <KPICard title="Usuários Únicos"   value={kpis.users}  change={7.8}   trend="up"   icon={Users}  color="blue"    requiresGA4={true} />
        <KPICard title="Bounce Rate"       value="38,4%"    change={-2.1}  trend="up"   icon={ArrowDownRight} color="green" requiresGA4={true} />
        <KPICard title="Sessões Orgânicas" value={`${organicPct}%`} change={1.4} trend="up" icon={Wifi} color="green" requiresGA4={true} />
      </div>

      <div className="charts-row">
        <ChartCard title="Sessões ao Longo do Tempo" subtitle="Sessões e usuários únicos diários" requiresGA4={true}>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={sessionsChartData} margin={{ top:10, right:10, left:0, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill:'#4B5568', fontSize:10 }} axisLine={false} tickLine={false} interval={period === '30d' ? 4 : 0} />
              <YAxis      tick={{ fill:'#4B5568', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={v => <span style={{ color:'#8B95A8', fontSize:12 }}>{v==='sessoes'?'Sessões':'Usuários'}</span>} />
              <Line type="monotone" dataKey="sessoes"  name="sessoes"  stroke="#6366F1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="usuarios" name="usuarios" stroke="#10B981" strokeWidth={2} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribuição por Canal" subtitle="Share de sessões por fonte" requiresGA4={true}>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={trafficData} dataKey="sessions" nameKey="source" cx="50%" cy="50%"
                outerRadius={95} innerRadius={45} labelLine={false} label={renderLabel}>
                {trafficData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [Number(v).toLocaleString('pt-BR'), n]} />
              <Legend formatter={v => <span style={{ color:'#8B95A8', fontSize:11 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Análise por Fonte de Tráfego" subtitle="Detalhamento completo de origens" requiresGA4={true}>
        <DataTable columns={trafficCols} data={trafficData} />
      </ChartCard>
    </div>
  );
}
