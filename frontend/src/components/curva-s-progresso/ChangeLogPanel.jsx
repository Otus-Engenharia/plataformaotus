/**
 * Componente: ChangeLogPanel
 * Painel compacto de log de alterações exibido ao lado do gráfico.
 * Somente leitura - edição é feita na aba "Alterações".
 */

import React, { useState } from 'react';
import { getChangeTypeConfig } from './changeLogColors';

function ChangeLogPanel({ changeLog, loading }) {
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [filterType, setFilterType] = useState('all');

  if (loading) {
    return (
      <div className="changelog-panel">
        <div className="changelog-panel-header">
          <h4>Log de Alterações Mensais</h4>
        </div>
        <div className="changelog-panel-loading">Carregando...</div>
      </div>
    );
  }

  if (!changeLog || !changeLog.month_pairs || changeLog.month_pairs.length === 0) {
    return (
      <div className="changelog-panel">
        <div className="changelog-panel-header">
          <h4>Log de Alterações Mensais</h4>
        </div>
        <div className="changelog-panel-empty">
          Nenhuma alteração detectada entre os reprogramados mensais.
        </div>
      </div>
    );
  }

  const { month_pairs, overall_summary } = changeLog;

  const filteredPairs = month_pairs.map(pair => {
    if (filterType === 'all') return pair;
    return {
      ...pair,
      changes: pair.changes.filter(c => c.type === filterType),
    };
  }).filter(pair => pair.changes.length > 0);

  return (
    <div className="changelog-panel">
      <div className="changelog-panel-header">
        <h4>Log de Alterações Mensais</h4>
        <select
          className="changelog-filter-select"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="all">Todos os tipos</option>
          <option value="DESVIO_PRAZO">Desvios de Prazo</option>
          <option value="TAREFA_CRIADA">Tarefas Criadas</option>
          <option value="TAREFA_DELETADA">Tarefas Removidas</option>
          <option value="TAREFA_NAO_FEITA">Não Feitas</option>
        </select>
      </div>

      <div className="changelog-panel-summary">
        Total: {overall_summary.total_changes} alterações
        {overall_summary.total_desvios > 0 && (
          <span className="changelog-summary-chip" style={{ color: '#EF4444' }}>
            Desvios: {overall_summary.total_desvios}
          </span>
        )}
        {overall_summary.total_criadas > 0 && (
          <span className="changelog-summary-chip" style={{ color: '#3B82F6' }}>
            Adições: {overall_summary.total_criadas}
          </span>
        )}
      </div>

      <div className="changelog-panel-months">
        {filteredPairs.map(pair => {
          const isExpanded = expandedMonth === pair.to_snapshot;
          return (
            <div key={pair.to_snapshot} className="changelog-month-section">
              <button
                className="changelog-month-header"
                onClick={() => setExpandedMonth(isExpanded ? null : pair.to_snapshot)}
              >
                <span className="changelog-month-label">{pair.to_label}</span>
                <span className="changelog-month-count">{pair.changes.length}</span>
                <span className={`changelog-chevron ${isExpanded ? 'expanded' : ''}`}>&#9660;</span>
              </button>

              {isExpanded && (
                <div className="changelog-month-changes">
                  {pair.changes.map((change, idx) => {
                    const config = getChangeTypeConfig(change.type);
                    return (
                      <div
                        key={idx}
                        className="changelog-change-card"
                        style={{
                          borderLeftColor: config.color,
                          opacity: change.annotation?.is_visible === false ? 0.5 : 1,
                        }}
                      >
                        <div className="changelog-change-top">
                          <span
                            className="changelog-type-badge"
                            style={{ background: config.bgColor, color: config.color, borderColor: config.borderColor }}
                          >
                            {config.label}
                          </span>
                          {change.delta_days != null && (
                            <span className="changelog-delta" style={{ color: change.delta_days > 0 ? '#EF4444' : '#10B981' }}>
                              {change.delta_days > 0 ? '+' : ''}{change.delta_days} dias
                            </span>
                          )}
                        </div>
                        <div className="changelog-change-name">{change.task_name}</div>
                        {change.disciplina && (
                          <div className="changelog-change-disc">{change.disciplina}</div>
                        )}
                        {change.annotation?.description && (
                          <div className="changelog-change-annotation">
                            {change.annotation.description}
                          </div>
                        )}
                        {change.annotation?.justification && (
                          <div className="changelog-change-justification">
                            {change.annotation.justification}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ChangeLogPanel;
