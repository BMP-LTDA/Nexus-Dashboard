import React, { useState, useEffect } from 'react';
import { MousePointerClick, ShoppingCart, CreditCard, Package, TrendingDown, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import KPICard from '../../components/UI/KPICard';
import ChartCard from '../../components/UI/ChartCard';
import PeriodFilter from '../../components/UI/PeriodFilter';
import { useFilter } from '../../contexts/FilterContext';
import { pixelService } from '../../services/pixelService';
import './Conversion.css';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: 13, fontWeight: 600 }}>
          {p.name}: {p.value}%
        </p>
      ))}
    </div>
  );
};

function EmptyPixelState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px', gap: 12, textAlign: 'center'
    }}>
      <Zap size={36} style={{ color: 'var(--accent-primary)', opacity: 0.5 }} />
      <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Pixel Nexus não instalado</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 380, margin: 0 }}>
        Instale o pixel na sua loja para rastrear sessões, carrinho e conversão em tempo real.
        Acesse <strong>Configurações → Pixel Nexus</strong> para obter o código de instalação.
      </p>
    </div>
  );
}

export default function Conversion({ currentAccount }) {
  const { period, customRange, dataVersion } = useFilter();

  const [loading, setLoading]   = useState(true);
  const [metrics, setMetrics]   = useState(null);

  useEffect(() => {
    async function loadData() {
      if (!currentAccount) return;
      setLoading(true);
      const data = await pixelService.getFunnelMetrics(currentAccount, period, customRange);
      setMetrics(data);
      setLoading(false);
    }
    loadData();
  }, [currentAccount, period, customRange, dataVersion]);

  const hasData = metrics?.hasData;

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
        <KPICard
          title="Taxa de Conversão"
          value={hasData ? metrics.conversionRate : '—'}
          change={hasData ? metrics.conversionChange : 0}
          trend={hasData ? (metrics.conversionChange >= 0 ? 'up' : 'down') : 'neutral'}
          icon={MousePointerClick}
          color="primary"
        />
        <KPICard
          title="Add-to-Cart Rate"
          value={hasData ? metrics.addToCartRate : '—'}
          change={hasData ? metrics.addToCartChange : 0}
          trend={hasData ? (metrics.addToCartChange >= 0 ? 'up' : 'down') : 'neutral'}
          icon={ShoppingCart}
          color="blue"
        />
        <KPICard
          title="Checkout Rate"
          value={hasData ? metrics.checkoutRate : '—'}
          change={hasData ? metrics.checkoutChange : 0}
          trend={hasData ? (metrics.checkoutChange >= 0 ? 'up' : 'down') : 'neutral'}
          icon={CreditCard}
          color="amber"
        />
        <KPICard
          title="Purchase Rate"
          value={hasData ? metrics.purchaseRate : '—'}
          change={hasData ? metrics.purchaseChange : 0}
          trend={hasData ? (metrics.purchaseChange >= 0 ? 'up' : 'down') : 'neutral'}
          icon={Package}
          color="green"
        />
      </div>

      <div className="charts-row">
        {/* Funil */}
        <ChartCard title="Funil de Conversão" subtitle="Jornada do usuário: sessão até compra">
          {!hasData ? <EmptyPixelState /> : (
            <div className="funnel-container">
              {metrics.funnelData.map((stage, i) => {
                const width = 100 - i * 14;
                const nextValue = metrics.funnelData[i + 1]?.value;
                return (
                  <div key={stage.stage} className="funnel-step">
                    <div className="funnel-bar-wrap">
                      <div className="funnel-bar" style={{ width: `${width}%`, background: stage.color }}>
                        <span className="funnel-stage-name">{stage.stage}</span>
                      </div>
                      {nextValue !== undefined && (
                        <div className="funnel-arrow">
                          <TrendingDown size={12} />
                          <span>
                            {((nextValue / Math.max(1, stage.value)) * 100).toFixed(1)}% passam
                          </span>
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
          )}
        </ChartCard>

        {/* Comparativo de período */}
        <ChartCard title="Comparativo de Período" subtitle="Taxas de conversão: atual vs. anterior">
          {!hasData ? <EmptyPixelState /> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metrics.comparison} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#4B5568', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="stage" tick={{ fill: '#8B95A8', fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="anterior" name="Anterior" fill="#252A3A" radius={[0, 4, 4, 0]} />
                <Bar dataKey="atual"    name="Atual"    fill="#6366F1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Análise de abandono */}
      <ChartCard title="Análise de Abandono" subtitle="Pontos de maior perda no funil">
        {!hasData ? <EmptyPixelState /> : (
          <div className="abandonment-grid">
            {metrics.abandonment.map(a => (
              <div key={a.from} className="abandonment-item card">
                <div className="abandon-header">
                  <span className="abandon-from">{a.from}</span>
                  <span className="abandon-pct" style={{ color: a.color }}>-{a.pct}%</span>
                </div>
                <div className="abandon-lost">{a.lost.toLocaleString('pt-BR')} usuários perdidos</div>
                <div className="abandon-bar">
                  <div style={{ width: `${Math.min(a.pct, 100)}%`, height: '100%', background: a.color, borderRadius: 99 }} />
                </div>
                <p className="abandon-insight">{a.insight}</p>
              </div>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  );
}
