import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import FeedbackCard, { STATUS_CONFIG, TYPE_CONFIG, CATEGORY_CONFIG } from '../../components/feedbacks/FeedbackCard';
import FeedbackDetailDialog from '../../components/feedbacks/FeedbackDetailDialog';
import MentionInput from '../../components/feedbacks/MentionInput';
import './FeedbackKanbanView.css';

const FeedbackAnalyticsView = lazy(() => import('./FeedbackAnalyticsView'));

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Tipos ocultos na vista da equipe (visíveis apenas na vista admin)
 */
const HIDDEN_TYPES = new Set(['bug', 'erro', 'outro']);

/**
 * Páginas da plataforma para seleção no feedback tipo Plataforma
 */
const PLATFORM_PAGES = [
  { value: 'lideres-projeto', label: 'Líderes de Projeto' },
  { value: 'cs', label: 'CS' },
  { value: 'apoio-projetos', label: 'Apoio de Projetos' },
  { value: 'projetos', label: 'Projetos' },
  { value: 'indicadores', label: 'Indicadores' },
  { value: 'okrs', label: 'OKRs' },
  { value: 'gestao-tarefas', label: 'Gestão de Tarefas' },
  { value: 'configuracoes', label: 'Configurações' },
  { value: 'admin-financeiro', label: 'Admin & Financeiro' },
  { value: 'vendas', label: 'Vendas' },
  { value: 'vista-cliente', label: 'Vista do Cliente' },
];

/**
 * Mapeamento de area prop → page_url para pré-preencher o dropdown
 */
const AREA_TO_PAGE = {
  projetos: 'projetos',
  lideres: 'lideres-projeto',
  cs: 'cs',
  apoio: 'apoio-projetos',
  admin_financeiro: 'admin-financeiro',
  indicadores: 'indicadores',
  okrs: 'okrs',
  workspace: 'gestao-tarefas',
  configuracoes: 'configuracoes',
  vendas: 'vendas',
  vista_cliente: 'vista-cliente',
};

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
export default function FeedbackKanbanView({ area = null }) {
  const { user, isPrivileged } = useAuth();
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('todos'); // 'todos' ou 'meus'
  const [categoryFilter, setCategoryFilter] = useState(''); // Filtro por categoria
  const [authorFilter, setAuthorFilter] = useState(''); // Filtro por autor
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'indicadores'
  const isGestao = !area; // Gestão de Feedbacks (sem filtro de área)

  // Tipo Processo só disponível na vista de Projetos
  const showProcessType = area === 'projetos';
  const defaultType = showProcessType ? 'feedback_processo' : 'feedback_plataforma';
  const defaultPage = AREA_TO_PAGE[area] || null;

  // Form state
  const [formData, setFormData] = useState({
    type: defaultType,
    titulo: '',
    feedback_text: '',
    screenshot_url: null,
    page_url: defaultType === 'feedback_plataforma' ? defaultPage : null
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
      const params = new URLSearchParams();
      if (area) params.set('area', area);
      const queryString = params.toString();
      const response = await fetch(`${API_URL}/api/feedbacks${queryString ? '?' + queryString : ''}`, {
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
  }, [area]);

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
        body: JSON.stringify({ ...formData, area })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar feedback');
      }

      // Reset form and refresh
      setFormData({ type: defaultType, titulo: '', feedback_text: '', screenshot_url: null, page_url: defaultType === 'feedback_plataforma' ? defaultPage : null });
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

  // Filter feedbacks - excluir tipos ocultos (bug, erro, outro)
  const visibleFeedbacks = feedbacks.filter(f => !HIDDEN_TYPES.has(f.type));

  let filteredFeedbacks = filter === 'meus'
    ? visibleFeedbacks.filter(f => f.author_email === user?.email)
    : visibleFeedbacks;

  // Apply category filter
  if (categoryFilter) {
    filteredFeedbacks = filteredFeedbacks.filter(f => f.category === categoryFilter);
  }

  // Apply author filter
  if (authorFilter) {
    filteredFeedbacks = filteredFeedbacks.filter(f => f.author_id === authorFilter);
  }

  // Unique authors for filter dropdown
  const uniqueAuthors = [...new Map(
    visibleFeedbacks
      .filter(f => f.author_id)
      .map(f => [f.author_id, { id: f.author_id, name: f.author_name || f.author_email?.split('@')[0] || 'Desconhecido' }])
  ).values()].sort((a, b) => a.name.localeCompare(b.name));

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

  // Stats (contam apenas feedbacks visíveis)
  const stats = {
    total: visibleFeedbacks.length,
    meus: visibleFeedbacks.filter(f => f.author_email === user?.email).length
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
          <h1>{isGestao ? 'Gestão de Feedbacks' : 'Feedbacks'}</h1>
        </div>

        {isGestao && (
          <div className="feedback-kanban__view-toggle">
            <button
              className={`feedback-kanban__view-btn ${viewMode === 'kanban' ? 'active' : ''}`}
              onClick={() => setViewMode('kanban')}
              title="Quadro Kanban"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="5" height="18" rx="1"/>
                <rect x="10" y="3" width="5" height="12" rx="1"/>
                <rect x="17" y="3" width="5" height="8" rx="1"/>
              </svg>
            </button>
            <button
              className={`feedback-kanban__view-btn ${viewMode === 'indicadores' ? 'active' : ''}`}
              onClick={() => setViewMode('indicadores')}
              title="Indicadores"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            </button>
          </div>
        )}

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

        <select
          className="feedback-kanban__category-filter"
          value={authorFilter}
          onChange={(e) => setAuthorFilter(e.target.value)}
          title="Filtrar por autor"
        >
          <option value="">Todos autores</option>
          {uniqueAuthors.map(author => (
            <option key={author.id} value={author.id}>{author.name}</option>
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

      {/* View: Kanban ou Indicadores */}
      {viewMode === 'indicadores' && isGestao ? (
        <Suspense fallback={<div className="feedback-kanban__loading"><div className="spinner"></div></div>}>
          <FeedbackAnalyticsView feedbacks={feedbacks} />
        </Suspense>
      ) : (
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
      )}

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
        <div className="feedback-dialog-overlay">
          <div className="feedback-dialog">
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
              {/* Type Selection - apenas Processo e Plataforma */}
              <div className="feedback-dialog__field">
                <label className="feedback-dialog__label">Tipo</label>
                <div className="feedback-dialog__type-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  {Object.entries(TYPE_CONFIG)
                    .filter(([value]) => !HIDDEN_TYPES.has(value))
                    .filter(([value]) => showProcessType || value !== 'feedback_processo')
                    .map(([value, config]) => (
                      <button
                        key={value}
                        type="button"
                        className={`feedback-dialog__type-btn ${formData.type === value ? 'feedback-dialog__type-btn--active' : ''}`}
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          type: value,
                          page_url: value === 'feedback_plataforma' ? (prev.page_url || defaultPage) : null
                        }))}
                      >
                        <span className="feedback-dialog__type-icon">{config.icon}</span>
                        <span className="feedback-dialog__type-label">{config.label}</span>
                      </button>
                    ))}
                </div>
              </div>

              {/* Page Selection - apenas para tipo Plataforma */}
              {formData.type === 'feedback_plataforma' && (
                <div className="feedback-dialog__field">
                  <label className="feedback-dialog__label" htmlFor="feedback-page">
                    Página da plataforma
                  </label>
                  <select
                    id="feedback-page"
                    className="feedback-dialog__input"
                    value={formData.page_url || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      page_url: e.target.value || null
                    }))}
                  >
                    <option value="">Selecione a página...</option>
                    {PLATFORM_PAGES.map(page => (
                      <option key={page.value} value={page.value}>{page.label}</option>
                    ))}
                  </select>
                </div>
              )}

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
