/**
 * Painel de impersonação para desenvolvedores
 *
 * Permite simular a visão de qualquer usuário do sistema.
 * Visível apenas para role=dev.
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { API_URL } from '../api';

export default function DevImpersonationPanel({ collapsed }) {
  const { isRealDev, impersonation, startImpersonation, stopImpersonation } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

  // Sync enabled state with active impersonation
  useEffect(() => {
    setEnabled(!!impersonation?.active);
    if (impersonation?.active) {
      setSelectedUserId(impersonation.target.id);
    }
  }, [impersonation]);

  // Fetch users when toggle enabled
  useEffect(() => {
    if (enabled && users.length === 0) {
      loadUsers();
    }
  }, [enabled]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/ind/admin/users`);
      if (response.data.success) {
        setUsers(response.data.data || []);
      }
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    if (enabled) {
      await stopImpersonation();
      setEnabled(false);
      setSelectedUserId('');
    } else {
      setEnabled(true);
    }
  };

  const handleSelectUser = async (e) => {
    const userId = e.target.value;
    setSelectedUserId(userId);
    if (userId) {
      await startImpersonation(userId);
    }
  };

  if (!isRealDev || collapsed) return null;

  // Agrupar usuários por setor
  const grouped = users.reduce((acc, user) => {
    const sectorName = user.setor?.name || 'Sem setor';
    if (!acc[sectorName]) acc[sectorName] = [];
    acc[sectorName].push(user);
    return acc;
  }, {});

  // Ordenar: "Operação" primeiro, depois alfabético
  const sortedSectors = Object.keys(grouped).sort((a, b) => {
    if (a === 'Operação') return -1;
    if (b === 'Operação') return 1;
    return a.localeCompare(b);
  });

  return (
    <div className={`dev-impersonation-panel ${impersonation?.active ? 'dev-impersonation-active' : ''}`}>
      <div className="dev-impersonation-header">
        <span className="dev-impersonation-label">Impersonar</span>
        <button
          className={`dev-impersonation-toggle ${enabled ? 'active' : ''}`}
          onClick={handleToggle}
          title={enabled ? 'Desativar impersonação' : 'Ativar impersonação'}
        >
          <span className="dev-toggle-knob" />
        </button>
      </div>
      {enabled && !impersonation?.active && (
        <select
          className="dev-impersonation-select"
          value={selectedUserId}
          onChange={handleSelectUser}
          disabled={loading}
        >
          <option value="">
            {loading ? 'Carregando...' : 'Selecionar usuário'}
          </option>
          {sortedSectors.map(sector => (
            <optgroup key={sector} label={sector}>
              {grouped[sector].map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      )}
      {impersonation?.active && (
        <div className="dev-impersonation-info">
          Vendo como: <strong>{impersonation.target.name}</strong>
          <span className="dev-impersonation-role">
            {impersonation.target.role}
            {impersonation.target.setor_name && ` · ${impersonation.target.setor_name}`}
          </span>
        </div>
      )}
    </div>
  );
}
