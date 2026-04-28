import React, { useState, useEffect, useMemo } from 'react';
import { Users, Search, Crown, UserPlus, AlertTriangle, ShoppingBag, ArrowUpDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useFilter } from '../../contexts/FilterContext';
import { ordersService } from '../../services/orders';
import PeriodFilter from '../../components/UI/PeriodFilter';
import './Customers.css';

const ITEMS_PER_PAGE = 25;

export default function Customers({ currentAccount }) {
  const { period, dataVersion } = useFilter();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('revenue'); // revenue, orders, recent, name
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function loadCustomers() {
      if (!currentAccount) return;
      setLoading(true);

      const { data: account } = await supabase
        .from('accounts')
        .select('id')
        .eq('slug', currentAccount)
        .single();

      if (!account?.id) { setLoading(false); return; }

      const records = await ordersService.fetchAllOrders(account.id, null, null, 'customer_name, created_at, amount, status, payment_status');

      const isBilled = (o) => {
        const s = (o.status || '').toLowerCase();
        const p = (o.payment_status || '').toLowerCase();
        return s === 'invoiced' || p === 'approved' || s === 'faturado';
      };

      // Agregar por cliente
      const map = {};
      (records || []).filter(isBilled).forEach(o => {
        const name = (o.customer_name || '').trim();
        if (!name || name === 'Desconhecido') return;
        if (!map[name]) {
          map[name] = {
            name,
            orders: 0,
            revenue: 0,
            firstPurchase: o.created_at,
            lastPurchase: o.created_at,
          };
        }
        map[name].orders++;
        map[name].revenue += Number(o.amount || 0);
        if (o.created_at > map[name].lastPurchase) map[name].lastPurchase = o.created_at;
        if (o.created_at < map[name].firstPurchase) map[name].firstPurchase = o.created_at;
      });

      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const allCustomers = Object.values(map);
      const avgRev = allCustomers.length > 0
        ? allCustomers.reduce((s, c) => s + c.revenue, 0) / allCustomers.length
        : 0;

      const enriched = allCustomers.map(c => {
        const lastDate = new Date(c.lastPurchase);
        const firstDate = new Date(c.firstPurchase);
        let segment = 'regular';
        if (c.orders >= 3 && c.revenue >= avgRev) segment = 'champion';
        else if (firstDate >= thirtyDaysAgo) segment = 'new';
        else if (c.orders >= 1 && lastDate < ninetyDaysAgo) segment = 'risk';

        return {
          ...c,
          avgTicket: c.orders > 0 ? c.revenue / c.orders : 0,
          segment,
          initials: c.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(),
        };
      });

      setCustomers(enriched);
      setLoading(false);
      setPage(1);
    }
    loadCustomers();
  }, [currentAccount, period, dataVersion]);

  const stats = useMemo(() => {
    const total = customers.length;
    const champion = customers.filter(c => c.segment === 'champion').length;
    const newC = customers.filter(c => c.segment === 'new').length;
    const atRisk = customers.filter(c => c.segment === 'risk').length;
    const totalRev = customers.reduce((s, c) => s + c.revenue, 0);
    const avgLTV = total > 0 ? totalRev / total : 0;
    return { total, champion, newC, atRisk, avgLTV };
  }, [customers]);

  const sorted = useMemo(() => {
    let filtered = customers.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase())
    );
    switch (sortBy) {
      case 'revenue': filtered.sort((a, b) => b.revenue - a.revenue); break;
      case 'orders': filtered.sort((a, b) => b.orders - a.orders); break;
      case 'recent': filtered.sort((a, b) => b.lastPurchase.localeCompare(a.lastPurchase)); break;
      case 'name': filtered.sort((a, b) => a.name.localeCompare(b.name)); break;
    }
    return filtered;
  }, [customers, search, sortBy]);

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginated = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const formatCurrency = v => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const segmentConfig = {
    champion: { label: 'Champion', className: 'segment-champion' },
    regular: { label: 'Regular', className: 'segment-regular' },
    new: { label: 'Novo', className: 'segment-new' },
    risk: { label: 'Em Risco', className: 'segment-risk' },
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">Base completa de clientes com segmentação e métricas individuais</p>
        </div>
        <PeriodFilter />
      </div>

      <div className="customers-stats">
        <div className="card customer-stat">
          <span className="customer-stat-value">{loading ? '...' : stats.total}</span>
          <span className="customer-stat-label">Total de Clientes</span>
        </div>
        <div className="card customer-stat">
          <span className="customer-stat-value" style={{ color: '#10B981' }}>{loading ? '...' : stats.champion}</span>
          <span className="customer-stat-label">Champions</span>
        </div>
        <div className="card customer-stat">
          <span className="customer-stat-value" style={{ color: '#3B82F6' }}>{loading ? '...' : stats.newC}</span>
          <span className="customer-stat-label">Novos (30d)</span>
        </div>
        <div className="card customer-stat">
          <span className="customer-stat-value" style={{ color: '#EF4444' }}>{loading ? '...' : stats.atRisk}</span>
          <span className="customer-stat-label">Em Risco</span>
        </div>
        <div className="card customer-stat">
          <span className="customer-stat-value">{loading ? '...' : formatCurrency(stats.avgLTV)}</span>
          <span className="customer-stat-label">LTV Médio</span>
        </div>
      </div>

      <div className="customer-search-bar">
        <div className="customer-search-wrap">
          <Search size={14} />
          <input
            className="customer-search-input"
            placeholder="Buscar cliente por nome..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        {['revenue', 'orders', 'recent', 'name'].map(s => (
          <button
            key={s}
            className={`sort-btn ${sortBy === s ? 'active' : ''}`}
            onClick={() => setSortBy(s)}
          >
            {s === 'revenue' ? 'Receita' : s === 'orders' ? 'Pedidos' : s === 'recent' ? 'Recente' : 'Nome'}
          </button>
        ))}
      </div>

      <div className="card customer-list">
        <div className="customer-list-header">
          <span>Cliente</span>
          <span style={{ textAlign: 'right' }}>Receita</span>
          <span style={{ textAlign: 'right' }}>Pedidos</span>
          <span style={{ textAlign: 'right' }}>Ticket Médio</span>
          <span style={{ textAlign: 'right' }}>Última Compra</span>
          <span style={{ textAlign: 'center' }}>Segmento</span>
        </div>

        {loading ? (
          <div className="customer-empty">Carregando clientes...</div>
        ) : paginated.length === 0 ? (
          <div className="customer-empty">
            <Users size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p>{search ? 'Nenhum cliente encontrado para essa busca.' : 'Nenhum cliente encontrado para o período.'}</p>
          </div>
        ) : (
          paginated.map((c, i) => (
            <div key={c.name} className="customer-row">
              <div className="customer-name-cell">
                <div className="customer-avatar">{c.initials}</div>
                <div>
                  <div className="customer-name-text">{c.name}</div>
                  <div className="customer-email">Desde {new Date(c.firstPurchase).toLocaleDateString('pt-BR')}</div>
                </div>
              </div>
              <div className="customer-value" style={{ textAlign: 'right' }}>{formatCurrency(c.revenue)}</div>
              <div className="customer-value" style={{ textAlign: 'right' }}>{c.orders}</div>
              <div className="customer-value" style={{ textAlign: 'right' }}>{formatCurrency(c.avgTicket)}</div>
              <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>
                {new Date(c.lastPurchase).toLocaleDateString('pt-BR')}
              </div>
              <div style={{ textAlign: 'center' }}>
                <span className={`segment-badge ${segmentConfig[c.segment].className}`}>
                  {segmentConfig[c.segment].label}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Anterior</button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = i + 1;
            return (
              <button key={p} className={page === p ? 'active' : ''} onClick={() => setPage(p)}>
                {p}
              </button>
            );
          })}
          {totalPages > 7 && <span style={{ color: 'var(--text-muted)' }}>...</span>}
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Próxima →</button>
        </div>
      )}
    </div>
  );
}
