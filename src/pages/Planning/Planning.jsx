import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Target, TrendingUp, Calendar, Award, Settings, Save, X, Edit2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import KPICard from '../../components/UI/KPICard';
import ChartCard from '../../components/UI/ChartCard';
import PeriodFilter from '../../components/UI/PeriodFilter';
import { useFilter } from '../../contexts/FilterContext';
import { ordersService } from '../../services/orders';
import { adsService } from '../../services/ads';
import { supabase } from '../../lib/supabase';
import { getBrasiliaNow } from '../../lib/dateUtils';
import './Planning.css';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>Dia {label}</p>
      {payload.map((p,i) => p.value && (
        <p key={i} style={{ color:p.color, fontSize:13, fontWeight:600 }}>
          {p.name}: R$ {Number(p.value).toLocaleString('pt-BR')}
        </p>
      ))}
    </div>
  );
};

function GoalCard({ label, target, current, pct, format = 'number', onEdit }) {
  const fmt = v => format === 'currency' ? `R$ ${Number(v).toLocaleString('pt-BR')}` : format === 'roas' ? `${v}x` : Number(v).toLocaleString('pt-BR');
  const statusColor = pct >= 95 ? '#10B981' : pct >= 80 ? '#F59E0B' : pct >= 50 ? '#F97316' : '#EF4444';
  const remaining = Math.max(0, target - current);

  return (
    <div className="goal-card card">
      <div className="goal-top">
        <span className="goal-label">{label}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="goal-pct" style={{ color: statusColor, background: statusColor + '18' }}>{pct}%</span>
          {onEdit && (
            <button onClick={onEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
              <Edit2 size={12} style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>
      </div>
      <div className="goal-values">
        <div>
          <p className="goal-current">{fmt(current)}</p>
          <p className="goal-sublabel">Realizado</p>
        </div>
        <div className="goal-divider" />
        <div>
          <p className="goal-target">{fmt(target)}</p>
          <p className="goal-sublabel">Meta</p>
        </div>
      </div>
      <div className="goal-bar-track">
        <div className="goal-bar-fill" style={{ width:`${Math.min(pct, 100)}%`, background: statusColor }} />
      </div>
      <p className="goal-remaining">
        {remaining > 0 ? `Faltam ${fmt(remaining)} para atingir a meta` : '🎉 Meta atingida!'}
      </p>
    </div>
  );
}

function GoalEditor({ goals, onSave, onCancel }) {
  const [form, setForm] = useState({
    revenue_target: goals?.revenue_target || 0,
    orders_target: goals?.orders_target || 0,
    roas_target: goals?.roas_target || 0,
    new_customers_target: goals?.new_customers_target || 0,
    period_type: goals?.period_type || 'month'
  });

  return (
    <div className="card" style={{ padding: 24, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
          <Settings size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Configurar Metas
        </h3>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <X size={18} />
        </button>
      </div>
      
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {['month', 'quarter', 'year'].map(pt => (
          <button
            key={pt}
            onClick={() => setForm(f => ({ ...f, period_type: pt }))}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: form.period_type === pt ? '1px solid var(--accent-primary)' : '1px solid var(--border-primary)',
              background: form.period_type === pt ? 'rgba(99,102,241,0.12)' : 'transparent',
              color: form.period_type === pt ? 'var(--accent-primary)' : 'var(--text-secondary)'
            }}
          >
            {pt === 'month' ? 'Mensal' : pt === 'quarter' ? 'Trimestral' : 'Anual'}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Meta de Receita (R$)</label>
          <input type="number" value={form.revenue_target} onChange={e => setForm(f => ({ ...f, revenue_target: Number(e.target.value) }))}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Meta de Pedidos</label>
          <input type="number" value={form.orders_target} onChange={e => setForm(f => ({ ...f, orders_target: Number(e.target.value) }))}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Meta de ROAS</label>
          <input type="number" step="0.1" value={form.roas_target} onChange={e => setForm(f => ({ ...f, roas_target: Number(e.target.value) }))}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Meta Novos Clientes</label>
          <input type="number" value={form.new_customers_target} onChange={e => setForm(f => ({ ...f, new_customers_target: Number(e.target.value) }))}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14 }} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, gap: 10 }}>
        <button onClick={onCancel} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-primary)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
          Cancelar
        </button>
        <button onClick={() => onSave(form)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Save size={14} /> Salvar Metas
        </button>
      </div>
    </div>
  );
}

export default function Planning({ currentAccount }) {
  const { period, dataVersion } = useFilter();
  const [goals, setGoals] = useState(null);
  const [actuals, setActuals] = useState({ revenue: 0, orders: 0, roas: 0, newCustomers: 0 });
  const [projectionData, setProjectionData] = useState([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(0);

  // Calcular dias restantes do mês
  useEffect(() => {
    const now = getBrasiliaNow();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    setDaysRemaining(lastDay - now.getDate());
  }, []);

  // Carregar metas do Supabase
  const loadGoals = useCallback(async () => {
    if (!currentAccount) return;
    const { data: account } = await supabase.from('accounts').select('id').eq('slug', currentAccount).single();
    if (!account?.id) return;

    const now = getBrasiliaNow();
    const refDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const { data } = await supabase
      .from('planning_goals')
      .select('*')
      .eq('account_id', account.id)
      .eq('reference_date', refDate)
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setGoals(data[0]);
    } else {
      setGoals(null);
    }
  }, [currentAccount]);

  // Carregar dados reais (realized)
  useEffect(() => {
    async function loadActuals() {
      if (!currentAccount) return;

      const rev = await ordersService.getRevenueMetrics(currentAccount, period);
      const ret = await ordersService.getRetentionMetrics(currentAccount, period);
      const ads = await adsService.getAdMetrics(currentAccount, period);

      const revenue = rev?.rawTotals?.net || 0;
      const orders = rev?.rawTotals?.billed || 0;
      const spend = ads?.rawTotals?.spend || 0;
      const roas = spend > 0 ? parseFloat((revenue / spend).toFixed(2)) : 0;
      const newCust = parseInt((ret?.newCustomers || '0').replace(/\D/g, '')) || 0;

      setActuals({ revenue, orders, roas, newCustomers: newCust });

      // Gerar projeção baseada na tendência real
      if (rev?.records?.length > 0) {
        const now = getBrasiliaNow();
        const currentDay = now.getDate();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

        // Agrupar receita diária real
        const dailyRevenue = {};
        rev.records.forEach(r => {
          if (r.status === 'invoiced' || r.payment_status === 'approved') {
            const day = parseInt(r.created_at.split('T')[0].split('-')[2]);
            dailyRevenue[day] = (dailyRevenue[day] || 0) + Number(r.amount || 0);
          }
        });

        // Média diária para projeção
        const daysWithData = Object.keys(dailyRevenue).length || 1;
        const avgDaily = revenue / daysWithData;

        const projection = [];
        let accumulatedActual = 0;

        for (let d = 1; d <= lastDay; d++) {
          const dayRevenue = dailyRevenue[d] || 0;
          accumulatedActual += dayRevenue;

          if (d <= currentDay) {
            projection.push({
              day: d,
              actual: Math.round(accumulatedActual),
              projected: d >= currentDay - 1 ? Math.round(accumulatedActual) : null,
              upper: null,
              lower: null
            });
          } else {
            const projectedAccum = revenue + avgDaily * (d - currentDay);
            projection.push({
              day: d,
              actual: null,
              projected: Math.round(projectedAccum),
              upper: Math.round(projectedAccum * 1.12),
              lower: Math.round(projectedAccum * 0.88)
            });
          }
        }
        setProjectionData(projection);
      }
    }
    loadActuals();
  }, [currentAccount, period, dataVersion]);

  useEffect(() => { loadGoals(); }, [loadGoals]);

  const handleSave = async (form) => {
    if (!currentAccount) return;
    setSaving(true);

    const { data: account } = await supabase.from('accounts').select('id').eq('slug', currentAccount).single();
    if (!account?.id) { setSaving(false); return; }

    const now = getBrasiliaNow();
    const refDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const { error } = await supabase
      .from('planning_goals')
      .upsert({
        account_id: account.id,
        period_type: form.period_type,
        reference_date: refDate,
        revenue_target: form.revenue_target,
        orders_target: form.orders_target,
        roas_target: form.roas_target,
        new_customers_target: form.new_customers_target,
        updated_at: new Date().toISOString()
      }, { onConflict: 'account_id,period_type,reference_date' });

    if (!error) {
      await loadGoals();
      setEditing(false);
    }
    setSaving(false);
  };

  // Calcular percentuais
  const calcPct = (current, target) => target > 0 ? Math.min(Math.round((current / target) * 100), 200) : 0;

  const g = goals ? {
    revenueGoal:  { target: Number(goals.revenue_target), current: actuals.revenue, pct: calcPct(actuals.revenue, Number(goals.revenue_target)) },
    ordersGoal:   { target: Number(goals.orders_target), current: actuals.orders, pct: calcPct(actuals.orders, Number(goals.orders_target)) },
    mediaROI:     { target: Number(goals.roas_target), current: actuals.roas, pct: calcPct(actuals.roas, Number(goals.roas_target)) },
    newCustomers: { target: Number(goals.new_customers_target), current: actuals.newCustomers, pct: calcPct(actuals.newCustomers, Number(goals.new_customers_target)) },
  } : null;

  const avgPct = g ? Math.round((g.revenueGoal.pct + g.ordersGoal.pct + g.mediaROI.pct + g.newCustomers.pct) / 4) : 0;

  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const now = getBrasiliaNow();
  const monthLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Planejamento & Projeções</h1>
          <p className="page-subtitle">Acompanhamento de metas e projeções para {monthLabel}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <PeriodFilter />
          {!editing && (
            <button onClick={() => setEditing(true)}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--accent-primary)', background: 'rgba(99,102,241,0.08)', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Settings size={14} /> {goals ? 'Editar Metas' : 'Definir Metas'}
            </button>
          )}
        </div>
      </div>

      {editing && <GoalEditor goals={goals} onSave={handleSave} onCancel={() => setEditing(false)} />}

      {!goals && !editing ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <Target size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Nenhuma meta definida</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            Configure suas metas mensais para acompanhar o progresso em tempo real.
          </p>
          <button onClick={() => setEditing(true)}
            style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Definir Metas Agora
          </button>
        </div>
      ) : g && (
        <>
          <div className="section-grid-4">
            <KPICard title="Atingimento Receita" value={`${g.revenueGoal.pct}%`}    change={g.revenueGoal.pct >= 100 ? 0 : g.revenueGoal.pct - 100}  trend={g.revenueGoal.pct >= 80 ? "up" : "down"} icon={Target}    color="primary" />
            <KPICard title="Atingimento Pedidos" value={`${g.ordersGoal.pct}%`}     change={g.ordersGoal.pct >= 100 ? 0 : g.ordersGoal.pct - 100}  trend={g.ordersGoal.pct >= 80 ? "up" : "down"} icon={Award}     color="blue"    />
            <KPICard title="Meta ROI Mídia"      value={`${g.mediaROI.pct}%`}       change={g.mediaROI.pct >= 100 ? 0 : g.mediaROI.pct - 100}  trend={g.mediaROI.pct >= 80 ? "up" : "down"} icon={TrendingUp} color="green"   />
            <KPICard title="Dias Restantes"      value={String(daysRemaining)}      change={0}    trend="neutral" icon={Calendar} color="amber"  />
          </div>

          <div className="section-grid-2" style={{ marginBottom:24 }}>
            <GoalCard label="Meta de Receita"    target={g.revenueGoal.target}  current={g.revenueGoal.current}  pct={g.revenueGoal.pct}  format="currency" onEdit={() => setEditing(true)} />
            <GoalCard label="Meta de Pedidos"    target={g.ordersGoal.target}   current={g.ordersGoal.current}   pct={g.ordersGoal.pct}   format="number" onEdit={() => setEditing(true)} />
            <GoalCard label="Meta ROI de Mídia" target={g.mediaROI.target}     current={g.mediaROI.current}     pct={g.mediaROI.pct}     format="roas" onEdit={() => setEditing(true)} />
            <GoalCard label="Novos Clientes"     target={g.newCustomers.target} current={g.newCustomers.current} pct={g.newCustomers.pct} format="number" onEdit={() => setEditing(true)} />
          </div>

          {projectionData.length > 0 && (
            <ChartCard
              title={`Projeção de Receita — ${monthLabel}`}
              subtitle="Linha de tendência com intervalo de confiança"
              tooltip="A área sombreada representa o intervalo de confiança da projeção (±12%). A linha sólida mostra o valor realizado e a tracejada a projeção."
            >
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={projectionData} margin={{ top:20, right:20, left:0, bottom:0 }}>
                  <defs>
                    <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0}   />
                    </linearGradient>
                    <linearGradient id="gradProjected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10B981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}   />
                    </linearGradient>
                    <linearGradient id="gradBand" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10B981" stopOpacity={0.08} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}     />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="day" tick={{ fill:'#4B5568', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>`D${v}`} />
                  <YAxis tick={{ fill:'#4B5568', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine x={now.getDate()} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 2" label={{ value:'Hoje', fill:'#4B5568', fontSize:10 }} />
                  {goals && goals.revenue_target > 0 && (
                    <ReferenceLine y={Number(goals.revenue_target)} stroke="#F59E0B" strokeDasharray="6 3" label={{ value:'Meta', fill:'#F59E0B', fontSize:10, position:'right' }} />
                  )}
                  <Legend formatter={v => <span style={{ color:'#8B95A8', fontSize:12 }}>
                    {v==='upper'?'Limite Superior':v==='lower'?'Limite Inferior':v==='actual'?'Realizado':'Projetado'}
                  </span>} />
                  <Area type="monotone" dataKey="upper"     name="upper"     stroke="none"    fill="url(#gradBand)"      connectNulls />
                  <Area type="monotone" dataKey="lower"     name="lower"     stroke="none"    fill="var(--bg-primary)"  connectNulls />
                  <Area type="monotone" dataKey="actual"    name="actual"    stroke="#6366F1" fill="url(#gradActual)"    strokeWidth={2} dot={false} connectNulls />
                  <Area type="monotone" dataKey="projected" name="projected" stroke="#10B981" fill="url(#gradProjected)" strokeWidth={2} dot={false} strokeDasharray="5 3" connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </>
      )}
    </div>
  );
}
