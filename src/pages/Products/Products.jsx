import React, { useMemo, useState, useEffect } from 'react';
import { Package, DollarSign, Hash, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import KPICard from '../../components/UI/KPICard';
import ChartCard from '../../components/UI/ChartCard';
import DataTable from '../../components/UI/DataTable';
import StatusBadge from '../../components/UI/StatusBadge';
import PeriodFilter from '../../components/UI/PeriodFilter';
import { useFilter } from '../../contexts/FilterContext';
import { ordersService } from '../../services/orders';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{label}</p>
      <p style={{ color:'#6366F1', fontSize:13, fontWeight:600 }}>R$ {Number(payload[0]?.value).toLocaleString('pt-BR')}</p>
    </div>
  );
};

const productCols = [
  { key: 'rank',     label: '#',           align: 'right', render: v => <span style={{ color:'var(--text-muted)', fontWeight:700 }}>{v}</span> },
  { key: 'name',     label: 'Produto',     sortable: true },
  { key: 'category', label: 'Categoria',   sortable: true, render: v => <StatusBadge value={v} type="info" /> },
  { key: 'orders',   label: 'Pedidos',     sortable: true, align: 'right', render: v => v.toLocaleString('pt-BR') },
  { key: 'revenue',  label: 'Receita',     sortable: true, align: 'right', render: v => `R$ ${Number(v).toLocaleString('pt-BR')}` },
  { key: 'avgTicket',label: 'Ticket Médio',sortable: true, align: 'right', render: v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` },
];

const barColors = ['#6366F1','#818CF8','#A5B4FC','#8B5CF6','#7C3AED','#6D28D9','#5B21B6','#4C1D95','#3730A3','#312E81'];

export default function Products({ currentAccount }) {
  const { period, multiplier, dataVersion } = useFilter();
  
  const [productsData, setProductsData] = useState([]);
  const [kpis, setKpis] = useState(null);

  useEffect(() => {
    async function loadProducts() {
      if (!currentAccount) return;
      const topProd = await ordersService.getTopProducts(currentAccount, period);
      const rev = await ordersService.getRevenueMetrics(currentAccount, period);
      
      setProductsData(topProd || []);
      setKpis(rev || null);
    }
    loadProducts();
  }, [currentAccount, period, multiplier, dataVersion]);
  
  const chartData = useMemo(() => productsData.slice(0, 8).map((p, i) => ({ 
    name: p.name.split(' ').slice(0, 2).join(' '), 
    revenue: p.revenue, 
    color: barColors[i] 
  })), [productsData]);

  const top10Revenue = productsData.slice(0, 10).reduce((acc, p) => acc + p.revenue, 0);

  const skusAtivos = productsData.length;
  const totalItemsSold = productsData.reduce((acc, p) => acc + p.orders, 0);
  const totalOrders = kpis?.rawTotals?.orders || 1;
  const itensPorPedido = (totalItemsSold / (totalOrders > 0 ? totalOrders : 1)).toFixed(1).replace('.', ',');

  const totalProductRevenue = productsData.reduce((acc, p) => acc + p.revenue, 0) || 1;

  const categoryMap = productsData.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + p.revenue;
    return acc;
  }, {});

  const categoryData = Object.keys(categoryMap)
    .map((cat, i) => ({
      cat,
      revenue: categoryMap[cat],
      pct: ((categoryMap[cat] / totalProductRevenue) * 100).toFixed(1),
      color: barColors[i % barColors.length]
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Ticket & Produtos</h1>
          <p className="page-subtitle">Performance de produtos, categorias e ticket médio</p>
        </div>
        <PeriodFilter />
      </div>

      <div className="section-grid-4">
        <KPICard title="Ticket Médio"      value={kpis?.avgTicket || "R$ 0,00"} change={kpis?.avgTicketChange || 0}  trend={kpis?.avgTicketChange >= 0 ? "up" : "down"} icon={TrendingUp} color="primary" />
        <KPICard title="Itens por Pedido"  value={itensPorPedido}  change={1.8}  trend="up" icon={Package}    color="blue"    />
        <KPICard title="SKUs Ativos"       value={skusAtivos}             change={12.0} trend="up" icon={Hash}       color="green"   />
        <KPICard title="Receita Top 10"    value={`R$ ${(top10Revenue / 1000).toFixed(1).replace('.',',')}k`} change={8.4} trend="up" icon={DollarSign} color="amber" />
      </div>

      <div className="charts-row">
        <ChartCard title="Top 8 Produtos por Receita" subtitle="Receita acumulada no período">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top:10, right:10, left:0, bottom:40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill:'#4B5568', fontSize:9 }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" />
              <YAxis tick={{ fill:'#4B5568', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" name="Receita" radius={[6,6,0,0]}>
                {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribuição por Categoria" subtitle="Receita por categoria de produto">
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {categoryData.length > 0 ? categoryData.map(c => (
              <div key={c.cat}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, color:'var(--text-primary)', fontWeight:500 }}>{c.cat}</span>
                  <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    <span style={{ fontSize:12, color:'var(--text-muted)' }}>R$ {(c.revenue/1000).toFixed(1)}k</span>
                    <span style={{ fontSize:12, fontWeight:700, color: c.color, minWidth:36, textAlign:'right' }}>{c.pct}%</span>
                  </div>
                </div>
                <div style={{ height:4, background:'var(--bg-tertiary)', borderRadius:99, overflow:'hidden' }}>
                  <div style={{ width:`${c.pct}%`, height:'100%', background:c.color, borderRadius:99 }} />
                </div>
              </div>
            )) : <p style={{ color:'var(--text-muted)', fontSize:12 }}>Nenhuma categoria encontrada no período.</p>}
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Top 10 Produtos" subtitle="Ranking completo de performance">
        <DataTable columns={productCols} data={productsData} maxRows={10} />
      </ChartCard>
    </div>
  );
}
