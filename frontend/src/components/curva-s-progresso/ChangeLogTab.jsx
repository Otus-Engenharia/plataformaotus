/**
 * Componente: ChangeLogTab
 * Aba dedicada completa para log de alterações com edição de anotações.
 */

import React, { useState } from 'react';
import { getChangeTypeConfig } from './changeLogColors';
import ChangeAnnotationEditor from './ChangeAnnotationEditor';

function ChangeLogTab({ changeLog, loading, projectCode, onRefresh }) {
  const [filterType, setFilterType] = useState('all');
  const [filterDiscipline, setFilterDiscipline] = useState('all');
  const [editingKey, setEditingKey] = useState(null);

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

  const { month_pairs, overall_summary, discipline_scores } = changeLog;

  // Coletar disciplinas únicas para filtro
  const allDisciplines = new Set();
  for (const pair of month_pairs) {
    for (const change of pair.changes) {
      if (change.disciplina) allDisciplines.add(change.disciplina);
    }
  }

  // Aplicar filtros
  const filteredPairs = month_pairs.map(pair => ({
    ...pair,
    changes: pair.changes.filter(c => {
      if (filterType !== 'all' && c.type !== filterType) return false;
      if (filterDiscipline !== 'all' && c.disciplina !== filterDiscipline) return false;
      return true;
    }),
  })).filter(pair => pair.changes.length > 0);

  const makeEditKey = (pair, change) =>
    `${pair.from_snapshot}|${pair.to_snapshot}|${change.type}|${change.task_name}`;

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

      {/* Filters */}
      <div className="changelog-filters">
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
        <select
          className="changelog-filter-select"
          value={filterDiscipline}
          onChange={e => setFilterDiscipline(e.target.value)}
        >
          <option value="all">Todas as disciplinas</option>
          {[...allDisciplines].sort().map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Monthly Sections */}
      <div className="changelog-months">
        {filteredPairs.map(pair => (
          <div key={pair.to_snapshot} className="changelog-month-block">
            <div className="changelog-month-block-header">
              <span className="changelog-month-block-label">{pair.to_label}</span>
              <span className="changelog-month-block-summary">
                {pair.changes.length} alteraç{pair.changes.length === 1 ? 'ão' : 'ões'}
              </span>
            </div>

            <div className="changelog-month-block-changes">
              {pair.changes.map((change, idx) => {
                const config = getChangeTypeConfig(change.type);
                const editKey = makeEditKey(pair, change);
                const isEditing = editingKey === editKey;
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
                            className="changelog-delta-badge"
                            style={{ color: change.delta_days > 0 ? '#EF4444' : '#10B981' }}
                          >
                            {change.delta_days > 0 ? '+' : ''}{change.delta_days} dias
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
                      </div>
                      <div className="changelog-change-row-right">
                        {change.annotation?.is_visible === false && (
                          <span className="changelog-hidden-badge">Oculto</span>
                        )}
                        <button
                          className="changelog-btn changelog-btn-sm"
                          onClick={() => setEditingKey(isEditing ? null : editKey)}
                          title={isEditing ? 'Fechar editor' : 'Editar anotação'}
                        >
                          {isEditing ? 'Fechar' : hasAnnotation ? 'Editar' : 'Anotar'}
                        </button>
                      </div>
                    </div>

                    {/* Annotation preview (when not editing) */}
                    {!isEditing && hasAnnotation && (
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

                    {/* Inline editor */}
                    {isEditing && (
                      <ChangeAnnotationEditor
                        projectCode={projectCode}
                        change={change}
                        monthPair={pair}
                        onSaved={() => {
                          setEditingKey(null);
                          onRefresh();
                        }}
                        onCancel={() => setEditingKey(null)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Discipline Scores (preparação para score futuro) */}
      {discipline_scores && discipline_scores.length > 0 && (
        <div className="changelog-discipline-summary">
          <h4>Resumo por Disciplina</h4>
          <table className="changelog-discipline-table">
            <thead>
              <tr>
                <th>Disciplina</th>
                <th>Total</th>
                <th>Desvios</th>
                <th>Criadas</th>
                <th>Removidas</th>
                <th>Dias de desvio</th>
              </tr>
            </thead>
            <tbody>
              {discipline_scores.slice(0, 10).map(d => (
                <tr key={d.disciplina}>
                  <td>{d.disciplina}</td>
                  <td>{d.total}</td>
                  <td style={{ color: d.desvios > 0 ? '#EF4444' : undefined }}>{d.desvios}</td>
                  <td style={{ color: d.criadas > 0 ? '#3B82F6' : undefined }}>{d.criadas}</td>
                  <td style={{ color: d.deletadas > 0 ? '#F97316' : undefined }}>{d.deletadas}</td>
                  <td style={{ color: d.total_desvio_dias > 0 ? '#EF4444' : undefined }}>
                    {d.total_desvio_dias > 0 ? `+${d.total_desvio_dias}` : d.total_desvio_dias}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ChangeLogTab;
