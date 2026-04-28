import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import './Layout.css';

export default function Layout({ currentAccount, onAccountChange }) {
  const [collapsed,    setCollapsed]    = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);

  const toggleMobile = () => setMobileOpen(v => !v);
  const closeMobile  = () => setMobileOpen(false);

  return (
    <div className="app-shell">
      <Header
        currentAccount={currentAccount}
        onAccountChange={onAccountChange}
        onMobileMenuToggle={toggleMobile}
        mobileMenuOpen={mobileOpen}
      />
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
        mobileOpen={mobileOpen}
        onMobileClose={closeMobile}
      />
      <main className={`main-content ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="page-wrapper animate-fadeIn">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
