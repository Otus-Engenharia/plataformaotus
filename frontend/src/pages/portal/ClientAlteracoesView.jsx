/**
 * Portal do Cliente - Alteracoes
 *
 * Log de alteracoes mensais do projeto via endpoint do portal.
 * Versao adaptada de VistaClienteAlteracoesView para Bearer token auth.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip as ChartTooltip,
} from 'chart.js';
import { API_URL } from '../../api';
import { useClientAuth } from '../../contexts/ClientAuthContext';
import { CHANGE_TYPE_CONFIG, getChangeTypeConfig } from '../../components/curva-s-progresso/changeLogColors';
import '../../styles/VistaClienteView.css';
import '../vista-cliente/VistaClienteAlteracoesView.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip);

const HIDDEN_DISCIPLINES = ['cliente', 'coordenação', 'coordenacao'];
const TYPE_ORDER = ['DESVIO_PRAZO', 'TAREFA_CRIADA', 'TAREFA_DELETADA', 'TAREFA_NAO_FEITA'];

function groupByType(changes) {
  const map = new Map();
  for (const c of changes) {
    if (!map.has(c.type)) map.set(c.type, []);
    map.get(c.type).push(c);
  }
  return [...map.entries()].sort((a, b) => TYPE_ORDER.indexOf(a[0]) - TYPE_ORDER.indexOf(b[0]));
}

function ClientAlteracoesView() {
  const { projectCode } = useParams();
  const { currentProject } = useOutletContext();
  const { getClientToken } = useClientAuth();

  const [changeLog, setChangeLog] = useState(null);
  const [changeLogLoading, setChangeLogLoading] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [activeMonth, setActiveMonth] = useState('all');
  const [expandedMonths, setExpandedMonths] = useState(new Set());
  const [showAllDisciplines, setShowAllDisciplines] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('tabela');

  const clientAxios = useCallback(() => ({
    headers: { Authorization: `Bearer ${getClientToken()}` },
  }), [getClientToken]);

  const fetchChangeLog = useCallback(async () => {
    if (!projectCode || (!currentProject?.smartsheetId && !currentProject?.nome)) return;
    setChangeLogLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentProject?.smartsheetId) params.set('smartsheetId', currentProject.smartsheetId);
      if (currentProject?.nome) params.set('projectName', currentProject.nome);
      const res = await axios.get(
        `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/changelog?${params}`,
        clientAxios()
      );
      if (res.data.success) {
        setChangeLog(res.data.data);
        const pairs = res.data.data?.month_pairs;
        if (pairs && pairs.length > 0) {
          setExpandedMonths(new Set([pairs[0].to_snapshot]));
        }
      }
    } catch (err) {
      console.error('Erro ao buscar changelog:', err);
    } finally {
      setChangeLogLoading(false);
    }
  }, [projectCode, currentProject?.smartsheetId, currentProject?.nome, clientAxios]);

  useEffect(() => {
    fetchChangeLog();
    setFilterType('all');
    setActiveMonth('all');
  }, [fetchChangeLog]);

  const { filteredPairs, displayPairs, disciplineScores, summary } = useMemo(() => {
    if (!changeLog || !changeLog.month_pairs) {
      return { filteredPairs: [], displayPairs: [], disciplineScores: [], summary: null };
    }

    const { month_pairs, overall_summary, discipline_scores } = changeLog;

    const filtered = month_pairs.map(pair => ({
      ...pair,
      changes: pair.changes.filter(c => {
        if (c.annotation?.is_visible === false) return false;
        if (filterType !== 'all' && c.type !== filterType) return false;
        return true;
      }),
    })).filter(pair => pair.changes.length > 0);

    const display = activeMonth === 'all'
      ? filtered
      : filtered.filter(pair => pair.to_snapshot === activeMonth);

    const filteredScores = (discipline_scores || []).filter(
      d => !HIDDEN_DISCIPLINES.includes(d.disciplina.toLowerCase())
    ).sort((a, b) => b.total_desvio_dias - a.total_desvio_dias);

    return {
      filteredPairs: filtered,
      displayPairs: display,
      disciplineScores: filteredScores,
      summary: overall_summary,
    };
  }, [changeLog, filterType, activeMonth]);

  const toggleMonth = (snapshot) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(snapshot)) next.delete(snapshot);
      else next.add(snapshot);
      return next;
    });
  };

  const handleFilterType = (type) => {
    setFilterType(prev => prev === type ? 'all' : type);
  };

  const visibleScores = showAllDisciplines ? disciplineScores : disciplineScores.slice(0, 8);

  if (changeLogLoading) {
    return (
      <div className="cp-view-loading">
        <div className="cp-view-spinner" />
        Carregando log de alterações...
      </div>
    );
  }

  if (!changeLog || !changeLog.month_pairs || changeLog.month_pairs.length === 0) {
    return (
      <div className="cp-view-empty">
        <span className="cp-view-empty-icon">&#128196;</span>
        <div>Nenhuma alteração detectada entre os reprogramados mensais.</div>
        <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 4 }}>
          E necessario ter pelo menos 2 snapshots mensais para detectar mudancas.
        </div>
      </div>
    );
  }

  return (
    <div className="vista-cliente-container">
      {/* KPI Strip */}
      <div className="vc-kpi-strip vcalt-kpi-strip">
        <div className="vc-kpi-card">
          <div className="vc-kpi-value">{summary?.total_changes || 0}</div>
          <div className="vc-kpi-label">Total de Alterações</div>
        </div>
        <div className="vc-kpi-card">
          <div className="vc-kpi-value">{summary?.months_analyzed || 0}</div>
          <div className="vc-kpi-label">Meses Analisados</div>
        </div>
        <div className="vc-kpi-card">
          <div className="vc-kpi-value" style={{ color: '#EF4444' }}>{summary?.total_desvios || 0}</div>
          <div className="vc-kpi-label">Desvios de Prazo</div>
        </div>
        <div className="vc-kpi-card">
          <div className="vc-kpi-value" style={{ color: '#3B82F6' }}>{summary?.total_criadas || 0}</div>
          <div className="vc-kpi-label">Tarefas Adicionadas</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="vcalt-filter-bar">
        <div className="vcalt-filter-buttons">
          <button
            className={`vcalt-filter-btn ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            Todos
          </button>
          {Object.entries(CHANGE_TYPE_CONFIG).map(([typeKey, config]) => (
            <button
              key={typeKey}
              className={`vcalt-filter-btn ${filterType === typeKey ? 'active' : ''}`}
              onClick={() => handleFilterType(typeKey)}
              style={filterType === typeKey ? {
                background: config.bgColor,
                color: config.color,
                borderColor: config.borderColor,
              } : undefined}
            >
              <span className="vcalt-filter-dot" style={{ background: config.color }} />
              {config.shortLabel}
            </button>
          ))}
        </div>
        <div className="vcalt-month-tabs">
          <button
            className={`vcalt-month-tab ${activeMonth === 'all' ? 'active' : ''}`}
            onClick={() => setActiveMonth('all')}
          >
            Todos
          </button>
          {filteredPairs.map(pair => (
            <button
              key={pair.to_snapshot}
              className={`vcalt-month-tab ${activeMonth === pair.to_snapshot ? 'active' : ''}`}
              onClick={() => setActiveMonth(pair.to_snapshot)}
            >
              {pair.to_label}
              <span className="vcalt-month-tab-count">{pair.changes.length}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content Grid */}
      <div className="vcalt-content-grid">
        {/* Left: Month Cards */}
        <div className="vcalt-months-column">
          {displayPairs.map(pair => {
            const isExpanded = expandedMonths.has(pair.to_snapshot);
            const monthDesvios = pair.changes.filter(c => c.type === 'DESVIO_PRAZO').length;
            const monthCriadas = pair.changes.filter(c => c.type === 'TAREFA_CRIADA').length;
            const monthDeletadas = pair.changes.filter(c => c.type === 'TAREFA_DELETADA').length;
            const monthNaoFeitas = pair.changes.filter(c => c.type === 'TAREFA_NAO_FEITA').length;

            return (
              <div key={pair.to_snapshot} className={`vcalt-month-card ${isExpanded ? 'expanded' : ''}`}>
                <button
                  className="vcalt-month-header"
                  onClick={() => toggleMonth(pair.to_snapshot)}
                >
                  <div className="vcalt-month-header-left">
                    <span className={`vcalt-chevron ${isExpanded ? 'open' : ''}`}>&#9654;</span>
                    <span className="vcalt-month-label">{pair.to_label}</span>
                    <span className="vcalt-month-total">
                      {pair.changes.length} alteraç{pair.changes.length === 1 ? 'ão' : 'ões'}
                    </span>
                  </div>
                  <div className="vcalt-month-badges">
                    {monthDesvios > 0 && (
                      <span className="vcalt-month-badge" style={{ color: '#EF4444', background: '#FEF2F2' }}>
                        {monthDesvios} desvio{monthDesvios !== 1 ? 's' : ''}
                      </span>
                    )}
                    {monthCriadas > 0 && (
                      <span className="vcalt-month-badge" style={{ color: '#3B82F6', background: '#EFF6FF' }}>
                        {monthCriadas} adic.
                      </span>
                    )}
                    {monthDeletadas > 0 && (
                      <span className="vcalt-month-badge" style={{ color: '#F97316', background: '#FFF7ED' }}>
                        {monthDeletadas} remov.
                      </span>
                    )}
                    {monthNaoFeitas > 0 && (
                      <span className="vcalt-month-badge" style={{ color: '#8B5CF6', background: '#F5F3FF' }}>
                        {monthNaoFeitas} n/feita{monthNaoFeitas !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </button>

                {!isExpanded && (monthDesvios + monthCriadas + monthDeletadas + monthNaoFeitas > 0) && (
                  <div className="vcalt-month-minibar">
                    {monthDesvios > 0 && <span style={{ background: '#EF4444', flex: monthDesvios }} />}
                    {monthCriadas > 0 && <span style={{ background: '#3B82F6', flex: monthCriadas }} />}
                    {monthDeletadas > 0 && <span style={{ background: '#F97316', flex: monthDeletadas }} />}
                    {monthNaoFeitas > 0 && <span style={{ background: '#8B5CF6', flex: monthNaoFeitas }} />}
                  </div>
                )}

                {isExpanded && (
                  <div className="vcalt-month-changes">
                    {(() => {
                      const groupedByDisc = new Map();
                      for (const change of pair.changes) {
                        const disc = change.disciplina || 'Sem disciplina';
                        if (!groupedByDisc.has(disc)) groupedByDisc.set(disc, []);
                        groupedByDisc.get(disc).push(change);
                      }
                      const sortedGroups = [...groupedByDisc.entries()].sort((a, b) => b[1].length - a[1].length);

                      return sortedGroups.map(([disc, changes]) => (
                        <div key={disc} className="vcalt-disc-group">
                          <div className="vcalt-disc-group-header">
                            <span className="vcalt-disc-group-name">{disc}</span>
                            <span className="vcalt-disc-group-count">{changes.length}</span>
                            <div className="vcalt-disc-type-bar">
                              {Object.entries(CHANGE_TYPE_CONFIG).map(([typeKey, cfg]) => {
                                const count = changes.filter(c => c.type === typeKey).length;
                                if (!count) return null;
                                return <span key={typeKey} style={{ background: cfg.color, flex: count }} />;
                              })}
                            </div>
                          </div>
                          {groupByType(changes).map(([typeKey, typeChanges]) => {
                            const typeCfg = getChangeTypeConfig(typeKey);
                            return (
                              <div key={typeKey} className="vcalt-type-subgroup">
                                <div className="vcalt-type-subheader" style={{ color: typeCfg.color }}>
                                  <span className="vcalt-type-dot" style={{ background: typeCfg.color }} />
                                  <span>{typeCfg.label}</span>
                                  <span className="vcalt-type-subheader-count">({typeChanges.length})</span>
                                </div>
                                {typeChanges.map((change, idx) => {
                                  const hasAnnotation = change.annotation && (change.annotation.description || change.annotation.justification);
                                  return (
                                    <div
                                      key={idx}
                                      className="vcalt-change-row"
                                      style={{ borderLeftColor: typeCfg.color }}
                                    >
                                      <div className="vcalt-change-main">
                                        <span className="vcalt-task-name">{change.task_name}</span>
                                        {change.fase_nome && (
                                          <span className="vcalt-phase-tag">{change.fase_nome}</span>
                                        )}
                                        {change.delta_days != null && (
                                          <span
                                            className="vcalt-delta-badge"
                                            style={{ color: change.delta_days > 0 ? '#EF4444' : '#10B981' }}
                                          >
                                            {change.delta_days > 0 ? '+' : ''}{change.delta_days}d
                                          </span>
                                        )}
                                      </div>
                                      {hasAnnotation && (
                                        <div className="vcalt-annotation">
                                          {change.annotation.description && (
                                            <p className="vcalt-annotation-desc">{change.annotation.description}</p>
                                          )}
                                          {change.annotation.justification && (
                                            <p className="vcalt-annotation-just">
                                              <strong>Justificativa:</strong> {change.annotation.justification}
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Discipline Sidebar */}
        <div className="vcalt-discipline-card">
          <h3 className="vcalt-discipline-title">Impacto por Disciplina</h3>
          {disciplineScores.length === 0 ? (
            <div className="vcalt-discipline-empty">Sem dados de disciplina.</div>
          ) : (
            <>
              <div className="vcalt-sidebar-tabs">
                <button className={`vcalt-sidebar-tab ${sidebarTab === 'tabela' ? 'active' : ''}`}
                  onClick={() => setSidebarTab('tabela')}>Tabela</button>
                <button className={`vcalt-sidebar-tab ${sidebarTab === 'grafico' ? 'active' : ''}`}
                  onClick={() => setSidebarTab('grafico')}>Gráfico</button>
              </div>

              {sidebarTab === 'grafico' && (
                <div style={{ height: Math.max(150, disciplineScores.length * 32) }}>
                  {(() => {
                    const chartScores = [...disciplineScores].sort((a, b) => b.total_desvio_dias - a.total_desvio_dias);
                    return (
                      <Bar
                        data={{
                          labels: chartScores.map(d => d.disciplina),
                          datasets: [{
                            label: 'Dias de Desvio',
                            data: chartScores.map(d => d.total_desvio_dias),
                            backgroundColor: 'rgba(239, 68, 68, 0.6)',
                            borderColor: '#EF4444',
                            borderWidth: 1,
                            borderRadius: 3,
                          }],
                        }}
                        options={{
                          indexAxis: 'y',
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { display: false },
                            tooltip: {
                              callbacks: {
                                title: (items) => items[0]?.label || '',
                                label: (item) => {
                                  const d = chartScores[item.dataIndex];
                                  return [
                                    `Dias de desvio: ${d.total_desvio_dias}`,
                                    `Desvios: ${d.desvios}`,
                                    `Total alterações: ${d.total}`,
                                  ];
                                },
                              },
                            },
                          },
                          scales: {
                            x: {
                              beginAtZero: true,
                              ticks: { precision: 0, font: { size: 11 } },
                              grid: { display: false },
                            },
                            y: {
                              ticks: { font: { size: 11 } },
                              grid: { display: false },
                            },
                          },
                        }}
                      />
                    );
                  })()}
                </div>
              )}

              {sidebarTab === 'tabela' && (
                <>
                  <div className="vcalt-discipline-table-wrap">
                    <table className="vcalt-discipline-table">
                      <thead>
                        <tr>
                          <th>Disciplina</th>
                          <th title="Total de alterações detectadas nesta disciplina">Alt.</th>
                          <th title="Quantidade de desvios de prazo">Desv.</th>
                          <th title="Soma total de dias de desvio (em valor absoluto)">Dias</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleScores.map(d => (
                          <tr key={d.disciplina} title={`${d.disciplina}: ${d.total} alterações, ${d.desvios} desvios, ${d.total_desvio_dias} dias de desvio`}>
                            <td className="vcalt-disc-name">{d.disciplina}</td>
                            <td className="vcalt-disc-num">{d.total}</td>
                            <td className="vcalt-disc-num vcalt-disc-desvios">{d.desvios}</td>
                            <td className="vcalt-disc-num">{d.total_desvio_dias}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="vcalt-discipline-legend">
                    Alt. = Alterações<br />
                    Desv. = Atividades com desvio<br />
                    Dias = Dias de desvio
                  </p>
                  {disciplineScores.length > 8 && (
                    <button
                      className="vcalt-show-more-btn"
                      onClick={() => setShowAllDisciplines(prev => !prev)}
                    >
                      {showAllDisciplines ? 'Ver menos' : `Ver todas (${disciplineScores.length})`}
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ClientAlteracoesView;
