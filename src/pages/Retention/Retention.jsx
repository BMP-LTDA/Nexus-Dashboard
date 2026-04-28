import React, { useMemo, useState, useEffect } from 'react';
import { Users, UserPlus, RefreshCcw, Heart, TrendingUp, ArrowDownRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import KPICard from '../../components/UI/KPICard';
import ChartCard from '../../components/UI/ChartCard';
import PeriodFilter from '../../components/UI/PeriodFilter';
import { useFilter } from '../../contexts/FilterContext';
import { ordersService } from '../../services/orders';
import './Retention.css';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{ color:p.color, fontSize:13, fontWeight:600 }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

const getCohortColor = (value) => {
  if (value === null || value === undefined) return 'transparent';
  if (value >= 100) return 'rgba(99,102,241,0.9)';
  if (value >= 40)  return 'rgba(99,102,241,0.5)';
  if (value >= 25)  return 'rgba(99,102,241,0.3)';
  if (value >= 15)  return 'rgba(99,102,241,0.2)';
  return 'rgba(99,102,241,0.1)';
};

export default function Retention({ currentAccount }) {
  const { period, multiplier, dataVersion } = useFilter();
  const [m, setM] = useState({
    newCustomers: { value: '0', change: 0 },
    returningCustomers: { value: '0', change: 0 },
    retentionRate: { value: '0%', change: 0 },
    ltv: { value: 'R$ 0,00', change: 0 },
    churnRate: { value: '0%', change: 0 },
    avgOrders: { value: '0', change: 0 }
  });
  const [retentionTimeline, setRetentionTimeline] = useState([]);
  const [cohortData, setCohortData] = useState([]);
  const [segments, setSegments] = useState({ champion: 0, atRisk: 0 });

  useEffect(() => {
    async function loadRetention() {
      if (!currentAccount) return;

      // 1. KPIs de retenção
      const ret = await ordersService.getRetentionMetrics(currentAccount, period);
      if (ret) {
        setM({
          newCustomers: { value: ret.newCustomers, change: ret.newCustomersChange || 0 },
          returningCustomers: { value: ret.returningCustomers, change: ret.returningCustomersChange || 0 },
          retentionRate: { value: ret.retentionRate, change: ret.retentionRateChange || 0 },
          ltv: { value: ret.ltv, change: ret.ltvChange || 0 },
          churnRate: { value: `${(100 - parseFloat((ret.retentionRate || '0').replace(',', '.').replace('%', ''))).toFixed(1).replace('.', ',')}%`, change: 0 },
          avgOrders: { value: '0', change: 0 }
        });
      }

      // 2. Timeline mensal (Novos vs Recorrentes) — dados reais
      const timeline = await ordersService.getMonthlyCustomerTimeline(currentAccount);
      if (timeline && timeline.length > 0) {
        setRetentionTimeline(timeline);
      }

      // 3. Cohort real
      const cohort = await ordersService.getCohortData(currentAccount);
      if (cohort && cohort.length > 0) {
        setCohortData(cohort);
      }

      // 4. Segmentos
      const segs = await ordersService.getCustomerSegments(currentAccount);
      if (segs) {
        setSegments(segs);
      }
    }
    loadRetention();
  }, [currentAccount, period, multiplier, dataVersion]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Retenção & Clientes</h1>
          <p className="page-subtitle">Análise de fidelização, LTV e comportamento de clientes</p>
        </div>
        <PeriodFilter />
      </div>

      <div className="section-grid-4">
        <KPICard title="Clientes Novos"      value={m.newCustomers.value}       change={m.newCustomers.change}       trend={m.newCustomers.change >= 0 ? "up" : "down"}   icon={UserPlus}       color="blue"    />
        <KPICard title="Clientes Recorrentes" value={m.returningCustomers.value} change={m.returningCustomers.change} trend={m.returningCustomers.change >= 0 ? "up" : "down"}   icon={RefreshCcw}     color="primary" />
        <KPICard title="Taxa de Retenção"    value={m.retentionRate.value}    change={m.retentionRate.change}    trend={m.retentionRate.change >= 0 ? "up" : "down"}   icon={Heart}          color="green"   />
        <KPICard title="LTV Estimado"        value={m.ltv.value}              change={m.ltv.change}              trend={m.ltv.change >= 0 ? "up" : "down"}   icon={TrendingUp}     color="amber"   />
      </div>
      <div className="section-grid-4">
        <KPICard title="Churn Rate"     value={m.churnRate.value}  change={Math.abs(m.churnRate.change)}  trend="up"   icon={ArrowDownRight} color="green" />
        <KPICard title="Pedidos/Cliente" value={m.avgOrders.value} change={m.avgOrders.change}            trend="up"   icon={Users}          color="cyan"  />
        <div className="card" style={{ padding:20 }}>
          <p style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8, fontWeight:500 }}>Segmento Champion</p>
          <p style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)', marginBottom:8 }}>{segments.champion}</p>
          <p style={{ fontSize:11, color:'var(--accent-green)' }}>Clientes de alto valor ↑</p>
        </div>
        <div className="card" style={{ padding:20 }}>
          <p style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8, fontWeight:500 }}>Em risco de churn</p>
          <p style={{ fontSize:22, fontWeight:700, color:'var(--accent-red)', marginBottom:8 }}>{segments.atRisk}</p>
          <p style={{ fontSize:11, color:'var(--text-muted)' }}>Requer ação de retenção</p>
        </div>
      </div>

      <div className="charts-row">
        <ChartCard title="Novos vs. Recorrentes" subtitle="Evolução mensal de clientes por tipo">
          {retentionTimeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={retentionTimeline} margin={{ top:10, right:10, left:0, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fill:'#4B5568', fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:'#4B5568', fontSize:10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={v => <span style={{ color:'#8B95A8', fontSize:12 }}>{v==='novos'?'Novos':'Recorrentes'}</span>} />
                <Line type="monotone" dataKey="novos"       name="novos"       stroke="#6366F1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="recorrentes" name="recorrentes" stroke="#10B981" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:250, color:'var(--text-muted)', fontSize:13 }}>
              Dados insuficientes para gerar timeline mensal
            </div>
          )}
        </ChartCard>

        <ChartCard title="Análise de Coorte" subtitle="Retenção mensal por coorte de aquisição" tooltip="Percentual de clientes que retornaram em cada mês após a primeira compra.">
          {cohortData.length > 0 ? (
            <div className="cohort-table">
              <div className="cohort-header">
                <div className="cohort-cell cohort-month-label">Coorte</div>
                {['M+0','M+1','M+2','M+3','M+4','M+5'].map(m => (
                  <div key={m} className="cohort-cell cohort-head">{m}</div>
                ))}
              </div>
              {cohortData.map(row => (
                <div key={row.month} className="cohort-row">
                  <div className="cohort-cell cohort-month">{row.month}</div>
                  {['m0','m1','m2','m3','m4','m5'].map(k => (
                    <div key={k} className="cohort-cell" style={{ background: getCohortColor(row[k]) }}>
                      {row[k] !== null && row[k] !== undefined ? `${row[k]}%` : '—'}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200, color:'var(--text-muted)', fontSize:13 }}>
              Dados insuficientes para análise de coorte
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
