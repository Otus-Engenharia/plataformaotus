import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './AdminPages.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function AdminUsuarios() {
  const { isPrivileged, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ sector_id: '', position_id: '', role: '' });
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

  // Filtered users
  const filteredUsers = users.filter(user => {
    const matchesName = !filter ||
      user.name?.toLowerCase().includes(filter.toLowerCase()) ||
      user.email?.toLowerCase().includes(filter.toLowerCase());
    return matchesName;
  });

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

  // Toggle user active status
  const handleToggleUserStatus = async (user) => {
    const newStatus = user.is_active === false ? true : false;
    const action = newStatus ? 'reativar' : 'desativar';

    if (!confirm(`Deseja ${action} o usuário "${user.name}"?`)) return;

    try {
      const res = await fetch(`${API_URL}/api/ind/admin/users/${user.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: newStatus })
      });
      if (!res.ok) throw new Error(`Erro ao ${action} usuário`);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Open edit modal
  const openEditModal = (user) => {
    setEditingUser(user);
    setEditForm({
      sector_id: user.setor?.id || '',
      position_id: user.cargo?.id || '',
      role: user.role || 'user'
    });
    setShowEditModal(true);
  };

  // Handle edit submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSubmitting(true);
    try {
      // Update sector
      await fetch(`${API_URL}/api/ind/admin/users/${editingUser.id}/sector`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sector_id: editForm.sector_id || null })
      });

      // Update position
      await fetch(`${API_URL}/api/ind/admin/users/${editingUser.id}/position`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ position_id: editForm.position_id || null })
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

  // Get initials
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  if (!isPrivileged) {
    return (
      <div className="admin-page">
        <div className="access-denied-card glass-card">
          <svg viewBox="0 0 24 24" width="48" height="48" className="access-denied-icon">
            <path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
          </svg>
          <h3>Acesso Negado</h3>
          <p>Você não tem permissão para acessar esta página. Apenas administradores podem gerenciar usuários.</p>
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
    <div className="admin-page admin-usuarios">
      {/* Header */}
      <header className="admin-header">
        <div>
          <h1>Usuários e Permissões</h1>
          <p className="admin-subtitle">Gerenciar usuários e papéis</p>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card glass-card">
          <div className="stat-header">
            <span className="stat-label">Administradores</span>
            <svg viewBox="0 0 24 24" width="18" height="18" className="stat-icon stat-icon-admin">
              <path fill="currentColor" d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
            </svg>
          </div>
          <div className="stat-value stat-value-admin">{adminsCount}</div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-header">
            <span className="stat-label">Líderes</span>
            <svg viewBox="0 0 24 24" width="18" height="18" className="stat-icon stat-icon-leader">
              <path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
            </svg>
          </div>
          <div className="stat-value stat-value-leader">{leadersCount}</div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-header">
            <span className="stat-label">Total de Usuários</span>
            <svg viewBox="0 0 24 24" width="18" height="18" className="stat-icon">
              <path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>
          </div>
          <div className="stat-value">{users.length}</div>
        </div>
      </div>

      {/* Role Legend */}
      <div className="role-legend glass-card">
        <div className="card-header">
          <h2>Legenda de Papéis</h2>
        </div>
        <div className="legend-grid">
          <div className="legend-item">
            <div className="legend-icon legend-icon-admin">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
              </svg>
            </div>
            <div className="legend-text">
              <span className="legend-title">Administrador</span>
              <span className="legend-desc">Acesso total ao sistema: gerencia setores, usuários e todos os indicadores.</span>
            </div>
          </div>
          <div className="legend-item">
            <div className="legend-icon legend-icon-leader">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
              </svg>
            </div>
            <div className="legend-text">
              <span className="legend-title">Líder</span>
              <span className="legend-desc">Pode gerenciar indicadores da equipe, fazer check-ins e acompanhar metas.</span>
            </div>
          </div>
          <div className="legend-item">
            <div className="legend-icon legend-icon-user">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
            </div>
            <div className="legend-text">
              <span className="legend-title">Usuário Comum</span>
              <span className="legend-desc">Pode visualizar indicadores e acompanhar o progresso da organização.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="users-card glass-card">
        <div className="card-header">
          <h2>Usuários</h2>
          <div className="filter-inline">
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="filter-input-sm"
            />
          </div>
        </div>
        <div className="users-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Role</th>
                <th>Setor</th>
                <th>Cargo</th>
                <th>Status</th>
                <th className="th-actions">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-row">Nenhum usuário encontrado</td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const isCurrentUser = currentUser?.email === user.email;
                  const isActive = user.is_active !== false;

                  return (
                    <tr key={user.id} className={!isActive ? 'row-inactive' : ''}>
                      <td className="cell-name">
                        <div className="user-cell">
                          <div className={`user-avatar ${!isActive ? 'avatar-inactive' : ''}`}>
                            {getInitials(user.name)}
                          </div>
                          <div className="user-info">
                            <span className="user-name">{user.name || '-'}</span>
                            {isCurrentUser && <span className="user-you">Você</span>}
                          </div>
                        </div>
                      </td>
                      <td className="cell-email">{user.email || '-'}</td>
                      <td>
                        <span className={`badge ${user.role === 'admin' || user.role === 'director' ? 'badge-gold' : user.role === 'leader' ? 'badge-leader' : 'badge-muted'}`}>
                          {user.role === 'director' ? 'admin' : user.role || 'user'}
                        </span>
                      </td>
                      <td>
                        <select
                          value={user.setor?.id || ''}
                          onChange={(e) => handleUpdateSector(user.id, e.target.value)}
                          className="inline-select"
                          disabled={!isActive}
                        >
                          <option value="">Sem setor</option>
                          {sectors.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={user.cargo?.id || ''}
                          onChange={(e) => handleUpdatePosition(user.id, e.target.value)}
                          className="inline-select"
                          disabled={!isActive}
                        >
                          <option value="">Sem cargo</option>
                          {positions.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className={`status-badge ${isActive ? 'status-active' : 'status-inactive'}`}>
                          {isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="td-actions">
                        <div className="cell-actions">
                          <button
                            className="btn-icon"
                            onClick={() => openEditModal(user)}
                            title="Editar usuário"
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16">
                              <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/>
                            </svg>
                          </button>
                          {!isCurrentUser && (
                            <button
                              className={`btn-icon ${isActive ? 'btn-danger' : 'btn-success'}`}
                              onClick={() => handleToggleUserStatus(user)}
                              title={isActive ? 'Desativar usuário' : 'Reativar usuário'}
                            >
                              {isActive ? (
                                <svg viewBox="0 0 24 24" width="16" height="16">
                                  <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"/>
                                </svg>
                              ) : (
                                <svg viewBox="0 0 24 24" width="16" height="16">
                                  <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Editar Usuário</h2>
                <p className="modal-description">Altere setor e cargo de {editingUser.name}</p>
              </div>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleEditSubmit} className="modal-form">
              {/* User Info */}
              <div className="edit-user-header">
                <div className="user-avatar user-avatar-lg">
                  {getInitials(editingUser.name)}
                </div>
                <div className="edit-user-info">
                  <span className="edit-user-name">{editingUser.name}</span>
                  <span className="edit-user-email">{editingUser.email}</span>
                </div>
              </div>

              <div className="form-group">
                <label>
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <path fill="currentColor" d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10z"/>
                  </svg>
                  Setor
                </label>
                <select
                  value={editForm.sector_id}
                  onChange={e => setEditForm({...editForm, sector_id: e.target.value})}
                >
                  <option value="">Nenhum</option>
                  {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <path fill="currentColor" d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/>
                  </svg>
                  Cargo
                </label>
                <select
                  value={editForm.position_id}
                  onChange={e => setEditForm({...editForm, position_id: e.target.value})}
                >
                  <option value="">Nenhum</option>
                  {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
