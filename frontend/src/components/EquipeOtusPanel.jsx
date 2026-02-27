/**
 * Componente: Painel Equipe Otus
 *
 * Exibe membros internos da Otus atribuídos ao projeto:
 * - Time padrão (baseado no team_id do projeto)
 * - Membros adicionados manualmente
 * - Destaque do líder do projeto
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import '../styles/EquipeOtusPanel.css';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function EquipeOtusPanel({ projectCode }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Edição inline de telefone
  const [editingPhoneId, setEditingPhoneId] = useState(null);
  const [phoneValue, setPhoneValue] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  // Modal de adicionar membro
  const [showAddModal, setShowAddModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [addingUserId, setAddingUserId] = useState(null);

  const fetchTeam = useCallback(async () => {
    if (!projectCode) return;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/api/projetos/equipe-otus`, {
        params: { projectCode },
        withCredentials: true
      });
      setData(response.data.data || null);
    } catch (err) {
      console.error('Erro ao buscar equipe Otus:', err);
      setError('Erro ao carregar equipe Otus');
    } finally {
      setLoading(false);
    }
  }, [projectCode]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  // IDs de membros já no projeto (padrão + manuais)
  const existingUserIds = useMemo(() => {
    if (!data) return new Set();
    const ids = new Set();
    (data.defaultMembers || []).forEach(m => ids.add(m.id));
    (data.manualMembers || []).forEach(m => ids.add(m.user?.id));
    return ids;
  }, [data]);

  const handleOpenAddModal = async () => {
    setShowAddModal(true);
    setSearchTerm('');
    try {
      const response = await axios.get(`${API_URL}/api/ind/admin/users`, { withCredentials: true });
      const users = response.data.data || [];
      // Filtrar apenas setor Operação e ativos
      const operacaoUsers = users.filter(u =>
        u.setor?.name?.toLowerCase().includes('opera') && u.is_active !== false
      );
      setAllUsers(operacaoUsers);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
    }
  };

  const handleAddMember = async (userId) => {
    setAddingUserId(userId);
    try {
      await axios.post(`${API_URL}/api/projetos/equipe-otus/members`, {
        projectCode,
        userId
      }, { withCredentials: true });
      fetchTeam();
      setShowAddModal(false);
    } catch (err) {
      console.error('Erro ao adicionar membro:', err);
      alert(err.response?.data?.error || 'Erro ao adicionar membro');
    } finally {
      setAddingUserId(null);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Remover este membro do projeto?')) return;
    try {
      await axios.delete(`${API_URL}/api/projetos/equipe-otus/members/${memberId}`, {
        withCredentials: true
      });
      fetchTeam();
    } catch (err) {
      console.error('Erro ao remover membro:', err);
    }
  };

  const startEditPhone = (memberId, currentPhone) => {
    setEditingPhoneId(memberId);
    setPhoneValue(currentPhone || '');
  };

  const cancelEditPhone = () => {
    setEditingPhoneId(null);
    setPhoneValue('');
  };

  const handleSavePhone = async (memberId) => {
    setSavingPhone(true);
    try {
      await axios.put(`${API_URL}/api/projetos/equipe-otus/members/${memberId}/phone`, {
        phone: phoneValue.trim()
      }, { withCredentials: true });
      setEditingPhoneId(null);
      fetchTeam();
    } catch (err) {
      console.error('Erro ao salvar telefone:', err);
      alert('Erro ao salvar telefone.');
    } finally {
      setSavingPhone(false);
    }
  };

  const renderPhoneField = (memberId, phone) => {
    if (editingPhoneId === memberId) {
      return (
        <div className="eotus-phone-edit">
          <input
            type="tel"
            className="eotus-phone-input"
            value={phoneValue}
            onChange={e => setPhoneValue(e.target.value)}
            placeholder="(00) 00000-0000"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter') handleSavePhone(memberId);
              if (e.key === 'Escape') cancelEditPhone();
            }}
          />
          <button className="eotus-phone-save-btn" onClick={() => handleSavePhone(memberId)} disabled={savingPhone}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
          <button className="eotus-phone-cancel-btn" onClick={cancelEditPhone}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      );
    }

    return (
      <span className="eotus-phone-display" onClick={() => startEditPhone(memberId, phone)}>
        {phone ? (
          <span className="eotus-member-phone">{phone}</span>
        ) : (
          <span className="eotus-member-missing">Sem telefone</span>
        )}
        <svg className="eotus-phone-edit-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </span>
    );
  };

  // Filtrar usuários disponíveis (não estão no projeto)
  const availableUsers = useMemo(() => {
    if (!searchTerm.trim()) return allUsers.filter(u => !existingUserIds.has(u.id));
    const term = searchTerm.toLowerCase();
    return allUsers.filter(u =>
      !existingUserIds.has(u.id) &&
      (u.name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term))
    );
  }, [allUsers, existingUserIds, searchTerm]);

  const totalMembers = (data?.defaultMembers?.length || 0) + (data?.manualMembers?.length || 0);

  if (!projectCode) {
    return (
      <div className="eotus-empty">
        <p>Selecione um projeto para ver a equipe Otus</p>
      </div>
    );
  }

  return (
    <div className="eotus-panel">
      {/* Header */}
      <div className="eotus-header">
        <div className="eotus-header-left">
          <h3 className="eotus-title">Equipe Otus</h3>
          {data?.teamName && (
            <span className="eotus-team-badge">{data.teamName}</span>
          )}
          <span className="eotus-count">{totalMembers} {totalMembers === 1 ? 'membro' : 'membros'}</span>
        </div>
        <button className="eotus-add-btn" onClick={handleOpenAddModal}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Adicionar
        </button>
      </div>

      {loading && (
        <div className="eotus-loading">
          <div className="eotus-spinner" />
          <span>Carregando equipe...</span>
        </div>
      )}

      {error && <div className="eotus-error">{error}</div>}

      {!loading && !error && !data?.teamId && (
        <div className="eotus-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <p>Nenhum time atribuído a este projeto.</p>
          <p className="eotus-empty-hint">Atribua um time na coluna "Time" do Portfólio.</p>
        </div>
      )}

      {!loading && !error && data?.teamId && (
        <div className="eotus-members-grid">
          {/* Líder destacado */}
          {data.leaderName && (
            <div className="eotus-leader-section">
              <span className="eotus-section-label">Líder do Projeto</span>
              {(() => {
                const leaderMember = data.defaultMembers?.find(m => m.id === data.leaderId);
                return (
                  <div className="eotus-member-card eotus-member-card--leader">
                    <div className="eotus-avatar eotus-avatar--leader">
                      {leaderMember?.avatar_url ? (
                        <img src={leaderMember.avatar_url} alt={data.leaderName} />
                      ) : (
                        getInitials(data.leaderName)
                      )}
                    </div>
                    <div className="eotus-member-info">
                      <span className="eotus-member-name">{data.leaderName}</span>
                      <span className="eotus-member-cargo">{leaderMember?.cargo?.name || 'Líder de projeto'}</span>
                      {leaderMember?.email ? (
                        <a href={`mailto:${leaderMember.email}`} className="eotus-member-email">{leaderMember.email}</a>
                      ) : (
                        <span className="eotus-member-missing">Sem email</span>
                      )}
                      {renderPhoneField(leaderMember?.id, leaderMember?.phone)}
                    </div>
                    <span className="eotus-leader-badge">Líder</span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Membros do time padrão */}
          {data.defaultMembers?.filter(m => m.id !== data.leaderId).length > 0 && (
            <div className="eotus-team-section">
              <span className="eotus-section-label">Time {data.teamName}</span>
              <div className="eotus-members-list">
                {data.defaultMembers
                  .filter(m => m.id !== data.leaderId)
                  .map(member => (
                    <div key={member.id} className="eotus-member-card">
                      <div className="eotus-avatar">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt={member.name} />
                        ) : (
                          getInitials(member.name)
                        )}
                      </div>
                      <div className="eotus-member-info">
                        <span className="eotus-member-name">{member.name}</span>
                        <span className="eotus-member-cargo">{member.cargo?.name || '-'}</span>
                        {member.email ? (
                          <a href={`mailto:${member.email}`} className="eotus-member-email">{member.email}</a>
                        ) : (
                          <span className="eotus-member-missing">Sem email</span>
                        )}
                        {renderPhoneField(member.id, member.phone)}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* Membros adicionados manualmente */}
          {data.manualMembers?.length > 0 && (
            <div className="eotus-manual-section">
              <span className="eotus-section-label">Adicionados manualmente</span>
              <div className="eotus-members-list">
                {data.manualMembers.map(row => (
                  <div key={row.id} className="eotus-member-card eotus-member-card--manual">
                    <div className="eotus-avatar">
                      {row.user?.avatar_url ? (
                        <img src={row.user.avatar_url} alt={row.user?.name} />
                      ) : (
                        getInitials(row.user?.name)
                      )}
                    </div>
                    <div className="eotus-member-info">
                      <span className="eotus-member-name">{row.user?.name || '-'}</span>
                      <span className="eotus-member-cargo">{row.user?.cargo?.name || '-'}</span>
                      {row.user?.email ? (
                        <a href={`mailto:${row.user.email}`} className="eotus-member-email">{row.user.email}</a>
                      ) : (
                        <span className="eotus-member-missing">Sem email</span>
                      )}
                      {renderPhoneField(row.user?.id, row.user?.phone)}
                      {row.user?.team?.team_name && (
                        <span className="eotus-member-team">{row.user.team.team_name}</span>
                      )}
                    </div>
                    <button
                      className="eotus-remove-btn"
                      onClick={() => handleRemoveMember(row.id)}
                      title="Remover do projeto"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal adicionar membro */}
      {showAddModal && (
        <div className="eotus-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="eotus-modal" onClick={e => e.stopPropagation()}>
            <div className="eotus-modal-header">
              <h3>Adicionar Membro Otus</h3>
              <button className="eotus-modal-close" onClick={() => setShowAddModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="eotus-modal-search">
              <input
                type="text"
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>

            <div className="eotus-modal-list">
              {availableUsers.length === 0 ? (
                <div className="eotus-modal-empty">
                  {allUsers.length === 0 ? 'Carregando...' : 'Nenhum colaborador encontrado'}
                </div>
              ) : (
                availableUsers.map(user => (
                  <div key={user.id} className="eotus-modal-user">
                    <div className="eotus-avatar eotus-avatar--sm">
                      {getInitials(user.name)}
                    </div>
                    <div className="eotus-modal-user-info">
                      <span className="eotus-modal-user-name">{user.name}</span>
                      <span className="eotus-modal-user-detail">
                        {user.cargo?.name || '-'} · {user.team?.team_name || '-'}
                      </span>
                    </div>
                    <button
                      className="eotus-modal-add-btn"
                      onClick={() => handleAddMember(user.id)}
                      disabled={addingUserId === user.id}
                    >
                      {addingUserId === user.id ? '...' : '+ Adicionar'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EquipeOtusPanel;
