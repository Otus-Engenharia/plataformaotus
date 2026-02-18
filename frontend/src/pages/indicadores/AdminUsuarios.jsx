import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import SearchableDropdown from '../../components/SearchableDropdown';
import './AdminPages.css';

const API_URL = import.meta.env.VITE_API_URL || '';

// Hierarquia de papéis (maior para menor privilégio)
const ROLE_HIERARCHY = [
  { value: 'dev', label: 'Dev', desc: 'Desenvolvimento + acesso total' },
  { value: 'ceo', label: 'CEO', desc: 'Diretoria executiva' },
  { value: 'director', label: 'Director', desc: 'Acesso total (diretoria)' },
  { value: 'admin', label: 'Admin', desc: 'Acesso total' },
  { value: 'leader', label: 'Líder', desc: 'Gerencia equipe' },
  { value: 'user', label: 'Usuário', desc: 'Visualiza indicadores' },
];

function getVisibleRoles(currentRole) {
  const idx = ROLE_HIERARCHY.findIndex(r => r.value === currentRole);
  if (idx === -1) return ROLE_HIERARCHY.filter(r => r.value === 'user');
  return ROLE_HIERARCHY.slice(idx);
}

export default function AdminUsuarios() {
  const { isPrivileged, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showLegend, setShowLegend] = useState(false);

  // Filter states
  const [filterRole, setFilterRole] = useState('');
  const [filterSetor, setFilterSetor] = useState('');
  const [filterLider, setFilterLider] = useState('');
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ sector_id: '', position_id: '', role: '', leader_id: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, sectorsRes, positionsRes] = await Promise.all([
        fetch(`${API_URL}/api/ind/admin/users`, { credentials: 'include' }),
        fetch(`${API_URL}/api/ind/sectors`, { credentials: 'include' }),
        fetch(`${API_URL}/api/ind/positions`, { credentials: 'include' })
      ]);

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.data || []);
      }
      if (sectorsRes.ok) {
        const data = await sectorsRes.json();
        setSectors(data.data || []);
      }
      if (positionsRes.ok) {
        const data = await positionsRes.json();
        setPositions(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Stats
  const adminsCount = users.filter(u => u.role === 'admin' || u.role === 'director').length;
  const leadersCount = users.filter(u => u.role === 'leader').length;
  const activeCount = users.filter(u => u.is_active !== false).length;

  // Unique setors for filter dropdown (always show all)
  const uniqueSetors = [...new Set(users.map(u => u.setor?.name).filter(Boolean))].sort();

  // Liders filtered by selected setor (cascading filter)
  const uniqueLiders = [...new Set(
    users
      .filter(u => !filterSetor || u.setor?.name === filterSetor)
      .map(u => u.leader?.name)
      .filter(Boolean)
  )].sort();

  // Filtered users
  const filteredUsers = users.filter(user => {
    // Text search filter
    const matchesSearch = !filter ||
      user.name?.toLowerCase().includes(filter.toLowerCase()) ||
      user.email?.toLowerCase().includes(filter.toLowerCase());

    // Role filter
    const matchesRole = !filterRole || user.role === filterRole;

    // Setor filter
    const matchesSetor = !filterSetor || user.setor?.name === filterSetor;

    // Lider filter
    const matchesLider = !filterLider || user.leader?.name === filterLider;

    // Active status filter
    const isActive = user.is_active !== false;
    const matchesActive = !showOnlyActive || isActive;

    return matchesSearch && matchesRole && matchesSetor && matchesLider && matchesActive;
  });

  // Check if any filter is active
  const hasActiveFilters = filterRole || filterSetor || filterLider || !showOnlyActive;

  // Clear all filters
  const clearAllFilters = () => {
    setFilter('');
    setFilterRole('');
    setFilterSetor('');
    setFilterLider('');
    setShowOnlyActive(true);
  };

  // Update sector
  const handleUpdateSector = async (userId, sectorId) => {
    try {
      const res = await fetch(`${API_URL}/api/ind/admin/users/${userId}/sector`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sector_id: sectorId || null })
      });
      if (!res.ok) throw new Error('Erro ao atualizar setor');
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Get potential leaders (users with role leader/admin or leadership position)
  const potentialLeaders = users.filter(u => {
    const hasLeaderRole = u.role === 'leader' || u.role === 'admin';
    const isLeadershipPosition = u.cargo?.is_leadership === true || u.cargo?.is_leadership === 'true';
    return hasLeaderRole || isLeadershipPosition;
  });

  // Update position
  const handleUpdatePosition = async (userId, positionId) => {
    try {
      const res = await fetch(`${API_URL}/api/ind/admin/users/${userId}/position`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ position_id: positionId || null })
      });
      if (!res.ok) throw new Error('Erro ao atualizar cargo');
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Update role
  const handleUpdateRole = async (userId, role) => {
    try {
      const res = await fetch(`${API_URL}/api/ind/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role })
      });
      if (!res.ok) throw new Error('Erro ao atualizar papel');
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Update leader
  const handleUpdateLeader = async (userId, leaderId) => {
    try {
      const res = await fetch(`${API_URL}/api/ind/admin/users/${userId}/leader`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ leader_id: leaderId || null })
      });
      if (!res.ok) throw new Error('Erro ao atualizar líder');
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Toggle user active status - optimistic update
  const handleToggleUserStatus = async (e, user) => {
    // Prevent any event propagation or default behavior
    e.preventDefault();
    e.stopPropagation();

    const newStatus = user.is_active === false ? true : false;
    const previousStatus = user.is_active;

    // Optimistic update - update UI immediately
    setUsers(prevUsers =>
      prevUsers.map(u =>
        u.id === user.id ? { ...u, is_active: newStatus } : u
      )
    );

    try {
      const res = await fetch(`${API_URL}/api/ind/admin/users/${user.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: newStatus })
      });

      if (!res.ok) {
        throw new Error('Erro ao atualizar status');
      }
      // Success - UI already updated
    } catch (err) {
      // Revert on error
      setUsers(prevUsers =>
        prevUsers.map(u =>
          u.id === user.id ? { ...u, is_active: previousStatus } : u
        )
      );
      alert(err.message);
    }
  };

  // Open edit modal
  const openEditModal = (user) => {
    setEditingUser(user);
    setEditForm({
      sector_id: user.setor?.id || '',
      position_id: user.cargo?.id || '',
      role: user.role || 'user',
      leader_id: user.leader?.id || ''
    });
    setShowEditModal(true);
  };

  // Handle edit submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSubmitting(true);
    try {
      await fetch(`${API_URL}/api/ind/admin/users/${editingUser.id}/sector`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sector_id: editForm.sector_id || null })
      });

      await fetch(`${API_URL}/api/ind/admin/users/${editingUser.id}/position`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ position_id: editForm.position_id || null })
      });

      await fetch(`${API_URL}/api/ind/admin/users/${editingUser.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: editForm.role })
      });

      await fetch(`${API_URL}/api/ind/admin/users/${editingUser.id}/leader`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ leader_id: editForm.leader_id || null })
      });

      setShowEditModal(false);
      setEditingUser(null);
      fetchData();
    } catch (err) {
      alert('Erro ao atualizar usuário');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  const getAvatarClass = (role) => {
    if (role === 'admin' || role === 'director') return 'avatar-role-admin';
    if (role === 'leader') return 'avatar-role-leader';
    return '';
  };

  if (!isPrivileged) {
    return (
      <div className="admin-page">
        <div className="access-denied-card glass-card">
          <svg viewBox="0 0 24 24" width="48" height="48" className="access-denied-icon">
            <path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
          </svg>
          <h3>Acesso Negado</h3>
          <p>Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="admin-page loading-state">
        <div className="loading-spinner"></div>
        <p>Carregando usuários...</p>
      </div>
    );
  }

  return (
    <div className="admin-page admin-usuarios-v2">
      {/* Header with inline stats */}
      <header className="usuarios-header-v2">
        <div className="usuarios-header-content">
          <div className="usuarios-title-area">
            <h1>Equipe</h1>
            <span className="usuarios-count-badge">{users.length}</span>
          </div>
          <div className="usuarios-stats-pills">
            <div className="stat-pill pill-admin">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"/>
              </svg>
              <span>{adminsCount}</span>
              <span className="pill-label">Admin</span>
            </div>
            <div className="stat-pill pill-leader">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
              </svg>
              <span>{leadersCount}</span>
              <span className="pill-label">Líderes</span>
            </div>
            <div className="stat-pill pill-active">
              <span className="dot-active"></span>
              <span>{activeCount}</span>
              <span className="pill-label">Ativos</span>
            </div>
          </div>
        </div>
      </header>

      {/* Collapsible Legend */}
      <button
        type="button"
        className={`legend-toggle-btn ${showLegend ? 'expanded' : ''}`}
        onClick={() => setShowLegend(!showLegend)}
      >
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
        <span>Sobre os papéis de acesso</span>
        <svg viewBox="0 0 24 24" width="16" height="16" className="chevron-icon">
          <path fill="currentColor" d="M7 10l5 5 5-5z"/>
        </svg>
      </button>

      {showLegend && (
        <div className="legend-panel glass-card">
          <div className="legend-row">
            <div className="legend-item-v2">
              <span className="legend-dot dot-admin"></span>
              <div>
                <strong>Administrador</strong>
                <p>Acesso total: gerencia setores, usuários e indicadores</p>
              </div>
            </div>
            <div className="legend-item-v2">
              <span className="legend-dot dot-leader"></span>
              <div>
                <strong>Líder</strong>
                <p>Gerencia indicadores da equipe e faz check-ins</p>
              </div>
            </div>
            <div className="legend-item-v2">
              <span className="legend-dot dot-user"></span>
              <div>
                <strong>Usuário</strong>
                <p>Visualiza indicadores e acompanha o progresso</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="users-table-card glass-card">
        <div className="table-toolbar">
          {/* Search Row */}
          <div className="toolbar-top-row">
            <div className="search-wrapper">
              <svg viewBox="0 0 24 24" width="18" height="18" className="search-icon">
                <path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <input
                type="text"
                placeholder="Buscar por nome ou email..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="search-input-v2"
              />
              {filter && (
                <button type="button" className="search-clear" onClick={() => setFilter('')}>
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              )}
            </div>
            <span className="results-count">
              {filteredUsers.length === users.length
                ? `${users.length} usuários`
                : `${filteredUsers.length} de ${users.length}`
              }
            </span>
          </div>

          {/* Filter Pills Row */}
          <div className="filter-bar">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className={`filter-dropdown ${filterRole ? 'filter-active' : ''}`}
            >
              <option value="">Papel</option>
              {getVisibleRoles(currentUser?.role).map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <SearchableDropdown
              value={filterSetor}
              onChange={(val) => {
                setFilterSetor(val);
                setFilterCargo(''); // Reset dependent filters
                setFilterLider('');
              }}
              options={uniqueSetors}
              placeholder="Setor"
              count={uniqueSetors.length > 0 ? uniqueSetors.length : null}
            />

            <SearchableDropdown
              value={filterLider}
              onChange={(val) => setFilterLider(val)}
              options={uniqueLiders}
              placeholder="Líder"
              disabled={uniqueLiders.length === 0}
              count={filterSetor && uniqueLiders.length > 0 ? uniqueLiders.length : null}
            />

            <button
              type="button"
              className={`toggle-active-btn ${showOnlyActive ? 'active' : ''}`}
              onClick={() => setShowOnlyActive(!showOnlyActive)}
            >
              <span className="toggle-dot"></span>
              <span>Apenas ativos</span>
            </button>

            {hasActiveFilters && (
              <button type="button" className="clear-filters-btn" onClick={clearAllFilters}>
                <svg viewBox="0 0 24 24" width="12" height="12">
                  <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
                Limpar
              </button>
            )}
          </div>
        </div>

        <div className="table-scroll">
          <table className="users-table-v2">
            <thead>
              <tr>
                <th className="col-user">Usuário</th>
                <th className="col-role">Papel</th>
                <th className="col-sector">Setor</th>
                <th className="col-cargo">Cargo</th>
                <th className="col-leader">Líder</th>
                <th className="col-status">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state-cell">
                    <div className="empty-state-content">
                      <svg viewBox="0 0 24 24" width="32" height="32">
                        <path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                      </svg>
                      <span>Nenhum usuário encontrado</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const isCurrentUser = currentUser?.email === user.email;
                  const isActive = user.is_active !== false;

                  return (
                    <tr
                      key={user.id}
                      className={`user-row ${!isActive ? 'row-disabled' : ''}`}
                      onClick={() => openEditModal(user)}
                    >
                      <td className="col-user">
                        <div className="user-cell-v3">
                          <div className={`avatar-v3 ${getAvatarClass(user.role)} ${!isActive ? 'avatar-disabled' : ''}`}>
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt="" className="avatar-img" />
                            ) : (
                              getInitials(user.name)
                            )}
                          </div>
                          <div className="user-meta-v3">
                            <span className="user-name-v3">
                              {user.name || 'Sem nome'}
                              {isCurrentUser && <span className="you-badge">você</span>}
                            </span>
                            <span className="user-email-v3">{user.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="col-role">
                        <span className={`role-pill ${user.role === 'dev' ? 'role-pill-dev' : user.role === 'ceo' ? 'role-pill-ceo' : user.role === 'director' || user.role === 'admin' ? 'role-pill-admin' : user.role === 'leader' ? 'role-pill-leader' : 'role-pill-user'}`}>
                          {user.role === 'dev' ? 'Dev' : user.role === 'ceo' ? 'CEO' : user.role === 'director' ? 'Director' : user.role === 'admin' ? 'Admin' : user.role === 'leader' ? 'Líder' : 'Usuário'}
                        </span>
                      </td>
                      <td className="col-sector">
                        <span className="field-text">{user.setor?.name || '—'}</span>
                      </td>
                      <td className="col-cargo">
                        <span className="field-text">{user.cargo?.name || '—'}</span>
                      </td>
                      <td className="col-leader">
                        <span className="field-text leader-text">
                          {user.leader?.name || '—'}
                        </span>
                      </td>
                      <td className="col-status" onClick={(e) => e.stopPropagation()}>
                        {isCurrentUser ? (
                          <span className={`status-chip-v3 ${isActive ? 'chip-active' : 'chip-inactive'}`}>
                            <span className="status-dot-v3"></span>
                            {isActive ? 'Ativo' : 'Inativo'}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className={`status-toggle-v3 ${isActive ? 'toggle-active' : 'toggle-inactive'}`}
                            onClick={(e) => handleToggleUserStatus(e, user)}
                            title={isActive ? 'Clique para desativar' : 'Clique para reativar'}
                          >
                            <span className="toggle-track">
                              <span className="toggle-thumb"></span>
                            </span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && editingUser && (
        <div className="modal-overlay-v2">
          <div className="modal-card glass-card">
            <button type="button" className="modal-close-btn" onClick={() => setShowEditModal(false)}>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>

            <div className="modal-user-header">
              <div className={`avatar-v2 avatar-lg ${getAvatarClass(editingUser.role)}`}>
                {editingUser.avatar_url ? (
                  <img src={editingUser.avatar_url} alt="" className="avatar-img" />
                ) : (
                  getInitials(editingUser.name)
                )}
              </div>
              <div className="modal-user-info">
                <h2>{editingUser.name}</h2>
                <p>{editingUser.email}</p>
              </div>
            </div>

            <form onSubmit={handleEditSubmit} className="modal-form-v2">
              <div className="form-field">
                <label>Papel de acesso</label>
                <div className="role-selector">
                  {getVisibleRoles(currentUser?.role).map(opt => (
                    <label
                      key={opt.value}
                      className={`role-option-v2 ${editForm.role === opt.value ? 'selected' : ''}`}
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

              <div className="form-row-v2">
                <div className="form-field">
                  <label>Setor</label>
                  <select
                    value={editForm.sector_id}
                    onChange={e => setEditForm({...editForm, sector_id: e.target.value, position_id: ''})}
                  >
                    <option value="">Selecione...</option>
                    {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Cargo</label>
                  <select
                    value={editForm.position_id}
                    onChange={e => setEditForm({...editForm, position_id: e.target.value})}
                  >
                    <option value="">Selecione...</option>
                    {positions
                      .filter(p => !editForm.sector_id || p.sector_id === editForm.sector_id || p.sector?.id === editForm.sector_id)
                      .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-field">
                <label>Líder {potentialLeaders.length > 0 && <span style={{color: '#888', fontWeight: 'normal'}}>({potentialLeaders.length} disponíveis)</span>}</label>
                <select
                  value={editForm.leader_id}
                  onChange={e => setEditForm({...editForm, leader_id: e.target.value})}
                >
                  <option value="">Sem líder</option>
                  {potentialLeaders.filter(l => l.id !== editingUser?.id).length === 0 ? (
                    <option disabled>Nenhum líder encontrado</option>
                  ) : (
                    potentialLeaders.filter(l => l.id !== editingUser?.id).map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))
                  )}
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-ghost-v2" onClick={() => setShowEditModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary-v2" disabled={isSubmitting}>
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
