import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, TrendingUp, ShoppingCart, Users, DollarSign, ArrowUpRight, ArrowDownRight, ShieldAlert, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { useFilter } from '../../contexts/FilterContext';
import { ordersService } from '../../services/orders';
import { adsService } from '../../services/ads';
import PeriodFilter from '../../components/UI/PeriodFilter';
import ChartCard from '../../components/UI/ChartCard';
import './AgencyPanel.css';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{ color:p.color, fontSize:13, fontWeight:600 }}>
          {p.name}: R$ {Number(p.value).toLocaleString('pt-BR')}
        </p>
      ))}
    </div>
  );
};

const storeColors = ['#6366F1','#10B981','#F59E0B','#EC4899','#3B82F6','#8B5CF6','#EF4444','#06B6D4'];

export default function AgencyPanel({ onAccountChange }) {
  const { isAdmin, userAccounts } = useAuth();
  const { period, dataVersion } = useFilter();
  const navigate = useNavigate();

  const [storeData, setStoreData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ revenue: 0, orders: 0, customers: 0, adSpend: 0 });

  useEffect(() => {
    async function loadAllStores() {
      if (!isAdmin || userAccounts.length === 0) return;
      setLoading(true);

      const results = [];
      let totalRev = 0, totalOrders = 0, totalCust = 0, totalAds = 0;

      for (const acc of userAccounts) {
        const slug = acc.slug || acc.id;
        const rev = await ordersService.getRevenueMetrics(slug, period);
        const ret = await ordersService.getRetentionMetrics(slug, period);
        const ads = await adsService.getAdMetrics(slug, period);

        const revenue = rev?.rawTotals?.net || 0;
        const orders = rev?.rawTotals?.billed || 0;
        const avgTicket = rev?.rawTotals?.avgTicket || 0;
        const newCust = parseInt((ret?.newCustomers || '0').replace(/\D/g, '')) || 0;
        const adSpend = ads?.rawTotals?.spend || 0;
        const roas = adSpend > 0 ? (revenue / adSpend) : 0;

        totalRev += revenue;
        totalOrders += orders;
        totalCust += newCust;
        totalAds += adSpend;

        results.push({
          ...acc,
          revenue,
          orders,
          avgTicket,
          newCustomers: newCust,
          adSpend,
          roas,
          revenueFormatted: rev?.net || 'R$ 0,00',
          revenueChange: rev?.netChange || 0,
          ordersFormatted: rev?.billed || '0',
          ordersChange: rev?.billedChange || 0,
        });
      }

      // Ordenar por receita desc
      results.sort((a, b) => b.revenue - a.revenue);
      setStoreData(results);
      setTotals({ revenue: totalRev, orders: totalOrders, customers: totalCust, adSpend: totalAds });
      setLoading(false);
    }
    loadAllStores();
  }, [isAdmin, userAccounts, period, dataVersion]);

  // Dados para gráfico comparativo
  const chartData = storeData.map((s, i) => ({
    name: s.name?.length > 12 ? s.name.substring(0, 12) + '…' : s.name,
    receita: Math.round(s.revenue),
    investimento: Math.round(s.adSpend),
  }));

  const maxRevenue = Math.max(...storeData.map(s => s.revenue), 1);
  const formatCurrency = v => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (!isAdmin) {
    return (
      <div className="access-denied">
        <ShieldAlert size={56} style={{ color: 'var(--accent-red)' }} />
        <h2>Acesso Restrito</h2>
        <p>O Painel da Agência está disponível apenas para contas administrativas (@aclick.com.br).</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Painel da Agência</h1>
          <p className="page-subtitle">Visão consolidada de todas as lojas gerenciadas pela CLK / Aclick</p>
        </div>
        <PeriodFilter />
      </div>

      {/* Totais Consolidados */}
      <div className="agency-total-banner">
        <div className="total-stat">
          <span className="total-stat-value">{loading ? '...' : formatCurrency(totals.revenue)}</span>
          <span className="total-stat-label">Receita Total da Agência</span>
        </div>
        <div className="total-stat">
          <span className="total-stat-value">{loading ? '...' : totals.orders.toLocaleString('pt-BR')}</span>
          <span className="total-stat-label">Pedidos Faturados</span>
        </div>
        <div className="total-stat">
          <span className="total-stat-value">{loading ? '...' : totals.customers.toLocaleString('pt-BR')}</span>
          <span className="total-stat-label">Novos Clientes</span>
        </div>
        <div className="total-stat">
          <span className="total-stat-value">{loading ? '...' : formatCurrency(totals.adSpend)}</span>
          <span className="total-stat-label">Investimento em Mídia</span>
        </div>
        <div className="total-stat">
          <span className="total-stat-value">{loading ? '...' : (totals.adSpend > 0 ? (totals.revenue / totals.adSpend).toFixed(2) + 'x' : 'N/D')}</span>
          <span className="total-stat-label">ROAS Geral</span>
        </div>
      </div>

      {/* Cards por Loja */}
      {loading ? (
        <div className="agency-grid">
          {[1,2,3,4].map(i => <div key={i} className="loading-skeleton" />)}
        </div>
      ) : (
        <div className="agency-grid">
          {storeData.map((store, i) => (
            <div
              key={store.id}
              className="store-card"
              onClick={() => { onAccountChange(store.slug || store.id); navigate('/'); }}
            >
              <div className="store-card-header">
                <div className="store-card-icon" style={{ background: (store.color || storeColors[i % storeColors.length]) + '18', color: store.color || storeColors[i % storeColors.length] }}>
                  {store.icon || '🏪'}
                </div>
                <div>
                  <div className="store-card-name">{store.name}</div>
                  <div className="store-card-slug">{store.slug}</div>
                </div>
              </div>
              <div className="store-metrics">
                <div className="store-metric">
                  <span className="store-metric-label">Receita</span>
                  <span className="store-metric-value">
                    {store.revenueFormatted}
                    {store.revenueChange !== 0 && (
                      <span className={`store-metric-change ${store.revenueChange >= 0 ? 'up' : 'down'}`}>
                        {store.revenueChange >= 0 ? '↑' : '↓'}{Math.abs(store.revenueChange).toFixed(1)}%
                      </span>
                    )}
                  </span>
                </div>
                <div className="store-metric">
                  <span className="store-metric-label">Pedidos</span>
                  <span className="store-metric-value">{store.ordersFormatted}</span>
                </div>
                <div className="store-metric">
                  <span className="store-metric-label">Ticket Médio</span>
                  <span className="store-metric-value">R$ {store.avgTicket.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="store-metric">
                  <span className="store-metric-label">ROAS</span>
                  <span className="store-metric-value">{store.roas > 0 ? store.roas.toFixed(2) + 'x' : 'N/D'}</span>
                </div>
              </div>
              <div className="store-card-bar">
                <div className="store-card-bar-fill" style={{
                  width: `${(store.revenue / maxRevenue * 100).toFixed(0)}%`,
                  background: store.color || storeColors[i % storeColors.length]
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gráfico Comparativo */}
      {!loading && chartData.length > 1 && (
        <ChartCard title="Comparativo de Receita por Loja" subtitle="Receita líquida e investimento em mídia por conta">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top:10, right:20, left:0, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill:'#8B95A8', fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'#4B5568', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={v => <span style={{ color:'#8B95A8', fontSize:12 }}>{v === 'receita' ? 'Receita' : 'Investimento'}</span>} />
              <Bar dataKey="receita" name="receita" fill="#6366F1" radius={[4,4,0,0]} />
              <Bar dataKey="investimento" name="investimento" fill="#F59E0B" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Tabela Ranking */}
      {!loading && storeData.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 24 }}>
          <div style={{ padding: '20px 24px 0' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              <BarChart3 size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} />
              Ranking de Performance
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Todas as lojas ordenadas por receita líquida</p>
          </div>
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="comparison-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Loja</th>
                  <th className="right">Receita</th>
                  <th className="right">Pedidos</th>
                  <th className="right">Ticket Médio</th>
                  <th className="right">Novos Clientes</th>
                  <th className="right">Investimento</th>
                  <th className="right">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {storeData.map((store, i) => (
                  <tr key={store.id} onClick={() => { onAccountChange(store.slug || store.id); navigate('/'); }} style={{ cursor: 'pointer' }}>
                    <td>
                      <span className="store-rank-badge" style={{
                        background: i === 0 ? 'rgba(245,158,11,0.15)' : i === 1 ? 'rgba(156,163,175,0.15)' : i === 2 ? 'rgba(180,83,9,0.15)' : 'var(--bg-tertiary)',
                        color: i === 0 ? '#F59E0B' : i === 1 ? '#9CA3AF' : i === 2 ? '#B45309' : 'var(--text-muted)'
                      }}>
                        {i + 1}
                      </span>
                    </td>
                    <td>
                      <div className="store-name-cell">
                        <span style={{ fontSize: 16 }}>{store.icon || '🏪'}</span>
                        <div>
                          <div style={{ fontWeight: 600 }}>{store.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{store.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="right" style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{store.revenueFormatted}</td>
                    <td className="right">{store.ordersFormatted}</td>
                    <td className="right">R$ {store.avgTicket.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>
                    <td className="right">{store.newCustomers}</td>
                    <td className="right">{store.adSpend > 0 ? formatCurrency(store.adSpend) : '—'}</td>
                    <td className="right">
                      <span style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        background: store.roas >= 3 ? 'rgba(16,185,129,0.12)' : store.roas >= 1 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                        color: store.roas >= 3 ? '#10B981' : store.roas >= 1 ? '#F59E0B' : '#EF4444'
                      }}>
                        {store.roas > 0 ? store.roas.toFixed(2) + 'x' : 'N/D'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
