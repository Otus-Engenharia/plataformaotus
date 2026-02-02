/**
 * Componente: Vista Admin de Feedbacks
 *
 * Gerencia feedbacks da plataforma com:
 * - Cards de resumo (KPIs)
 * - Filtros compactos
 * - Tabela com feedbacks
 * - Modal para detalhes e edição
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './FeedbackAdminView.css';

const API_URL = import.meta.env.VITE_API_URL || '';

// === STATUS E TIPO CONFIG ===
// STATUS_CONFIG contém todos os status (incluindo legados) para exibição
const STATUS_CONFIG = {
  pendente: { label: 'Pendente', color: '#f59e0b' },
  em_analise: { label: 'Em Análise', color: '#3b82f6' },
  em_progresso: { label: 'Em Progresso', color: '#8b5cf6' },
  // Status legados - mapeados para "Em Progresso" na exibição
  backlog_desenvolvimento: { label: 'Em Progresso', color: '#8b5cf6' },
  backlog_treinamento: { label: 'Em Progresso', color: '#8b5cf6' },
  analise_funcionalidade: { label: 'Em Progresso', color: '#8b5cf6' },
  finalizado: { label: 'Finalizado', color: '#22c55e' },
  recusado: { label: 'Recusado', color: '#6b7280' },
};

// Opções simplificadas para o dropdown (sem status legados)
const DROPDOWN_STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_analise', label: 'Em Análise' },
  { value: 'em_progresso', label: 'Em Progresso' },
  { value: 'finalizado', label: 'Finalizado' },
  { value: 'recusado', label: 'Recusado' },
];

const TIPO_CONFIG = {
  processo: { label: 'Processo', icon: '⚙️' },
  plataforma: { label: 'Plataforma', icon: '💻' },
  sugestao: { label: 'Sugestão', icon: '💡' },
  outro: { label: 'Outro', icon: '📝' },
};

// Colunas do Kanban (ordem de exibição)
// statuses pode ser um array para agrupar múltiplos status em uma coluna
const KANBAN_COLUMNS = [
  { statuses: ['pendente'], label: 'Pendentes', color: '#f59e0b' },
  { statuses: ['em_analise'], label: 'Em Análise', color: '#3b82f6' },
  { statuses: ['em_progresso', 'backlog_desenvolvimento', 'backlog_treinamento', 'analise_funcionalidade'], label: 'Em Progresso', color: '#8b5cf6' },
  { statuses: ['finalizado'], label: 'Finalizados', color: '#22c55e' },
  { statuses: ['recusado'], label: 'Recusados', color: '#6b7280' },
];

// === ICONS ===
const Icons = {
  MessageSquare: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  List: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
  Kanban: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="5" height="18" rx="1"/>
      <rect x="10" y="3" width="5" height="12" rx="1"/>
      <rect x="17" y="3" width="5" height="8" rx="1"/>
    </svg>
  ),
  Lock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  Clock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  CheckCircle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  AlertCircle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  Refresh: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6"/>
      <path d="M1 20v-6h6"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  ),
  Search: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  User: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Calendar: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
};

// === HELPERS ===
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

function getInitials(name) {
  if (!name || name === 'Anônimo') return 'AN';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// === COMPONENTE PRINCIPAL ===
export default function FeedbackAdminView() {
  const { user, hasFullAccess } = useAuth();
  const canEdit = hasFullAccess; // dev, director, ou admin podem editar
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Vista: 'list' ou 'kanban'
  const [viewMode, setViewMode] = useState('list');

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [editAnalysis, setEditAnalysis] = useState('');
  const [editAction, setEditAction] = useState('');
  const [updating, setUpdating] = useState(false);

  // Mapa de email -> nome do usuário
  const [usersMap, setUsersMap] = useState({});

  // Drag and drop
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // === FETCH ===
  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Buscar feedbacks e usuários em paralelo
      const [feedbacksRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/api/feedbacks`, { credentials: 'include' }),
        fetch(`${API_URL}/api/ind/admin/users`, { credentials: 'include' }),
      ]);

      if (!feedbacksRes.ok) throw new Error('Erro ao carregar feedbacks');
      const feedbacksData = await feedbacksRes.json();
      setFeedbacks(feedbacksData.data || []);

      // Criar mapa de email -> nome
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        const emailToName = {};
        (usersData.data || usersData || []).forEach((u) => {
          if (u.email) {
            emailToName[u.email.toLowerCase()] = u.name || u.nome;
          }
        });
        setUsersMap(emailToName);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  // === MODAL HANDLERS ===
  // Normaliza status legados para "em_progresso" no dropdown
  const normalizeStatus = (status) => {
    const legacyStatuses = ['backlog_desenvolvimento', 'backlog_treinamento', 'analise_funcionalidade'];
    return legacyStatuses.includes(status) ? 'em_progresso' : status;
  };

  const openModal = (feedback) => {
    setSelectedFeedback(feedback);
    setEditStatus(normalizeStatus(feedback.status));
    setEditAnalysis(feedback.admin_analysis || '');
    setEditAction(feedback.admin_action || '');
  };

  const closeModal = () => {
    setSelectedFeedback(null);
    setEditStatus('');
    setEditAnalysis('');
    setEditAction('');
  };

  const handleSave = async () => {
    if (!selectedFeedback) return;

    setUpdating(true);
    try {
      const response = await fetch(`${API_URL}/api/feedbacks/${selectedFeedback.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: editStatus,
          admin_analysis: editAnalysis || null,
          admin_action: editAction || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar alterações');
      }

      // Update local state
      const updated = {
        ...selectedFeedback,
        status: editStatus,
        admin_analysis: editAnalysis || null,
        admin_action: editAction || null,
      };

      setFeedbacks((prev) =>
        prev.map((f) => (f.id === selectedFeedback.id ? updated : f))
      );
      closeModal();
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const hasChanges = selectedFeedback && (
    editStatus !== selectedFeedback.status ||
    editAnalysis !== (selectedFeedback.admin_analysis || '') ||
    editAction !== (selectedFeedback.admin_action || '')
  );

  // === DRAG AND DROP ===
  const handleDragStart = (e, feedback) => {
    if (!canEdit) return;
    setDraggingId(feedback.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', feedback.id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e, columnLabel) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnLabel);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e, column) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!canEdit || !draggingId) return;

    const feedback = feedbacks.find((f) => f.id === draggingId);
    if (!feedback) return;

    // Se já está na mesma coluna, não fazer nada
    if (column.statuses.includes(feedback.status)) {
      setDraggingId(null);
      return;
    }

    // Para colunas com múltiplos status, usar o primeiro
    const newStatus = column.statuses[0];

    try {
      const response = await fetch(`${API_URL}/api/feedbacks/${feedback.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar status');
      }

      // Update local state
      setFeedbacks((prev) =>
        prev.map((f) => (f.id === feedback.id ? { ...f, status: newStatus } : f))
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setDraggingId(null);
    }
  };

  // === FILTERS ===
  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((feedback) => {
      if (filterStatus) {
        // Se filtrar por "em_progresso", incluir status legados também
        if (filterStatus === 'em_progresso') {
          const progressStatuses = ['em_progresso', 'backlog_desenvolvimento', 'backlog_treinamento', 'analise_funcionalidade'];
          if (!progressStatuses.includes(feedback.status)) return false;
        } else if (feedback.status !== filterStatus) {
          return false;
        }
      }
      if (filterTipo && feedback.tipo !== filterTipo) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        // Buscar também pelo nome no cadastro de usuários
        const nameFromUsers = feedback.author_email
          ? usersMap[feedback.author_email.toLowerCase()]
          : null;
        return (
          feedback.titulo?.toLowerCase().includes(search) ||
          feedback.feedback_text?.toLowerCase().includes(search) ||
          feedback.author_name?.toLowerCase().includes(search) ||
          feedback.author_email?.toLowerCase().includes(search) ||
          nameFromUsers?.toLowerCase().includes(search)
        );
      }
      return true;
    });
  }, [feedbacks, filterStatus, filterTipo, searchTerm, usersMap]);

  // === STATS ===
  const stats = useMemo(() => ({
    total: feedbacks.length,
    pendentes: feedbacks.filter((f) => f.status === 'pendente').length,
    emProgresso: feedbacks.filter((f) =>
      ['em_analise', 'em_progresso', 'backlog_desenvolvimento', 'backlog_treinamento', 'analise_funcionalidade'].includes(f.status)
    ).length,
    finalizados: feedbacks.filter((f) => f.status === 'finalizado').length,
  }), [feedbacks]);

  const hasActiveFilters = filterStatus || filterTipo || searchTerm;

  const clearFilters = () => {
    setFilterStatus('');
    setFilterTipo('');
    setSearchTerm('');
  };

  // Obter nome do autor (busca no cadastro se não tiver nome mas tiver email)
  const getAuthorDisplayName = useCallback((feedback) => {
    if (feedback.author_name) return feedback.author_name;
    if (feedback.author_email) {
      const nameFromUsers = usersMap[feedback.author_email.toLowerCase()];
      if (nameFromUsers) return nameFromUsers;
    }
    return 'Anônimo';
  }, [usersMap]);

  // === RENDER ===
  if (loading) {
    return (
      <div className="feedback-admin">
        <div className="feedback-admin__loading">Carregando feedbacks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="feedback-admin">
        <div className="glass-card feedback-admin__error">
          <h3>Erro ao carregar dados</h3>
          <p>{error}</p>
          <button onClick={fetchFeedbacks} className="btn-refresh">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-admin">
      {/* Header */}
      <div className="feedback-admin__header">
        <div className="feedback-admin__title-section">
          <h2>Gerenciar Feedbacks</h2>
          <p>
            {canEdit
              ? 'Analise e responda os feedbacks da plataforma'
              : 'Visualize os feedbacks da plataforma (somente leitura)'}
          </p>
        </div>
        <div className="header-actions">
          {/* View Toggle */}
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="Vista de Lista"
            >
              <Icons.List />
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`}
              onClick={() => setViewMode('kanban')}
              title="Vista Kanban"
            >
              <Icons.Kanban />
            </button>
          </div>
          <button onClick={fetchFeedbacks} className="btn-refresh">
            <Icons.Refresh />
            Atualizar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="feedback-admin__stats">
        <div className="stat-card">
          <div className="stat-icon">
            <Icons.MessageSquare />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total</span>
          </div>
        </div>
        <div className="stat-card highlight-orange">
          <div className="stat-icon">
            <Icons.AlertCircle />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.pendentes}</span>
            <span className="stat-label">Pendentes</span>
          </div>
        </div>
        <div className="stat-card highlight-blue">
          <div className="stat-icon">
            <Icons.Clock />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.emProgresso}</span>
            <span className="stat-label">Em Progresso</span>
          </div>
        </div>
        <div className="stat-card highlight-green">
          <div className="stat-icon">
            <Icons.CheckCircle />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.finalizados}</span>
            <span className="stat-label">Finalizados</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card feedback-admin__filters">
        <div className="filters-row">
          <div className="filter-group">
            <label className="filter-label">Status</label>
            <select
              className="filter-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Todos</option>
              {DROPDOWN_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Tipo</label>
            <select
              className="filter-select"
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
            >
              <option value="">Todos</option>
              {Object.entries(TIPO_CONFIG).map(([value, config]) => (
                <option key={value} value={value}>{config.icon} {config.label}</option>
              ))}
            </select>
          </div>

          <div className="filter-group filter-group--search">
            <label className="filter-label">Buscar</label>
            <div className="search-wrapper">
              <span className="search-icon"><Icons.Search /></span>
              <input
                type="text"
                className="filter-input"
                placeholder="Buscar por título, texto ou autor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="filters-footer">
          <span className="results-count">
            Mostrando <strong>{filteredFeedbacks.length}</strong> de{' '}
            <strong>{feedbacks.length}</strong> feedbacks
          </span>
          {hasActiveFilters && (
            <button className="btn-clear-filters" onClick={clearFilters}>
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Content - List or Kanban */}
      {viewMode === 'list' ? (
        /* List View */
        <div className="glass-card feedback-admin__table-wrapper">
          {filteredFeedbacks.length === 0 ? (
            <div className="feedback-admin__empty">
              <Icons.MessageSquare />
              <p>Nenhum feedback encontrado</p>
            </div>
          ) : (
            <table className="feedback-admin__table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Feedback</th>
                  <th>Autor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredFeedbacks.map((feedback) => {
                  const statusConfig = STATUS_CONFIG[feedback.status] || STATUS_CONFIG.pendente;
                  const tipoConfig = TIPO_CONFIG[feedback.tipo] || TIPO_CONFIG.outro;

                  return (
                    <tr
                      key={feedback.id}
                      onClick={() => openModal(feedback)}
                      className="feedback-row"
                    >
                      <td className="cell-date">
                        <span className="date-day">{formatDateShort(feedback.created_at)}</span>
                      </td>
                      <td>
                        <span className={`tipo-badge tipo-badge--${feedback.tipo || 'outro'}`}>
                          <span className="tipo-icon">{tipoConfig.icon}</span>
                          {tipoConfig.label}
                        </span>
                      </td>
                      <td className="cell-content">
                        <span className="feedback-title">
                          {feedback.titulo || feedback.feedback_text?.substring(0, 60) + '...'}
                        </span>
                      </td>
                      <td className="cell-author">
                        <div className="author-cell">
                          <div className="author-avatar">
                            {getInitials(getAuthorDisplayName(feedback))}
                          </div>
                          <div className="author-info">
                            <span className="author-name">{getAuthorDisplayName(feedback)}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className="status-badge"
                        style={{ '--status-color': statusConfig.color }}
                      >
                        <span className="status-dot"></span>
                        {statusConfig.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        /* Kanban View */
        <div className="feedback-admin-kanban">
          {KANBAN_COLUMNS.map((column) => {
            const columnFeedbacks = filteredFeedbacks.filter(
              (f) => column.statuses.includes(f.status)
            );
            const isDropTarget = dragOverColumn === column.label && draggingId;

            return (
              <div
                key={column.label}
                className={`kanban-column ${isDropTarget ? 'drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, column.label)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column)}
              >
                <div
                  className="kanban-column-header"
                  style={{ '--column-color': column.color }}
                >
                  <span className="kanban-column-title">{column.label}</span>
                  <span className="kanban-column-count">{columnFeedbacks.length}</span>
                </div>
                <div className="kanban-column-content">
                  {columnFeedbacks.length === 0 ? (
                    <div className="kanban-empty">
                      {isDropTarget ? 'Solte aqui' : 'Nenhum item'}
                    </div>
                  ) : (
                    columnFeedbacks.map((feedback) => {
                      const tipoConfig = TIPO_CONFIG[feedback.tipo] || TIPO_CONFIG.outro;
                      const isDragging = draggingId === feedback.id;
                      return (
                        <div
                          key={feedback.id}
                          className={`kanban-card ${isDragging ? 'dragging' : ''} ${canEdit ? 'draggable' : ''}`}
                          draggable={canEdit}
                          onDragStart={(e) => handleDragStart(e, feedback)}
                          onDragEnd={handleDragEnd}
                          onClick={() => openModal(feedback)}
                        >
                          <div className="kanban-card-header">
                            <span className={`tipo-badge tipo-badge--${feedback.tipo || 'outro'}`}>
                              <span className="tipo-icon">{tipoConfig.icon}</span>
                              {tipoConfig.label}
                            </span>
                            <span className="kanban-card-date">
                              {formatDateShort(feedback.created_at)}
                            </span>
                          </div>
                          <p className="kanban-card-text">
                            {feedback.titulo || feedback.feedback_text?.substring(0, 80) + '...'}
                          </p>
                          <div className="kanban-card-footer">
                            <div className="author-cell compact">
                              <div className="author-avatar small">
                                {getInitials(getAuthorDisplayName(feedback))}
                              </div>
                              <span className="author-name">
                                {getAuthorDisplayName(feedback)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {selectedFeedback && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content feedback-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-info">
                <div className="modal-badges">
                  <span
                    className="status-badge"
                    style={{ '--status-color': STATUS_CONFIG[selectedFeedback.status]?.color }}
                  >
                    <span className="status-dot"></span>
                    {STATUS_CONFIG[selectedFeedback.status]?.label}
                  </span>
                  <span className={`tipo-badge tipo-badge--${selectedFeedback.tipo || 'outro'}`}>
                    <span className="tipo-icon">{TIPO_CONFIG[selectedFeedback.tipo]?.icon}</span>
                    {TIPO_CONFIG[selectedFeedback.tipo]?.label}
                  </span>
                </div>
                {selectedFeedback.titulo && (
                  <h3 className="modal-title">{selectedFeedback.titulo}</h3>
                )}
              </div>
              <button className="modal-close" onClick={closeModal}>
                <Icons.X />
              </button>
            </div>

            <div className="modal-body">
              {/* Author & Date */}
              <div className="feedback-meta">
                <div className="feedback-author">
                  <div className="author-avatar large">
                    {getInitials(getAuthorDisplayName(selectedFeedback))}
                  </div>
                  <div className="author-details">
                    <span className="author-name">{getAuthorDisplayName(selectedFeedback)}</span>
                    {selectedFeedback.author_email && (
                      <span className="author-email">{selectedFeedback.author_email}</span>
                    )}
                  </div>
                </div>
                <div className="feedback-date">
                  <Icons.Calendar />
                  <span>{formatDate(selectedFeedback.created_at)}</span>
                </div>
              </div>

              {/* Feedback Content */}
              <div className="feedback-content-section">
                <h4>Feedback</h4>
                <p className="feedback-text">{selectedFeedback.feedback_text}</p>
              </div>

              {/* Admin Section */}
              <div className="admin-section">
                <div className="admin-section-header">
                  <h4>Gerenciamento (Admin)</h4>
                  {!canEdit && (
                    <span className="readonly-badge">
                      <Icons.Lock />
                      Somente leitura
                    </span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    disabled={updating || !canEdit}
                  >
                    {DROPDOWN_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label className="form-label">Análise</label>
                  <textarea
                    className="form-textarea"
                    value={editAnalysis}
                    onChange={(e) => setEditAnalysis(e.target.value)}
                    placeholder={canEdit ? 'Descreva sua análise sobre este feedback...' : 'Nenhuma análise registrada'}
                    rows={3}
                    disabled={updating || !canEdit}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Ação a tomar</label>
                  <textarea
                    className="form-textarea"
                    value={editAction}
                    onChange={(e) => setEditAction(e.target.value)}
                    placeholder={canEdit ? 'Descreva a ação que será tomada...' : 'Nenhuma ação registrada'}
                    rows={3}
                    disabled={updating || !canEdit}
                  />
                </div>
              </div>

              {selectedFeedback.resolved_by && (
                <div className="resolved-info">
                  Última atualização por {selectedFeedback.resolved_by}
                  {selectedFeedback.resolved_at && (
                    <> em {formatDate(selectedFeedback.resolved_at)}</>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={closeModal} disabled={updating}>
                {canEdit ? 'Cancelar' : 'Fechar'}
              </button>
              {canEdit && (
                <button
                  className="btn-save"
                  onClick={handleSave}
                  disabled={updating || !hasChanges}
                >
                  {updating ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
