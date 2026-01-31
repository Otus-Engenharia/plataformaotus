import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import FeedbackCard, { STATUS_CONFIG, TIPO_CONFIG } from '../../components/feedbacks/FeedbackCard';
import FeedbackDetailDialog from '../../components/feedbacks/FeedbackDetailDialog';
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
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    tipo: 'processo',
    titulo: '',
    feedback_text: ''
  });
  const [submitting, setSubmitting] = useState(false);

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
      setFormData({ tipo: 'processo', titulo: '', feedback_text: '' });
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
  const filteredFeedbacks = filter === 'meus'
    ? feedbacks.filter(f => f.author_email === user?.email)
    : feedbacks;

  // Group feedbacks by Kanban column
  const getColumnFeedbacks = (column) => {
    return filteredFeedbacks.filter(f => column.statuses.includes(f.status));
  };

  // Check if feedback belongs to current user
  const isOwnFeedback = (feedback) => feedback.author_email === user?.email;

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
      {/* Header */}
      <div className="feedback-kanban__header">
        <div className="feedback-kanban__title-section">
          <h1>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Feedbacks
          </h1>
          <p>Acompanhe e envie feedbacks sobre processos e plataforma</p>
        </div>

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

      {/* Tabs */}
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
        />
      )}

      {/* Create Form Dialog */}
      {showCreateForm && (
        <div className="dialog-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="dialog-content glass-card" onClick={e => e.stopPropagation()}>
            <div className="dialog-header">
              <h2>Novo Feedback</h2>
              <button className="dialog-close" onClick={() => setShowCreateForm(false)}>&times;</button>
            </div>

            <form className="dialog-form" onSubmit={handleCreateFeedback}>
              <div className="form-group">
                <label htmlFor="feedback-tipo">Tipo *</label>
                <select
                  id="feedback-tipo"
                  value={formData.tipo}
                  onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value }))}
                  required
                >
                  {Object.entries(TIPO_CONFIG).map(([value, config]) => (
                    <option key={value} value={value}>
                      {config.icon} {config.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="feedback-titulo">Título (opcional)</label>
                <input
                  id="feedback-titulo"
                  type="text"
                  value={formData.titulo}
                  onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                  placeholder="Resumo do seu feedback"
                />
              </div>

              <div className="form-group">
                <label htmlFor="feedback-text">Feedback *</label>
                <textarea
                  id="feedback-text"
                  value={formData.feedback_text}
                  onChange={(e) => setFormData(prev => ({ ...prev, feedback_text: e.target.value }))}
                  placeholder="Descreva seu feedback em detalhes..."
                  rows={5}
                  required
                />
              </div>

              <div className="dialog-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreateForm(false)}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
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
