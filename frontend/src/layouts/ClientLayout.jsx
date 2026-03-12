import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../api';
import { useClientAuth } from '../contexts/ClientAuthContext';
import '../styles/ClientPortal.css';
import '../styles/VistaClienteView.css';

function getHealthLevel(idp) {
  if (idp == null) return 'warning';
  if (idp >= 1.0) return 'good';
  if (idp >= 0.8) return 'warning';
  return 'danger';
}

const NAV_ITEMS = [
  { path: 'inicio', label: 'Início', icon: '📊' },
  { path: 'apontamentos', label: 'Apontamentos', icon: '📋' },
  { path: 'pendencias', label: 'Pendências', icon: '⚠️' },
  { path: 'marcos', label: 'Marcos', icon: '🎯' },
  { path: 'relatos', label: 'Relatos', icon: '📝' },
  { path: 'alteracoes', label: 'Alterações', icon: '🔄' },
  { path: 'feedbacks-nps', label: 'Feedbacks NPS', icon: '⭐' },
];

function extractProjectCode(pathname) {
  const match = pathname.match(/^\/portal\/projeto\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function ClientLayout() {
  const { clientUser, clientLogout, getClientToken } = useClientAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const projectCode = useMemo(() => extractProjectCode(location.pathname), [location.pathname]);
  const [collapsed, setCollapsed] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectDetails, setProjectDetails] = useState({});
  const [projectIdp, setProjectIdp] = useState(null);

  const fetchProjects = useCallback(async () => {
    try {
      const token = getClientToken();
      const res = await axios.get(`${API_URL}/api/client/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) setProjects(res.data.data);
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setProjectsLoading(false);
    }
  }, [getClientToken]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // Fetch project features (smartsheetId, construflowId) when project changes
  useEffect(() => {
    if (!projectCode || projectDetails[projectCode]) return;
    const token = getClientToken();
    axios.get(`${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/details`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => {
      if (res.data.success) {
        setProjectDetails(prev => ({ ...prev, [projectCode]: res.data.data }));
      }
    }).catch(err => {
      console.error('Error fetching project details:', err);
    });
  }, [projectCode, getClientToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentProject = useMemo(() => {
    const base = projects.find(p => p.projectCode === projectCode) || null;
    if (!base) return null;
    const details = projectDetails[projectCode];
    return details ? { ...base, ...details } : base;
  }, [projects, projectCode, projectDetails]);

  const handleLogout = () => {
    clientLogout();
    navigate('/login');
  };

  const handleProjectChange = (e) => {
    const code = e.target.value;
    if (code) {
      navigate(`/portal/projeto/${encodeURIComponent(code)}/inicio`);
    } else {
      navigate('/portal');
    }
  };

  const isProjectView = !!projectCode;

  return (
    <div className="cp-shell">
      {/* Sidebar */}
      <aside className={`cp-sidebar ${collapsed ? 'cp-sidebar-collapsed' : ''}`}>
        {/* Logo */}
        <div className="cp-sidebar-header">
          <img src="/Otus-logo-300x300.png" alt="Otus" className="cp-sidebar-logo" />
          {!collapsed && <span className="cp-sidebar-brand">Portal do Cliente</span>}
          <button
            className="cp-sidebar-toggle"
            onClick={() => setCollapsed(v => !v)}
            title={collapsed ? 'Expandir' : 'Recolher'}
          >
            {collapsed ? '▶' : '◀'}
          </button>
        </div>

        {/* Navigation */}
        {isProjectView && (
          <nav className="cp-sidebar-nav">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.path}
                to={`/portal/projeto/${encodeURIComponent(projectCode)}/${item.path}`}
                className={({ isActive }) =>
                  `cp-nav-link ${isActive ? 'cp-nav-link-active' : ''}`
                }
              >
                <span className="cp-nav-icon">{item.icon}</span>
                {!collapsed && <span className="cp-nav-text">{item.label}</span>}
              </NavLink>
            ))}
          </nav>
        )}

        {/* Back to projects */}
        {isProjectView && (
          <button
            className="cp-nav-link cp-back-link"
            onClick={() => navigate('/portal')}
          >
            <span className="cp-nav-icon">←</span>
            {!collapsed && <span className="cp-nav-text">Todos os Projetos</span>}
          </button>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* User footer */}
        <div className="cp-sidebar-footer">
          {!collapsed && (
            <div className="cp-sidebar-user-info">
              <span className="cp-sidebar-user-name">
                {clientUser?.name || clientUser?.email}
              </span>
              <span className="cp-sidebar-user-role">Cliente</span>
            </div>
          )}
          <button className="cp-logout-btn" onClick={handleLogout} title="Sair">
            {collapsed ? '⏻' : 'Sair'}
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="cp-main-area">
        {/* Top bar */}
        {isProjectView && (
          <header className="cp-topbar">
            <div className="cp-topbar-left">
              <h1 className="cp-topbar-title">Vista do Cliente</h1>
              {currentProject && (
                <>
                  <span className={`vc-health-dot ${getHealthLevel(projectIdp)}`} />
                  <span className="cp-topbar-project-name">
                    {currentProject.nome || currentProject.projectCode}
                  </span>
                </>
              )}
            </div>
            <div className="cp-topbar-right">
              <select
                className="cp-topbar-select"
                value={projectCode || ''}
                onChange={handleProjectChange}
              >
                <option value="">Selecione um projeto</option>
                {projects.map(p => (
                  <option key={p.projectCode} value={p.projectCode}>
                    {p.nome || p.projectCode}
                  </option>
                ))}
              </select>
            </div>
          </header>
        )}

        {/* Content */}
        <main className={`cp-content ${isProjectView ? 'cp-content-with-topbar' : ''}`}>
          <Outlet context={{ projects, currentProject, projectsLoading, setProjectIdp }} />
        </main>
      </div>
    </div>
  );
}

export default ClientLayout;
