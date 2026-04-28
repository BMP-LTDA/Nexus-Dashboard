import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, ChevronDown, User, Settings, LogOut, 
  Sun, Moon, Menu, X, Plus, Pencil, Trash2 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import StoreModal from '../Modals/StoreModal';
import ConfirmModal from '../Modals/ConfirmModal';
import './Header.css';

export default function Header({ currentAccount, onAccountChange, onMobileMenuToggle, mobileMenuOpen }) {
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  
  // Store management states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [deletingStore, setDeletingStore] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { theme, toggleTheme } = useTheme();
  const { user, isAdmin, signOut, userAccounts, refreshAccounts } = useAuth();
  const navigate = useNavigate();
  
  const accountRef = useRef(null);
  const notifRef   = useRef(null);
  const profileRef = useRef(null);

  const accountsList = userAccounts.length > 0 ? userAccounts : [];
  const activeAccount = accountsList.find(a => a.slug === currentAccount) || 
                        accountsList.find(a => a.id === currentAccount) || 
                        accountsList[0] || { name: 'Sem loja', icon: '❓', id: null };

  useEffect(() => {
    const handle = (e) => {
      if (accountRef.current && !accountRef.current.contains(e.target)) setShowAccountMenu(false);
      if (notifRef.current   && !notifRef.current.contains(e.target))   setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('nexus_notifications');
    if (saved) return JSON.parse(saved);
    return [
      { id:1, type:'success', text:'Meta de receita atingida em 93,7%',    time:'2min atrás' },
      { id:2, type:'alert',   text:'Taxa de conversão caiu 0,8% hoje',      time:'18min atrás'},
      { id:3, type:'info',    text:'Relatório de março disponível',          time:'1h atrás'   },
      { id:4, type:'info',    text:'Novo cliente sincronizado: Loja Beta',   time:'3h atrás'   },
    ];
  });

  useEffect(() => {
    localStorage.setItem('nexus_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    const handleNewNotif = (e) => {
      const { title, desc, type } = e.detail;
      setNotifications(prev => [
        { id: Date.now(), type: type === 'info' ? 'info' : 'success', text: title, time: 'agora' },
        ...prev
      ]);
    };
    window.addEventListener('nexus_notification', handleNewNotif);
    return () => window.removeEventListener('nexus_notification', handleNewNotif);
  }, []);

  const markAllAsRead = () => {
    setNotifications([]);
  };

  const handleDeleteStore = async () => {
    if (!deletingStore) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', deletingStore.id);
      
      if (error) throw error;
      
      await refreshAccounts();
      setDeletingStore(null);
      
      // If deleted account was active, switch to another
      if (deletingStore.slug === currentAccount || deletingStore.id === currentAccount) {
        onAccountChange(null);
      }
    } catch (err) {
      alert('Erro ao excluir loja: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <header className="header">
      <div className="header-left">
        <button className="hamburger-btn" onClick={onMobileMenuToggle}>
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="header-logo">
          <div className="logo-mark"><span className="logo-icon">◈</span></div>
          <div className="logo-text">
            <span className="logo-name">Nexus</span>
            <span className="logo-tag">Analytics</span>
          </div>
        </div>
      </div>

      <div className="header-center" ref={accountRef}>
        <button className={`account-switcher ${showAccountMenu ? 'active' : ''}`} onClick={() => setShowAccountMenu(v => !v)}>
          <span className="account-icon">{activeAccount.icon}</span>
          <div className="account-info">
            <span className="account-label">Conta ativa</span>
            <span className="account-name">{activeAccount.name}</span>
          </div>
          <ChevronDown size={14} className={`chevron ${showAccountMenu ? 'rotated' : ''}`} />
        </button>

        {showAccountMenu && (
          <div className="dropdown account-dropdown animate-fadeInUp">
            <div className="dropdown-header">Selecionar conta</div>
            <div className="account-list-scroll">
              {accountsList.map(acc => (
                <div key={acc.id} className="account-item-wrapper">
                  <button
                    className={`dropdown-item account-item ${acc.slug === currentAccount || acc.id === currentAccount ? 'selected' : ''}`}
                    onClick={() => { onAccountChange(acc.slug || acc.id); setShowAccountMenu(false); }}
                  >
                    <span className="account-item-icon" style={{ background: (acc.color || '#6366F1')+'22', color: acc.color || '#6366F1' }}>{acc.icon}</span>
                    <span className="account-item-name">{acc.name}</span>
                    {(acc.slug === currentAccount || acc.id === currentAccount) && <span className="check-mark">✓</span>}
                  </button>
                  
                  {isAdmin && (
                    <div className="account-actions">
                      <button 
                        className="btn-action edit" 
                        onClick={(e) => { e.stopPropagation(); setEditingStore(acc); setShowAccountMenu(false); }}
                        title="Editar Loja"
                      >
                        <Pencil size={12} />
                      </button>
                      <button 
                        className="btn-action delete" 
                        onClick={(e) => { e.stopPropagation(); setDeletingStore(acc); setShowAccountMenu(false); }}
                        title="Excluir Loja"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="dropdown-divider" />
            <button className="dropdown-item add-account" onClick={() => { setShowCreateModal(true); setShowAccountMenu(false); }}>
              <span className="add-icon"><Plus size={14} /></span> Criar nova loja
            </button>
          </div>
        )}

        {/* Modals */}
        {showCreateModal && <StoreModal onClose={() => setShowCreateModal(false)} />}
        {editingStore && <StoreModal initialData={editingStore} onClose={() => setEditingStore(null)} />}
        {deletingStore && (
          <ConfirmModal 
            title="Excluir Loja"
            message={`Tem certeza que deseja excluir a loja "${deletingStore.name}"? Todos os vínculos serão removidos permanentemente.`}
            confirmText="Sim, Excluir"
            loading={isDeleting}
            onConfirm={handleDeleteStore}
            onClose={() => setDeletingStore(null)}
          />
        )}
      </div>

      <div className="header-right">
        <button className="header-action-btn theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="header-action-wrap" ref={notifRef}>
          <button className={`header-action-btn ${showNotifications ? 'active' : ''}`} onClick={() => setShowNotifications(v => !v)}>
            <Bell size={18} />
            {notifications.length > 0 && <span className="notif-badge">{notifications.length}</span>}
          </button>
          {showNotifications && (
            <div className="dropdown notif-dropdown animate-fadeInUp">
              <div className="dropdown-header">
                <span>Notificações</span>
                <button className="mark-read" onClick={markAllAsRead}>Marcar como lidas</button>
              </div>
              <div className="notif-list">
                {notifications.length > 0 ? (
                  notifications.map(n => (
                    <div key={n.id} className={`notif-item notif-${n.type}`}>
                      <div className={`notif-dot dot-${n.type}`} />
                      <div className="notif-content">
                        <p className="notif-text">{n.text}</p>
                        <span className="notif-time">{n.time}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="notif-empty"><p>Sem novas notificações</p></div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="header-action-wrap" ref={profileRef}>
          <button className={`profile-btn ${showProfile ? 'active' : ''}`} onClick={() => setShowProfile(v => !v)}>
            <div className="avatar">{(user?.user_metadata?.full_name || user?.email || 'U').substring(0, 2).toUpperCase()}</div>
          </button>
          {showProfile && (
            <div className="dropdown profile-dropdown animate-fadeInUp">
              <div className="profile-info">
                <div className="avatar avatar-lg">{(user?.user_metadata?.full_name || user?.email || 'U').substring(0, 2).toUpperCase()}</div>
                <div>
                  <p className="profile-name">{user?.user_metadata?.full_name || 'Usuário Nexus'}</p>
                  <p className="profile-email">{user?.email}</p>
                </div>
              </div>
              <div className="dropdown-divider" />
              <button className="dropdown-item" onClick={() => { navigate('/configuracoes'); setShowProfile(false); }}><User size={14} /> Meu perfil</button>
              <button className="dropdown-item" onClick={() => { navigate('/configuracoes'); setShowProfile(false); }}><Settings size={14} /> Configurações</button>
              <div className="dropdown-divider" />
              <button className="dropdown-item danger" onClick={() => { signOut(); setShowProfile(false); }}><LogOut size={14} /> Sair</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
