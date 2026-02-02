import React from 'react';
import './FeedbackCard.css';

/**
 * Status colors for visual identification
 */
const STATUS_CONFIG = {
  pendente: { label: 'Pendente', color: '#f59e0b' },
  em_analise: { label: 'Em Análise', color: '#3b82f6' },
  backlog_desenvolvimento: { label: 'Backlog Dev', color: '#8b5cf6' },
  backlog_treinamento: { label: 'Backlog Treino', color: '#ec4899' },
  analise_funcionalidade: { label: 'Análise Func.', color: '#06b6d4' },
  finalizado: { label: 'Finalizado', color: '#22c55e' },
  recusado: { label: 'Recusado', color: '#6b7280' }
};

const TIPO_CONFIG = {
  processo: { label: 'Processo', icon: '⚙️' },
  plataforma: { label: 'Plataforma', icon: '💻' },
  sugestao: { label: 'Sugestão', icon: '💡' },
  outro: { label: 'Outro', icon: '📝' }
};

/**
 * Formata data para exibição
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
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
 * Card de feedback para visualização em Kanban
 * @param {Object} props
 * @param {Object} props.feedback - Dados do feedback
 * @param {boolean} props.isOwn - Se é do próprio usuário
 * @param {Function} props.onClick - Callback ao clicar
 */
export default function FeedbackCard({ feedback, isOwn = false, onClick }) {
  const statusConfig = STATUS_CONFIG[feedback.status] || STATUS_CONFIG.pendente;
  const tipoConfig = TIPO_CONFIG[feedback.tipo] || TIPO_CONFIG.outro;

  const handleClick = () => {
    if (onClick) onClick(feedback);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  // Trunca o texto do feedback para 3 linhas (~120 chars)
  const truncatedText = feedback.feedback_text?.length > 120
    ? feedback.feedback_text.substring(0, 120) + '...'
    : feedback.feedback_text;

  return (
    <div
      className={`feedback-card glass-card ${isOwn ? 'feedback-card--own' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Feedback: ${feedback.titulo || truncatedText}`}
    >
      {/* Header: Status + Tipo + Data */}
      <div className="feedback-card__header">
        <div className="feedback-card__badges">
          <span
            className="feedback-card__status"
            style={{ '--status-color': statusConfig.color }}
          >
            {statusConfig.label}
          </span>
          <span className="feedback-card__tipo">
            <span className="feedback-card__tipo-icon">{tipoConfig.icon}</span>
            {tipoConfig.label}
          </span>
        </div>
        <span className="feedback-card__date">{formatDate(feedback.created_at)}</span>
      </div>

      {/* Body: Título (se houver) + Texto */}
      <div className="feedback-card__body">
        {feedback.titulo && (
          <h4 className="feedback-card__title">{feedback.titulo}</h4>
        )}
        <p className="feedback-card__text">{truncatedText}</p>
      </div>

      {/* Footer: Avatar + Nome do autor */}
      <div className="feedback-card__footer">
        <div className="feedback-card__author">
          <div
            className="feedback-card__avatar"
            title={feedback.author_email}
          >
            {getInitials(feedback.author_name, feedback.author_email)}
          </div>
          <span className="feedback-card__author-name">
            {feedback.author_name || feedback.author_email?.split('@')[0] || 'Anônimo'}
          </span>
        </div>
        {feedback.admin_analysis && (
          <span className="feedback-card__has-response" title="Tem resposta do admin">
            💬
          </span>
        )}
      </div>

      {/* Indicador de próprio */}
      {isOwn && (
        <div className="feedback-card__own-indicator" title="Seu feedback">
          ⭐
        </div>
      )}
    </div>
  );
}

/**
 * Retorna a configuração de status para uso externo
 */
export { STATUS_CONFIG, TIPO_CONFIG };
