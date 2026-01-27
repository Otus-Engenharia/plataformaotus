/**
 * Componente: Vista de Logs
 * 
 * Visualiza logs de ações e acessos dos usuários (apenas admin/director)
 */

import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import '../styles/LogsView.css';

const ACTION_TYPES = [
  { value: '', label: 'Todos' },
  { value: 'access', label: 'Acesso' },
  { value: 'view', label: 'Visualização' },
  { value: 'create', label: 'Criação' },
  { value: 'update', label: 'Atualização' },
  { value: 'delete', label: 'Exclusão' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
];

const RESOURCE_TYPES = [
  { value: '', label: 'Todos' },
  { value: 'view', label: 'Vista' },
  { value: 'portfolio', label: 'Portfólio' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'user_views', label: 'Permissões' },
  { value: 'logs', label: 'Logs' },
];

function LogsView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    user_email: '',
    action_type: '',
    resource_type: '',
    start_date: '',
    end_date: '',
  });
  const [stats, setStats] = useState(null);
  const [showStats, setShowStats] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (filters.user_email) params.append('user_email', filters.user_email);
      if (filters.action_type) params.append('action_type', filters.action_type);
      if (filters.resource_type) params.append('resource_type', filters.resource_type);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      params.append('limit', '500');

      const response = await axios.get(`${API_URL}/api/admin/logs?${params.toString()}`, {
        withCredentials: true,
      });

      if (response.data?.success) {
        setLogs(response.data.data || []);
      } else {
        setError(response.data?.error || 'Erro ao carregar logs');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao carregar logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);

      const response = await axios.get(`${API_URL}/api/admin/logs/stats?${params.toString()}`, {
        withCredentials: true,
      });

      if (response.data?.success) {
        setStats(response.data.data);
      }
    } catch (err) {
      console.error('Erro ao buscar estatísticas:', err);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    if (showStats) {
      fetchStats();
    }
  }, [showStats, filters.start_date, filters.end_date]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleApplyFilters = () => {
    fetchLogs();
  };

  const handleClearFilters = () => {
    setFilters({
      user_email: '',
      action_type: '',
      resource_type: '',
      start_date: '',
      end_date: '',
    });
    setTimeout(() => fetchLogs(), 100);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getActionLabel = (actionType) => {
    const action = ACTION_TYPES.find((a) => a.value === actionType);
    return action ? action.label : actionType;
  };

  if (loading && logs.length === 0) {
    return (
      <div className="logs-container">
        <div className="logs-loading">Carregando logs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="logs-container">
        <div className="logs-error">
          <h2>Erro ao carregar logs</h2>
          <p>{error}</p>
          <button onClick={fetchLogs} className="retry-button">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="logs-container">
      <div className="logs-header">
        <h2>Logs do Sistema</h2>
        <div className="logs-header-actions">
          <button
            onClick={() => setShowStats(!showStats)}
            className="btn-stats"
          >
            {showStats ? 'Ocultar' : 'Mostrar'} Estatísticas
          </button>
          <button onClick={fetchLogs} className="refresh-button">
            Atualizar
          </button>
        </div>
      </div>

      {showStats && stats && (
        <div className="logs-stats">
          <div className="stats-section">
            <h3>Ações por Tipo</h3>
            <div className="stats-list">
              {stats.actions.map((stat) => (
                <div key={stat.action_type} className="stat-item">
                  <span className="stat-label">{getActionLabel(stat.action_type)}:</span>
                  <span className="stat-value">{stat.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="stats-section">
            <h3>Uso de Vistas</h3>
            <div className="stats-list">
              {stats.views.map((stat) => (
                <div key={stat.vista} className="stat-item">
                  <span className="stat-label">{stat.vista}:</span>
                  <span className="stat-value">
                    {stat.total_acessos} acessos ({stat.usuarios_unicos} usuários)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="logs-filters">
        <div className="filter-group">
          <label htmlFor="user_email">Email do Usuário</label>
          <input
            id="user_email"
            type="text"
            placeholder="Filtrar por email..."
            value={filters.user_email}
            onChange={(e) => handleFilterChange('user_email', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="action_type">Tipo de Ação</label>
          <select
            id="action_type"
            value={filters.action_type}
            onChange={(e) => handleFilterChange('action_type', e.target.value)}
          >
            {ACTION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="resource_type">Tipo de Recurso</label>
          <select
            id="resource_type"
            value={filters.resource_type}
            onChange={(e) => handleFilterChange('resource_type', e.target.value)}
          >
            {RESOURCE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="start_date">Data Inicial</label>
          <input
            id="start_date"
            type="date"
            value={filters.start_date}
            onChange={(e) => handleFilterChange('start_date', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="end_date">Data Final</label>
          <input
            id="end_date"
            type="date"
            value={filters.end_date}
            onChange={(e) => handleFilterChange('end_date', e.target.value)}
          />
        </div>

        <div className="filter-actions">
          <button onClick={handleApplyFilters} className="btn-apply">
            Aplicar Filtros
          </button>
          <button onClick={handleClearFilters} className="btn-clear">
            Limpar
          </button>
        </div>
      </div>

      <div className="logs-results">
        Mostrando {logs.length} log(s)
      </div>

      <div className="logs-table-wrapper">
        <table className="logs-table">
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>Usuário</th>
              <th>Ação</th>
              <th>Recurso</th>
              <th>Detalhes</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  Nenhum log encontrado
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDate(log.created_at)}</td>
                  <td>
                    <div className="user-info">
                      <div className="user-name">{log.user_name || '-'}</div>
                      <div className="user-email">{log.user_email}</div>
                    </div>
                  </td>
                  <td>
                    <span className={`action-badge action-${log.action_type}`}>
                      {getActionLabel(log.action_type)}
                    </span>
                  </td>
                  <td>
                    {log.resource_name || log.resource_type || '-'}
                  </td>
                  <td>
                    {log.details ? (
                      <details className="details-dropdown">
                        <summary>Ver detalhes</summary>
                        <pre>{JSON.stringify(log.details, null, 2)}</pre>
                      </details>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{log.ip_address || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default LogsView;
