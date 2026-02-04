/**
 * Componente principal da aplicação
 * 
 * Gerencia as rotas e navegação entre as visualizações:
 * - /portfolio - Vista do portfólio
 * - /cs - Dados do Setor de Sucesso do Cliente
 */

import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OracleProvider, useOracle } from './contexts/OracleContext';
import { PortfolioProvider } from './contexts/PortfolioContext';
import axios from 'axios';
import IndicadoresLiderancaView from './components/IndicadoresLiderancaView';
import ProjetosView from './components/ProjetosView';
import ConfiguracoesView from './components/ConfiguracoesView';
import CSView from './components/CSView';
import EstudoCustosView from './components/EstudoCustosView';
import HorasView from './components/HorasView';
import FormularioPassagemView from './components/FormularioPassagemView';
// FeedbacksView removido - substituído por FeedbackKanbanView e FeedbackAdminView (lazy loaded)
import ContatosView from './components/ContatosView';
import LogsView from './components/LogsView';
import HomeView from './components/HomeView';
import PortfolioView from './components/PortfolioView';
import IndicadoresView from './components/IndicadoresView';
import CurvaSView from './components/CurvaSView';
import BaselinesView from './components/BaselinesView';
import CSAreaView from './components/CSAreaView';
import ApoioProjetosView from './components/ApoioProjetosView';
import AlocacaoTimesView from './components/AlocacaoTimesView';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import AuthLoading from './components/AuthLoading';
import OracleChat from './components/OracleChat';
import BugReportFAB from './components/BugReportFAB';
import './styles/App.css';

// Lazy load das páginas de indicadores individuais
const DashboardIndicadores = lazy(() => import('./pages/indicadores/DashboardIndicadores'));
const OverviewIndicadores = lazy(() => import('./pages/indicadores/OverviewIndicadores'));
const TeamView = lazy(() => import('./pages/indicadores/TeamView'));
const PersonDetailView = lazy(() => import('./pages/indicadores/PersonDetailView'));
const IndicatorDetailView = lazy(() => import('./pages/indicadores/IndicatorDetailView'));
const HistoryView = lazy(() => import('./pages/indicadores/HistoryView'));
const AdminSetores = lazy(() => import('./pages/indicadores/AdminSetores'));
const AdminUsuarios = lazy(() => import('./pages/indicadores/AdminUsuarios'));
const AdminCargos = lazy(() => import('./pages/indicadores/AdminCargos'));
// AdminBugReports removido - substituído por FeedbackAdminView

// Lazy load das páginas de Feedbacks
const FeedbackKanbanView = lazy(() => import('./pages/feedbacks/FeedbackKanbanView'));
const FeedbackAdminView = lazy(() => import('./pages/feedbacks/FeedbackAdminView'));

// Lazy load das páginas de Workspace (Gestao de Tarefas)
const WorkspaceView = lazy(() => import('./pages/workspace/WorkspaceView'));
const ProjectView = lazy(() => import('./pages/workspace/ProjectView'));
// SectorWorkspaceView removido - funcionalidade agora no WorkspaceView com drawer

// Lazy load das páginas de OKRs
const DashboardOKRs = lazy(() => import('./pages/okrs/DashboardOKRs'));
const CompanyOKRs = lazy(() => import('./pages/okrs/CompanyOKRs'));
const SectorOKRs = lazy(() => import('./pages/okrs/SectorOKRs'));
const ObjectiveDetail = lazy(() => import('./pages/okrs/ObjectiveDetail'));
const KeyResultDetail = lazy(() => import('./pages/okrs/KeyResultDetail'));
const CheckInMeeting = lazy(() => import('./pages/okrs/CheckInMeeting'));
const HistoryOKRs = lazy(() => import('./pages/okrs/HistoryOKRs'));

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
      <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM10 12a2 2 0 1 1 4 0 2 2 0 0 1-4 0Z" />
      <path d="M12 1a1 1 0 0 1 1 1v1.07a7 7 0 0 1 2.62 1.09l.76-.76a1 1 0 1 1 1.41 1.41l-.76.76A7 7 0 0 1 18.12 8H19a1 1 0 1 1 0 2h-.88a7 7 0 0 1 0 4H19a1 1 0 1 1 0 2h-.88a7 7 0 0 1-1.09 2.62l.76.76a1 1 0 1 1-1.41 1.41l-.76-.76A7 7 0 0 1 13 21.12V22a1 1 0 1 1-2 0v-.88a7 7 0 0 1-2.62-1.09l-.76.76a1 1 0 1 1-1.41-1.41l.76-.76A7 7 0 0 1 5.88 16H5a1 1 0 1 1 0-2h.88a7 7 0 0 1 0-4H5a1 1 0 1 1 0-2h.88a7 7 0 0 1 1.09-2.62l-.76-.76a1 1 0 0 1 1.41-1.41l.76.76A7 7 0 0 1 11 3.07V2a1 1 0 0 1 1-1Zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" />
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
  // Ícones para área de Indicadores Individuais
  dashboard: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
    </svg>
  ),
  overview: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
    </svg>
  ),
  team: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
    </svg>
  ),
  sectors: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm6 9.09c0 4-2.55 7.7-6 8.83-3.45-1.13-6-4.82-6-8.83V6.31l6-2.12 6 2.12v4.78z" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  ),
  positions: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z" />
    </svg>
  ),
  bugs: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 116 0v1M12 20c-3.3 0-6-2.7-6-6v-3a6 6 0 0112 0v3c0 3.3-2.7 6-6 6zM12 20v2M3 13h3M18 13h3M6.53 17.47l-2.12 2.12M17.47 17.47l2.12 2.12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

function Sidebar({ collapsed, onToggle, area }) {
  const location = useLocation();
  const { user, logout, isDirector, isAdmin, isPrivileged, isDev, hasFullAccess, canAccessFormularioPassagem } = useAuth();
  const linkTitle = (label) => (collapsed ? label : undefined);

  // State para setores (carregados dinamicamente para OKRs e Workspace)
  const [sectors, setSectors] = useState([]);
  const [sectorsExpanded, setSectorsExpanded] = useState(true);

  // State para workspace sectors
  const [workspaceSectors, setWorkspaceSectors] = useState([]);
  const [workspaceSectorsExpanded, setWorkspaceSectorsExpanded] = useState(true);
  const [workspaceProjects, setWorkspaceProjects] = useState({});
  const [expandedSectors, setExpandedSectors] = useState({});

  // Carregar setores quando estiver na área de OKRs ou Workspace
  useEffect(() => {
    if (area === 'okrs') {
      axios.get('/api/ind/sectors', { withCredentials: true })
        .then(res => {
          if (res.data.success) {
            setSectors(res.data.data || []);
          }
        })
        .catch(err => console.error('Error loading sectors:', err));
    }
    if (area === 'workspace') {
      axios.get('/api/ind/sectors', { withCredentials: true })
        .then(res => {
          if (res.data.success) {
            setWorkspaceSectors(res.data.data || []);
          }
        })
        .catch(err => console.error('Error loading workspace sectors:', err));
    }
  }, [area]);

  // Função para carregar projetos de um setor (lazy load)
  const loadSectorProjects = useCallback((sectorId) => {
    if (workspaceProjects[sectorId]) return; // Já carregado
    axios.get(`/api/workspace-projects?sector_id=${sectorId}`, { withCredentials: true })
      .then(res => {
        if (res.data.success) {
          setWorkspaceProjects(prev => ({
            ...prev,
            [sectorId]: res.data.data || []
          }));
        }
      })
      .catch(err => console.error('Error loading sector projects:', err));
  }, [workspaceProjects]);

  // Toggle setor expandido
  const toggleSectorExpanded = useCallback((sectorId) => {
    setExpandedSectors(prev => {
      const newExpanded = { ...prev, [sectorId]: !prev[sectorId] };
      if (newExpanded[sectorId]) {
        loadSectorProjects(sectorId);
      }
      return newExpanded;
    });
  }, [loadSectorProjects]);

  // Cores e ícones para setores
  const SECTOR_COLORS = {
    'CS': '#22c55e',
    'Tecnologia': '#3b82f6',
    'Marketing': '#ec4899',
    'Vendas': '#f59e0b',
    'Gente & Gestão': '#8b5cf6',
    'Administrativo & Financeiro': '#6b7280',
    'Diretoria': '#ef4444',
    'Operação': '#06b6d4',
  };

  const SECTOR_ICONS = {
    'CS': '🎯',
    'Tecnologia': '💻',
    'Marketing': '📢',
    'Vendas': '💼',
    'Gente & Gestão': '👥',
    'Administrativo & Financeiro': '📊',
    'Diretoria': '🏢',
    'Operação': '⚙️',
  };

  const getSectorIcon = (name) => SECTOR_ICONS[name] || '📁';
  const getSectorColor = (name) => SECTOR_COLORS[name] || '#64748b';
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

  // Links para área de PROJETOS
  const projetosLinks = (
    <>
      <Link
        to="/horas" 
        className={`nav-link nav-link-modern ${location.pathname.startsWith('/horas') ? 'nav-link-active' : ''}`}
        title={linkTitle('Horas')}
      >
        <span className="nav-icon">{icons.horas}</span>
        <span className="nav-text">Horas</span>
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
    </>
  );

  // Links para área de LÍDERES DE PROJETO
  const lideresLinks = (
    <>
      <Link
        to="/lideres-projeto/indicadores"
        className={`nav-link nav-link-modern ${location.pathname === '/lideres-projeto/indicadores' || location.pathname === '/lideres-projeto' ? 'nav-link-active' : ''}`}
        title={linkTitle('Indicadores')}
      >
        <span className="nav-icon">{icons.indicadores}</span>
        <span className="nav-text">Indicadores</span>
      </Link>
      <Link
        to="/lideres-projeto/portfolio"
        className={`nav-link nav-link-modern ${location.pathname === '/lideres-projeto/portfolio' ? 'nav-link-active' : ''}`}
        title={linkTitle('Portfolio')}
      >
        <span className="nav-icon">{icons.projetos}</span>
        <span className="nav-text">Portfolio</span>
      </Link>
      <Link
        to="/lideres-projeto/curva-s"
        className={`nav-link nav-link-modern ${location.pathname === '/lideres-projeto/curva-s' ? 'nav-link-active' : ''}`}
        title={linkTitle('Curva S')}
      >
        <span className="nav-icon">{icons.indicadoresLideranca}</span>
        <span className="nav-text">Curva S</span>
      </Link>
      <Link
        to="/lideres-projeto/baselines"
        className={`nav-link nav-link-modern ${location.pathname === '/lideres-projeto/baselines' ? 'nav-link-active' : ''}`}
        title={linkTitle('Baselines')}
      >
        <span className="nav-icon">{icons.indicadoresLideranca}</span>
        <span className="nav-text">Baselines</span>
      </Link>
      {isPrivileged && (
        <Link
          to="/lideres-projeto/alocacao-times"
          className={`nav-link nav-link-modern ${location.pathname === '/lideres-projeto/alocacao-times' ? 'nav-link-active' : ''}`}
          title={linkTitle('Alocacao de Times')}
        >
          <span className="nav-icon">{icons.team}</span>
          <span className="nav-text">Alocacao de Times</span>
        </Link>
      )}
    </>
  );

  // Links para área de CS (placeholder - expandir depois)
  const csLinks = (
    <>
      <Link
        to="/cs-area"
        className={`nav-link nav-link-modern nav-link-active`}
        title={linkTitle('CS')}
      >
        <span className="nav-icon">{icons.cs}</span>
        <span className="nav-text">Dashboard CS</span>
      </Link>
    </>
  );

  // Links para área de APOIO DE PROJETOS (placeholder - expandir depois)
  const apoioLinks = (
    <>
      <Link
        to="/apoio-projetos"
        className={`nav-link nav-link-modern nav-link-active`}
        title={linkTitle('Apoio de Projetos')}
      >
        <span className="nav-icon">{icons.projetos}</span>
        <span className="nav-text">Dashboard Apoio</span>
      </Link>
    </>
  );

  // Links para área de WORKSPACE (Gestão de Tarefas)
  // Navegação simplificada - setores são gerenciados pelo drawer no WorkspaceView
  const workspaceLinks = (
    <>
      <Link
        to="/workspace"
        className={`nav-link nav-link-modern ${location.pathname === '/workspace' || location.pathname.startsWith('/workspace/') ? 'nav-link-active' : ''}`}
        title={linkTitle('Gestao por Setor')}
      >
        <span className="nav-icon">{icons.projetos}</span>
        <span className="nav-text">Gestao por Setor</span>
      </Link>

      {/* Seção SETORES - Lista simples, drawer no WorkspaceView faz a navegação detalhada */}
      {workspaceSectors.length > 0 && workspaceSectors.filter(s => s.name !== 'Diretoria').length > 0 && (
        <>
          <div className="nav-section-divider"></div>
          <button
            className={`nav-section-header ${collapsed ? 'sr-only' : ''}`}
            onClick={() => setWorkspaceSectorsExpanded(!workspaceSectorsExpanded)}
            title={linkTitle('Setores')}
          >
            <span className="nav-icon">{icons.sectors}</span>
            <span className="nav-section-title">SETORES</span>
            <span className={`nav-section-chevron ${workspaceSectorsExpanded ? 'expanded' : ''}`}>
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M7 10l5 5 5-5z"/>
              </svg>
            </span>
          </button>
          {workspaceSectorsExpanded && (
            <div className="nav-sectors-list">
              {workspaceSectors.filter(s => s.name !== 'Diretoria').map(sector => (
                <Link
                  key={sector.id}
                  to="/workspace"
                  className="nav-link nav-link-modern nav-link-nested nav-link-sector"
                  title={linkTitle(sector.name)}
                  onClick={() => {
                    // Trigger para abrir drawer do setor (via state ou URL param)
                    window.dispatchEvent(new CustomEvent('openSectorDrawer', { detail: sector }));
                  }}
                >
                  <span className="nav-sector-icon">{getSectorIcon(sector.name)}</span>
                  <span className="nav-text">{sector.name}</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );

  // Links para área de CONFIGURAÇÕES
  const configuracoesLinks = (
    <>
      <Link
        to="/acessos"
        className={`nav-link nav-link-modern ${location.pathname.startsWith('/acessos') ? 'nav-link-active' : ''}`}
        title={linkTitle('Acessos')}
      >
        <span className="nav-icon">{icons.acessos}</span>
        <span className="nav-text">Acessos</span>
      </Link>
      <Link
        to="/logs"
        className={`nav-link nav-link-modern ${location.pathname.startsWith('/logs') ? 'nav-link-active' : ''}`}
        title={linkTitle('Logs')}
      >
        <span className="nav-icon">{icons.settings}</span>
        <span className="nav-text">Logs</span>
      </Link>
      <Link
        to="/bug-reports"
        className={`nav-link nav-link-modern ${location.pathname.startsWith('/bug-reports') ? 'nav-link-active' : ''}`}
        title={linkTitle('Bug Reports')}
      >
        <span className="nav-icon">{icons.bugs}</span>
        <span className="nav-text">Bug Reports</span>
      </Link>
      <Link
        to="/gerenciar-feedbacks"
        className={`nav-link nav-link-modern ${location.pathname === '/gerenciar-feedbacks' ? 'nav-link-active' : ''}`}
        title={linkTitle('Gerenciar Feedbacks')}
      >
        <span className="nav-icon">{icons.feedbacks}</span>
        <span className="nav-text">Gerenciar Feedbacks</span>
      </Link>
    </>
  );

  // Links para área de INDICADORES INDIVIDUAIS
  const indicadoresIndLinks = (
    <>
      <Link
        to="/ind"
        className={`nav-link nav-link-modern ${location.pathname === '/ind' ? 'nav-link-active' : ''}`}
        title={linkTitle('Meus Indicadores')}
      >
        <span className="nav-icon">{icons.dashboard}</span>
        <span className="nav-text">Meus Indicadores</span>
      </Link>
      <Link
        to="/ind/equipe"
        className={`nav-link nav-link-modern ${location.pathname === '/ind/equipe' ? 'nav-link-active' : ''}`}
        title={linkTitle('Minha Equipe')}
      >
        <span className="nav-icon">{icons.team}</span>
        <span className="nav-text">Minha Equipe</span>
      </Link>
      {isPrivileged && (
        <>
          <Link
            to="/ind/visao-geral"
            className={`nav-link nav-link-modern ${location.pathname === '/ind/visao-geral' ? 'nav-link-active' : ''}`}
            title={linkTitle('Visão Geral')}
          >
            <span className="nav-icon">{icons.overview}</span>
            <span className="nav-text">Visão Geral</span>
          </Link>
          <Link
            to="/ind/historico"
            className={`nav-link nav-link-modern ${location.pathname === '/ind/historico' ? 'nav-link-active' : ''}`}
            title={linkTitle('Histórico')}
          >
            <span className="nav-icon">{icons.history}</span>
            <span className="nav-text">Histórico</span>
          </Link>
          <div className="nav-section-divider"></div>
          <span className={`nav-section-title ${collapsed ? 'sr-only' : ''}`}>Administração</span>
          <Link
            to="/ind/admin/setores"
            className={`nav-link nav-link-modern ${location.pathname === '/ind/admin/setores' ? 'nav-link-active' : ''}`}
            title={linkTitle('Setores')}
          >
            <span className="nav-icon">{icons.sectors}</span>
            <span className="nav-text">Setores</span>
          </Link>
          <Link
            to="/ind/admin/cargos"
            className={`nav-link nav-link-modern ${location.pathname === '/ind/admin/cargos' ? 'nav-link-active' : ''}`}
            title={linkTitle('Cargos')}
          >
            <span className="nav-icon">{icons.positions}</span>
            <span className="nav-text">Cargos</span>
          </Link>
          <Link
            to="/ind/admin/usuarios"
            className={`nav-link nav-link-modern ${location.pathname === '/ind/admin/usuarios' ? 'nav-link-active' : ''}`}
            title={linkTitle('Usuários')}
          >
            <span className="nav-icon">{icons.users}</span>
            <span className="nav-text">Usuários</span>
          </Link>
        </>
      )}
    </>
  );

  // Links para área de OKRs
  const okrsLinks = (
    <>
      <Link
        to="/okrs"
        className={`nav-link nav-link-modern ${location.pathname === '/okrs' ? 'nav-link-active' : ''}`}
        title={linkTitle('Dashboard')}
      >
        <span className="nav-icon">{icons.dashboard}</span>
        <span className="nav-text">Dashboard</span>
      </Link>
      <Link
        to="/okrs/empresa"
        className={`nav-link nav-link-modern ${location.pathname === '/okrs/empresa' ? 'nav-link-active' : ''}`}
        title={linkTitle('OKRs da Empresa')}
      >
        <span className="nav-icon">{icons.sectors}</span>
        <span className="nav-text">OKRs da Empresa</span>
      </Link>
      {isPrivileged && (
        <>
          <Link
            to="/okrs/check-in"
            className={`nav-link nav-link-modern ${location.pathname === '/okrs/check-in' ? 'nav-link-active' : ''}`}
            title={linkTitle('Reunião Check-in')}
          >
            <span className="nav-icon">{icons.feedbacks}</span>
            <span className="nav-text">Reunião Check-in</span>
          </Link>
          <Link
            to="/okrs/historico"
            className={`nav-link nav-link-modern ${location.pathname === '/okrs/historico' ? 'nav-link-active' : ''}`}
            title={linkTitle('Histórico')}
          >
            <span className="nav-icon">{icons.history}</span>
            <span className="nav-text">Histórico</span>
          </Link>
        </>
      )}

      {/* Seção SETORES */}
      {sectors.length > 0 && (
        <>
          <div className="nav-section-divider"></div>
          <button
            className={`nav-section-header ${collapsed ? 'sr-only' : ''}`}
            onClick={() => setSectorsExpanded(!sectorsExpanded)}
            title={linkTitle('Setores')}
          >
            <span className="nav-icon">{icons.sectors}</span>
            <span className="nav-section-title">SETORES</span>
            <span className={`nav-section-chevron ${sectorsExpanded ? 'expanded' : ''}`}>
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M7 10l5 5 5-5z"/>
              </svg>
            </span>
          </button>
          {sectorsExpanded && (
            <div className="nav-sectors-list">
              {sectors.map(sector => (
                <Link
                  key={sector.id}
                  to={`/okrs/setor/${sector.id}`}
                  className={`nav-link nav-link-modern nav-link-nested ${location.pathname === `/okrs/setor/${sector.id}` ? 'nav-link-active' : ''}`}
                  title={linkTitle(sector.name)}
                >
                  <span className="nav-bullet">•</span>
                  <span className="nav-text">{sector.name}</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {/* Seção ADMINISTRAÇÃO */}
      {isPrivileged && (
        <>
          <div className="nav-section-divider"></div>
          <span className={`nav-section-title ${collapsed ? 'sr-only' : ''}`}>ADMINISTRAÇÃO</span>
          <Link
            to="/ind/admin/setores"
            className={`nav-link nav-link-modern ${location.pathname === '/ind/admin/setores' ? 'nav-link-active' : ''}`}
            title={linkTitle('Setores')}
          >
            <span className="nav-icon">{icons.sectors}</span>
            <span className="nav-text">Setores</span>
          </Link>
          <Link
            to="/ind/admin/usuarios"
            className={`nav-link nav-link-modern ${location.pathname === '/ind/admin/usuarios' ? 'nav-link-active' : ''}`}
            title={linkTitle('Usuários')}
          >
            <span className="nav-icon">{icons.users}</span>
            <span className="nav-text">Usuários</span>
          </Link>
        </>
      )}
    </>
  );

  return (
    <aside className={`sidebar glass-sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <nav className="sidebar-links">
        {area === 'projetos' && projetosLinks}
        {area === 'lideres' && lideresLinks}
        {area === 'cs' && csLinks}
        {area === 'apoio' && apoioLinks}
        {area === 'configuracoes' && configuracoesLinks}
        {area === 'indicadores' && indicadoresIndLinks}
        {area === 'okrs' && okrsLinks}
        {area === 'workspace' && workspaceLinks}
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
                {isDev && <span className="nav-user-badge">Dev</span>}
                {!isDev && isDirector && <span className="nav-user-badge">Diretora</span>}
                {!isDev && !isDirector && isAdmin && <span className="nav-user-badge">Admin</span>}
              </div>
            )}
          </div>
          {(isAdmin || isDirector) && (
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
  const navigate = useNavigate();
  const location = useLocation();
  const isHomeRoute = location.pathname === '/home' || location.pathname === '/';
  
  return (
    <header className="topbar">
      <div className="topbar-brand">
        {!isHomeRoute && (
          <button 
            onClick={() => navigate('/home')} 
            className="topbar-home-button"
            title="Voltar ao início"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <path d="M9 22V12h6v10" />
            </svg>
          </button>
        )}
        <img src="/otus_branca.png" alt="Otus Engenharia" className="nav-logo" />
        <h1 className="topbar-title">Indicadores do Setor de Projeto</h1>
      </div>
      <div className="topbar-mission">Elevando o padrão de se construir</div>
    </header>
  );
}

function AppContent() {
  const location = useLocation();
  const { isPrivileged, isAuthenticated, loading, isAdmin, isDirector, isLeader, isDev, hasFullAccess, canAccessView } = useAuth();
  const { isOpen: isOracleOpen } = useOracle();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const isLoginRoute = location.pathname === '/login';

  // Devs, admin e diretor podem acessar Projetos e Configurações
  // Líderes são redirecionados para /ind
  const canAccessProjetosArea = isDev || isAdmin || isDirector;
  const canAccessConfiguracoesArea = isDev || isAdmin || isDirector;

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
  
  // Detectar área atual baseado na rota
  const getCurrentArea = () => {
    const path = location.pathname;
    // Área Líderes de Projeto (separada de projetos)
    if (path.startsWith('/lideres-projeto')) {
      return 'lideres';
    }
    // Área CS
    if (path.startsWith('/cs-area')) {
      return 'cs';
    }
    // Área Apoio de Projetos
    if (path.startsWith('/apoio-projetos')) {
      return 'apoio';
    }
    if (path.startsWith('/horas') ||
        path.startsWith('/projetos') ||
        path.startsWith('/cs') ||
        path.startsWith('/estudo-de-custos') ||
        path.startsWith('/contatos') ||
        path.startsWith('/formulario-passagem') ||
        path.startsWith('/feedbacks')) {
      return 'projetos';
    }
    if (path.startsWith('/acessos') || path.startsWith('/logs') || path.startsWith('/bug-reports') || path.startsWith('/gerenciar-feedbacks')) {
      return 'configuracoes';
    }
    if (path.startsWith('/ind')) {
      return 'indicadores';
    }
    if (path.startsWith('/okrs')) {
      return 'okrs';
    }
    if (path.startsWith('/workspace')) {
      return 'workspace';
    }
    return null;
  };
  
  const currentArea = getCurrentArea();
  const showSidebar = !isHomeRoute && currentArea !== null;
  const showTopBar = !isHomeRoute;
  // Não mostrar Oráculo na Home, OKRs, Indicadores legados e área /ind
  const isOKRsOrIndicadoresRoute = location.pathname.startsWith('/okrs') || location.pathname.startsWith('/ind');
  const showOracle = !isHomeRoute && !isOKRsOrIndicadoresRoute;
  
  // Tela Home: sem TopBar, sem Sidebar, sem Oráculo
  if (isHomeRoute) {
    return (
      <div className="app">
        <main className="main-content">
          <Routes>
            <Route 
              path="/home" 
              element={
                <ProtectedRoute>
                  <HomeView />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Navigate to="/home" replace />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </main>
      </div>
    );
  }
  
  // Demais páginas: com TopBar, Sidebar (se aplicável), e Oráculo
  return (
    <div className="app app-shell">
      {showTopBar && <TopBar />}
      <div className="app-body">
        {showSidebar && (
          <Sidebar
            collapsed={isSidebarCollapsed}
            onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
            area={currentArea}
          />
        )}
        <main className={`main-content ${showSidebar ? 'main-content-sidebar' : ''} ${isOracleOpen ? 'oracle-adjusted' : ''}`}>
          <Routes>
            {/* Redirect antigo /indicadores-lideranca para nova área */}
            <Route
              path="/indicadores-lideranca"
              element={<Navigate to="/lideres-projeto/indicadores" replace />}
            />
            {/* Área Líderes de Projeto - rotas aninhadas com PortfolioProvider compartilhado */}
            <Route
              path="/lideres-projeto"
              element={
                <ProtectedRoute>
                  {canAccessProjetosArea ? (
                    <PortfolioProvider>
                      <Outlet />
                    </PortfolioProvider>
                  ) : <Navigate to="/ind" replace />}
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="indicadores" replace />} />
              <Route path="indicadores" element={<IndicadoresView />} />
              <Route path="portfolio" element={<PortfolioView />} />
              <Route path="curva-s" element={<CurvaSView />} />
              <Route path="baselines" element={<BaselinesView />} />
              <Route path="alocacao-times" element={isPrivileged ? <AlocacaoTimesView /> : <Navigate to="/ind" replace />} />
            </Route>
            {/* Área CS */}
            <Route
              path="/cs-area"
              element={
                <ProtectedRoute>
                  <CSAreaView />
                </ProtectedRoute>
              }
            />
            {/* Área Apoio de Projetos */}
            <Route
              path="/apoio-projetos"
              element={
                <ProtectedRoute>
                  <ApoioProjetosView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/horas"
              element={
                <ProtectedRoute>
                  {canAccessProjetosArea ? <HorasView /> : <Navigate to="/ind" replace />}
                </ProtectedRoute>
              }
            />
            {/* Área de OKRs */}
            <Route
              path="/okrs"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<div className="loading-page">Carregando...</div>}>
                    <DashboardOKRs />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/okrs/empresa"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<div className="loading-page">Carregando...</div>}>
                    <CompanyOKRs />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/okrs/setor/:id"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<div className="loading-page">Carregando...</div>}>
                    <SectorOKRs />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/okrs/objetivo/:id"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<div className="loading-page">Carregando...</div>}>
                    <ObjectiveDetail />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/okrs/kr/:id"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<div className="loading-page">Carregando...</div>}>
                    <KeyResultDetail />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/okrs/check-in"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<div className="loading-page">Carregando...</div>}>
                    <CheckInMeeting />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/okrs/historico"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<div className="loading-page">Carregando...</div>}>
                    <HistoryOKRs />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/projetos"
              element={
                <ProtectedRoute>
                  {canAccessProjetosArea ? <ProjetosView /> : <Navigate to="/ind" replace />}
                </ProtectedRoute>
              }
            />
            <Route
              path="/cs"
              element={
                <ProtectedRoute>
                  {canAccessProjetosArea ? <CSView /> : <Navigate to="/ind" replace />}
                </ProtectedRoute>
              }
            />
            <Route
              path="/estudo-de-custos"
              element={
                <ProtectedRoute>
                  {canAccessProjetosArea ? <EstudoCustosView /> : <Navigate to="/ind" replace />}
                </ProtectedRoute>
              }
            />
            <Route
              path="/contatos"
              element={
                <ProtectedRoute>
                  {canAccessProjetosArea ? <ContatosView /> : <Navigate to="/ind" replace />}
                </ProtectedRoute>
              }
            />
            <Route
              path="/formulario-passagem"
              element={
                <ProtectedRoute>
                  {canAccessProjetosArea ? <FormularioPassagemView /> : <Navigate to="/ind" replace />}
                </ProtectedRoute>
              }
            />
            <Route
              path="/feedbacks"
              element={
                <ProtectedRoute>
                  {canAccessProjetosArea ? (
                    <Suspense fallback={<div className="loading-page">Carregando...</div>}>
                      <FeedbackKanbanView />
                    </Suspense>
                  ) : <Navigate to="/ind" replace />}
                </ProtectedRoute>
              }
            />
            <Route
              path="/gerenciar-feedbacks"
              element={
                <ProtectedRoute>
                  {canAccessConfiguracoesArea ? (
                    <Suspense fallback={<div className="loading-page">Carregando...</div>}>
                      <FeedbackAdminView />
                    </Suspense>
                  ) : <Navigate to="/ind" replace />}
                </ProtectedRoute>
              }
            />
            {/* Area de Workspace (Gestao de Tarefas) */}
            <Route
              path="/workspace"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<div className="loading-page">Carregando...</div>}>
                    <WorkspaceView />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/workspace/project/:projectId"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<div className="loading-page">Carregando...</div>}>
                    <ProjectView />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            {/* Redirecionar rota antiga de setor para workspace */}
            <Route
              path="/workspace/setor/:sectorId"
              element={<Navigate to="/workspace" replace />}
            />
            <Route
              path="/acessos"
              element={
                <ProtectedRoute>
                  {canAccessConfiguracoesArea ? <ConfiguracoesView /> : <Navigate to="/ind" replace />}
                </ProtectedRoute>
              }
            />
            <Route
              path="/logs"
              element={
                <ProtectedRoute>
                  {canAccessConfiguracoesArea ? <LogsView /> : <Navigate to="/ind" replace />}
                </ProtectedRoute>
              }
            />
            <Route
              path="/bug-reports"
              element={
                <ProtectedRoute>
                  {canAccessConfiguracoesArea ? (
                    <Suspense fallback={<div className="loading-page">Carregando...</div>}>
                      <FeedbackAdminView />
                    </Suspense>
                  ) : <Navigate to="/ind" replace />}
                </ProtectedRoute>
              }
            />
            {/* Área de Indicadores Individuais */}
            <Route
              path="/ind"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<div className="loading-page">Carregando...</div>}>
                    <DashboardIndicadores />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ind/equipe"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<div className="loading-page">Carregando...</div>}>
                    <TeamView />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ind/visao-geral"
              element={
                <ProtectedRoute>
                  {isPrivileged ? (
                    <Suspense fallback={<div className="loading-page">Carregando...</div>}>
                      <OverviewIndicadores />
                    </Suspense>
                  ) : <Navigate to="/ind" replace />}
                </ProtectedRoute>
              }
            />
            <Route
              path="/ind/historico"
              element={
                <ProtectedRoute>
                  {isPrivileged ? (
                    <Suspense fallback={<div className="loading-page">Carregando...</div>}>
                      <HistoryView />
                    </Suspense>
                  ) : <Navigate to="/ind" replace />}
                </ProtectedRoute>
              }
            />
            <Route
              path="/ind/pessoa/:id"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<div className="loading-page">Carregando...</div>}>
                    <PersonDetailView />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ind/indicador/:id"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<div className="loading-page">Carregando...</div>}>
                    <IndicatorDetailView />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ind/admin/setores"
              element={
                <ProtectedRoute>
                  {isPrivileged ? (
                    <Suspense fallback={<div className="loading-page">Carregando...</div>}>
                      <AdminSetores />
                    </Suspense>
                  ) : <Navigate to="/ind" replace />}
                </ProtectedRoute>
              }
            />
            <Route
              path="/ind/admin/cargos"
              element={
                <ProtectedRoute>
                  {isPrivileged ? (
                    <Suspense fallback={<div className="loading-page">Carregando...</div>}>
                      <AdminCargos />
                    </Suspense>
                  ) : <Navigate to="/ind" replace />}
                </ProtectedRoute>
              }
            />
            <Route
              path="/ind/admin/usuarios"
              element={
                <ProtectedRoute>
                  {isPrivileged ? (
                    <Suspense fallback={<div className="loading-page">Carregando...</div>}>
                      <AdminUsuarios />
                    </Suspense>
                  ) : <Navigate to="/ind" replace />}
                </ProtectedRoute>
              }
            />
          </Routes>
          {/* Oraculo - Assistente LMM (disponível em todas as páginas exceto Home) */}
          {showOracle && <OracleChat />}
          {/* Bug Report FAB - disponível em todas as páginas exceto Home/Login */}
          <BugReportFAB />
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
