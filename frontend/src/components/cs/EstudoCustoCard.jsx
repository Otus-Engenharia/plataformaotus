import React from 'react';
import './EstudoCustoCard.css';

const STATUS_CONFIG = {
  pendente: { label: 'Pendente', color: '#f59e0b' },
  em_analise: { label: 'Em Analise', color: '#3b82f6' },
  em_progresso: { label: 'Em Progresso', color: '#06b6d4' },
  aguardando_info: { label: 'Aguardando Info', color: '#8b5cf6' },
  finalizado: { label: 'Finalizado', color: '#22c55e' },
  recusado: { label: 'Recusado', color: '#6b7280' },
};

const PRIORIDADE_CONFIG = {
  baixa: { label: 'Baixa', color: '#6b7280' },
  normal: { label: 'Normal', color: '#3b82f6' },
  alta: { label: 'Alta', color: '#f59e0b' },
  urgente: { label: 'Urgente', color: '#ef4444' },
};

function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}sem`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

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

export default function EstudoCustoCard({
  estudo,
  isOwn = false,
  isDragging = false,
  draggable = false,
  onDragStart,
  onDragEnd,
  onClick,
}) {
  const prioridadeConfig = PRIORIDADE_CONFIG[estudo.prioridade] || PRIORIDADE_CONFIG.normal;

  const handleClick = () => {
    if (onClick) onClick(estudo);
  };

  const authorName = estudo.author_name ||
    estudo.author_email?.split('@')[0] ||
    'Desconhecido';

  const classNames = [
    'eccard',
    isOwn && 'eccard--own',
    isDragging && 'eccard--dragging',
  ].filter(Boolean).join(' ');

  return (
    <article
      className={classNames}
      onClick={handleClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      tabIndex={0}
      role="button"
      aria-label={`Solicitacao: ${estudo.projeto}`}
    >
      {/* Top row */}
      <div className="eccard__top">
        <div className="eccard__meta">
          <span className="eccard__code">EC-{estudo.id}</span>
          {estudo.status_fase && (
            <span className="eccard__fase">{estudo.status_fase}</span>
          )}
        </div>
        <div className="eccard__icons">
          {estudo.link_estudo_custos && (
            <span className="eccard__icon eccard__icon--study" title="Estudo de custos pronto">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <polyline points="16 13 12 17 8 13" />
              </svg>
            </span>
          )}
          {estudo.link_construflow && (
            <span className="eccard__icon eccard__icon--construflow" title="ConstruFlow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </span>
          )}
          <span className="eccard__date">{formatRelativeDate(estudo.created_at)}</span>
        </div>
      </div>

      {/* Projeto */}
      <div className="eccard__projeto">{estudo.projeto}</div>

      {/* Nome do Time */}
      {estudo.nome_time && (
        <div className="eccard__time">{estudo.nome_time}</div>
      )}

      {/* Data Prevista */}
      {estudo.data_prevista_apresentacao && (
        <div className="eccard__data-prevista">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {formatDate(estudo.data_prevista_apresentacao)}
        </div>
      )}

      {/* Footer */}
      <div className="eccard__footer">
        <div className="eccard__author">
          <span className="eccard__avatar">{getInitials(estudo.author_name, estudo.author_email)}</span>
          <span className="eccard__name">{authorName}</span>
        </div>
        <div className="eccard__indicators">
          {estudo.prioridade && estudo.prioridade !== 'normal' && (
            <span
              className="eccard__prioridade"
              style={{ '--pri-color': prioridadeConfig.color }}
              title={prioridadeConfig.label}
            >
              {prioridadeConfig.label}
            </span>
          )}
          {estudo.comment_count > 0 && (
            <span className="eccard__comments" title={`${estudo.comment_count} comentarios`}>
              💬 {estudo.comment_count}
            </span>
          )}
          {isOwn && <span title="Sua solicitacao">⭐</span>}
        </div>
      </div>
    </article>
  );
}

export { STATUS_CONFIG, PRIORIDADE_CONFIG };
