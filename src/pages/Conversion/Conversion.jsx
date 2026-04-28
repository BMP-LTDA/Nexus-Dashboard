import React, { useState, useEffect } from 'react';
import { MousePointerClick, ShoppingCart, CreditCard, Package, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import KPICard from '../../components/UI/KPICard';
import ChartCard from '../../components/UI/ChartCard';
import PeriodFilter from '../../components/UI/PeriodFilter';
import { useFilter } from '../../contexts/FilterContext';
import { analyticsService } from '../../services/analytics';
import './Conversion.css';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{ color:p.color, fontSize:13, fontWeight:600 }}>{p.name}: {p.value}%</p>
      ))}
    </div>
  );
};

export default function Conversion({ currentAccount }) {
  const { period, dataVersion } = useFilter();
  
  const [loading, setLoading] = useState(true);
  const [funnelData, setFunnelData] = useState([]);
  const [funnelComparison, setFunnelComparison] = useState([]);

  useEffect(() => {
    async function loadData() {
      if (!currentAccount) return;
      setLoading(true);
      
      const data = await analyticsService.getMetrics(currentAccount, period);
      if (data && data.funnelData) {
        setFunnelData(data.funnelData);
        
        // Mocking previous period comparison based on current funnel logic
        const comparison = [
          { stage: 'Conversão Geral', atual: data.funnelData[4]?.pct || 0, anterior: ((data.funnelData[4]?.pct || 0) * 1.1).toFixed(2) },
          { stage: 'Add-to-Cart',     atual: data.funnelData[2]?.pct || 0, anterior: ((data.funnelData[2]?.pct || 0) * 0.95).toFixed(1) },
          { stage: 'Checkout Rate',   atual: data.funnelData[3]?.pct || 0, anterior: ((data.funnelData[3]?.pct || 0) * 1.05).toFixed(1) },
          { stage: 'Purchase Rate',   atual: data.funnelData[4]?.pct || 0, anterior: ((data.funnelData[4]?.pct || 0) * 1.1).toFixed(2) },
        ];
        setFunnelComparison(comparison);
      }
      setLoading(false);
    }
    loadData();
  }, [currentAccount, period, dataVersion]);

  // Fallbacks if data is loading or empty
  const conversionRate = funnelData[4]?.pct || 0;
  const addToCartRate = funnelData[2]?.pct || 0;
  const checkoutRate = funnelData[3]?.pct || 0;
  const totalSessionsVal = funnelData[0]?.value || 1;

  return (
    <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Conversão & Funil</h1>
          <p className="page-subtitle">Análise do funil de vendas e taxas de conversão por etapa</p>
        </div>
        <PeriodFilter />
      </div>

      <div className="section-grid-4">
        <KPICard title="Taxa de Conversão"  value={`${conversionRate}%`}  change={-0.8} trend="down"    icon={MousePointerClick} color="primary" requiresGA4={true} />
        <KPICard title="Add-to-Cart Rate"   value={`${addToCartRate}%`}  change={5.2}  trend="up"      icon={ShoppingCart}      color="blue"    requiresGA4={true} />
        <KPICard title="Checkout Rate"      value={`${checkoutRate}%`}   change={-2.4} trend="down"    icon={CreditCard}        color="amber"   requiresGA4={true} />
        <KPICard title="Purchase Rate"      value={`${conversionRate}%`}  change={-0.8} trend="down"    icon={Package}           color="green"   requiresGA4={true} />
      </div>

      <div className="charts-row">
        {/* Custom Funnel */}
        <ChartCard title="Funil de Conversão" subtitle="Jornada do usuário: sessão até compra" requiresGA4={true}>
          <div className="funnel-container">
            {funnelData.map((stage, i) => {
              const width = 100 - (i * 14);
              return (
                <div key={stage.stage} className="funnel-step">
                  <div className="funnel-bar-wrap">
                    <div className="funnel-bar" style={{ width: `${width}%`, background: stage.color }}>
                      <span className="funnel-stage-name">{stage.stage}</span>
                    </div>
                    {i < funnelData.length - 1 && (
                      <div className="funnel-arrow">
                        <TrendingDown size={12} />
                        <span>{((funnelData[i+1].value / Math.max(1, stage.value)) * 100).toFixed(1)}% passam</span>
                      </div>
                    )}
                  </div>
                  <div className="funnel-metrics">
                    <span className="funnel-value">{Number(stage.value).toLocaleString('pt-BR')}</span>
                    <span className="funnel-pct">{stage.pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>

        {/* Comparison Chart */}
        <ChartCard title="Comparativo de Período" subtitle="Taxas de conversão: atual vs. anterior" requiresGA4={true}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={funnelComparison} layout="vertical" margin={{ top:10, right:20, left:20, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fill:'#4B5568', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} />
              <YAxis type="category" dataKey="stage" tick={{ fill:'#8B95A8', fontSize:11 }} axisLine={false} tickLine={false} width={100} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="anterior" name="Anterior" fill="#252A3A" radius={[0,4,4,0]} />
              <Bar dataKey="atual"    name="Atual"    fill="#6366F1" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Abandonment Analysis */}
      <ChartCard title="Análise de Abandono" subtitle="Pontos de maior perda no funil" requiresGA4={true}>
        <div className="abandonment-grid">
          {[
            { from: 'Produto → Carrinho', lost: Math.round(43320 * (totalSessionsVal / 118540)), pct: 66.8, color: '#EF4444', insight: 'Maior ponto de abandono — revisar CTAs e preços' },
            { from: 'Carrinho → Checkout', lost: Math.round(12560 * (totalSessionsVal / 118540)), pct: 41.5, color: '#F59E0B', insight: 'Considerar otimização do processo de checkout' },
            { from: 'Checkout → Compra',  lost: Math.round(5078 * (totalSessionsVal / 118540)),  pct: 43.1, color: '#F59E0B', insight: 'Otimizar formas de pagamento e UX do checkout' },
          ].map(a => (
            <div key={a.from} className="abandonment-item card">
              <div className="abandon-header">
                <span className="abandon-from">{a.from}</span>
                <span className="abandon-pct" style={{ color: a.color }}>-{a.pct}%</span>
              </div>
              <div className="abandon-lost">{a.lost.toLocaleString('pt-BR')} usuários perdidos</div>
              <div className="abandon-bar">
                <div style={{ width:`${a.pct}%`, height:'100%', background: a.color, borderRadius:99 }} />
              </div>
              <p className="abandon-insight">{a.insight}</p>
            </div>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}
