import React from 'react';
import './DemandaCard.css';

const STATUS_CONFIG = {
  pendente: { label: 'Pendente', color: '#f59e0b' },
  em_analise: { label: 'Em Analise', color: '#3b82f6' },
  em_progresso: { label: 'Em Progresso', color: '#06b6d4' },
  aguardando_info: { label: 'Aguardando Info', color: '#8b5cf6' },
  finalizado: { label: 'Finalizado', color: '#22c55e' },
  recusado: { label: 'Recusado', color: '#6b7280' },
};

const CATEGORIA_CONFIG = {
  ajuste_pastas: { label: 'Ajuste de Pastas', icon: '📁', color: '#f59e0b' },
  modelo_federado: { label: 'Modelo Federado', icon: '🏗️', color: '#8b5cf6' },
  regras_modelo_federado: { label: 'Regras do Modelo Federado', icon: '📋', color: '#10b981' },
  modelagem: { label: 'Modelagem', icon: '📐', color: '#3b82f6' },
};

const TIPO_SERVICO_CONFIG = {
  modelagem_compatibilizacao: { label: 'Compatibilização' },
  pranchas_alvenaria: { label: 'Pranchas Alvenaria' },
  pranchas_furacao: { label: 'Pranchas Furação' },
  unir_markups: { label: 'Unir Markups' },
  quantitativo: { label: 'Quantitativo' },
  outro: { label: 'Outro' },
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

export default function DemandaCard({
  demanda,
  isOwn = false,
  isDragging = false,
  draggable = false,
  onDragStart,
  onDragEnd,
  onClick,
}) {
  const categoriaConfig = CATEGORIA_CONFIG[demanda.categoria] || CATEGORIA_CONFIG.modelagem;
  const tipoConfig = demanda.tipo_servico ? TIPO_SERVICO_CONFIG[demanda.tipo_servico] : null;
  const prioridadeConfig = PRIORIDADE_CONFIG[demanda.prioridade] || PRIORIDADE_CONFIG.normal;

  const handleClick = () => {
    if (onClick) onClick(demanda);
  };

  const previewText = demanda.descricao?.length > 80
    ? demanda.descricao.substring(0, 80) + '...'
    : demanda.descricao;

  const authorName = demanda.author_name ||
    demanda.author_email?.split('@')[0] ||
    'Desconhecido';

  const classNames = [
    'dmcard',
    isOwn && 'dmcard--own',
    isDragging && 'dmcard--dragging',
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
      aria-label={`Demanda: ${previewText}`}
    >
      {/* Top row */}
      <div className="dmcard__top">
        <div className="dmcard__meta">
          <span className="dmcard__code">DM-{demanda.id}</span>
          <span
            className="dmcard__categoria"
            style={{ '--cat-color': categoriaConfig.color }}
          >
            {categoriaConfig.icon} {categoriaConfig.label}
          </span>
          {tipoConfig && (
            <span className="dmcard__tipo">{tipoConfig.label}</span>
          )}
        </div>
        <span className="dmcard__date">{formatRelativeDate(demanda.created_at)}</span>
      </div>

      {/* Cliente - Projeto */}
      <div className="dmcard__projeto">{demanda.cliente_projeto}</div>

      {/* Content */}
      <p className="dmcard__text">{previewText}</p>

      {/* Footer */}
      <div className="dmcard__footer">
        <div className="dmcard__author">
          <span className="dmcard__avatar">{getInitials(demanda.author_name, demanda.author_email)}</span>
          <span className="dmcard__name">{authorName}</span>
        </div>
        <div className="dmcard__indicators">
          {demanda.prioridade && demanda.prioridade !== 'normal' && (
            <span
              className="dmcard__prioridade"
              style={{ '--pri-color': prioridadeConfig.color }}
              title={prioridadeConfig.label}
            >
              {prioridadeConfig.label}
            </span>
          )}
          {demanda.comment_count > 0 && (
            <span className="dmcard__comments" title={`${demanda.comment_count} comentários`}>
              💬 {demanda.comment_count}
            </span>
          )}
          {isOwn && <span title="Sua demanda">⭐</span>}
        </div>
      </div>
    </article>
  );
}

export { STATUS_CONFIG, CATEGORIA_CONFIG, TIPO_SERVICO_CONFIG, PRIORIDADE_CONFIG };
