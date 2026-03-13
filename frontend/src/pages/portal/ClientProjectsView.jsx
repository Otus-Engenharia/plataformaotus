import React, { useState } from 'react';
import { useNavigate, useSearchParams, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../api';
import { useClientAuth } from '../../contexts/ClientAuthContext';
import { isAtivoStatus, isFinalizedStatus, isPausedStatus, isAIniciarStatus } from '../../utils/portfolio-utils';
import '../../styles/ClientPortal.css';

const statusColors = {
  'planejamento': '#0369a1',
  'a iniciar': '#0369a1',
  'fase 01': '#d97706',
  'fase 02': '#d97706',
  'fase 03': '#d97706',
  'fase 04': '#d97706',
  'finalizado': '#15803d',
  'pausado': '#737373',
};

function ProjectCardCover({ project, token }) {
  const [imgError, setImgError] = useState(false);
  const hasCapa = !!project.capaUrl;

  const coverSrc = hasCapa && !imgError && token
    ? `${API_URL}/api/client/projects/${encodeURIComponent(project.projectCode)}/cover-image?token=${encodeURIComponent(token)}`
    : null;

  return (
    <div className="client-project-card-cover">
      {coverSrc ? (
        <img
          src={coverSrc}
          alt=""
          onError={() => setImgError(true)}
          loading="lazy"
        />
      ) : (
        <div className="client-project-card-cover-fallback">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="6" width="22" height="15" rx="2" />
            <path d="M3 21h18" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            <path d="M7 13h2v4H7z" />
            <path d="M11 11h2v6h-2z" />
            <path d="M15 14h2v3h-2z" />
          </svg>
        </div>
      )}
      <span
        className="client-project-status-badge"
        style={{ background: statusColors[(project.status || '').toLowerCase()] || '#737373' }}
      >
        {project.status || 'N/A'}
      </span>
    </div>
  );
}

function ClientProjectsView() {
  const { clientUser, getClientToken } = useClientAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { projects, projectsLoading } = useOutletContext();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [showAtivos, setShowAtivos] = useState(true);
  const [showFinalizados, setShowFinalizados] = useState(false);
  const [showPausados, setShowPausados] = useState(false);
  const [showAIniciar, setShowAIniciar] = useState(false);

  // Change password modal state
  const [showChangePassword, setShowChangePassword] = useState(
    () => searchParams.get('changePassword') === 'true'
  );
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const token = getClientToken();

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword.length < 6) {
      setPasswordError('Senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem');
      return;
    }

    setPasswordSaving(true);
    try {
      await axios.post(`${API_URL}/api/client/auth/update-password`, {
        newPassword,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowChangePassword(false);
      setSearchParams({});
    } catch (err) {
      setPasswordError(err.response?.data?.error || 'Erro ao atualizar senha');
    } finally {
      setPasswordSaving(false);
    }
  };

  // Filter logic
  const anyChipActive = showAtivos || showFinalizados || showPausados || showAIniciar;
  const filteredProjects = (projects || []).filter(p => {
    // Status filter
    if (anyChipActive) {
      const match =
        (showAtivos && isAtivoStatus(p.status)) ||
        (showFinalizados && isFinalizedStatus(p.status)) ||
        (showPausados && isPausedStatus(p.status)) ||
        (showAIniciar && isAIniciarStatus(p.status));
      if (!match) return false;
    }
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const nome = (p.nome || p.projectCode || '').toLowerCase();
      const empresa = (p.empresaCliente || '').toLowerCase();
      if (!nome.includes(term) && !empresa.includes(term)) return false;
    }
    return true;
  });

  // Count by category
  const countAtivos = (projects || []).filter(p => isAtivoStatus(p.status)).length;
  const countFinalizados = (projects || []).filter(p => isFinalizedStatus(p.status)).length;
  const countPausados = (projects || []).filter(p => isPausedStatus(p.status)).length;
  const countAIniciar = (projects || []).filter(p => isAIniciarStatus(p.status)).length;

  if (projectsLoading) {
    return (
      <div className="client-projects-loading">
        <div className="client-projects-spinner" />
        <p>Carregando projetos...</p>
      </div>
    );
  }

  return (
    <div className="client-projects">
      {/* Change Password Modal (first login) */}
      {showChangePassword && (
        <div className="client-change-password-overlay">
          <div className="client-change-password-modal">
            <h2>Altere sua senha</h2>
            <p>Por segurança, defina uma nova senha para acessar o portal.</p>
            {passwordError && (
              <p style={{ color: '#dc2626', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>{passwordError}</p>
            )}
            <form onSubmit={handleChangePassword}>
              <input
                type="password"
                placeholder="Nova senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <input
                type="password"
                placeholder="Confirmar nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <button type="submit" disabled={passwordSaving}>
                {passwordSaving ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="client-projects-header">
        <h1>Bem-vindo, {clientUser?.name?.split(' ')[0] || 'Cliente'}!</h1>
        <p>Selecione um projeto para acompanhar</p>
      </div>

      {/* Toolbar: search + filter chips */}
      <div className="client-projects-toolbar">
        <div className="client-projects-search-wrapper">
          <svg className="client-projects-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="client-projects-search"
            placeholder="Buscar projeto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="client-projects-chips">
          <button
            className={`client-project-chip${showAtivos ? ' active' : ''}`}
            onClick={() => setShowAtivos(!showAtivos)}
          >
            Ativos <span className="client-project-chip-count">{countAtivos}</span>
          </button>
          <button
            className={`client-project-chip${showAIniciar ? ' active' : ''}`}
            onClick={() => setShowAIniciar(!showAIniciar)}
          >
            A Iniciar <span className="client-project-chip-count">{countAIniciar}</span>
          </button>
          <button
            className={`client-project-chip${showFinalizados ? ' active' : ''}`}
            onClick={() => setShowFinalizados(!showFinalizados)}
          >
            Finalizados <span className="client-project-chip-count">{countFinalizados}</span>
          </button>
          <button
            className={`client-project-chip${showPausados ? ' active' : ''}`}
            onClick={() => setShowPausados(!showPausados)}
          >
            Pausados <span className="client-project-chip-count">{countPausados}</span>
          </button>
        </div>
        <span className="client-projects-result-count">
          {filteredProjects.length} projeto{filteredProjects.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="client-projects-grid">
        {filteredProjects.map(project => (
          <div
            key={project.projectCode}
            className="client-project-card"
            onClick={() => navigate(`/portal/projeto/${encodeURIComponent(project.projectCode)}/inicio`)}
          >
            <ProjectCardCover project={project} token={token} />
            <div className="client-project-card-body">
              <h3 className="client-project-name">{project.nome || project.projectCode}</h3>
              <p className="client-project-company">{project.empresaCliente || ''}</p>
              {project.role && (
                <p className="client-project-role">{project.role}</p>
              )}
            </div>
          </div>
        ))}
        {filteredProjects.length === 0 && (
          <div className="client-projects-empty">
            {projects.length === 0 ? (
              <>
                <p>Nenhum projeto vinculado ao seu acesso.</p>
                <p>Entre em contato com a equipe Otus para mais informações.</p>
              </>
            ) : (
              <p>Nenhum projeto encontrado com os filtros selecionados.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ClientProjectsView;
