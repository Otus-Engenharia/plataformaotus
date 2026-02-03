/**
 * Componente: AlocacaoTimesView
 *
 * Vista para gerenciar alocacao de times da Operacao.
 * Duas abas:
 * - Alocacao de Pessoas: Atribuir cargo e time aos colaboradores
 * - Gerenciar Times: CRUD de times
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/AlocacaoTimesView.css';

// === ICONS ===
const Icons = {
  Users: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Team: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  ),
  Plus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Edit: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Search: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Refresh: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

// === HELPERS ===
function getInitials(name) {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// === COMPONENTE PRINCIPAL ===
function AlocacaoTimesView() {
  const { hasFullAccess, isPrivileged } = useAuth();
  const [activeTab, setActiveTab] = useState('alocacao');

  // === STATE: ALOCACAO TAB ===
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // === STATE: GERENCIAR TIMES TAB ===
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [teamForm, setTeamForm] = useState({ team_number: '', team_name: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // === STATE: EDIT USER MODAL ===
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ team_id: '', position_id: '' });

  // === FETCH DATA ===
  const fetchUsers = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/ind/admin/users`, {
        withCredentials: true,
      });
      if (response.data?.success) {
        // Filtrar apenas usuarios do setor Operacao
        const allUsers = response.data.data || [];
        const operacaoUsers = allUsers.filter(u =>
          u.setor?.name?.toLowerCase().includes('opera')
        );
        setUsers(operacaoUsers);
      }
    } catch (err) {
      console.error('Erro ao buscar usuarios:', err);
    }
  }, []);

  const fetchTeams = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/operacao/teams`, {
        withCredentials: true,
      });
      if (response.data?.success) {
        setTeams(response.data.data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar times:', err);
    }
  }, []);

  const fetchPositions = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/ind/positions`, {
        withCredentials: true,
      });
      if (response.data?.success) {
        // Filtrar posicoes do setor Operacao
        const allPositions = response.data.data || [];
        const operacaoPositions = allPositions.filter(p =>
          p.sector?.name?.toLowerCase().includes('opera')
        );
        setPositions(operacaoPositions);
      }
    } catch (err) {
      console.error('Erro ao buscar cargos:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchUsers(), fetchTeams(), fetchPositions()]);
    setLoading(false);
  }, [fetchUsers, fetchTeams, fetchPositions]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // === FILTERED DATA ===
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const term = searchTerm.toLowerCase();
    return users.filter(u =>
      u.name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  // === TEAM CRUD HANDLERS ===
  const handleOpenTeamModal = (team = null) => {
    if (team) {
      setEditingTeam(team);
      setTeamForm({ team_number: team.team_number || '', team_name: team.team_name || '' });
    } else {
      setEditingTeam(null);
      setTeamForm({ team_number: '', team_name: '' });
    }
    setShowTeamModal(true);
  };

  const handleCloseTeamModal = () => {
    setShowTeamModal(false);
    setEditingTeam(null);
    setTeamForm({ team_number: '', team_name: '' });
  };

  const handleSaveTeam = async (e) => {
    e.preventDefault();
    if (!teamForm.team_name.trim()) {
      alert('Nome do time e obrigatorio');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingTeam) {
        await axios.put(
          `${API_URL}/api/operacao/teams/${editingTeam.id}`,
          teamForm,
          { withCredentials: true }
        );
      } else {
        await axios.post(
          `${API_URL}/api/operacao/teams`,
          teamForm,
          { withCredentials: true }
        );
      }
      handleCloseTeamModal();
      await fetchTeams();
    } catch (err) {
      alert('Erro ao salvar time: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTeam = async (team) => {
    const usersInTeam = users.filter(u => u.team?.id === team.id);
    if (usersInTeam.length > 0) {
      alert(`Nao e possivel excluir o time "${team.team_name}" pois existem ${usersInTeam.length} usuario(s) alocado(s).`);
      return;
    }

    if (!confirm(`Deseja realmente excluir o time "${team.team_name}"?`)) return;

    try {
      await axios.delete(`${API_URL}/api/operacao/teams/${team.id}`, {
        withCredentials: true,
      });
      await fetchTeams();
    } catch (err) {
      alert('Erro ao excluir time: ' + (err.response?.data?.error || err.message));
    }
  };

  // === USER ALLOCATION HANDLERS ===
  const handleOpenUserModal = (user) => {
    setEditingUser(user);
    setUserForm({
      team_id: user.team?.id || '',
      position_id: user.cargo?.id || '',
    });
    setShowUserModal(true);
  };

  const handleCloseUserModal = () => {
    setShowUserModal(false);
    setEditingUser(null);
    setUserForm({ team_id: '', position_id: '' });
  };

  const handleSaveUserAllocation = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSubmitting(true);
    try {
      // Update team
      await axios.put(
        `${API_URL}/api/operacao/users/${editingUser.id}/team`,
        { team_id: userForm.team_id || null },
        { withCredentials: true }
      );

      // Update position
      await axios.put(
        `${API_URL}/api/ind/admin/users/${editingUser.id}/position`,
        { position_id: userForm.position_id || null },
        { withCredentials: true }
      );

      handleCloseUserModal();
      await fetchUsers();
    } catch (err) {
      alert('Erro ao salvar alocacao: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  // === RENDER ===
  if (!isPrivileged) {
    return (
      <div className="alocacao-times-container">
        <div className="access-denied-card glass-card">
          <h3>Acesso Negado</h3>
          <p>Voce nao tem permissao para acessar esta pagina.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="alocacao-times-container">
        <div className="loading-state">Carregando dados...</div>
      </div>
    );
  }

  return (
    <div className="alocacao-times-container">
      {/* Header */}
      <div className="alocacao-times-header">
        <h2>Alocacao de Times</h2>
        <button onClick={refreshAll} className="btn-refresh">
          <Icons.Refresh />
          Atualizar
        </button>
      </div>

      {/* Stats Cards */}
      <section className="summary-section">
        <div className="summary-card">
          <div className="summary-icon">
            <Icons.Users />
          </div>
          <div className="summary-content">
            <span className="summary-value">{users.length}</span>
            <span className="summary-label">Colaboradores</span>
          </div>
        </div>
        <div className="summary-card highlight-blue">
          <div className="summary-icon">
            <Icons.Team />
          </div>
          <div className="summary-content">
            <span className="summary-value">{teams.length}</span>
            <span className="summary-label">Times</span>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="alocacao-tabs">
        <button
          className={`alocacao-tab ${activeTab === 'alocacao' ? 'active' : ''}`}
          onClick={() => setActiveTab('alocacao')}
        >
          <Icons.Users />
          Alocacao de Pessoas
          <span className="tab-count">{users.length}</span>
        </button>
        <button
          className={`alocacao-tab ${activeTab === 'times' ? 'active' : ''}`}
          onClick={() => setActiveTab('times')}
        >
          <Icons.Team />
          Gerenciar Times
          <span className="tab-count">{teams.length}</span>
        </button>
      </div>

      {/* Tab: Alocacao de Pessoas */}
      {activeTab === 'alocacao' && (
        <>
          {/* Search */}
          <div className="search-bar glass-card">
            <div className="search-wrapper">
              <span className="search-icon"><Icons.Search /></span>
              <input
                type="text"
                className="search-input"
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <span className="results-count">
              {filteredUsers.length} de {users.length} colaboradores
            </span>
          </div>

          {/* Table */}
          <div className="glass-card table-wrapper">
            <table className="alocacao-table">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Cargo</th>
                  <th>Time</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-state">
                      Nenhum colaborador encontrado
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const teamLabel = user.team
                      ? user.team.team_number
                        ? `${user.team.team_number} - ${user.team.team_name}`
                        : user.team.team_name
                      : '-';

                    return (
                      <tr key={user.id}>
                        <td>
                          <div className="user-cell">
                            <div className="user-avatar">{getInitials(user.name)}</div>
                            <div className="user-info">
                              <span className="user-name">{user.name || '-'}</span>
                              <span className="user-email">{user.email || '-'}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {user.cargo?.name ? (
                            <span className="badge badge-muted">{user.cargo.name}</span>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td>
                          {user.team ? (
                            <span className="badge badge-blue">{teamLabel}</span>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn-icon"
                            onClick={() => handleOpenUserModal(user)}
                            title="Editar alocacao"
                          >
                            <Icons.Edit />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Tab: Gerenciar Times */}
      {activeTab === 'times' && (
        <>
          {/* Add Team Button */}
          <div className="times-toolbar">
            <button className="btn-primary" onClick={() => handleOpenTeamModal()}>
              <Icons.Plus />
              Novo Time
            </button>
          </div>

          {/* Teams Table */}
          <div className="glass-card table-wrapper">
            <table className="alocacao-table">
              <thead>
                <tr>
                  <th>Numero</th>
                  <th>Nome do Time</th>
                  <th>Membros</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {teams.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-state">
                      Nenhum time cadastrado
                    </td>
                  </tr>
                ) : (
                  teams.map((team) => {
                    const membersCount = users.filter(u => u.team?.id === team.id).length;

                    return (
                      <tr key={team.id}>
                        <td>
                          <span className="team-number">{team.team_number || '-'}</span>
                        </td>
                        <td>
                          <span className="team-name">{team.team_name || '-'}</span>
                        </td>
                        <td>
                          <span className="badge badge-muted">{membersCount} membro(s)</span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="btn-icon"
                              onClick={() => handleOpenTeamModal(team)}
                              title="Editar time"
                            >
                              <Icons.Edit />
                            </button>
                            <button
                              className="btn-icon btn-danger"
                              onClick={() => handleDeleteTeam(team)}
                              title="Excluir time"
                            >
                              <Icons.Trash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal: Editar Time */}
      {showTeamModal && (
        <div className="modal-overlay" onClick={handleCloseTeamModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingTeam ? 'Editar Time' : 'Novo Time'}</h3>
              <button className="btn-close" onClick={handleCloseTeamModal}>
                <Icons.X />
              </button>
            </div>
            <form onSubmit={handleSaveTeam} className="modal-body">
              <div className="form-field">
                <label className="form-label">Numero do Time</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Ex: 5"
                  value={teamForm.team_number}
                  onChange={(e) => setTeamForm({ ...teamForm, team_number: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Nome do Time *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: Time Eliane"
                  value={teamForm.team_name}
                  onChange={(e) => setTeamForm({ ...teamForm, team_name: e.target.value })}
                  required
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={handleCloseTeamModal} disabled={isSubmitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn-save" disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Alocacao de Usuario */}
      {showUserModal && editingUser && (
        <div className="modal-overlay" onClick={handleCloseUserModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-user-info">
                <div className="user-avatar">{getInitials(editingUser.name)}</div>
                <div>
                  <h3>{editingUser.name}</h3>
                  <p>{editingUser.email}</p>
                </div>
              </div>
              <button className="btn-close" onClick={handleCloseUserModal}>
                <Icons.X />
              </button>
            </div>
            <form onSubmit={handleSaveUserAllocation} className="modal-body">
              <div className="form-field">
                <label className="form-label">Cargo</label>
                <select
                  className="form-select"
                  value={userForm.position_id}
                  onChange={(e) => setUserForm({ ...userForm, position_id: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Time</label>
                <select
                  className="form-select"
                  value={userForm.team_id}
                  onChange={(e) => setUserForm({ ...userForm, team_id: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.team_number ? `${t.team_number} - ${t.team_name}` : t.team_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={handleCloseUserModal} disabled={isSubmitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn-save" disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AlocacaoTimesView;
