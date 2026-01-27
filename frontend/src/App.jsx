/**
 * Componente principal da aplicação
 * 
 * Gerencia as rotas e navegação entre as visualizações:
 * - /portfolio - Vista do portfólio
 * - /cs - Dados do Setor de Sucesso do Cliente
 */

import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OracleProvider, useOracle } from './contexts/OracleContext';
import IndicadoresLiderancaView from './components/IndicadoresLiderancaView';
import ProjetosView from './components/ProjetosView';
import ConfiguracoesView from './components/ConfiguracoesView';
import CSView from './components/CSView';
import EstudoCustosView from './components/EstudoCustosView';
import HorasView from './components/HorasView';
import FormularioPassagemView from './components/FormularioPassagemView';
import FeedbacksView from './components/FeedbacksView';
import HomeView from './components/HomeView';
import IndicadoresView from './components/IndicadoresView';
import OKRsView from './components/OKRsView';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import AuthLoading from './components/AuthLoading';
import OracleChat from './components/OracleChat';
import './styles/App.css';

const icons = {
  indicadoresLideranca: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7.5A3.5 3.5 0 0 1 7.5 4h9A3.5 3.5 0 0 1 20 7.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7.5Zm3.5-1.5A1.5 1.5 0 0 0 6 7.5V9h12V7.5A1.5 1.5 0 0 0 16.5 6h-9Z" />
    </svg>
  ),
  horas: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
    </svg>
  ),
  indicadores: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  ),
  okrs: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  acessos: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a5 5 0 0 1 5 5v2h1.5a2.5 2.5 0 0 1 2.5 2.5V19a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 19v-6.5A2.5 2.5 0 0 1 5.5 10H7V8a5 5 0 0 1 5-5Zm-3 7h6V8a3 3 0 0 0-6 0v2Z" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6a1 1 0 0 1 1-1h16a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm0 6a1 1 0 0 1 1-1h16a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm0 6a1 1 0 0 1 1-1h16a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Z" />
      <circle cx="18" cy="6" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
      <circle cx="18" cy="18" r="1.5" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 4h-4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4a1 1 0 1 0 0-2h-4V6h4a1 1 0 1 0 0-2Zm9.7 7.3-3-3a1 1 0 0 0-1.4 1.4L16.6 11H10a1 1 0 1 0 0 2h6.6l-1.3 1.3a1 1 0 0 0 1.4 1.4l3-3a1 1 0 0 0 0-1.4Z" />
    </svg>
  ),
  projetos: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6Zm0 2h7v5h5v11H6V4Z" />
    </svg>
  ),
  cs: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  ),
  estudoCustos: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm0 2v16h10V4H7Zm2 2h6v2H9V6Zm0 4h6v2H9v-2Zm0 4h4v2H9v-2Z" />
    </svg>
  ),
  contatos: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4-8 5-8-5V6l8 5 8-5v2Z" />
    </svg>
  ),
  formularioPassagem: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm4 18H6V4h7v5h5v11Z" />
      <path d="M8 12h8v2H8v-2Zm0 4h8v2H8v-2Z" />
    </svg>
  ),
  feedbacks: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Zm0 14H6l-2 2V4h16v12Z" />
      <path d="M7 9h10v2H7V9Zm0 3h7v2H7v-2Z" />
    </svg>
  ),
};

function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const { user, logout, isDirector, isAdmin, isPrivileged, canAccessFormularioPassagem } = useAuth();
  const linkTitle = (label) => (collapsed ? label : undefined);
  const shortcuts = [
    {
      id: 'feedz',
      label: 'Feedz',
      href: 'https://app.feedz.com.br/',
      icon: '/icons/feedz.jpg',
    },
    {
      id: 'guia',
      label: 'Guia das Corujas',
      href: 'https://sites.google.com/otusengenharia.com/guia-das-corujas/identidade-organizacional',
      icon: '/icons/coruja.png',
    },
    {
      id: 'lista',
      label: 'Lista Mestra',
      href: 'https://docs.google.com/spreadsheets/d/1NjIK-XUIxnfgnIVvS-5XvYU02iLGgwvXsDZBDxwaaj0/edit?gid=1450042635#gid=1450042635',
      icon: '/icons/lista.png',
    },
  ];
  const getShortName = (name) => {
    if (!name) return '';
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 2) {
      return parts.join(' ');
    }
    return `${parts[0]} ${parts[1]}`;
  };
  return (
    <aside className={`sidebar glass-sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <nav className="sidebar-links">
        <Link 
          to="/indicadores-lideranca" 
          className={`nav-link nav-link-modern ${location.pathname.startsWith('/indicadores-lideranca') ? 'nav-link-active' : ''}`}
          title={linkTitle('Indicadores Liderança')}
        >
          <span className="nav-icon">{icons.indicadoresLideranca}</span>
          <span className="nav-text">Indicadores Liderança</span>
        </Link>
        <Link 
          to="/horas" 
          className={`nav-link nav-link-modern ${location.pathname.startsWith('/horas') ? 'nav-link-active' : ''}`}
          title={linkTitle('Horas')}
        >
          <span className="nav-icon">{icons.horas}</span>
          <span className="nav-text">Horas</span>
        </Link>
        <Link 
          to="/indicadores" 
          className={`nav-link nav-link-modern ${location.pathname === '/indicadores' ? 'nav-link-active' : ''}`}
          title={linkTitle('Indicadores')}
        >
          <span className="nav-icon">{icons.indicadores}</span>
          <span className="nav-text">Indicadores</span>
        </Link>
        <Link 
          to="/okrs" 
          className={`nav-link nav-link-modern ${location.pathname.startsWith('/okrs') ? 'nav-link-active' : ''}`}
          title={linkTitle('OKRs')}
        >
          <span className="nav-icon">{icons.okrs}</span>
          <span className="nav-text">OKRs</span>
        </Link>
        <Link 
          to="/projetos" 
          className={`nav-link nav-link-modern ${location.pathname.startsWith('/projetos') ? 'nav-link-active' : ''}`}
          title={linkTitle('Projetos')}
        >
          <span className="nav-icon">{icons.projetos}</span>
          <span className="nav-text">Projetos</span>
        </Link>
        <Link 
          to="/cs" 
          className={`nav-link nav-link-modern ${location.pathname.startsWith('/cs') ? 'nav-link-active' : ''}`}
          title={linkTitle('CS')}
        >
          <span className="nav-icon">{icons.cs}</span>
          <span className="nav-text">CS</span>
        </Link>
        <Link 
          to="/estudo-de-custos" 
          className={`nav-link nav-link-modern ${location.pathname.startsWith('/estudo-de-custos') ? 'nav-link-active' : ''}`}
          title={linkTitle('Estudo de Custos')}
        >
          <span className="nav-icon">{icons.estudoCustos}</span>
          <span className="nav-text">Estudo de Custos</span>
        </Link>
        <Link 
          to="/contatos" 
          className={`nav-link nav-link-modern ${location.pathname.startsWith('/contatos') ? 'nav-link-active' : ''}`}
          title={linkTitle('Contatos')}
        >
          <span className="nav-icon">{icons.contatos}</span>
          <span className="nav-text">Contatos</span>
        </Link>
        {canAccessFormularioPassagem && (
          <Link 
            to="/formulario-passagem" 
            className={`nav-link nav-link-modern ${location.pathname.startsWith('/formulario-passagem') ? 'nav-link-active' : ''}`}
            title={linkTitle('Formulário de Passagem')}
          >
            <span className="nav-icon">{icons.formularioPassagem}</span>
            <span className="nav-text">Formulário de Passagem</span>
          </Link>
        )}
        <Link 
          to="/feedbacks" 
          className={`nav-link nav-link-modern ${location.pathname.startsWith('/feedbacks') ? 'nav-link-active' : ''}`}
          title={linkTitle('Feedbacks')}
        >
          <span className="nav-icon">{icons.feedbacks}</span>
          <span className="nav-text">Feedbacks</span>
        </Link>
      </nav>
      <button
        type="button"
        className="sidebar-toggle sidebar-toggle-inline"
        onClick={onToggle}
        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
      >
        {collapsed ? '»' : '«'}
      </button>
      <div className="sidebar-lower">
        {!collapsed && (
          <div className="sidebar-shortcuts" aria-label="Atalhos">
            {shortcuts.map((item) => (
              <a
                key={item.id}
                href={item.href}
                className="sidebar-shortcut"
                title={item.label}
                target="_blank"
                rel="noreferrer"
              >
                <img src={item.icon} alt="" className="sidebar-shortcut-icon" aria-hidden="true" />
                <span className="sr-only">{item.label}</span>
              </a>
            ))}
          </div>
        )}
      </div>
      {user && (
        <div className="sidebar-footer">
          <div className="sidebar-user">
            {user.picture && (
              <img src={user.picture} alt={user.name} className="nav-user-avatar" />
            )}
            {!collapsed && (
              <div className="sidebar-user-info">
                <span className="nav-user-name">{getShortName(user.name)}</span>
                {isDirector && <span className="nav-user-badge">Diretora</span>}
                {!isDirector && isAdmin && <span className="nav-user-badge">Admin</span>}
              </div>
            )}
          </div>
          {isPrivileged && (
            <Link
              to="/acessos"
              className={`nav-logout-button nav-button-secondary ${location.pathname === '/acessos' ? 'nav-button-active' : ''} ${collapsed ? 'nav-icon-only' : ''}`}
              title={linkTitle('Configurações')}
            >
              <span className="nav-button-icon">{icons.settings}</span>
              {!collapsed && <span>Configurações</span>}
            </Link>
          )}
          <button onClick={logout} className={`nav-logout-button ${collapsed ? 'nav-icon-only' : ''}`}>
            <span className="nav-button-icon">{icons.logout}</span>
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      )}
    </aside>
  );
}

function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <img src="/otus_branca.png" alt="Otus Engenharia" className="nav-logo" />
        <h1 className="topbar-title">Indicadores do Setor de Projeto</h1>
      </div>
      <div className="topbar-mission">Elevando o padrão de se construir</div>
    </header>
  );
}

function AppContent() {
  const location = useLocation();
  const { isPrivileged, isAuthenticated, loading } = useAuth();
  const { isOpen: isOracleOpen } = useOracle();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const isLoginRoute = location.pathname === '/login';

  // 1. Verificando auth: só loading minimalista, sem revelar estrutura do app
  if (loading) {
    return <AuthLoading />;
  }

  // 2. Não autenticado: login ou redirect para login (nunca mostrar shell)
  if (!isAuthenticated) {
    if (isLoginRoute) {
      return (
        <div className="app">
          <main className="main-content">
            <Routes>
              <Route path="/login" element={<Login />} />
            </Routes>
          </main>
        </div>
      );
    }
    return <Navigate to="/login" replace />;
  }

  // 3. Autenticado em /login → ir para o app
  if (isLoginRoute) {
    return <Navigate to="/home" replace />;
  }

  // 4. Autenticado: mostrar shell (TopBar, Sidebar, rotas)
  const isHomeRoute = location.pathname === '/home' || location.pathname === '/';
  const showSidebar = !isHomeRoute;
  
  return (
    <div className="app app-shell">
      <TopBar />
      <div className="app-body">
        {showSidebar && (
          <Sidebar
            collapsed={isSidebarCollapsed}
            onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
          />
        )}
        <main className={`main-content ${showSidebar ? 'main-content-sidebar' : ''} ${isOracleOpen ? 'oracle-adjusted' : ''}`}>
          <Routes>
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Navigate to="/home" replace />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/home" 
              element={
                <ProtectedRoute>
                  <HomeView />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/indicadores-lideranca" 
              element={
                <ProtectedRoute>
                  <IndicadoresLiderancaView />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/horas" 
              element={
                <ProtectedRoute>
                  <HorasView />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/indicadores" 
              element={
                <ProtectedRoute>
                  <IndicadoresView />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/okrs" 
              element={
                <ProtectedRoute>
                  <OKRsView />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/projetos" 
              element={
                <ProtectedRoute>
                  <ProjetosView />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/cs" 
              element={
                <ProtectedRoute>
                  <CSView />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/estudo-de-custos" 
              element={
                <ProtectedRoute>
                  <EstudoCustosView />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/contatos" 
              element={
                <ProtectedRoute>
                  <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <h2>Contatos</h2>
                    <p>Esta funcionalidade será implementada em breve.</p>
                  </div>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/formulario-passagem" 
              element={
                <ProtectedRoute>
                  <FormularioPassagemView />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/feedbacks" 
              element={
                <ProtectedRoute>
                  <FeedbacksView />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/acessos" 
              element={
                <ProtectedRoute>
                  {isPrivileged ? <ConfiguracoesView /> : <Navigate to="/indicadores-lideranca" replace />}
                </ProtectedRoute>
              } 
            />
          </Routes>
          {/* Oraculo - Assistente LMM (disponível em todas as páginas) */}
          <OracleChat />
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <OracleProvider>
          <AppContent />
        </OracleProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
