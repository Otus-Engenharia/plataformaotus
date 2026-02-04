import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import FeedbackCard, { STATUS_CONFIG, TYPE_CONFIG, CATEGORY_CONFIG } from '../../components/feedbacks/FeedbackCard';
import FeedbackDetailDialog from '../../components/feedbacks/FeedbackDetailDialog';
import MentionInput from '../../components/feedbacks/MentionInput';
import './FeedbackKanbanView.css';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Agrupamento de status para as colunas do Kanban
 */
const KANBAN_COLUMNS = [
  {
    id: 'novos',
    title: 'Novos',
    statuses: ['pendente'],
    color: '#f59e0b'
  },
  {
    id: 'em_andamento',
    title: 'Em Andamento',
    statuses: ['em_analise', 'backlog_desenvolvimento', 'backlog_treinamento', 'analise_funcionalidade'],
    color: '#3b82f6'
  },
  {
    id: 'finalizados',
    title: 'Finalizados',
    statuses: ['finalizado'],
    color: '#22c55e'
  },
  {
    id: 'recusados',
    title: 'Recusados',
    statuses: ['recusado'],
    color: '#6b7280'
  }
];

/**
 * Vista Kanban de Feedbacks para a equipe
 */
export default function FeedbackKanbanView() {
  const { user, isPrivileged } = useAuth();
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('todos'); // 'todos' ou 'meus'
  const [categoryFilter, setCategoryFilter] = useState(''); // Filtro por categoria
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    type: 'feedback_processo',
    titulo: '',
    feedback_text: '',
    screenshot_url: null
  });
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Handle screenshot upload
  const handleScreenshotChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('A imagem deve ter no máximo 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result);
        setFormData(prev => ({ ...prev, screenshot_url: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeScreenshot = () => {
    setScreenshotPreview(null);
    setFormData(prev => ({ ...prev, screenshot_url: null }));
  };

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/feedbacks`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Erro ao carregar feedbacks');
      }
      setFeedbacks(data.data || []);
    } catch (err) {
      console.error('Erro ao carregar feedbacks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  const handleCreateFeedback = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/api/feedbacks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar feedback');
      }

      // Reset form and refresh
      setFormData({ type: 'feedback_processo', titulo: '', feedback_text: '', screenshot_url: null });
      setScreenshotPreview(null);
      setShowCreateForm(false);
      fetchFeedbacks();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateFeedback = async (id, updateData) => {
    const response = await fetch(`${API_URL}/api/feedbacks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro ao atualizar feedback');
    }

    fetchFeedbacks();
  };

  // Filter feedbacks
  let filteredFeedbacks = filter === 'meus'
    ? feedbacks.filter(f => f.author_email === user?.email)
    : feedbacks;

  // Apply category filter
  if (categoryFilter) {
    filteredFeedbacks = filteredFeedbacks.filter(f => f.category === categoryFilter);
  }

  // Group feedbacks by Kanban column
  const getColumnFeedbacks = (column) => {
    return filteredFeedbacks.filter(f => column.statuses.includes(f.status));
  };

  // Check if feedback belongs to current user
  const isOwnFeedback = (feedback) => feedback.author_email === user?.email;

  // Callback para quando uma menção @FB-XXX é clicada
  const handleMentionClick = useCallback((code) => {
    // Extrai o número do código (FB-123 -> 123)
    const idMatch = code.match(/FB-(\d+)/i);
    const id = idMatch ? parseInt(idMatch[1], 10) : null;
    const mentioned = id ? feedbacks.find(f => f.id === id) : null;
    if (mentioned) {
      setSelectedFeedback(mentioned);
    } else {
      alert(`Feedback ${code} não encontrado`);
    }
  }, [feedbacks]);

  // Stats
  const stats = {
    total: feedbacks.length,
    meus: feedbacks.filter(f => f.author_email === user?.email).length
  };

  if (loading) {
    return (
      <div className="feedback-kanban">
        <div className="feedback-kanban__loading">
          <div className="spinner"></div>
          <p>Carregando feedbacks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-kanban">
      {/* Toolbar: Título + Tabs + Ações */}
      <div className="feedback-kanban__toolbar">
        <div className="feedback-kanban__title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <h1>Feedbacks</h1>
        </div>

        <div className="feedback-kanban__tabs">
          <button
            className={`feedback-kanban__tab ${filter === 'todos' ? 'active' : ''}`}
            onClick={() => setFilter('todos')}
          >
            Todos
            <span className="feedback-kanban__tab-count">{stats.total}</span>
          </button>
          <button
            className={`feedback-kanban__tab ${filter === 'meus' ? 'active' : ''}`}
            onClick={() => setFilter('meus')}
          >
            Meus Feedbacks
            <span className="feedback-kanban__tab-count">{stats.meus}</span>
          </button>
        </div>

        <select
          className="feedback-kanban__category-filter"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          title="Filtrar por categoria"
        >
          <option value="">Todas categorias</option>
          {Object.entries(CATEGORY_CONFIG).map(([value, config]) => (
            <option key={value} value={value}>{config.label}</option>
          ))}
        </select>

        <div className="feedback-kanban__actions">
          <button
            className="feedback-kanban__refresh"
            onClick={fetchFeedbacks}
            title="Atualizar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
          </button>
          <button
            className="feedback-kanban__create-btn"
            onClick={() => setShowCreateForm(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Novo Feedback
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="feedback-kanban__error">
          <p>{error}</p>
          <button onClick={fetchFeedbacks}>Tentar novamente</button>
        </div>
      )}

      {/* Kanban Board */}
      <div className="feedback-kanban__board">
        {KANBAN_COLUMNS.map(column => {
          const columnFeedbacks = getColumnFeedbacks(column);
          return (
            <div key={column.id} className="feedback-kanban__column">
              <div
                className="feedback-kanban__column-header"
                style={{ '--column-color': column.color }}
              >
                <h3>{column.title}</h3>
                <span className="feedback-kanban__column-count">{columnFeedbacks.length}</span>
              </div>
              <div className="feedback-kanban__column-content">
                {columnFeedbacks.length === 0 ? (
                  <div className="feedback-kanban__empty">
                    Nenhum feedback
                  </div>
                ) : (
                  columnFeedbacks.map(feedback => (
                    <FeedbackCard
                      key={feedback.id}
                      feedback={feedback}
                      isOwn={isOwnFeedback(feedback)}
                      onClick={() => setSelectedFeedback(feedback)}
                      onMentionClick={handleMentionClick}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Dialog */}
      {selectedFeedback && (
        <FeedbackDetailDialog
          feedback={selectedFeedback}
          isPrivileged={isPrivileged}
          onUpdate={handleUpdateFeedback}
          onClose={() => setSelectedFeedback(null)}
          onMentionClick={handleMentionClick}
          feedbacks={feedbacks}
        />
      )}

      {/* Create Form Dialog */}
      {showCreateForm && (
        <div className="feedback-dialog-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="feedback-dialog" onClick={e => e.stopPropagation()}>
            <div className="feedback-dialog__header">
              <div className="feedback-dialog__title-row">
                <svg className="feedback-dialog__header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <h2>Novo Feedback</h2>
              </div>
              <button className="feedback-dialog__close" onClick={() => setShowCreateForm(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form className="feedback-dialog__form" onSubmit={handleCreateFeedback}>
              {/* Type Selection */}
              <div className="feedback-dialog__field">
                <label className="feedback-dialog__label">Tipo</label>
                <div className="feedback-dialog__type-grid">
                  {Object.entries(TYPE_CONFIG).map(([value, config]) => (
                    <button
                      key={value}
                      type="button"
                      className={`feedback-dialog__type-btn ${formData.type === value ? 'feedback-dialog__type-btn--active' : ''}`}
                      onClick={() => setFormData(prev => ({ ...prev, type: value }))}
                    >
                      <span className="feedback-dialog__type-icon">{config.icon}</span>
                      <span className="feedback-dialog__type-label">{config.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div className="feedback-dialog__field">
                <label className="feedback-dialog__label" htmlFor="feedback-titulo">
                  Título <span className="feedback-dialog__optional">(opcional)</span>
                </label>
                <input
                  id="feedback-titulo"
                  type="text"
                  className="feedback-dialog__input"
                  value={formData.titulo}
                  onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                  placeholder="Resumo do seu feedback"
                  maxLength={200}
                />
              </div>

              {/* Description */}
              <div className="feedback-dialog__field">
                <label className="feedback-dialog__label" htmlFor="feedback-text">
                  Descrição <span className="feedback-dialog__required">*</span>
                  <span className="feedback-dialog__hint">Digite @ para mencionar outro feedback</span>
                </label>
                <MentionInput
                  id="feedback-text"
                  className="feedback-dialog__textarea"
                  value={formData.feedback_text}
                  onChange={(val) => setFormData(prev => ({ ...prev, feedback_text: val }))}
                  feedbacks={feedbacks}
                  placeholder="Descreva seu feedback em detalhes..."
                  rows={4}
                  required
                />
              </div>

              {/* Screenshot */}
              <div className="feedback-dialog__field">
                <label className="feedback-dialog__label">
                  Screenshot <span className="feedback-dialog__optional">(opcional)</span>
                </label>
                {screenshotPreview ? (
                  <div className="feedback-dialog__screenshot-preview">
                    <img src={screenshotPreview} alt="Screenshot preview" />
                    <button
                      type="button"
                      className="feedback-dialog__screenshot-remove"
                      onClick={removeScreenshot}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <label className="feedback-dialog__upload">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleScreenshotChange}
                      className="feedback-dialog__upload-input"
                    />
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>Clique ou arraste uma imagem</span>
                    <span className="feedback-dialog__upload-hint">PNG, JPG até 5MB</span>
                  </label>
                )}
              </div>

              {/* Actions */}
              <div className="feedback-dialog__actions">
                <button
                  type="button"
                  className="feedback-dialog__btn feedback-dialog__btn--secondary"
                  onClick={() => setShowCreateForm(false)}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="feedback-dialog__btn feedback-dialog__btn--primary"
                  disabled={submitting || !formData.feedback_text.trim()}
                >
                  {submitting ? 'Enviando...' : 'Enviar Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
