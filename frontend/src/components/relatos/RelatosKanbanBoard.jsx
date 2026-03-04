import React, { useMemo } from 'react';
import RelatoCard from './RelatoCard';

const COLUMN_ORDER = ['risco', 'decisao', 'bloqueio', 'informativo', 'licao-aprendida'];

function RelatosKanbanBoard({ relatos, tipos, filtroTipo, expandedId, onToggleExpand, onEdit, onDelete, variant = 'internal' }) {
  const tipoMap = useMemo(() => {
    const map = {};
    tipos.forEach(t => { map[t.slug] = t; });
    return map;
  }, [tipos]);

  const columns = useMemo(() => {
    const grouped = {};
    COLUMN_ORDER.forEach(slug => { grouped[slug] = []; });

    relatos.forEach(r => {
      if (grouped[r.tipo_slug]) {
        grouped[r.tipo_slug].push(r);
      }
    });

    // Ordenar por created_at DESC (mais recente primeiro)
    Object.values(grouped).forEach(arr => {
      arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    });

    const activeSlugs = filtroTipo ? [filtroTipo] : COLUMN_ORDER;

    return activeSlugs
      .filter(slug => tipoMap[slug])
      .map(slug => ({
        slug,
        label: tipoMap[slug]?.label || slug,
        color: tipoMap[slug]?.color || '#6b7280',
        items: grouped[slug] || [],
      }));
  }, [relatos, tipos, tipoMap, filtroTipo]);

  const isSingleColumn = columns.length === 1;
  const isClient = variant === 'client';

  return (
    <div className={`relatos-kanban ${isSingleColumn ? 'relatos-kanban--single' : ''}`}>
      {columns.map(col => (
        <div key={col.slug} className="relatos-kanban__column">
          <div className="relatos-kanban__column-header" style={{ '--column-color': col.color }}>
            <h4 className="relatos-kanban__column-title">{col.label}</h4>
            <span className="relatos-kanban__column-count">{col.items.length}</span>
          </div>
          <div className="relatos-kanban__column-body">
            {col.items.length === 0 ? (
              <div className="relatos-kanban__empty">Nenhum relato</div>
            ) : (
              col.items.map(relato => (
                <RelatoCard
                  key={relato.id}
                  relato={relato}
                  variant={variant}
                  isExpanded={expandedId === relato.id}
                  onToggleExpand={() => onToggleExpand(relato.id)}
                  onEdit={isClient ? undefined : () => onEdit(relato)}
                  onDelete={isClient ? undefined : () => onDelete(relato.id)}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default RelatosKanbanBoard;
