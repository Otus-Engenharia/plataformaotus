/**
 * Componente: ChangeLogTab
 * Aba dedicada completa para log de alterações com edição via modal.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CHANGE_TYPE_CONFIG, getChangeTypeConfig } from './changeLogColors';
import ChangeAnnotationEditor from './ChangeAnnotationEditor';

function ChangeLogTab({ changeLog, loading, projectCode, onRefresh }) {
  const [filterType, setFilterType] = useState('all');
  const [filterDiscipline, setFilterDiscipline] = useState('all');
  const [activeMonth, setActiveMonth] = useState('all');
  const [editingChange, setEditingChange] = useState(null);

  // Fechar modal com Escape
  useEffect(() => {
    if (!editingChange) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setEditingChange(null);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [editingChange]);

  if (loading) {
    return <div className="changelog-tab-loading">Carregando log de alterações...</div>;
  }

  if (!changeLog || !changeLog.month_pairs || changeLog.month_pairs.length === 0) {
    return (
      <div className="changelog-tab-empty">
        Nenhuma alteração detectada entre os reprogramados mensais.
        <br />
        <span style={{ fontSize: 12, color: '#999' }}>
          É necessário ter pelo menos 2 snapshots mensais para detectar mudanças.
        </span>
      </div>
    );
  }

  const { month_pairs, overall_summary } = changeLog;

  // Coletar disciplinas únicas
  const allDisciplines = new Set();
  for (const pair of month_pairs) {
    for (const change of pair.changes) {
      if (change.disciplina) allDisciplines.add(change.disciplina);
    }
  }

  // Aplicar filtros de tipo e disciplina
  const filteredPairs = month_pairs.map(pair => ({
    ...pair,
    changes: pair.changes.filter(c => {
      if (filterType !== 'all' && c.type !== filterType) return false;
      if (filterDiscipline !== 'all' && c.disciplina !== filterDiscipline) return false;
      return true;
    }),
  })).filter(pair => pair.changes.length > 0);

  // Aplicar filtro de mês (sub-aba)
  const displayPairs = activeMonth === 'all' || activeMonth === 'disciplines'
    ? filteredPairs
    : filteredPairs.filter(pair => pair.to_snapshot === activeMonth);

  const handleFilterType = (type) => {
    setFilterType(prev => prev === type ? 'all' : type);
  };

  return (
    <div className="changelog-tab">
      {/* KPI Summary Bar */}
      <div className="changelog-kpi-bar">
        <div className="changelog-kpi">
          <span className="changelog-kpi-value">{overall_summary.total_changes}</span>
          <span className="changelog-kpi-label">Total de Alterações</span>
        </div>
        <div className="changelog-kpi">
          <span className="changelog-kpi-value">{overall_summary.months_analyzed}</span>
          <span className="changelog-kpi-label">Meses Analisados</span>
        </div>
        <div className="changelog-kpi">
          <span className="changelog-kpi-value" style={{ color: '#EF4444' }}>
            {overall_summary.total_desvios}
          </span>
          <span className="changelog-kpi-label">Desvios de Prazo</span>
        </div>
        <div className="changelog-kpi">
          <span className="changelog-kpi-value" style={{ color: '#3B82F6' }}>
            {overall_summary.total_criadas}
          </span>
          <span className="changelog-kpi-label">Tarefas Adicionadas</span>
        </div>
        <div className="changelog-kpi">
          <span className="changelog-kpi-value">{overall_summary.total_annotated || 0}</span>
          <span className="changelog-kpi-label">Anotadas</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="changelog-filter-bar">
        <div className="changelog-filter-buttons">
          <button
            className={`changelog-filter-btn ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            Todos
          </button>
          {Object.entries(CHANGE_TYPE_CONFIG).map(([typeKey, config]) => (
            <button
              key={typeKey}
              className={`changelog-filter-btn ${filterType === typeKey ? 'active' : ''}`}
              onClick={() => handleFilterType(typeKey)}
              style={filterType === typeKey ? {
                background: config.bgColor,
                color: config.color,
                borderColor: config.borderColor,
              } : undefined}
            >
              <span className="changelog-filter-btn-dot" style={{ background: config.color }} />
              {config.shortLabel}
            </button>
          ))}
        </div>
        <select
          className="changelog-filter-discipline"
          value={filterDiscipline}
          onChange={e => setFilterDiscipline(e.target.value)}
        >
          <option value="all">Todas as disciplinas</option>
          {[...allDisciplines].sort().map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Month Sub-tabs */}
      <div className="changelog-month-tabs">
        <button
          className={`changelog-month-tab ${activeMonth === 'all' ? 'active' : ''}`}
          onClick={() => setActiveMonth('all')}
        >
          Todos
        </button>
        {filteredPairs.map(pair => (
          <button
            key={pair.to_snapshot}
            className={`changelog-month-tab ${activeMonth === pair.to_snapshot ? 'active' : ''}`}
            onClick={() => setActiveMonth(pair.to_snapshot)}
          >
            {pair.to_label}
            <span className="changelog-month-tab-count">{pair.changes.length}</span>
          </button>
        ))}
      </div>

      {/* Month Blocks with Change Rows */}
      <div className="changelog-months-scroll">
        <div className="changelog-months">
          {displayPairs.map(pair => {
            // Resumo de impactos por tipo no mês
            const monthDesvios = pair.changes.filter(c => c.type === 'DESVIO_PRAZO').length;
            const monthCriadas = pair.changes.filter(c => c.type === 'TAREFA_CRIADA').length;
            const monthDeletadas = pair.changes.filter(c => c.type === 'TAREFA_DELETADA').length;
            const monthNaoFeitas = pair.changes.filter(c => c.type === 'TAREFA_NAO_FEITA').length;

            return (
            <div key={pair.to_snapshot} className="changelog-month-block">
              <div className="changelog-month-block-header">
                <span className="changelog-month-block-label">{pair.to_label}</span>
                <div className="changelog-month-block-stats">
                  {monthDesvios > 0 && (
                    <span className="changelog-month-stat" style={{ color: '#EF4444', background: '#FEF2F2' }}>
                      {monthDesvios} desvio{monthDesvios !== 1 ? 's' : ''}
                    </span>
                  )}
                  {monthCriadas > 0 && (
                    <span className="changelog-month-stat" style={{ color: '#3B82F6', background: '#EFF6FF' }}>
                      {monthCriadas} adicionada{monthCriadas !== 1 ? 's' : ''}
                    </span>
                  )}
                  {monthDeletadas > 0 && (
                    <span className="changelog-month-stat" style={{ color: '#F97316', background: '#FFF7ED' }}>
                      {monthDeletadas} removida{monthDeletadas !== 1 ? 's' : ''}
                    </span>
                  )}
                  {monthNaoFeitas > 0 && (
                    <span className="changelog-month-stat" style={{ color: '#8B5CF6', background: '#F5F3FF' }}>
                      {monthNaoFeitas} não feita{monthNaoFeitas !== 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="changelog-month-block-summary">
                    {pair.changes.length} alteraç{pair.changes.length === 1 ? 'ão' : 'ões'}
                  </span>
                </div>
              </div>

              <div className="changelog-month-block-changes">
                {pair.changes.map((change, idx) => {
                  const config = getChangeTypeConfig(change.type);
                  const hasAnnotation = change.annotation && (change.annotation.description || change.annotation.justification);

                  return (
                    <div
                      key={idx}
                      className={`changelog-change-row ${change.annotation?.is_visible === false ? 'hidden-from-client' : ''}`}
                      style={{ borderLeftColor: config.color }}
                    >
                      <div className="changelog-change-row-main">
                        <div className="changelog-change-row-left">
                          <span
                            className="changelog-type-badge"
                            style={{ background: config.bgColor, color: config.color, borderColor: config.borderColor }}
                          >
                            {config.label}
                          </span>
                          {change.delta_days != null && (
                            <span
                              className={`changelog-delta-badge ${change.is_overridden ? 'changelog-delta-overridden' : ''}`}
                              style={{ color: change.delta_days > 0 ? '#EF4444' : '#10B981' }}
                              title={change.is_overridden
                                ? `Original: ${change.original_delta_days > 0 ? '+' : ''}${change.original_delta_days} dias`
                                : undefined}
                            >
                              {change.delta_days > 0 ? '+' : ''}{change.delta_days} dias
                              {change.is_overridden && <span className="changelog-override-indicator">*</span>}
                            </span>
                          )}
                        </div>
                        <div className="changelog-change-row-center">
                          <span className="changelog-change-task-name">{change.task_name}</span>
                          {change.disciplina && (
                            <span className="changelog-change-discipline">{change.disciplina}</span>
                          )}
                          {change.fase_nome && (
                            <span className="changelog-change-phase">{change.fase_nome}</span>
                          )}
                          {(change.categoria_atraso || change.motivo_atraso || change.observacao_otus) && (
                            <div className="changelog-smartsheet-meta">
                              {change.categoria_atraso && (
                                <span className="changelog-meta-tag changelog-meta-categoria">
                                  {change.categoria_atraso}
                                </span>
                              )}
                              {change.motivo_atraso && (
                                <span className="changelog-meta-tag changelog-meta-motivo">
                                  {change.motivo_atraso}
                                </span>
                              )}
                              {change.observacao_otus && (
                                <span className="changelog-meta-obs">
                                  {change.observacao_otus}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="changelog-change-row-right">
                          {change.annotation?.is_visible === false && (
                            <span className="changelog-hidden-badge">Oculto</span>
                          )}
                          <button
                            className="changelog-btn-edit"
                            onClick={() => setEditingChange({ change, monthPair: pair })}
                            title="Editar anotação"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Editar
                          </button>
                        </div>
                      </div>

                      {/* Annotation preview (read-only) */}
                      {hasAnnotation && (
                        <div className="changelog-annotation-preview">
                          {change.annotation.description && (
                            <div className="changelog-annotation-desc">{change.annotation.description}</div>
                          )}
                          {change.annotation.justification && (
                            <div className="changelog-annotation-just">
                              <em>Justificativa:</em> {change.annotation.justification}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* Modal Editor */}
      {editingChange && createPortal(
        <div className="changelog-modal-overlay" onClick={() => setEditingChange(null)}>
          <div
            className="changelog-modal-content"
            onClick={e => e.stopPropagation()}
          >
            <div className="changelog-modal-header">
              <div>
                <h2>Editar Anotação</h2>
                <span className="changelog-modal-subtitle">
                  {editingChange.change.task_name}
                </span>
              </div>
              <button
                className="changelog-modal-close"
                onClick={() => setEditingChange(null)}
                aria-label="Fechar"
              >
                &times;
              </button>
            </div>
            <ChangeAnnotationEditor
              projectCode={projectCode}
              change={editingChange.change}
              monthPair={editingChange.monthPair}
              onSaved={() => {
                setEditingChange(null);
                onRefresh();
              }}
              onCancel={() => setEditingChange(null)}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default ChangeLogTab;
