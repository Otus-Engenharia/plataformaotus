/**
 * Componente: Vista de Logs
 *
 * Abas:
 * - Todos os Logs: logs gerais com filtros
 * - Alterações de Projetos: auditoria de segurança para edições no portfólio
 */

import React, { useEffect, useState } from 'react';
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

function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('pt-BR');
}

function getActionLabel(actionType) {
  const action = ACTION_TYPES.find((a) => a.value === actionType);
  return action ? action.label : actionType;
}

// ── Aba: Todos os Logs ──────────────────────────────────────────
function AllLogsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    user_email: '', action_type: '', resource_type: '', start_date: '', end_date: '',
  });
  const [stats, setStats] = useState(null);
  const [showStats, setShowStats] = useState(false);

  const fetchLogs = async (f = filters) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (f.user_email) params.append('user_email', f.user_email);
      if (f.action_type) params.append('action_type', f.action_type);
      if (f.resource_type) params.append('resource_type', f.resource_type);
      if (f.start_date) params.append('start_date', f.start_date);
      if (f.end_date) params.append('end_date', f.end_date);
      params.append('limit', '500');
      const { data } = await axios.get(`${API_URL}/api/admin/logs?${params}`, { withCredentials: true });
      if (data?.success) setLogs(data.data || []);
      else setError(data?.error || 'Erro ao carregar logs');
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      const { data } = await axios.get(`${API_URL}/api/admin/logs/stats?${params}`, { withCredentials: true });
      if (data?.success) setStats(data.data);
    } catch {}
  };

  useEffect(() => { fetchLogs(); }, []);
  useEffect(() => { if (showStats) fetchStats(); }, [showStats, filters.start_date, filters.end_date]);

  const handleFilterChange = (field, value) => setFilters(prev => ({ ...prev, [field]: value }));

  const handleClear = () => {
    const empty = { user_email: '', action_type: '', resource_type: '', start_date: '', end_date: '' };
    setFilters(empty);
    setTimeout(() => fetchLogs(empty), 50);
  };

  if (loading && logs.length === 0) return <div className="logs-loading">Carregando logs...</div>;
  if (error) return (
    <div className="logs-error">
      <p>{error}</p>
      <button onClick={() => fetchLogs()} className="retry-button">Tentar novamente</button>
    </div>
  );

  return (
    <>
      <div className="logs-header-actions">
        <button onClick={() => setShowStats(!showStats)} className="btn-stats">
          {showStats ? 'Ocultar' : 'Mostrar'} Estatísticas
        </button>
        <button onClick={() => fetchLogs()} className="refresh-button">Atualizar</button>
      </div>

      {showStats && stats && (
        <div className="logs-stats">
          <div className="stats-section">
            <h3>Ações por Tipo</h3>
            <div className="stats-list">
              {stats.actions.map(s => (
                <div key={s.action_type} className="stat-item">
                  <span className="stat-label">{getActionLabel(s.action_type)}:</span>
                  <span className="stat-value">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="stats-section">
            <h3>Uso de Vistas</h3>
            <div className="stats-list">
              {stats.views.map(s => (
                <div key={s.vista} className="stat-item">
                  <span className="stat-label">{s.vista}:</span>
                  <span className="stat-value">{s.total_acessos} acessos ({s.usuarios_unicos} usuários)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="logs-filters">
        <div className="filter-group">
          <label>Email do Usuário</label>
          <input type="text" placeholder="Filtrar por email..." value={filters.user_email}
            onChange={e => handleFilterChange('user_email', e.target.value)} />
        </div>
        <div className="filter-group">
          <label>Tipo de Ação</label>
          <select value={filters.action_type} onChange={e => handleFilterChange('action_type', e.target.value)}>
            {ACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Tipo de Recurso</label>
          <select value={filters.resource_type} onChange={e => handleFilterChange('resource_type', e.target.value)}>
            {RESOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Data Inicial</label>
          <input type="date" value={filters.start_date} onChange={e => handleFilterChange('start_date', e.target.value)} />
        </div>
        <div className="filter-group">
          <label>Data Final</label>
          <input type="date" value={filters.end_date} onChange={e => handleFilterChange('end_date', e.target.value)} />
        </div>
        <div className="filter-actions">
          <button onClick={() => fetchLogs()} className="btn-apply">Aplicar Filtros</button>
          <button onClick={handleClear} className="btn-clear">Limpar</button>
        </div>
      </div>

      <div className="logs-results">Mostrando {logs.length} log(s)</div>

      <div className="logs-table-wrapper">
        <table className="logs-table">
          <thead>
            <tr>
              <th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Recurso</th><th>Detalhes</th><th>IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0
              ? <tr><td colSpan={6} className="empty-state">Nenhum log encontrado</td></tr>
              : logs.map(log => (
                <tr key={log.id}>
                  <td>{formatDate(log.created_at)}</td>
                  <td>
                    <div className="user-info">
                      <div className="user-name">{log.user_name || '-'}</div>
                      <div className="user-email">{log.user_email}</div>
                    </div>
                  </td>
                  <td><span className={`action-badge action-${log.action_type}`}>{getActionLabel(log.action_type)}</span></td>
                  <td>{log.resource_name || log.resource_type || '-'}</td>
                  <td>
                    {log.details
                      ? <details className="details-dropdown"><summary>Ver detalhes</summary><pre>{JSON.stringify(log.details, null, 2)}</pre></details>
                      : '-'}
                  </td>
                  <td>{log.ip_address || '-'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Aba: Alterações de Projetos ──────────────────────────────────
function AltProjectsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projectFilter, setProjectFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchAlteracoes = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        action_type: 'update',
        resource_type: 'portfolio',
        limit: '1000',
      });
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      const { data } = await axios.get(`${API_URL}/api/admin/logs?${params}`, { withCredentials: true });
      if (data?.success) setLogs(data.data || []);
      else setError(data?.error || 'Erro ao carregar alterações');
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAlteracoes(); }, []);

  const filtered = projectFilter
    ? logs.filter(l => (l.resource_id || '').toLowerCase().includes(projectFilter.toLowerCase()))
    : logs;

  if (loading && logs.length === 0) return <div className="logs-loading">Carregando alterações...</div>;
  if (error) return (
    <div className="logs-error">
      <p>{error}</p>
      <button onClick={fetchAlteracoes} className="retry-button">Tentar novamente</button>
    </div>
  );

  return (
    <>
      <div className="audit-banner">
        Histórico completo de edições em campos de projetos do portfólio — rastreabilidade para segurança.
      </div>

      <div className="logs-header-actions">
        <button onClick={fetchAlteracoes} className="refresh-button">Atualizar</button>
      </div>

      <div className="logs-filters">
        <div className="filter-group">
          <label>Código do Projeto</label>
          <input type="text" placeholder="Ex: OT-123" value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)} />
        </div>
        <div className="filter-group">
          <label>Data Inicial</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="filter-group">
          <label>Data Final</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div className="filter-actions">
          <button onClick={fetchAlteracoes} className="btn-apply">Aplicar Filtros</button>
          <button onClick={() => { setProjectFilter(''); setStartDate(''); setEndDate(''); setTimeout(fetchAlteracoes, 50); }} className="btn-clear">Limpar</button>
        </div>
      </div>

      <div className="logs-results">Mostrando {filtered.length} alteração(ões)</div>

      <div className="logs-table-wrapper">
        <table className="logs-table audit-table">
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>Usuário</th>
              <th>Projeto</th>
              <th>Campo Alterado</th>
              <th>Valor Anterior</th>
              <th>Novo Valor</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={7} className="empty-state">Nenhuma alteração encontrada</td></tr>
              : filtered.map(log => (
                <tr key={log.id}>
                  <td className="audit-date">{formatDate(log.created_at)}</td>
                  <td>
                    <div className="user-info">
                      <div className="user-name">{log.user_name || '-'}</div>
                      <div className="user-email">{log.user_email}</div>
                    </div>
                  </td>
                  <td className="audit-project">{log.resource_id || '-'}</td>
                  <td className="audit-field">{log.resource_name || '-'}</td>
                  <td className="audit-old-value">
                    {log.details?.oldValue !== undefined
                      ? <span className="value-old">{String(log.details.oldValue ?? '')}</span>
                      : '-'}
                  </td>
                  <td className="audit-new-value">
                    {log.details?.value !== undefined
                      ? <span className="value-new">{String(log.details.value ?? '')}</span>
                      : '-'}
                  </td>
                  <td>{log.ip_address || '-'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Componente raiz ──────────────────────────────────────────────
function LogsView() {
  const [activeTab, setActiveTab] = useState('todos');

  return (
    <div className="logs-container">
      <div className="logs-header">
        <h2>Logs do Sistema</h2>
      </div>

      <div className="logs-tabs">
        <button
          className={`logs-tab-btn ${activeTab === 'todos' ? 'active' : ''}`}
          onClick={() => setActiveTab('todos')}
        >
          Todos os Logs
        </button>
        <button
          className={`logs-tab-btn ${activeTab === 'alteracoes' ? 'active' : ''}`}
          onClick={() => setActiveTab('alteracoes')}
        >
          Alterações de Projetos
        </button>
      </div>

      {activeTab === 'todos' ? <AllLogsTab /> : <AltProjectsTab />}
    </div>
  );
}

export default LogsView;
