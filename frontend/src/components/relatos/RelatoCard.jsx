/**
 * Componente: Card de Relato
 *
 * Exibe um relato individual com badges de tipo e prioridade,
 * data/autor e conteúdo expandível.
 */

import React from 'react';

const TIPO_ICONS = {
  'alert-triangle': '\u26A0',
  'check-circle': '\u2705',
  'x-circle': '\u26D4',
  'info': '\u2139\uFE0F',
};

function RelatoCard({ relato, isExpanded, onToggleExpand, onEdit, onDelete, canEdit }) {
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  return (
    <div
      className={`relato-card ${isExpanded ? 'relato-card-expanded' : ''} ${relato.is_resolved ? 'relato-card-resolved' : ''}`}
      style={{ borderLeftColor: relato.tipo_color }}
    >
      <div className="relato-card-header" onClick={onToggleExpand}>
        <div className="relato-card-main">
          <div className="relato-card-title-row">
            <span className="relato-card-icon">
              {TIPO_ICONS[relato.tipo_slug === 'risco' ? 'alert-triangle' :
                relato.tipo_slug === 'decisao' ? 'check-circle' :
                relato.tipo_slug === 'bloqueio' ? 'x-circle' : 'info'] || '\u2139\uFE0F'}
            </span>
            <span className="relato-card-titulo">{relato.titulo}</span>
            <span
              className="relato-badge relato-badge-tipo"
              style={{ backgroundColor: relato.tipo_color, color: '#fff' }}
            >
              {relato.tipo_label}
            </span>
            <span
              className="relato-badge relato-badge-prioridade"
              style={{
                backgroundColor: relato.prioridade_color + '20',
                color: relato.prioridade_color,
                border: `1px solid ${relato.prioridade_color}`,
              }}
            >
              {relato.prioridade_label?.toUpperCase()}
            </span>
          </div>
          <div className="relato-card-meta">
            <span className="relato-card-date">{formatDate(relato.created_at)}</span>
            {relato.author_name && (
              <>
                <span className="relato-card-separator">&bull;</span>
                <span className="relato-card-author">{relato.author_name}</span>
              </>
            )}
            {relato.is_resolved && (
              <span className="relato-card-resolved-badge">Resolvido</span>
            )}
          </div>
        </div>
        <span className={`relato-card-chevron ${isExpanded ? 'relato-card-chevron-open' : ''}`}>
          &#9660;
        </span>
      </div>

      {isExpanded && (
        <div className="relato-card-body">
          <p className="relato-card-descricao">{relato.descricao}</p>
          {canEdit && (
            <div className="relato-card-actions">
              <button className="relato-action-btn relato-action-edit" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                Editar
              </button>
              <button className="relato-action-btn relato-action-delete" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                Remover
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RelatoCard;
