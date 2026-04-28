import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Settings as SettingsIcon, User, Bell, Shield, Palette, Database, Globe, ChevronRight, Store, Copy, CheckCircle, Plus, RefreshCcw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import './Settings.css';

const settingSections = [
  {
    id: 'profile', icon: User, label: 'Perfil', desc: 'Gerencie informações da conta',
  },
  {
    id: 'integrations', icon: Database, label:'Integrações / Dados', desc:'Importação Bagy e APIs' 
  },
  {
    id: 'notifications', icon: Bell, label: 'Notificações', desc: 'Configure alertas e avisos',
    toggles: [
      { label:'Alertas de meta atingida',      desc:'Notificar quando uma meta for alcançada', active:true  },
      { label:'Queda de conversão',             desc:'Avisar quando a taxa cair mais de 0,5%', active:true  },
      { label:'Relatório semanal',              desc:'Receber resumo toda segunda-feira',       active:false },
      { label:'Anomalias de receita',           desc:'Detectar variações fora do padrão',       active:true  },
    ]
  },
  { id: 'security',     icon: Shield,   label:'Segurança',       desc:'Senhas e autenticação' },
  { id: 'region',       icon: Globe,    label:'Idioma & Região', desc:'Fuso horário e moeda' },
];

export default function Settings({ currentAccount, onOrdersUploaded }) {
  const [activeSection, setActiveSection] = useState('profile');
  const [toggles, setToggles] = useState(() => {
    const saved = localStorage.getItem('nexus_notification_settings');
    if (saved) return JSON.parse(saved);
    return { 0:true, 1:true, 2:false, 3:true };
  });
  const { user } = useAuth();

  const section = settingSections.find(s => s.id === activeSection);
  
  const profileFields = [
    { label: 'Nome', value: user?.user_metadata?.full_name || '', type: 'text' },
    { label: 'E-mail', value: user?.email || '', type: 'email' },
  ];

  const handleToggle = (index, label) => {
    const newState = { ...toggles, [index]: !toggles[index] };
    setToggles(newState);
    localStorage.setItem('nexus_notification_settings', JSON.stringify(newState));

    const event = new CustomEvent('nexus_notification', {
      detail: { 
        title: 'Preferência Atualizada', 
        desc: `A configuração "${label}" foi salva.`, 
        type: 'success' 
      }
    });
    window.dispatchEvent(event);
  };

  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  
  // Ads Upload State
  const adsFileInputRef = useRef(null);
  const [isUploadingAds, setIsUploadingAds] = useState(false);
  const [adsUploadStatus, setAdsUploadStatus] = useState(null);
  const [adsPlatform, setAdsPlatform] = useState('Meta Ads');
  
  // Analytics State
  const [gaPropertyId, setGaPropertyId] = useState('');
  const [isSavingGA, setIsSavingGA] = useState(false);

  // New Store State
  const [newStore, setNewStore] = useState({ name: '', slug: '', ga_property_id: '', color: '#6366F1' });
  const [isCreatingStore, setIsCreatingStore] = useState(false);
  const [createdWebhookUrl, setCreatedWebhookUrl] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const { refreshAccounts } = useAuth();

  // Meta Ads State
  const [metaAdAccountId, setMetaAdAccountId] = useState('');
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [isSyncingMeta, setIsSyncingMeta] = useState(false);
  const [metaSyncResult, setMetaSyncResult] = useState(null);

  // Load current GA config
  React.useEffect(() => {
    async function loadGA() {
      if (!currentAccount) return;
      const slug = typeof currentAccount === 'string' ? currentAccount : currentAccount.id;
      const { data, error } = await supabase.from('accounts').select('ga_property_id, meta_ad_account_id').eq('slug', slug).single();
      if (data && !error) {
        setGaPropertyId(data.ga_property_id || '');
        setMetaAdAccountId(data.meta_ad_account_id || '');
      }
    }
    loadGA();
  }, [currentAccount]);

  const handleSaveGA = async () => {
    setIsSavingGA(true);
    try {
      const slug = typeof currentAccount === 'string' ? currentAccount : currentAccount.id;
      const { error } = await supabase
        .from('accounts')
        .update({ ga_property_id: gaPropertyId })
        .eq('slug', slug);
      
      if (error) throw error;
      
      window.dispatchEvent(new CustomEvent('nexus_notification', {
        detail: { title: 'Analytics Atualizado', desc: 'ID da Propriedade GA4 salvo com sucesso.', type: 'success' }
      }));
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('nexus_notification', {
        detail: { title: 'Erro ao Salvar', desc: err.message, type: 'error' }
      }));
    } finally {
      setIsSavingGA(false);
    }
  };

  const handleCreateStore = async () => {
    if (!newStore.name || !newStore.slug) {
      window.dispatchEvent(new CustomEvent('nexus_notification', {
        detail: { title: 'Campos obrigatórios', desc: 'Nome e Slug são obrigatórios.', type: 'error' }
      }));
      return;
    }

    setIsCreatingStore(true);
    try {
      const slug = newStore.slug.toLowerCase().replace(/[^a-z0-9-]/g, '');

      const { data, error } = await supabase
        .from('accounts')
        .insert({
          name: newStore.name,
          slug: slug,
          icon: '🏪',
          color: newStore.color,
          ga_property_id: newStore.ga_property_id || null,
          owner_id: user?.id || null
        })
        .select()
        .single();

      if (error) throw error;

      const webhookSecret = import.meta.env.VITE_WEBHOOK_SECRET;
      const secretParam = webhookSecret ? `&secret=${webhookSecret}` : '&secret=<SEU_SECRET>';
      const webhookUrl = `https://vvtalmhfdchhwlzqgnvt.supabase.co/functions/v1/bagy-webhook?account=${slug}${secretParam}`;
      setCreatedWebhookUrl(webhookUrl);

      window.dispatchEvent(new CustomEvent('nexus_notification', {
        detail: { title: 'Loja Criada!', desc: `"${newStore.name}" foi adicionada com sucesso.`, type: 'success' }
      }));

      setNewStore({ name: '', slug: '', ga_property_id: '', color: '#6366F1' });
      await refreshAccounts();
    } catch (err) {
      console.error(err);
      const msg = err.message?.includes('duplicate') ? 'Esse slug já está em uso. Escolha outro.' : err.message;
      window.dispatchEvent(new CustomEvent('nexus_notification', {
        detail: { title: 'Erro ao Criar', desc: msg, type: 'error' }
      }));
    } finally {
      setIsCreatingStore(false);
    }
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(createdWebhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const parseCurrency = (val) => {
    if (!val) return 0;
    let str = String(val).trim();
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastComma > lastDot) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
      str = str.replace(/,/g, '');
    }
    return parseFloat(str) || 0;
  };

  const processCSVData = (data) => {
    const ordersMap = new Map();

    data.forEach(row => {
      // Handle both raw API format and exported Portuguese format
      const orderId = row['id'] || row['ID do Pedido'] || row['Número do pedido'];
      if (!orderId) return;

      if (!ordersMap.has(orderId)) {
        ordersMap.set(orderId, {
          id: orderId,
          code: row['code'] || row['Código'] || orderId,
          createdAt: row['created_at'] || row['Criado em'] || row['Data'] || new Date().toISOString(),
          total: parseCurrency(row['total'] || row['Total'] || row['Valor Total'] || '0'),
          subtotal: parseCurrency(row['subtotal'] || row['Subtotal'] || '0'),
          discount: parseCurrency(row['discount'] || row['Desconto'] || row['Valor do Desconto'] || '0'),
          customerName: row['customers__via__customer_id__name'] || row['Nome do Cliente'] || row['Cliente'] || 'Desconhecido',
          city: row['Order Addresses__city'] || row['Cidade'] || '',
          state: row['Order Addresses__state'] || row['Estado'] || '',
          paymentStatus: (row['Order Payments__status'] || row['Status do Pagamento'] || 'approved').toLowerCase(),
          status: (row['status'] || row['Status do Pedido'] || 'invoiced').toLowerCase(),
          items: []
        });
      }

      const itemName = row['Order Items__name'] || row['Produtos'] || row['Produto'] || row['Nome do Produto'];
      if (itemName) {
        ordersMap.get(orderId).items.push({
          productId: row['Products__id'] || row['ID do Produto'] || '0',
          name: itemName,
          quantity: parseInt(row['Order Items__quantity'] || row['Quantidade'] || '1', 10) || 1,
          price: parseCurrency(row['Order Items__price'] || row['Preço'] || '0')
        });
      }
    });

    let ordersArray = Array.from(ordersMap.values());
    
    // Sort by createdAt descending
    ordersArray.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Limit to 5000 orders to prevent QuotaExceededError in localStorage
    if (ordersArray.length > 5000) {
      ordersArray = ordersArray.slice(0, 5000);
    }
    
    return ordersArray;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async function(results) {
        try {
          if (!results.data || !results.data.length) {
            throw new Error("O arquivo CSV parece estar vazio ou não tem cabeçalhos válidos.");
          }

          const processedOrders = processCSVData(results.data);
          
          if (processedOrders.length === 0) {
            throw new Error("Nenhum pedido encontrado. Verifique se as colunas estão corretas.");
          }

          // --- Resolve Account UUID from slug ---
          const accountSlug = (typeof currentAccount === 'string' ? currentAccount : currentAccount?.id) || 'locley';
          const { data: accountData, error: accountError } = await supabase
            .from('accounts')
            .select('id')
            .eq('slug', accountSlug)
            .single();

          if (accountError || !accountData) {
            throw new Error(`Conta "${accountSlug}" não encontrada no Supabase. Verifique o slug.`);
          }
          const accountId = accountData.id;

          // --- Map CSV rows to orders table schema ---
          const rows = processedOrders.map(o => ({
            account_id: accountId,
            external_order_id: String(o.id),
            created_at: o.createdAt || new Date().toISOString(),
            amount: Number(o.total) || 0,
            customer_name: o.customerName || 'Desconhecido',
            payment_status: o.paymentStatus || 'approved',
            status: o.status || 'invoiced',
            items: o.items || []
          }));

          // --- Batch upsert in chunks of 100 to prevent payload errors and UI freezing ---
          const CHUNK = 100;
          let inserted = 0;
          for (let i = 0; i < rows.length; i += CHUNK) {
            const chunk = rows.slice(i, i + CHUNK);
            const { error: upsertError } = await supabase
              .from('orders')
              .upsert(chunk, { onConflict: 'account_id, external_order_id' });
            if (upsertError) throw upsertError;
            inserted += chunk.length;
            
            // Allow UI to breathe and prevent rate limits
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          setIsUploading(false);
          setUploadStatus({
            type: 'success',
            msg: `Sucesso! ${inserted} pedidos salvos no banco de dados.`
          });

          window.dispatchEvent(new CustomEvent('nexus_notification', {
            detail: { title: 'Upload Concluído', desc: `${inserted} pedidos sincronizados com o Supabase.`, type: 'success' }
          }));

          // Trigger immediate cache refresh (no need to wait for Realtime)
          if (onOrdersUploaded) onOrdersUploaded();

        } catch (err) {
          console.error('[CSV Upload Error]:', err);
          setIsUploading(false);
          setUploadStatus({ type: 'error', msg: `Falha: ${err.message}` });
        }
      },
      error: function(err) {
        console.error(err);
        setIsUploading(false);
        setUploadStatus({ type: 'error', msg: 'Erro ao abrir arquivo. Tente novamente.' });
      }
    });
  };

  const processAdsCSVData = (data, platform) => {
    const aggregatedData = {};

    data.forEach(row => {
      const normRow = {};
      Object.keys(row).forEach(k => {
        const normKey = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        normRow[normKey] = row[k];
      });

      const rawDate = normRow['data'] || normRow['date'] || normRow['day'] || normRow['dia'] || normRow['inicio dos relatorios'] || normRow['reporting starts'];
      if (!rawDate) return;
      
      let dateIso = rawDate;
      if (rawDate.includes('/')) {
        const parts = rawDate.split('/');
        if (parts.length >= 3) {
          if (parts[0].length === 2 && parts[2].length === 4) {
             dateIso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          } else if (parts[0].length === 4) {
             dateIso = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          }
        }
      }

      if (dateIso.length > 10) dateIso = dateIso.substring(0, 10);

      const spendRaw = normRow['valor gasto'] || normRow['valor'] || normRow['amount spent (brl)'] || normRow['valor gasto (brl)'] || normRow['cost'] || normRow['custo'] || normRow['spend'] || '0';
      const spend = parseFloat(String(spendRaw).replace(/R\$\s?/g,'').replace(/\./g,'').replace(',','.'));
      
      const impRaw = normRow['impressoes'] || normRow['impressions'] || '0';
      const impressions = parseInt(String(impRaw).replace(/\./g,''), 10);
      
      const clickRaw = normRow['cliques'] || normRow['cliques (todos)'] || normRow['clicks (all)'] || normRow['clicks'] || '0';
      const clicks = parseInt(String(clickRaw).replace(/\./g,''), 10);

      const rowPlatform = normRow['plataforma'] || normRow['platform'] || platform;
      const key = `${dateIso}_${rowPlatform}`;

      if (!aggregatedData[key]) {
        aggregatedData[key] = {
          date: dateIso,
          platform: rowPlatform,
          spend: 0,
          impressions: 0,
          clicks: 0
        };
      }

      aggregatedData[key].spend += isNaN(spend) ? 0 : spend;
      aggregatedData[key].impressions += isNaN(impressions) ? 0 : impressions;
      aggregatedData[key].clicks += isNaN(clicks) ? 0 : clicks;
    });

    return Object.values(aggregatedData);
  };

  const handleAdsFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingAds(true);
    setAdsUploadStatus(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async function(results) {
        try {
          if (!results.data || !results.data.length) throw new Error("Arquivo vazio ou sem cabeçalhos.");
          const processedAds = processAdsCSVData(results.data, adsPlatform);
          if (processedAds.length === 0) throw new Error("Nenhum dado válido encontrado. Verifique as colunas.");

          const accountSlug = (typeof currentAccount === 'string' ? currentAccount : currentAccount?.id) || 'locley';
          const { data: accountData, error: accountError } = await supabase.from('accounts').select('id').eq('slug', accountSlug).single();
          if (accountError || !accountData) throw new Error("Conta não encontrada no Supabase.");

          const rows = processedAds.map(a => ({
            account_id: accountData.id,
            date: a.date,
            platform: a.platform,
            spend: a.spend,
            impressions: a.impressions,
            clicks: a.clicks
          }));

          const CHUNK = 500;
          let inserted = 0;
          for (let i = 0; i < rows.length; i += CHUNK) {
            const chunk = rows.slice(i, i + CHUNK);
            const { error: upsertError } = await supabase
              .from('daily_ad_spend')
              .upsert(chunk, { onConflict: 'account_id, date, platform' });
            if (upsertError) throw upsertError;
            inserted += chunk.length;
          }

          setIsUploadingAds(false);
          setAdsUploadStatus({ type: 'success', msg: `Sucesso! ${inserted} registros de ads salvos.` });
          window.dispatchEvent(new CustomEvent('nexus_notification', { detail: { title: 'Mídia Paga Atualizada', desc: `${inserted} registros sincronizados.`, type: 'success' } }));
        } catch (err) {
          console.error(err);
          setIsUploadingAds(false);
          setAdsUploadStatus({ type: 'error', msg: `Falha: ${err.message}` });
        }
      },
      error: function(err) {
        setIsUploadingAds(false);
        setAdsUploadStatus({ type: 'error', msg: 'Erro ao abrir arquivo.' });
      }
    });
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom:24 }}>
        <div>
          <h1 className="page-title">Configurações</h1>
          <p className="page-subtitle">Gerencie preferências do sistema e da conta</p>
        </div>
      </div>

      <div className="settings-layout">
        {/* Left Nav */}
        <div className="settings-nav card">
          {settingSections.map(s => (
            <button
              key={s.id}
              className={`settings-nav-item ${activeSection === s.id ? 'active' : ''}`}
              onClick={() => setActiveSection(s.id)}
            >
              <div className="settings-nav-icon">
                <s.icon size={16} />
              </div>
              <div className="settings-nav-info">
                <span className="settings-nav-label">{s.label}</span>
                <span className="settings-nav-desc">{s.desc}</span>
              </div>
              <ChevronRight size={14} className="settings-nav-arrow" />
            </button>
          ))}

          <div className="settings-nav-divider" />
          
          <div className="settings-nav-footer">
            <p>© 2026 Nexus Analytics</p>
          </div>
        </div>

        {/* Content */}
        <div className="settings-content">
          {activeSection === 'profile' && (
            <div className="card settings-panel">
              <div className="settings-panel-header">
                <h2 className="settings-panel-title">Informações do Perfil</h2>
                <p className="settings-panel-subtitle">Atualize seus dados pessoais</p>
              </div>
              <div className="settings-avatar-row">
                <div className="settings-avatar">
                  {(user?.user_metadata?.full_name || user?.email || 'U').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <button className="btn-secondary">Alterar foto</button>
                  <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>PNG ou JPG, máx. 2MB</p>
                </div>
              </div>
              <div className="settings-fields">
                {profileFields.map(f => (
                  <div key={f.label} className="settings-field">
                    <label className="field-label">{f.label}</label>
                    <input type={f.type} defaultValue={f.value} className="field-input" />
                  </div>
                ))}
              </div>
              <div className="settings-actions">
                <button className="btn-primary" onClick={() => {
                  window.dispatchEvent(new CustomEvent('nexus_notification', {
                    detail: { title: 'Perfil', desc: 'As informações foram salvas com sucesso.', type: 'success' }
                  }));
                }}>Salvar alterações</button>
                <button className="btn-ghost" onClick={() => window.location.reload()}>Cancelar</button>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="card settings-panel">
              <div className="settings-panel-header">
                <h2 className="settings-panel-title">Notificações</h2>
                <p className="settings-panel-subtitle">Escolha quando e como ser notificado</p>
              </div>
              <div className="settings-toggles">
                {section.toggles.map((t, i) => (
                  <div key={i} className="toggle-row">
                    <div className="toggle-info">
                      <span className="toggle-label">{t.label}</span>
                      <span className="toggle-desc">{t.desc}</span>
                    </div>
                    <button
                      className={`toggle-btn ${toggles[i] ? 'on' : 'off'}`}
                      onClick={() => handleToggle(i, t.label)}
                    >
                      <span className="toggle-thumb" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'integrations' && (
            <>
              <div className="card settings-panel">
                <div className="settings-panel-header">
                  <h2 className="settings-panel-title">Integração de Dados (Bagy)</h2>
                  <p className="settings-panel-subtitle">Importe os dados brutos em formato CSV para alimentar o Dashboard</p>
                </div>
                
                <div style={{ marginTop: '20px', padding: '24px', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
                  <Database size={40} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                  <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>Upload de Exportação Bagy</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
                    Carregue seu arquivo "pedidos exportados.csv". Os dados serão parseados localmente e preparados para envio.
                  </p>
                  <input 
                    type="file" 
                    accept=".csv" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    onChange={handleFileUpload} 
                  />
                  <button 
                    className="btn-primary" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? 'Processando...' : 'Selecionar Arquivo CSV'}
                  </button>

                  {uploadStatus && (
                    <div style={{ marginTop: '20px', padding: '12px', borderRadius: '4px', backgroundColor: uploadStatus.type === 'error' ? '#fef2f2' : '#f0fdf4', color: uploadStatus.type === 'error' ? '#991b1b' : '#166534', fontSize: '14px', border: `1px solid ${uploadStatus.type === 'error' ? '#f87171' : '#4ade80'}` }}>
                      {uploadStatus.msg}
                    </div>
                  )}
                </div>
              </div>

              {/* Upload de Mídia Paga (Ads) */}
              <div className="card settings-panel" style={{ marginTop: '24px' }}>
                <div className="settings-panel-header">
                  <h2 className="settings-panel-title">Mídia Paga (Meta / Google Ads)</h2>
                  <p className="settings-panel-subtitle">Importe os gastos diários exportados das plataformas de anúncio</p>
                </div>
                
                <div style={{ marginTop: '20px', padding: '24px', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
                  <Globe size={40} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                  <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>Upload de Investimento em Mídia</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '13px' }}>
                    O CSV deve conter as colunas: Data, Valor Gasto, Impressões, Cliques.
                  </p>
                  
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                    <div className="settings-field" style={{ width: '200px', textAlign: 'left', marginBottom: 0 }}>
                      <label className="field-label" style={{ fontSize: '12px' }}>Plataforma Padrão</label>
                      <select 
                        className="field-input" 
                        value={adsPlatform}
                        onChange={(e) => setAdsPlatform(e.target.value)}
                        style={{ padding: '8px 12px' }}
                      >
                        <option value="Meta Ads">Meta Ads</option>
                        <option value="Google Ads">Google Ads</option>
                        <option value="TikTok Ads">TikTok Ads</option>
                      </select>
                    </div>
                  </div>

                  <input 
                    type="file" 
                    accept=".csv" 
                    ref={adsFileInputRef} 
                    style={{ display: 'none' }} 
                    onChange={handleAdsFileUpload} 
                  />
                  <button 
                    className="btn-secondary" 
                    onClick={() => adsFileInputRef.current?.click()}
                    disabled={isUploadingAds}
                  >
                    {isUploadingAds ? 'Processando...' : 'Selecionar Exportação (CSV)'}
                  </button>

                  {adsUploadStatus && (
                    <div style={{ marginTop: '20px', padding: '12px', borderRadius: '4px', backgroundColor: adsUploadStatus.type === 'error' ? '#fef2f2' : '#f0fdf4', color: adsUploadStatus.type === 'error' ? '#991b1b' : '#166534', fontSize: '14px', border: `1px solid ${adsUploadStatus.type === 'error' ? '#f87171' : '#4ade80'}` }}>
                      {adsUploadStatus.msg}
                    </div>
                  )}
                </div>
              </div>

              {/* Google Analytics 4 Section */}
              <div className="card settings-panel" style={{ marginTop: '24px' }}>
                <div className="settings-panel-header">
                  <h2 className="settings-panel-title">Google Analytics 4</h2>
                  <p className="settings-panel-subtitle">Conecte sua conta para trazer dados reais de sessões e conversão</p>
                </div>
                
                <div style={{ marginTop: '20px', padding: '24px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <div className="settings-field" style={{ marginBottom: 0 }}>
                    <label className="field-label">ID da Propriedade (Property ID)</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input 
                        type="text" 
                        className="field-input" 
                        placeholder="Ex: 384729102" 
                        value={gaPropertyId}
                        onChange={(e) => setGaPropertyId(e.target.value)}
                      />
                      <button 
                        className="btn-primary" 
                        style={{ whiteSpace: 'nowrap' }}
                        onClick={handleSaveGA}
                        disabled={isSavingGA}
                      >
                        {isSavingGA ? 'Salvando...' : 'Salvar ID'}
                      </button>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      O Property ID pode ser encontrado no painel do GA4 em: Administrador &gt; Propriedade &gt; Detalhes da Propriedade.
                    </p>
                  </div>
                </div>
              </div>

              {/* Meta Ads API Integration */}
              <div className="card settings-panel" style={{ marginTop: '24px' }}>
                <div className="settings-panel-header">
                  <h2 className="settings-panel-title">Meta Ads (API Automática)</h2>
                  <p className="settings-panel-subtitle">Conecte a API do Meta para sincronizar dados de mídia paga automaticamente</p>
                </div>
                
                <div style={{ marginTop: '20px', padding: '24px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <div className="settings-field" style={{ marginBottom: 16 }}>
                    <label className="field-label">Ad Account ID</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input 
                        type="text" 
                        className="field-input" 
                        placeholder="Ex: act_123456789 ou 123456789" 
                        value={metaAdAccountId}
                        onChange={(e) => setMetaAdAccountId(e.target.value)}
                      />
                      <button 
                        className="btn-primary" 
                        style={{ whiteSpace: 'nowrap' }}
                        onClick={async () => {
                          setIsSavingMeta(true);
                          try {
                            const slug = typeof currentAccount === 'string' ? currentAccount : currentAccount.id;
                            const { error } = await supabase
                              .from('accounts')
                              .update({ meta_ad_account_id: metaAdAccountId })
                              .eq('slug', slug);
                            if (error) throw error;
                            window.dispatchEvent(new CustomEvent('nexus_notification', {
                              detail: { title: 'Meta Ads', desc: 'Ad Account ID salvo com sucesso.', type: 'success' }
                            }));
                          } catch (err) {
                            window.dispatchEvent(new CustomEvent('nexus_notification', {
                              detail: { title: 'Erro', desc: err.message, type: 'error' }
                            }));
                          } finally {
                            setIsSavingMeta(false);
                          }
                        }}
                        disabled={isSavingMeta}
                      >
                        {isSavingMeta ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      O Ad Account ID pode ser encontrado no Meta Business Suite em: Configurações da Conta &gt; Informações.
                    </p>
                  </div>

                  {metaAdAccountId && (
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button 
                          className="btn-secondary" 
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                          onClick={async () => {
                            setIsSyncingMeta(true);
                            setMetaSyncResult(null);
                            try {
                              const { data: { session } } = await supabase.auth.getSession();
                              const slug = typeof currentAccount === 'string' ? currentAccount : currentAccount.id;
                              const res = await fetch('https://vvtalmhfdchhwlzqgnvt.supabase.co/functions/v1/meta-ads-sync', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${session?.access_token}`
                                },
                                body: JSON.stringify({ accountSlug: slug, datePreset: 'last_30d' })
                              });
                              const data = await res.json();
                              if (data.error) {
                                setMetaSyncResult({ type: 'error', msg: data.error });
                              } else {
                                setMetaSyncResult({ type: 'success', msg: data.message });
                                window.dispatchEvent(new CustomEvent('nexus_notification', {
                                  detail: { title: 'Meta Ads Sincronizado!', desc: data.message, type: 'success' }
                                }));
                              }
                            } catch (err) {
                              setMetaSyncResult({ type: 'error', msg: err.message });
                            } finally {
                              setIsSyncingMeta(false);
                            }
                          }}
                          disabled={isSyncingMeta}
                        >
                          {isSyncingMeta ? (
                            <><RefreshCcw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Sincronizando...</>
                          ) : (
                            <><RefreshCcw size={14} /> Sincronizar Agora (Últimos 30 dias)</>
                          )}
                        </button>
                      </div>

                      {metaSyncResult && (
                        <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '6px', fontSize: '13px',
                          backgroundColor: metaSyncResult.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                          color: metaSyncResult.type === 'error' ? '#EF4444' : '#10B981',
                          border: `1px solid ${metaSyncResult.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}` }}>
                          {metaSyncResult.msg}
                        </div>
                      )}

                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px' }}>
                        ⚠️ Requer o secret <code>META_ACCESS_TOKEN</code> configurado no Supabase.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Nova Loja */}
              <div className="card settings-panel" style={{ marginTop: '24px' }}>
                <div className="settings-panel-header">
                  <h2 className="settings-panel-title">Adicionar Nova Loja</h2>
                  <p className="settings-panel-subtitle">Crie uma nova conta para gerenciar outra loja no dashboard</p>
                </div>

                <div style={{ marginTop: '20px', padding: '24px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="settings-field">
                      <label className="field-label">Nome da Loja *</label>
                      <input
                        type="text"
                        className="field-input"
                        placeholder="Ex: Minha Loja"
                        value={newStore.name}
                        onChange={(e) => setNewStore({ ...newStore, name: e.target.value })}
                      />
                    </div>
                    <div className="settings-field">
                      <label className="field-label">Slug (identificador) *</label>
                      <input
                        type="text"
                        className="field-input"
                        placeholder="Ex: minha-loja"
                        value={newStore.slug}
                        onChange={(e) => setNewStore({ ...newStore, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                      />
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Usado na URL da webhook e identificação interna</p>
                    </div>
                    <div className="settings-field">
                      <label className="field-label">GA4 Property ID (opcional)</label>
                      <input
                        type="text"
                        className="field-input"
                        placeholder="Ex: G-XXXXXXXXXX"
                        value={newStore.ga_property_id}
                        onChange={(e) => setNewStore({ ...newStore, ga_property_id: e.target.value })}
                      />
                    </div>
                    <div className="settings-field">
                      <label className="field-label">Cor do Tema</label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="color"
                          value={newStore.color}
                          onChange={(e) => setNewStore({ ...newStore, color: e.target.value })}
                          style={{ width: '40px', height: '36px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'transparent' }}
                        />
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{newStore.color}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn-primary"
                    style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={handleCreateStore}
                    disabled={isCreatingStore}
                  >
                    <Plus size={14} />
                    {isCreatingStore ? 'Criando...' : 'Criar Loja'}
                  </button>

                  {createdWebhookUrl && (
                    <div style={{ marginTop: '20px', padding: '16px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <CheckCircle size={14} style={{ color: 'var(--accent-green)' }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-green)' }}>Loja criada com sucesso!</span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Configure esta URL como webhook na plataforma Bagy:</p>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <code style={{ flex: 1, fontSize: '11px', padding: '10px', background: 'var(--bg-primary)', borderRadius: '6px', color: 'var(--text-primary)', wordBreak: 'break-all', border: '1px solid var(--border-color)' }}>
                          {createdWebhookUrl}
                        </code>
                        <button
                          className="btn-secondary"
                          style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={handleCopyWebhook}
                        >
                          {copiedUrl ? <><CheckCircle size={14} /> Copiado!</> : <><Copy size={14} /> Copiar</>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {['security', 'region'].includes(activeSection) && (
            <div className="card settings-panel empty-state">
              <div className="settings-panel-header">
                <h2 className="settings-panel-title">{section.label}</h2>
                <p className="settings-panel-subtitle">{section.desc}</p>
              </div>
              <div className="placeholder-content">
                <div className="placeholder-icon">
                  <section.icon size={48} />
                </div>
                <h3>Em breve</h3>
                <p>As configurações de {section.label.toLowerCase()} estarão disponíveis na próxima atualização.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
