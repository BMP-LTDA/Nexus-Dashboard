import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Clock, CheckCircle, Calendar, Search, RefreshCcw, Info, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useFilter } from '../../contexts/FilterContext';
import PeriodFilter from '../../components/UI/PeriodFilter';
import StatusBadge from '../../components/UI/StatusBadge';
import { getBrasiliaNow } from '../../lib/dateUtils';
import { ordersService } from '../../services/orders';
import { adsService } from '../../services/ads';
import './Reports.css';

const typeColors = {
  'Receita':      { bg: 'rgba(99,102,241,0.12)',  color: '#818CF8' },
  'Conversão':    { bg: 'rgba(16,185,129,0.12)',  color: '#10B981' },
  'Mídia Paga':   { bg: 'rgba(245,158,11,0.12)',  color: '#F59E0B' },
  'Clientes':     { bg: 'rgba(59,130,246,0.12)',  color: '#3B82F6' },
  'Produtos':     { bg: 'rgba(236,72,153,0.12)',  color: '#EC4899' },
  'Planejamento': { bg: 'rgba(6,182,212,0.12)',   color: '#06B6D4' },
};

const periodLabels = {
  'today': 'Hoje', '7d': '7 dias', '30d': '30 dias', '90d': '90 dias',
  'month': 'Mês atual', 'prev-month': 'Mês anterior', 'year': 'Ano', 'custom': 'Personalizado'
};

export default function Reports({ currentAccount }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [reports, setReports] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);

  const { period, dataVersion } = useFilter();

  // Gerar lista de relatórios disponíveis baseada em dados reais
  useEffect(() => {
    async function generateReportList() {
      if (!currentAccount) return;

      const now = getBrasiliaNow();
      const dateStr = now.toLocaleDateString('pt-BR');
      const slug = currentAccount;

      const baseReports = [
        { id: 'rev', name: `Receita & Faturamento — ${slug}`, type: 'Receita', date: dateStr, status: 'Pronto', size: 'Dinâmico' },
        { id: 'prod', name: `Top Produtos — ${slug}`, type: 'Produtos', date: dateStr, status: 'Pronto', size: 'Dinâmico' },
        { id: 'cust', name: `Análise de Clientes — ${slug}`, type: 'Clientes', date: dateStr, status: 'Pronto', size: 'Dinâmico' },
      ];

      // Verificar se há dados de mídia
      const ads = await adsService.getAdMetrics(currentAccount, period);
      if (ads && ads.rawTotals.spend > 0) {
        baseReports.push({
          id: 'media', name: `Mídia Paga — ${slug}`, type: 'Mídia Paga', date: dateStr, status: 'Pronto', size: 'Dinâmico'
        });
      }

      // Relatório consolidado
      baseReports.push({
        id: 'full', name: `Relatório Consolidado — ${slug}`, type: 'Receita', date: dateStr, status: 'Pronto', size: 'Dinâmico'
      });

      setReports(baseReports);
    }
    generateReportList();
  }, [currentAccount, period, dataVersion]);

  const addToast = useCallback((title, desc, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, desc, type }]);
    
    const event = new CustomEvent('nexus_notification', { detail: { title, desc, type } });
    window.dispatchEvent(event);

    setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, 4000);
  }, []);

  const handleDownload = async (reportId, format) => {
    setDownloadingId(`${reportId}-${format}`);
    const report = reports.find(r => r.id === reportId);

    try {
      // Buscar dados reais
      const rev = await ordersService.getRevenueMetrics(currentAccount, period);
      const ret = await ordersService.getRetentionMetrics(currentAccount, period);
      const topProd = await ordersService.getTopProducts(currentAccount, period);
      const ads = await adsService.getAdMetrics(currentAccount, period);

      const periodLabel = periodLabels[period] || period;
      const rType = report?.type || 'Receita';

      if (format === 'PDF') {
        const doc = new jsPDF();
        
        // Header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(99, 102, 241);
        doc.text('Nexus Analytics', 20, 20);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text('Relatório Gerencial de E-commerce', 20, 26);
        
        doc.setDrawColor(230, 230, 230);
        doc.line(20, 32, 190, 32);
        
        doc.setFontSize(16);
        doc.setTextColor(40, 40, 40);
        doc.text(report?.name || 'Relatório de Performance', 20, 45);
        
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        doc.text(`Loja: ${currentAccount}`, 20, 52);
        doc.text(`Período: ${periodLabel}`, 20, 57);
        doc.text(`Gerado em: ${getBrasiliaNow().toLocaleString('pt-BR')}`, 20, 62);

        let y = 80;

        // Seção Receita
        if (['Receita', 'full'].includes(rType) || reportId === 'full') {
          doc.setFontSize(14);
          doc.setTextColor(99, 102, 241);
          doc.text('📊 Receita & Faturamento', 20, y);
          y += 10;

          doc.setFontSize(10);
          doc.setTextColor(60, 60, 60);
          const revData = [
            ['Receita Bruta', rev?.gross || 'N/D'],
            ['Receita Líquida', rev?.net || 'N/D'],
            ['Pedidos Captados', rev?.captured || 'N/D'],
            ['Pedidos Faturados', rev?.billed || 'N/D'],
            ['Ticket Médio', rev?.avgTicket || 'N/D'],
            ['Taxa de Aprovação', rev?.approvalRate || 'N/D'],
            ['Cancelamentos', rev?.cancellations || 'N/D'],
          ];

          revData.forEach(([label, value]) => {
            doc.text(label, 25, y);
            doc.text(String(value), 120, y);
            y += 7;
          });
          y += 8;
        }

        // Seção Produtos
        if (['Produtos', 'full'].includes(rType) || reportId === 'full') {
          if (y > 240) { doc.addPage(); y = 20; }
          doc.setFontSize(14);
          doc.setTextColor(99, 102, 241);
          doc.text('🏆 Top Produtos', 20, y);
          y += 10;

          doc.setFontSize(9);
          doc.setTextColor(60, 60, 60);
          (topProd || []).slice(0, 10).forEach((p, i) => {
            if (y > 280) { doc.addPage(); y = 20; }
            doc.text(`${i + 1}. ${p.name}`, 25, y);
            doc.text(`R$ ${Number(p.revenue).toLocaleString('pt-BR')} | ${p.orders} vendas`, 120, y);
            y += 6;
          });
          y += 8;
        }

        // Seção Clientes
        if (['Clientes', 'full'].includes(rType) || reportId === 'full') {
          if (y > 240) { doc.addPage(); y = 20; }
          doc.setFontSize(14);
          doc.setTextColor(99, 102, 241);
          doc.text('👥 Clientes & Retenção', 20, y);
          y += 10;

          doc.setFontSize(10);
          doc.setTextColor(60, 60, 60);
          const custData = [
            ['Novos Clientes', ret?.newCustomers || 'N/D'],
            ['Clientes Recorrentes', ret?.returningCustomers || 'N/D'],
            ['Taxa de Retenção', ret?.retentionRate || 'N/D'],
            ['LTV Estimado', ret?.ltv || 'N/D'],
          ];
          custData.forEach(([label, value]) => {
            doc.text(label, 25, y);
            doc.text(String(value), 120, y);
            y += 7;
          });
          y += 8;
        }

        // Seção Mídia
        if (['Mídia Paga', 'full'].includes(rType) || reportId === 'full') {
          if (ads && ads.rawTotals.spend > 0) {
            if (y > 240) { doc.addPage(); y = 20; }
            doc.setFontSize(14);
            doc.setTextColor(99, 102, 241);
            doc.text('📣 Mídia Paga', 20, y);
            y += 10;

            doc.setFontSize(10);
            doc.setTextColor(60, 60, 60);
            const mediaData = [
              ['Investimento Total', ads.kpis.totalSpend],
              ['CPC Médio', ads.kpis.avgCpc],
              ['CTR', ads.kpis.ctr],
              ['Impressões', ads.kpis.impressions],
              ['Cliques', ads.kpis.clicks],
            ];
            mediaData.forEach(([label, value]) => {
              doc.text(label, 25, y);
              doc.text(String(value), 120, y);
              y += 7;
            });

            y += 5;
            doc.text('Breakdown por Plataforma:', 25, y);
            y += 7;
            ads.platforms.forEach(p => {
              doc.text(`${p.platform}: R$ ${Number(p.spend).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | ${p.clicks} cliques | CTR: ${p.ctr}`, 30, y);
              y += 6;
            });
          }
        }

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(180, 180, 180);
        doc.text('Nexus Analytics Dashboard — Gerado automaticamente com dados reais', 20, 285);

        const fileName = report ? report.name.replace(/\s+/g, '_') : `relatorio_${reportId}`;
        doc.save(`${fileName}.pdf`);

      } else {
        // CSV
        const Papa = (await import('papaparse')).default;
        let csvData = [];

        if (rType === 'Mídia Paga' && ads?.records?.length > 0) {
          csvData = ads.records.map(r => ({
            'Data': new Date(r.date).toLocaleDateString('pt-BR'),
            'Plataforma': r.platform,
            'Investimento (R$)': Number(r.spend).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
            'Impressões': r.impressions,
            'Cliques': r.clicks
          }));
        } else if (rType === 'Produtos' && topProd?.length > 0) {
          csvData = topProd.map(p => ({
            '#': p.rank,
            'Produto': p.name,
            'Categoria': p.category,
            'Pedidos': p.orders,
            'Receita (R$)': Number(p.revenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
            'Ticket Médio': Number(p.avgTicket).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
          }));
        } else if (rev?.records?.length > 0) {
          csvData = rev.records.map(o => ({
            'Data/Hora': new Date(o.created_at).toLocaleString('pt-BR'),
            'ID Pedido': o.external_order_id || o.id,
            'Cliente': o.customer_name || 'N/D',
            'Status': o.status,
            'Pagamento': o.payment_status,
            'Valor (R$)': Number(o.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
          }));
        }

        if (csvData.length > 0) {
          const csvString = Papa.unparse(csvData);
          const BOM = "\ufeff";
          const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const fileName = report ? report.name.replace(/\s+/g, '_') : `relatorio_${reportId}`;
          a.download = `${fileName}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }
      }

      addToast('Download Concluído', `${format} gerado com dados reais do período.`, 'success');
    } catch (err) {
      console.error(err);
      addToast('Erro no Download', 'Ocorreu um erro inesperado.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const types = ['Todos', ...new Set(reports.map(r => r.type))];
  const filtered = reports.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchType   = typeFilter === 'Todos' || r.type === typeFilter;
    return matchSearch && matchType;
  });

  const stats = [
    { label:'Disponíveis', value: reports.length, icon: FileText,    color:'#6366F1', bg:'rgba(99,102,241,0.12)' },
    { label:'Prontos',     value: reports.filter(r => r.status === 'Pronto').length, icon: CheckCircle, color:'#10B981', bg:'rgba(16,185,129,0.12)' },
    { label:'Formatos',    value: 'PDF, CSV', icon: Download, color:'#3B82F6', bg:'rgba(59,130,246,0.12)' },
    { label:'Dados',       value: 'Tempo Real', icon: Clock, color:'#F59E0B', bg:'rgba(245,158,11,0.12)' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="page-subtitle">Exporte relatórios com dados reais do e-commerce</p>
        </div>
        <PeriodFilter />
      </div>

      <div className="section-grid-4" style={{ marginBottom:24 }}>
        {stats.map(s => (
          <div key={s.label} className="card report-stat-card" style={{ padding:20 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <span style={{ fontSize:12, color:'var(--text-secondary)', fontWeight:500 }}>{s.label}</span>
              <div style={{ width:32, height:32, borderRadius:8, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <s.icon size={16} style={{ color:s.color }} />
              </div>
            </div>
            <span style={{ fontSize:28, fontWeight:700, color:'var(--text-primary)' }}>{s.value}</span>
          </div>
        ))}
      </div>

      <div className="reports-filter-bar">
        <div className="reports-search">
          <Search size={14} className="search-icon" />
          <input
            type="text" placeholder="Buscar relatórios..." value={search}
            onChange={e => setSearch(e.target.value)} className="search-input"
          />
        </div>
        <div className="type-filters">
          {types.map(t => (
            <button key={t} className={`type-filter-btn ${typeFilter === t ? 'active' : ''}`}
              onClick={() => setTypeFilter(t)}>{t}</button>
          ))}
        </div>
      </div>

      <div className="reports-list card">
        <div className="reports-list-header">
          <span className="reports-col reports-col-name">Nome do Relatório</span>
          <span className="reports-col reports-col-type">Tipo</span>
          <span className="reports-col reports-col-date desktop-only">Período</span>
          <span className="reports-col reports-col-status">Status</span>
          <span className="reports-col reports-col-action" />
        </div>

        {filtered.length === 0 ? (
          <div className="reports-empty">
            <FileText size={32} />
            <p>Nenhum relatório encontrado</p>
          </div>
        ) : (
          filtered.map(r => {
            const tc = typeColors[r.type] || { bg:'var(--bg-tertiary)', color:'var(--text-secondary)' };
            return (
              <div key={r.id} className="report-row">
                <div className="reports-col reports-col-name">
                  <div className="report-icon-wrap">
                    <FileText size={16} style={{ color:'var(--accent-primary)' }} />
                  </div>
                  <span className="report-name">{r.name}</span>
                </div>
                <div className="reports-col reports-col-type">
                  <span className="report-type-badge" style={{ background:tc.bg, color:tc.color }}>{r.type}</span>
                </div>
                <div className="reports-col reports-col-date desktop-only">
                  <span style={{ fontSize:12, color:'var(--text-secondary)' }}>{periodLabels[period] || period}</span>
                </div>
                <div className="reports-col reports-col-status">
                  <StatusBadge value={r.status} type="success" />
                </div>
                <div className="reports-col reports-col-action">
                  <div className="report-actions">
                    <button className="report-action-btn" onClick={() => handleDownload(r.id, 'PDF')}
                      disabled={downloadingId === `${r.id}-PDF`}>
                      {downloadingId === `${r.id}-PDF` ? <RefreshCcw size={14} className="loading-spin" /> : <Download size={14} />} PDF
                    </button>
                    <button className="report-action-btn" onClick={() => handleDownload(r.id, 'CSV')}
                      disabled={downloadingId === `${r.id}-CSV`}>
                      {downloadingId === `${r.id}-CSV` ? <RefreshCcw size={14} className="loading-spin" /> : <Download size={14} />} CSV
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <div className="toast-icon">
              {t.type === 'success' ? <CheckCircle size={18} color="var(--accent-green)" /> : <Info size={18} color="var(--accent-primary)" />}
            </div>
            <div className="toast-content">
              <span className="toast-title">{t.title}</span>
              <span className="toast-desc">{t.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
