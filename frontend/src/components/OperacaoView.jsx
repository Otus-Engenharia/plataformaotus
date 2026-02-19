/**
 * Componente: Vista de Operacao (Gerenciamento de Acessos)
 *
 * Interface moderna com:
 * - Cards de resumo (KPIs)
 * - Tabela simplificada com avatares e badges de nivel
 * - Gerenciamento de overrides de vistas por usuario
 * - Visual glass-card
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/OperacaoView.css';

// === CONSTANTES ===
const ACCESS_LABELS = {
  dev: 'Dev',
  ceo: 'CEO',
  director: 'Director',
  admin: 'Admin',
  leader: 'Líder',
  user: 'Usuário',
  sem_acesso: 'Sem acesso',
};

// === ICONS (SVG inline) ===
const Icons = {
  Users: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Settings: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  List: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  Refresh: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  Search: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
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
  Plus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
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

function getAccessLevelClass(level) {
  const map = {
    dev: 'level-dev',
    director: 'level-director',
    admin: 'level-admin',
    leader: 'level-leader',
    user: 'level-user',
    sem_acesso: 'level-sem_acesso',
  };
  return map[level] || 'level-user';
}

// === COMPONENTE PRINCIPAL ===
function OperacaoView() {
  const { isDev, hasFullAccess } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState('usuarios');

  // === USUARIOS TAB STATE ===
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [accessFilter, setAccessFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [userViews, setUserViews] = useState({});
  const [saving, setSaving] = useState(false);

  // === DADOS PARA EDICAO DE USUARIO ===
  const [sectors, setSectors] = useState([]);
  const [positions, setPositions] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  // === MODAL DE EDICAO DE USUARIO ===
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ sector_id: '', position_id: '', role: '', leader_id: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // === VIEWS CATALOG STATE ===
  const [availableViews, setAvailableViews] = useState([]);
  const [viewsLoading, setViewsLoading] = useState(false);


  // Modal state for editing user views
  const [showViewsModal, setShowViewsModal] = useState(false);
  const [editingUserEmail, setEditingUserEmail] = useState(null);
  const [editingUserName, setEditingUserName] = useState('');
  const [tempViews, setTempViews] = useState([]);

  // === MODAL DE CRIACAO DE USUARIO ===
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', email: '', sector_id: '', position_id: '', role: 'user', phone: ''
  });
  const [createErrors, setCreateErrors] = useState({});
  const [isCreating, setIsCreating] = useState(false);

  // === FETCH FUNCTIONS ===
  const fetchViews = async () => {
    try {
      setViewsLoading(true);
      const response = await axios.get(`${API_URL}/api/admin/views`, {
        withCredentials: true,
      });
      if (response.data?.success) {
        setAvailableViews(response.data.data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar vistas:', err);
    } finally {
      setViewsLoading(false);
    }
  };

  const fetchAccessData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/api/admin/colaboradores`, {
        withCredentials: true,
      });

      if (response.data?.success) {
        setData(Array.isArray(response.data.data) ? response.data.data : []);
      } else {
        setError('Erro ao carregar dados de acessos');
      }
    } catch (err) {
      console.error('Erro ao buscar acessos:', err);
      setError(err.response?.data?.error || err.message || 'Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserViews = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/user-views`, {
        withCredentials: true,
      });
      if (response.data?.success) {
        const viewsMap = {};
        (response.data.data || []).forEach((item) => {
          if (!viewsMap[item.email]) {
            viewsMap[item.email] = [];
          }
          viewsMap[item.email].push(item.view_id);
        });
        setUserViews(viewsMap);
      }
    } catch (err) {
      console.error('Erro ao buscar permissoes de vistas:', err);
    }
  };

  const fetchSectors = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/ind/sectors`, {
        withCredentials: true,
      });
      if (response.data?.success) {
        setSectors(response.data.data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar setores:', err);
    }
  };

  const fetchPositions = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/ind/positions`, {
        withCredentials: true,
      });
      if (response.data?.success) {
        setPositions(response.data.data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar cargos:', err);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/ind/admin/users`, {
        withCredentials: true,
      });
      if (response.data?.success) {
        setAllUsers(response.data.data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar usuarios:', err);
    }
  };

  const refreshAll = useCallback(() => {
    fetchViews();
    fetchAccessData();
    fetchUserViews();
    fetchSectors();
    fetchPositions();
    fetchAllUsers();
  }, []);

  useEffect(() => {
    fetchViews();
    fetchAccessData();
    fetchUserViews();
    fetchSectors();
    fetchPositions();
    fetchAllUsers();
  }, []);

  // === COMPUTED VALUES (memos) ===
  const uniqueSectors = useMemo(() => {
    const sectorSet = new Set();
    data.forEach((row) => {
      if (row.setor) sectorSet.add(row.setor);
    });
    return Array.from(sectorSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [data]);

  const uniqueAccessLevels = useMemo(() => {
    const levels = new Set();
    data.forEach((row) => {
      if (row.nivel_acesso) levels.add(row.nivel_acesso);
    });
    return Array.from(levels).sort();
  }, [data]);

  const potentialLeaders = useMemo(() => {
    return allUsers.filter(u => {
      const hasLeaderRole = u.role === 'leader' || u.role === 'admin' || u.role === 'director';
      const isLeadershipPosition = u.cargo?.is_leadership === true;
      return hasLeaderRole || isLeadershipPosition;
    });
  }, [allUsers]);

  const filteredData = useMemo(() => {
    let filtered = [...data];

    if (sectorFilter !== 'all') {
      filtered = filtered.filter((row) => row.setor === sectorFilter);
    }

    if (accessFilter !== 'all') {
      filtered = filtered.filter((row) => row.nivel_acesso === accessFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((row) => {
        return [row.colaborador, row.email, row.setor, row.nivel_acesso]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      });
    }

    return filtered;
  }, [data, sectorFilter, accessFilter, searchTerm]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const total = data.length;
    const withAccess = data.filter(
      (r) => r.nivel_acesso && r.nivel_acesso !== 'sem_acesso'
    ).length;
    const withOverrides = Object.keys(userViews).filter(
      (email) => userViews[email]?.length > 0
    ).length;

    return { total, withAccess, withOverrides };
  }, [data, userViews]);

  // === USER VIEWS FUNCTIONS ===
  const handleOpenViewsModal = (email, name) => {
    setEditingUserEmail(email);
    setEditingUserName(name || email);
    setTempViews(userViews[email] || []);
    setShowViewsModal(true);
  };

  const handleToggleView = (viewId) => {
    setTempViews((prev) =>
      prev.includes(viewId) ? prev.filter((id) => id !== viewId) : [...prev, viewId]
    );
  };

  const handleSaveViews = async () => {
    try {
      setSaving(true);
      const response = await axios.put(
        `${API_URL}/api/admin/user-views`,
        { email: editingUserEmail, views: tempViews },
        { withCredentials: true }
      );

      if (response.data?.success) {
        setShowViewsModal(false);
        setEditingUserEmail(null);
        await fetchUserViews();
      } else {
        alert('Erro ao salvar: ' + (response.data.error || 'Erro desconhecido'));
      }
    } catch (err) {
      console.error('Erro ao salvar permissoes:', err);
      alert('Erro ao salvar: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleCloseViewsModal = () => {
    setShowViewsModal(false);
    setEditingUserEmail(null);
    setTempViews([]);
  };

  // === FUNCOES DE CRIACAO DE USUARIO ===
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!createForm.name.trim()) errors.name = 'Nome obrigatorio';
    if (!createForm.email.trim()) errors.email = 'Email obrigatorio';
    else if (!createForm.email.endsWith('@otusengenharia.com'))
      errors.email = 'Email deve ser @otusengenharia.com';

    if (Object.keys(errors).length) {
      setCreateErrors(errors);
      return;
    }

    setIsCreating(true);
    try {
      await axios.post(
        `${API_URL}/api/ind/admin/users`,
        {
          name: createForm.name.trim(),
          email: createForm.email.toLowerCase().trim(),
          role: createForm.role,
          setor_id: createForm.sector_id || null,
          position_id: createForm.position_id || null,
          phone: createForm.phone || null,
        },
        { withCredentials: true }
      );
      setShowCreateModal(false);
      setCreateForm({ name: '', email: '', sector_id: '', position_id: '', role: 'user', phone: '' });
      setCreateErrors({});
      await fetchAccessData();
      await fetchAllUsers();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      if (errorMsg.includes('ja cadastrado')) {
        setCreateErrors({ email: 'Email ja cadastrado' });
      } else {
        alert('Erro ao criar colaborador: ' + errorMsg);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setCreateForm({ name: '', email: '', sector_id: '', position_id: '', role: 'user', phone: '' });
    setCreateErrors({});
  };

  // Clear filters
  const clearFilters = () => {
    setSearchTerm('');
    setSectorFilter('all');
    setAccessFilter('all');
  };

  const hasActiveFilters = searchTerm || sectorFilter !== 'all' || accessFilter !== 'all';

  // === FUNCOES DE EDICAO DE USUARIO ===
  const handleOpenEditUserModal = (row) => {
    const user = allUsers.find(u => u.email === row.email);
    if (!user) {
      alert('Usuario nao encontrado para edicao. Tente atualizar a pagina.');
      return;
    }

    setEditingUser(user);
    setEditForm({
      sector_id: user.setor?.id || '',
      position_id: user.cargo?.id || '',
      role: user.role || 'user',
      leader_id: user.leader?.id || ''
    });
    setShowEditUserModal(true);
  };

  const handleEditUserSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSubmitting(true);
    try {
      await axios.put(
        `${API_URL}/api/ind/admin/users/${editingUser.id}/sector`,
        { sector_id: editForm.sector_id || null },
        { withCredentials: true }
      );

      await axios.put(
        `${API_URL}/api/ind/admin/users/${editingUser.id}/position`,
        { position_id: editForm.position_id || null },
        { withCredentials: true }
      );

      await axios.put(
        `${API_URL}/api/ind/admin/users/${editingUser.id}/role`,
        { role: editForm.role },
        { withCredentials: true }
      );

      await axios.put(
        `${API_URL}/api/ind/admin/users/${editingUser.id}/leader`,
        { leader_id: editForm.leader_id || null },
        { withCredentials: true }
      );

      setShowEditUserModal(false);
      setEditingUser(null);

      await fetchAccessData();
      await fetchAllUsers();
    } catch (err) {
      alert('Erro ao atualizar usuario: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to get view name by id
  const getViewName = useCallback(
    (viewId) => {
      const view = availableViews.find((v) => v.id === viewId);
      return view?.name || viewId;
    },
    [availableViews]
  );

  // === RENDER ===
  if (loading && activeTab === 'usuarios') {
    return (
      <div className="operacao-container">
        <div className="loading-state">Carregando dados...</div>
      </div>
    );
  }

  if (error && activeTab === 'usuarios') {
    return (
      <div className="operacao-container">
        <div className="glass-card error-state">
          <h3>Erro ao carregar dados</h3>
          <p>{error}</p>
          <button onClick={fetchAccessData} className="btn-refresh">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="operacao-container">
      {/* Header */}
      <div className="operacao-header">
        <h2>Gerenciamento de Acessos</h2>
        <div className="header-actions">
          {hasFullAccess && (
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              <Icons.Plus />
              Adicionar Colaborador
            </button>
          )}
          <button onClick={refreshAll} className="btn-refresh">
            <Icons.Refresh />
            Atualizar
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <section className="summary-section">
        <div className="summary-card">
          <div className="summary-icon">
            <Icons.Users />
          </div>
          <div className="summary-content">
            <span className="summary-value">{summaryStats.total}</span>
            <span className="summary-label">Colaboradores</span>
          </div>
        </div>

        <div className="summary-card highlight-green">
          <div className="summary-icon">
            <Icons.Check />
          </div>
          <div className="summary-content">
            <span className="summary-value">{summaryStats.withAccess}</span>
            <span className="summary-label">Com Acesso</span>
          </div>
        </div>

        <div className="summary-card highlight-yellow">
          <div className="summary-icon">
            <Icons.Settings />
          </div>
          <div className="summary-content">
            <span className="summary-value">{summaryStats.withOverrides}</span>
            <span className="summary-label">Com Customizacoes</span>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="operacao-tabs">
        <button
          className={`operacao-tab ${activeTab === 'usuarios' ? 'active' : ''}`}
          onClick={() => setActiveTab('usuarios')}
        >
          Usuarios
          <span className="tab-count">{data.length}</span>
        </button>
        {isDev && (
          <button
            className={`operacao-tab ${activeTab === 'vistas' ? 'active' : ''}`}
            onClick={() => setActiveTab('vistas')}
          >
            Catalogo de Vistas
            <span className="tab-count">{availableViews.length}</span>
          </button>
        )}
      </div>

      {/* Tab: Usuarios */}
      {activeTab === 'usuarios' && (
        <>
          {/* Filters */}
          <div className="operacao-filters glass-card">
            <div className="filters-row">
              <div className="filter-group">
                <label className="filter-label">Setor</label>
                <select
                  className="filter-select"
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                >
                  <option value="all">Todos os setores</option>
                  {uniqueSectors.map((setor) => (
                    <option key={setor} value={setor}>
                      {setor}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Nivel de Acesso</label>
                <select
                  className="filter-select"
                  value={accessFilter}
                  onChange={(e) => setAccessFilter(e.target.value)}
                >
                  <option value="all">Todos os niveis</option>
                  {uniqueAccessLevels.map((level) => (
                    <option key={level} value={level}>
                      {ACCESS_LABELS[level] || level}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Buscar</label>
                <div className="search-wrapper">
                  <span className="search-icon"><Icons.Search /></span>
                  <input
                    type="text"
                    className="filter-input"
                    placeholder="Nome, email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="filters-footer">
              <span className="results-count">
                Mostrando <strong>{filteredData.length}</strong> de{' '}
                <strong>{data.length}</strong> colaboradores
              </span>
              {hasActiveFilters && (
                <button className="btn-clear-filters" onClick={clearFilters}>
                  Limpar filtros
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="glass-card operacao-table-wrapper">
            <table className="operacao-table">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Setor</th>
                  <th>Nivel de Acesso</th>
                  <th>Permissoes de Vistas</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      Nenhum colaborador encontrado
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row) => {
                    const accessLabel = ACCESS_LABELS[row.nivel_acesso] || row.nivel_acesso || '-';
                    const levelClass = getAccessLevelClass(row.nivel_acesso);
                    const userViewsList = userViews[row.email] || [];
                    const viewsCount = userViewsList.length;

                    return (
                      <tr key={row.colaborador_id || row.email}>
                        {/* Colaborador (avatar + nome + email) */}
                        <td>
                          <div className="user-cell">
                            <div className="user-avatar">{getInitials(row.colaborador)}</div>
                            <div className="user-info">
                              <span className="user-name">{row.colaborador || '-'}</span>
                              <span className="user-email">{row.email || '-'}</span>
                            </div>
                          </div>
                        </td>

                        {/* Setor */}
                        <td>
                          {row.setor ? (
                            <span className="badge badge-muted">{row.setor}</span>
                          ) : (
                            '-'
                          )}
                        </td>

                        {/* Nivel de Acesso */}
                        <td>
                          <span className={`access-badge ${levelClass}`}>
                            <span className="access-dot"></span>
                            {accessLabel}
                          </span>
                        </td>

                        {/* Permissoes de Vistas */}
                        <td>
                          <div className="views-preview">
                            {viewsCount > 0 ? (
                              <>
                                <span className="views-status custom">
                                  {viewsCount} customizacao(es)
                                </span>
                                <div className="views-tags">
                                  {userViewsList.slice(0, 3).map((viewId) => (
                                    <span key={viewId} className="view-tag">
                                      {getViewName(viewId)}
                                    </span>
                                  ))}
                                  {userViewsList.length > 3 && (
                                    <span className="view-tag more">
                                      +{userViewsList.length - 3}
                                    </span>
                                  )}
                                </div>
                              </>
                            ) : (
                              <span className="views-status default">Usando padrao</span>
                            )}
                          </div>
                        </td>

                        {/* Acoes */}
                        <td>
                          <div className="action-buttons">
                            <button
                              className="btn-icon"
                              onClick={() => handleOpenEditUserModal(row)}
                              title="Editar dados do usuario"
                            >
                              <Icons.Settings />
                            </button>
                            <button
                              className="btn-icon"
                              onClick={() => handleOpenViewsModal(row.email, row.colaborador)}
                              title="Editar permissoes de vistas"
                            >
                              <Icons.Edit />
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

      {/* Tab: Catalogo de Vistas (Dev only) */}
      {activeTab === 'vistas' && isDev && (
        <section className="vistas-section">
          <p className="vistas-info">
            Catalogo de todas as vistas disponiveis na plataforma. Apenas desenvolvedores podem
            modificar este catalogo.
          </p>

          {viewsLoading ? (
            <div className="loading-state">Carregando vistas...</div>
          ) : (
            <div className="glass-card operacao-table-wrapper">
              <table className="operacao-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nome</th>
                    <th>Area</th>
                    <th>Rota</th>
                    <th>Ordem</th>
                  </tr>
                </thead>
                <tbody>
                  {availableViews.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty-state">
                        Nenhuma vista cadastrada
                      </td>
                    </tr>
                  ) : (
                    availableViews.map((view) => (
                      <tr key={view.id}>
                        <td>
                          <code>{view.id}</code>
                        </td>
                        <td>{view.name}</td>
                        <td>{view.area}</td>
                        <td>
                          <code>{view.route}</code>
                        </td>
                        <td>{view.sort_order}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Modal: Editar Vistas do Usuario */}
      {showViewsModal && (
        <div className="modal-overlay">
          <div
            className="modal-content views-editor-modal"
          >
            <div className="modal-header">
              <h3>Editar Permissoes</h3>
              <p>{editingUserName}</p>
            </div>

            <div className="modal-body">
              <div className="views-checklist">
                {availableViews.map((view) => (
                  <label key={view.id} className="view-checkbox">
                    <input
                      type="checkbox"
                      checked={tempViews.includes(view.id)}
                      onChange={() => handleToggleView(view.id)}
                    />
                    <div className="view-checkbox-label">
                      <span className="view-checkbox-name">{view.name}</span>
                      <span className="view-checkbox-route">{view.route}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleCloseViewsModal} disabled={saving}>
                Cancelar
              </button>
              <button className="btn-save" onClick={handleSaveViews} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Dados do Usuario */}
      {showEditUserModal && editingUser && (
        <div className="modal-overlay">
          <div className="modal-content user-edit-modal">
            <div className="modal-header">
              <div className="modal-user-info">
                <div className="user-avatar modal-avatar">{getInitials(editingUser.name)}</div>
                <div>
                  <h3>{editingUser.name}</h3>
                  <p>{editingUser.email}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleEditUserSubmit} className="modal-body">
              {/* Papel de Acesso */}
              <div className="form-field">
                <label className="form-label">Papel de Acesso</label>
                <div className="role-selector">
                  {[
                    ...(isDev ? [
                      { value: 'dev', label: 'Dev', desc: 'Desenvolvimento + acesso total' },
                      { value: 'ceo', label: 'CEO', desc: 'Diretoria executiva' },
                    ] : []),
                    { value: 'director', label: 'Director', desc: 'Acesso total (diretoria)' },
                    { value: 'admin', label: 'Admin', desc: 'Acesso total' },
                    { value: 'leader', label: 'Líder', desc: 'Gerencia equipe' },
                    { value: 'user', label: 'Usuário', desc: 'Acesso básico' },
                  ].map(opt => (
                    <label
                      key={opt.value}
                      className={`role-option ${editForm.role === opt.value ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={opt.value}
                        checked={editForm.role === opt.value}
                        onChange={e => setEditForm({...editForm, role: e.target.value})}
                      />
                      <span className={`role-indicator role-${opt.value}`}></span>
                      <div>
                        <span className="role-label">{opt.label}</span>
                        <span className="role-desc">{opt.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Setor e Cargo */}
              <div className="form-row">
                <div className="form-field">
                  <label className="form-label">Setor</label>
                  <select
                    className="form-select"
                    value={editForm.sector_id}
                    onChange={e => setEditForm({...editForm, sector_id: e.target.value})}
                  >
                    <option value="">Selecione...</option>
                    {sectors.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Cargo</label>
                  <select
                    className="form-select"
                    value={editForm.position_id}
                    onChange={e => setEditForm({...editForm, position_id: e.target.value})}
                  >
                    <option value="">Selecione...</option>
                    {positions.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Lider */}
              <div className="form-field">
                <label className="form-label">Lider</label>
                <select
                  className="form-select"
                  value={editForm.leader_id}
                  onChange={e => setEditForm({...editForm, leader_id: e.target.value})}
                >
                  <option value="">Sem lider</option>
                  {potentialLeaders
                    .filter(l => l.id !== editingUser?.id)
                    .map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))
                  }
                </select>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowEditUserModal(false)}
                  disabled={isSubmitting}
                >
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

      {/* Modal: Criar Novo Usuario */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content user-create-modal">
            <div className="modal-header">
              <h3>Adicionar Colaborador</h3>
              <p className="modal-subtitle">Preencha os dados do novo colaborador</p>
            </div>

            <form onSubmit={handleCreateSubmit} className="modal-body">
              {/* Nome */}
              <div className="form-field">
                <label className="form-label required">Nome</label>
                <input
                  type="text"
                  className={`form-input ${createErrors.name ? 'error' : ''}`}
                  placeholder="Nome completo"
                  value={createForm.name}
                  onChange={e => setCreateForm({...createForm, name: e.target.value})}
                />
                {createErrors.name && (
                  <span className="form-error">{createErrors.name}</span>
                )}
              </div>

              {/* Email */}
              <div className="form-field">
                <label className="form-label required">Email</label>
                <input
                  type="email"
                  className={`form-input ${createErrors.email ? 'error' : ''}`}
                  placeholder="email@otusengenharia.com"
                  value={createForm.email}
                  onChange={e => setCreateForm({...createForm, email: e.target.value})}
                />
                {createErrors.email && (
                  <span className="form-error">{createErrors.email}</span>
                )}
              </div>

              {/* Setor e Cargo */}
              <div className="form-row">
                <div className="form-field">
                  <label className="form-label">Setor</label>
                  <select
                    className="form-select"
                    value={createForm.sector_id}
                    onChange={e => setCreateForm({...createForm, sector_id: e.target.value})}
                  >
                    <option value="">Selecione...</option>
                    {sectors.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Cargo</label>
                  <select
                    className="form-select"
                    value={createForm.position_id}
                    onChange={e => setCreateForm({...createForm, position_id: e.target.value})}
                  >
                    <option value="">Selecione...</option>
                    {positions.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Papel de Acesso */}
              <div className="form-field">
                <label className="form-label">Nivel de Acesso</label>
                <div className="role-selector">
                  {[
                    ...(isDev ? [
                      { value: 'dev', label: 'Dev', desc: 'Desenvolvimento + acesso total' },
                      { value: 'ceo', label: 'CEO', desc: 'Diretoria executiva' },
                    ] : []),
                    { value: 'director', label: 'Director', desc: 'Acesso total (diretoria)' },
                    { value: 'admin', label: 'Admin', desc: 'Acesso total' },
                    { value: 'leader', label: 'Líder', desc: 'Gerencia equipe' },
                    { value: 'user', label: 'Usuário', desc: 'Acesso básico' },
                  ].map(opt => (
                    <label
                      key={opt.value}
                      className={`role-option ${createForm.role === opt.value ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="create-role"
                        value={opt.value}
                        checked={createForm.role === opt.value}
                        onChange={e => setCreateForm({...createForm, role: e.target.value})}
                      />
                      <span className={`role-indicator role-${opt.value}`}></span>
                      <div>
                        <span className="role-label">{opt.label}</span>
                        <span className="role-desc">{opt.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Telefone */}
              <div className="form-field">
                <label className="form-label">Telefone</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="(00) 00000-0000"
                  value={createForm.phone}
                  onChange={e => setCreateForm({...createForm, phone: e.target.value})}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={handleCloseCreateModal}
                  disabled={isCreating}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-save" disabled={isCreating}>
                  {isCreating ? 'Criando...' : 'Criar Colaborador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default OperacaoView;
