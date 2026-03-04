import React from 'react';
import { RelatoIcon, TIPO_ICON_MAP } from './RelatoIcons';

function RelatoCard({ relato, isExpanded, onToggleExpand, onEdit, onDelete, variant = 'internal' }) {
  const isClient = variant === 'client';

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const iconName = TIPO_ICON_MAP[relato.tipo_slug] || 'info';

  return (
    <div
      className={`relato-card ${isExpanded ? 'relato-card-expanded' : ''} ${relato.is_resolved ? 'relato-card-resolved' : ''}`}
      style={{ borderLeftColor: relato.tipo_color }}
    >
      <div className="relato-card-header" onClick={onToggleExpand}>
        <div className="relato-card-main">
          <div className="relato-card-top-row">
            <span
              className="relato-card-icon-wrapper"
              style={{ backgroundColor: relato.tipo_color + '14' }}
            >
              <RelatoIcon name={iconName} size={15} color={relato.tipo_color} />
            </span>
            <span
              className="relato-badge relato-badge-tipo"
              style={{ backgroundColor: relato.tipo_color, color: '#fff' }}
            >
              {relato.tipo_label}
            </span>
            <span
              className="relato-badge relato-badge-prioridade"
              style={{
                backgroundColor: relato.prioridade_color + '15',
                color: relato.prioridade_color,
                border: `1px solid ${relato.prioridade_color}40`,
              }}
            >
              {relato.prioridade_label}
            </span>
            {relato.code && (
              <span className="relato-card-code">{relato.code}</span>
            )}
            {relato.is_resolved && (
              <span className="relato-card-resolved-badge">
                <RelatoIcon name="check" size={12} color="#15803d" />
                Resolvido
              </span>
            )}
          </div>

          <h4 className="relato-card-titulo">{relato.titulo}</h4>

          {!isExpanded && relato.descricao && (
            <p className="relato-card-preview">{relato.descricao}</p>
          )}

          <div className="relato-card-meta">
            <span className="relato-card-date">{formatDate(relato.created_at)}</span>
            {relato.author_name && (
              <>
                <span className="relato-card-separator">&bull;</span>
                <span className="relato-card-author">{relato.author_name}</span>
              </>
            )}
            {relato.construflow_issue_code && (
              <span className="relato-card-construflow-badge">
                <RelatoIcon name="link" size={11} color="#e65100" />
                {relato.construflow_issue_code}
              </span>
            )}
          </div>
        </div>

        <div className="relato-card-header-actions">
          {!isClient && (
            <button
              className="relato-card-edit-btn"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              title="Editar relato"
            >
              &#9998;
            </button>
          )}
          <span className={`relato-card-chevron ${isExpanded ? 'relato-card-chevron-open' : ''}`}>
            <RelatoIcon name="chevron-down" size={16} color="#9ca3af" />
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="relato-card-body">
          <p className="relato-card-descricao">{relato.descricao}</p>
          {!isClient && (
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
