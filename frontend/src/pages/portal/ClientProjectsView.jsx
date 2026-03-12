import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../api';
import { useClientAuth } from '../../contexts/ClientAuthContext';
import '../../styles/ClientPortal.css';

const statusColors = {
  'Planejamento': '#0369a1',
  'Fase 01': '#d97706',
  'Fase 02': '#d97706',
  'Fase 03': '#d97706',
  'Fase 04': '#d97706',
  'Finalizado': '#15803d',
  'Pausado': '#737373',
};

function ClientProjectsView() {
  const { clientUser, getClientToken } = useClientAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Change password modal state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    fetchProjects();
    // Check if must change password (first login)
    if (searchParams.get('changePassword') === 'true') {
      setShowChangePassword(true);
    }
  }, []);

  const fetchProjects = async () => {
    try {
      const token = getClientToken();
      const res = await axios.get(`${API_URL}/api/client/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setProjects(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

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
      const token = getClientToken();
      await axios.post(`${API_URL}/api/client/auth/update-password`, {
        newPassword,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowChangePassword(false);
      // Remove query param
      setSearchParams({});
    } catch (err) {
      setPasswordError(err.response?.data?.error || 'Erro ao atualizar senha');
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
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
      <div className="client-projects-grid">
        {projects.map(project => (
          <div
            key={project.projectCode}
            className="client-project-card"
            onClick={() => navigate(`/portal/projeto/${encodeURIComponent(project.projectCode)}`)}
          >
            <div className="client-project-card-header">
              <span
                className="client-project-status-badge"
                style={{ background: statusColors[project.status] || '#737373' }}
              >
                {project.status || 'N/A'}
              </span>
            </div>
            <h3 className="client-project-name">{project.nome || project.projectCode}</h3>
            <p className="client-project-company">{project.empresaCliente || ''}</p>
            {project.role && (
              <p className="client-project-role">{project.role}</p>
            )}
          </div>
        ))}
        {projects.length === 0 && (
          <div className="client-projects-empty">
            <p>Nenhum projeto vinculado ao seu acesso.</p>
            <p>Entre em contato com a equipe Otus para mais informações.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ClientProjectsView;
