import React, { useState, useEffect } from 'react';
import { STATUS_CONFIG, TYPE_CONFIG, CATEGORY_CONFIG } from './FeedbackCard';
import { renderTextWithMentions } from './FeedbackMention';
import MentionInput from './MentionInput';
import '../indicadores/dialogs/Dialogs.css';
import './FeedbackDetailDialog.css';
import './FeedbackMention.css';

/**
 * Formata data para exibição
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Extrai iniciais do nome para avatar
 */
function getInitials(name, email) {
  if (name) {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return '??';
}

/**
 * Dialog de detalhes do feedback
 * @param {Object} props
 * @param {Object} props.feedback - Dados do feedback
 * @param {boolean} props.isPrivileged - Se o usuário é admin/director
 * @param {Function} props.onUpdate - Callback para atualizar (admin)
 * @param {Function} props.onClose - Callback para fechar
 * @param {Function} props.onMentionClick - Callback quando uma menção @FB-XXX é clicada
 * @param {Array} props.feedbacks - Lista de feedbacks para autocomplete de menções
 */
export default function FeedbackDetailDialog({
  feedback,
  isPrivileged = false,
  onUpdate,
  onClose,
  onMentionClick,
  feedbacks = []
}) {
  const [status, setStatus] = useState(feedback.status);
  const [category, setCategory] = useState(feedback.category || '');
  const [adminAnalysis, setAdminAnalysis] = useState(feedback.admin_analysis || '');
  const [adminAction, setAdminAction] = useState(feedback.admin_action || '');
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const statusConfig = STATUS_CONFIG[feedback.status] || STATUS_CONFIG.pendente;
  const typeConfig = TYPE_CONFIG[feedback.type] || TYPE_CONFIG.outro;
  const categoryConfig = feedback.category ? CATEGORY_CONFIG[feedback.category] : null;

  useEffect(() => {
    // Check if there are changes
    const changed =
      status !== feedback.status ||
      category !== (feedback.category || '') ||
      adminAnalysis !== (feedback.admin_analysis || '') ||
      adminAction !== (feedback.admin_action || '');
    setHasChanges(changed);
  }, [status, category, adminAnalysis, adminAction, feedback]);

  const handleSave = async () => {
    if (!onUpdate) return;

    setLoading(true);
    try {
      await onUpdate(feedback.id, {
        status,
        category: category || null,
        admin_analysis: adminAnalysis || null,
        admin_action: adminAction || null
      });
      onClose();
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      if (hasChanges && isPrivileged) {
        if (window.confirm('Você tem alterações não salvas. Deseja sair?')) {
          onClose();
        }
      } else {
        onClose();
      }
    }
  };

  return (
    <div className="dialog-overlay" onClick={handleOverlayClick}>
      <div className="dialog-content dialog-large glass-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="dialog-header">
          <div className="feedback-detail__header-info">
            <div className="feedback-detail__badges">
              <span className="feedback-detail__code">FB-{feedback.id}</span>
              <span
                className="feedback-detail__status"
                style={{ '--status-color': statusConfig.color }}
              >
                {statusConfig.label}
              </span>
              <span className="feedback-detail__tipo">
                <span className="feedback-detail__tipo-icon">{typeConfig.icon}</span>
                {typeConfig.label}
              </span>
              {categoryConfig && (
                <span
                  className="feedback-detail__category"
                  style={{ '--category-color': categoryConfig.color }}
                >
                  {categoryConfig.label}
                </span>
              )}
            </div>
            {feedback.titulo && (
              <h2 className="feedback-detail__title">{feedback.titulo}</h2>
            )}
          </div>
          <button className="dialog-close" onClick={onClose}>&times;</button>
        </div>

        {/* Content */}
        <div className="feedback-detail__body">
          {/* Author info */}
          <div className="feedback-detail__author-section">
            <div className="feedback-detail__avatar">
              {getInitials(feedback.author_name, feedback.author_email)}
            </div>
            <div className="feedback-detail__author-info">
              <span className="feedback-detail__author-name">
                {feedback.author_name || 'Anônimo'}
              </span>
              <span className="feedback-detail__author-email">
                {feedback.author_email}
              </span>
            </div>
            <span className="feedback-detail__date">
              {formatDate(feedback.created_at)}
            </span>
          </div>

          {/* Feedback content */}
          <div className="feedback-detail__content-section">
            <h4>Feedback</h4>
            <p className="feedback-detail__text">
              {renderTextWithMentions(feedback.feedback_text, onMentionClick)}
            </p>
          </div>

          {/* Screenshot (if exists) */}
          {feedback.screenshot_url && (
            <div className="feedback-detail__screenshot-section">
              <h4>Screenshot</h4>
              <div className="feedback-detail__screenshot">
                <img
                  src={feedback.screenshot_url}
                  alt="Screenshot do feedback"
                  onClick={() => window.open(feedback.screenshot_url, '_blank')}
                />
              </div>
            </div>
          )}

          {/* Admin response (read-only for non-privileged) */}
          {!isPrivileged && (feedback.admin_analysis || feedback.admin_action) && (
            <div className="feedback-detail__response-section">
              <h4>Resposta do Admin</h4>
              {feedback.admin_analysis && (
                <div className="feedback-detail__response-item">
                  <span className="feedback-detail__response-label">Análise</span>
                  <p>{renderTextWithMentions(feedback.admin_analysis, onMentionClick)}</p>
                </div>
              )}
              {feedback.admin_action && (
                <div className="feedback-detail__response-item">
                  <span className="feedback-detail__response-label">Ação a tomar</span>
                  <p>{renderTextWithMentions(feedback.admin_action, onMentionClick)}</p>
                </div>
              )}
              {feedback.resolved_at && (
                <div className="feedback-detail__resolved">
                  Respondido por {feedback.resolved_by} em {formatDate(feedback.resolved_at)}
                </div>
              )}
            </div>
          )}

          {/* Admin edit section */}
          {isPrivileged && (
            <div className="feedback-detail__admin-section">
              <h4>Gerenciamento (Admin)</h4>

              <div className="form-group">
                <label htmlFor="feedback-status">Status</label>
                <select
                  id="feedback-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                    <option key={value} value={value}>{config.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="feedback-category">Categoria (Dev)</label>
                <select
                  id="feedback-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Sem categoria</option>
                  {Object.entries(CATEGORY_CONFIG).map(([value, config]) => (
                    <option key={value} value={value}>{config.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="feedback-analysis">Análise <span className="form-hint">@ para mencionar</span></label>
                <MentionInput
                  id="feedback-analysis"
                  value={adminAnalysis}
                  onChange={setAdminAnalysis}
                  feedbacks={feedbacks}
                  placeholder="Descreva sua análise sobre este feedback..."
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label htmlFor="feedback-action">Ação a tomar <span className="form-hint">@ para mencionar</span></label>
                <MentionInput
                  id="feedback-action"
                  value={adminAction}
                  onChange={setAdminAction}
                  feedbacks={feedbacks}
                  placeholder="Descreva a ação que será tomada..."
                  rows={3}
                />
              </div>

              <div className="dialog-actions">
                <button
                  className="btn-secondary"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={loading || !hasChanges}
                >
                  {loading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          )}

          {/* Non-privileged close button */}
          {!isPrivileged && (
            <div className="dialog-actions">
              <button className="btn-primary" onClick={onClose}>
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
