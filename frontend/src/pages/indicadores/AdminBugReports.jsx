import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './AdminBugReports.css';

const API_URL = import.meta.env.VITE_API_URL || '';

const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente', color: '#f59e0b' },
  { value: 'em_andamento', label: 'Em Andamento', color: '#3b82f6' },
  { value: 'resolvido', label: 'Resolvido', color: '#22c55e' },
  { value: 'fechado', label: 'Fechado', color: '#6b7280' }
];

const TYPE_OPTIONS = [
  { value: 'bug', label: 'Bug', icon: '🐛' },
  { value: 'erro', label: 'Erro', icon: '❌' },
  { value: 'sugestao', label: 'Sugestão', icon: '💡' },
  { value: 'outro', label: 'Outro', icon: '📝' }
];

/**
 * Página de administração de relatórios de bugs
 */
export default function AdminBugReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Detail view
  const [selectedReport, setSelectedReport] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/bug-reports`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Erro ao carregar relatórios');
      const data = await response.json();
      setReports(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateReport = async (id, updates) => {
    setUpdating(true);
    try {
      const response = await fetch(`${API_URL}/api/bug-reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Erro ao atualizar relatório');

      // Update local state
      setReports(prev => prev.map(r =>
        r.id === id ? { ...r, ...updates } : r
      ));

      if (selectedReport?.id === id) {
        setSelectedReport(prev => ({ ...prev, ...updates }));
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusChange = (id, newStatus) => {
    const updates = {
      status: newStatus,
      ...(newStatus === 'resolvido' || newStatus === 'fechado' ? {
        resolved_by: user?.email,
        resolved_at: new Date().toISOString()
      } : {})
    };
    updateReport(id, updates);
  };

  const handleSaveNotes = () => {
    if (selectedReport) {
      updateReport(selectedReport.id, { admin_notes: adminNotes });
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const opt = STATUS_OPTIONS.find(s => s.value === status);
    return (
      <span
        className="bug-admin__status-badge"
        style={{ '--status-color': opt?.color || '#6b7280' }}
      >
        {opt?.label || status}
      </span>
    );
  };

  const getTypeLabel = (type) => {
    const opt = TYPE_OPTIONS.find(t => t.value === type);
    return (
      <span className="bug-admin__type">
        <span className="bug-admin__type-icon">{opt?.icon || '📝'}</span>
        {opt?.label || type}
      </span>
    );
  };

  // Filter reports
  const filteredReports = reports.filter(report => {
    if (filterStatus && report.status !== filterStatus) return false;
    if (filterType && report.type !== filterType) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        report.title?.toLowerCase().includes(search) ||
        report.description?.toLowerCase().includes(search) ||
        report.reporter_name?.toLowerCase().includes(search) ||
        report.reporter_email?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // Stats
  const stats = {
    total: reports.length,
    pendente: reports.filter(r => r.status === 'pendente').length,
    em_andamento: reports.filter(r => r.status === 'em_andamento').length,
    resolvido: reports.filter(r => r.status === 'resolvido').length
  };

  if (loading) {
    return (
      <div className="bug-admin">
        <div className="bug-admin__loading">
          <div className="bug-admin__spinner"></div>
          <p>Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bug-admin">
      {/* Header */}
      <div className="bug-admin__header">
        <div className="bug-admin__title-section">
          <h1>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 116 0v1" />
              <path d="M12 20c-3.3 0-6-2.7-6-6v-3a6 6 0 0112 0v3c0 3.3-2.7 6-6 6z" />
            </svg>
            Relatórios de Bugs
          </h1>
          <p>Gerencie os relatórios de bugs e feedbacks da plataforma</p>
        </div>

        {/* Stats */}
        <div className="bug-admin__stats">
          <div className="bug-admin__stat">
            <span className="bug-admin__stat-value">{stats.total}</span>
            <span className="bug-admin__stat-label">Total</span>
          </div>
          <div className="bug-admin__stat bug-admin__stat--warning">
            <span className="bug-admin__stat-value">{stats.pendente}</span>
            <span className="bug-admin__stat-label">Pendentes</span>
          </div>
          <div className="bug-admin__stat bug-admin__stat--info">
            <span className="bug-admin__stat-value">{stats.em_andamento}</span>
            <span className="bug-admin__stat-label">Em Andamento</span>
          </div>
          <div className="bug-admin__stat bug-admin__stat--success">
            <span className="bug-admin__stat-value">{stats.resolvido}</span>
            <span className="bug-admin__stat-label">Resolvidos</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bug-admin__filters glass-card">
        <div className="bug-admin__filter-group">
          <label>Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Todos</option>
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="bug-admin__filter-group">
          <label>Tipo</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">Todos</option>
            {TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
            ))}
          </select>
        </div>

        <div className="bug-admin__filter-group bug-admin__filter-group--search">
          <label>Buscar</label>
          <input
            type="text"
            placeholder="Buscar por título, descrição ou autor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button
          className="bug-admin__refresh-btn"
          onClick={fetchReports}
          title="Atualizar lista"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="bug-admin__content">
        {/* Table */}
        <div className="bug-admin__table-container glass-card">
          {error ? (
            <div className="bug-admin__error">
              <p>{error}</p>
              <button onClick={fetchReports}>Tentar novamente</button>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="bug-admin__empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 15h8M9 9h.01M15 9h.01" />
              </svg>
              <p>Nenhum relatório encontrado</p>
            </div>
          ) : (
            <table className="bug-admin__table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Título</th>
                  <th>Autor</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map(report => (
                  <tr
                    key={report.id}
                    className={selectedReport?.id === report.id ? 'bug-admin__row--selected' : ''}
                  >
                    <td className="bug-admin__cell--date">
                      {formatDate(report.created_at)}
                    </td>
                    <td>{getTypeLabel(report.type)}</td>
                    <td className="bug-admin__cell--title">
                      <span
                        className="bug-admin__title-link"
                        onClick={() => {
                          setSelectedReport(report);
                          setAdminNotes(report.admin_notes || '');
                        }}
                      >
                        {report.title}
                      </span>
                    </td>
                    <td className="bug-admin__cell--author">
                      <span className="bug-admin__author-name">{report.reporter_name || 'Anônimo'}</span>
                      <span className="bug-admin__author-email">{report.reporter_email}</span>
                    </td>
                    <td>{getStatusBadge(report.status)}</td>
                    <td className="bug-admin__cell--actions">
                      <select
                        value={report.status}
                        onChange={(e) => handleStatusChange(report.id, e.target.value)}
                        className="bug-admin__status-select"
                        disabled={updating}
                      >
                        {STATUS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail Panel */}
        {selectedReport && (
          <div className="bug-admin__detail glass-card">
            <div className="bug-admin__detail-header">
              <h3>{selectedReport.title}</h3>
              <button
                className="bug-admin__detail-close"
                onClick={() => setSelectedReport(null)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="bug-admin__detail-content">
              <div className="bug-admin__detail-meta">
                <div>{getTypeLabel(selectedReport.type)}</div>
                <div>{getStatusBadge(selectedReport.status)}</div>
                <div className="bug-admin__detail-date">
                  {formatDate(selectedReport.created_at)}
                </div>
              </div>

              <div className="bug-admin__detail-section">
                <h4>Descrição</h4>
                <p>{selectedReport.description}</p>
              </div>

              {selectedReport.page_url && (
                <div className="bug-admin__detail-section">
                  <h4>Página</h4>
                  <a href={selectedReport.page_url} target="_blank" rel="noopener noreferrer">
                    {selectedReport.page_url}
                  </a>
                </div>
              )}

              {selectedReport.screenshot_url && (
                <div className="bug-admin__detail-section">
                  <h4>Screenshot</h4>
                  <img
                    src={selectedReport.screenshot_url}
                    alt="Screenshot do bug"
                    className="bug-admin__screenshot"
                  />
                </div>
              )}

              <div className="bug-admin__detail-section">
                <h4>Autor</h4>
                <p>
                  {selectedReport.reporter_name || 'Anônimo'}
                  {selectedReport.reporter_email && (
                    <> ({selectedReport.reporter_email})</>
                  )}
                </p>
              </div>

              {selectedReport.resolved_by && (
                <div className="bug-admin__detail-section">
                  <h4>Resolvido por</h4>
                  <p>
                    {selectedReport.resolved_by}
                    {selectedReport.resolved_at && (
                      <> em {formatDate(selectedReport.resolved_at)}</>
                    )}
                  </p>
                </div>
              )}

              <div className="bug-admin__detail-section">
                <h4>Notas do Admin</h4>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Adicione notas sobre este relatório..."
                  rows={4}
                />
                <button
                  className="bug-admin__save-notes"
                  onClick={handleSaveNotes}
                  disabled={updating || adminNotes === selectedReport.admin_notes}
                >
                  Salvar Notas
                </button>
              </div>

              <div className="bug-admin__detail-actions">
                <label>Alterar Status:</label>
                <select
                  value={selectedReport.status}
                  onChange={(e) => handleStatusChange(selectedReport.id, e.target.value)}
                  disabled={updating}
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
