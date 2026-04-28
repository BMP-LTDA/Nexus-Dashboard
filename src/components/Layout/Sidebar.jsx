import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, Globe, MousePointerClick,
  Package, Users, Megaphone, Target, FileText, Settings,
  ChevronLeft, ChevronRight, LogOut, Building2, UserCheck
} from 'lucide-react';
import './Sidebar.css';
import { useAuth } from '../../contexts/AuthContext';

const navItems = [
  { to: '/',              icon: LayoutDashboard,  label: 'Painel Inicial',           section: 'main'   },
  { to: '/receita',       icon: TrendingUp,        label: 'Receita & Faturamento',    section: 'main'   },
  { to: '/trafego',       icon: Globe,             label: 'Tráfego & Aquisição',      section: 'main'   },
  { to: '/conversao',     icon: MousePointerClick, label: 'Conversão & Funil',        section: 'main'   },
  { to: '/produtos',      icon: Package,           label: 'Ticket & Produtos',        section: 'main'   },
  { to: '/retencao',      icon: Users,             label: 'Retenção & Clientes',      section: 'main'   },
  { to: '/clientes',      icon: UserCheck,         label: 'Base de Clientes',         section: 'main'   },
  { to: '/midia',         icon: Megaphone,         label: 'Mídia Paga',               section: 'main'   },
  { to: '/planejamento',  icon: Target,            label: 'Planejamento & Projeções', section: 'main'   },
  { to: '/relatorios',    icon: FileText,          label: 'Relatórios',               section: 'main'   },
  { to: '/agencia',       icon: Building2,         label: 'Painel da Agência',        section: 'admin'  },
  { to: '/configuracoes', icon: Settings,          label: 'Configurações',            section: 'config' },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const { signOut, isAdmin } = useAuth();

  const visibleItems = navItems.filter(i => {
    if (i.section === 'admin' && !isAdmin) return false;
    return true;
  });

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={onMobileClose} />
      )}

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <nav className="sidebar-nav">
          <div className="nav-section">
            {visibleItems.filter(i => i.section === 'main').map(item => (
              <NavItem key={item.to} {...item} collapsed={collapsed} onMobileClose={onMobileClose} />
            ))}
          </div>

          {isAdmin && (
            <>
              <div className="nav-divider" />
              <div className="nav-section">
                <div className="nav-section-title" style={{ padding: collapsed ? '4px 0' : '4px 14px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                  {!collapsed && 'Admin'}
                </div>
                {visibleItems.filter(i => i.section === 'admin').map(item => (
                  <NavItem key={item.to} {...item} collapsed={collapsed} onMobileClose={onMobileClose} />
                ))}
              </div>
            </>
          )}

          <div className="nav-divider" />
          <div className="nav-section">
            {visibleItems.filter(i => i.section === 'config').map(item => (
              <NavItem key={item.to} {...item} collapsed={collapsed} onMobileClose={onMobileClose} />
            ))}
            <button className="nav-item logout-btn" onClick={() => { signOut(); onMobileClose(); }}>
              <span className="nav-icon"><LogOut size={18} /></span>
              {!collapsed && <span className="nav-label">Sair</span>}
            </button>
          </div>
        </nav>

        <button className="sidebar-toggle" onClick={onToggle} title={collapsed ? 'Expandir menu' : 'Recolher menu'}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>
    </>
  );
}

function NavItem({ to, icon: Icon, label, collapsed, onMobileClose }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      title={collapsed ? label : undefined}
      onClick={onMobileClose}
    >
      <span className="nav-icon"><Icon size={18} /></span>
      {!collapsed && <span className="nav-label">{label}</span>}
    </NavLink>
  );
}
