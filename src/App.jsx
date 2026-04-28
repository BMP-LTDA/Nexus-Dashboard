import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { FilterProvider } from './contexts/FilterContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout     from './components/Layout/Layout';
import Overview   from './pages/Overview/Overview';
import Revenue    from './pages/Revenue/Revenue';
import Traffic    from './pages/Traffic/Traffic';
import Conversion from './pages/Conversion/Conversion';
import Products   from './pages/Products/Products';
import Retention  from './pages/Retention/Retention';
import PaidMedia  from './pages/PaidMedia/PaidMedia';
import Planning   from './pages/Planning/Planning';
import Reports    from './pages/Reports/Reports';
import Settings   from './pages/Settings/Settings';
import Login      from './pages/Login/Login';
import SignUp     from './pages/SignUp/SignUp';
import AgencyPanel from './pages/Agency/AgencyPanel';
import Customers  from './pages/Customers/Customers';
import { useRealtimeOrders } from './hooks/useRealtimeOrders';
import { GA4Provider } from './contexts/GA4Context';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function DashboardRoutes({ currentAccount, setCurrentAccount }) {
  const { userAccounts, loading } = useAuth();
  
  // Realtime hook: populates in-memory cache and triggers re-renders
  const { refetch: refetchOrders } = useRealtimeOrders(currentAccount);

  useEffect(() => {
    if (!loading && userAccounts.length > 0 && !currentAccount) {
      setCurrentAccount(userAccounts[0].slug || userAccounts[0].id);
    }
  }, [userAccounts, loading, currentAccount, setCurrentAccount]);

  if (loading) return null;

  return (
    <GA4Provider currentAccount={currentAccount}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout
                currentAccount={currentAccount}
                onAccountChange={setCurrentAccount}
              />
            </ProtectedRoute>
          }
        >
          <Route index                element={<Overview   currentAccount={currentAccount} />} />
          <Route path="receita"       element={<Revenue    currentAccount={currentAccount} />} />
          <Route path="trafego"       element={<Traffic    currentAccount={currentAccount} />} />
          <Route path="conversao"     element={<Conversion currentAccount={currentAccount} />} />
          <Route path="produtos"      element={<Products   currentAccount={currentAccount} />} />
          <Route path="retencao"      element={<Retention  currentAccount={currentAccount} />} />
          <Route path="midia"         element={<PaidMedia  currentAccount={currentAccount} />} />
          <Route path="planejamento"  element={<Planning   currentAccount={currentAccount} />} />
          <Route path="relatorios"    element={<Reports    currentAccount={currentAccount} />} />
          <Route path="clientes"      element={<Customers  currentAccount={currentAccount} />} />
          <Route path="agencia"       element={<AgencyPanel onAccountChange={setCurrentAccount} />} />
          <Route path="configuracoes" element={<Settings currentAccount={currentAccount} onOrdersUploaded={refetchOrders} />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </GA4Provider>
  );
}

export default function App() {
  const [currentAccount, setCurrentAccount] = useState('');

  return (
    <ThemeProvider>
      <AuthProvider>
        <FilterProvider>
          <BrowserRouter>
            <DashboardRoutes 
              currentAccount={currentAccount} 
              setCurrentAccount={setCurrentAccount} 
            />
          </BrowserRouter>
        </FilterProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
