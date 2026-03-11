/**
 * MarcosClienteTab - Aba "Marcos do Cliente" na Curva S
 *
 * Exibe marcos de TODOS os projetos do time agrupados por projeto,
 * com KPIs, desvio, e possibilidade de vincular ao cronograma.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import './MarcosClienteTab.css';

/* ---- Helpers ---- */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function calcDesvio(marco) {
  const cronograma = marco.smartsheet_data_termino || marco.prazo_atual;
  const expectativa = marco.cliente_expectativa_data;
  if (!cronograma || !expectativa) return null;
  const dC = new Date(cronograma), dE = new Date(expectativa);
  if (isNaN(dC.getTime()) || isNaN(dE.getTime())) return null;
  return Math.round((dC - dE) / 86400000);
}

const STATUS_MAP = {
  feito: { label: 'Feito', className: 'feito' },
  andamento: { label: 'Em Andamento', className: 'andamento' },
  atrasado: { label: 'Atrasado', className: 'atrasado' },
  pendente: { label: 'Pendente', className: 'pendente' },
};

function MarcosClienteTab({ selectedProjectId, portfolio }) {
  const [marcosMap, setMarcosMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState({});

  // Link modal state
  const [linkingMarco, setLinkingMarco] = useState(null); // { id, nome, projectCode, smartsheetId, projectName }
  const [cronogramaTasks, setCronogramaTasks] = useState([]);
  const [cronogramaLoading, setCronogramaLoading] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');

  const projects = useMemo(() => {
    if (!portfolio || !Array.isArray(portfolio)) return [];
    return portfolio.filter(p => p.project_code_norm);
  }, [portfolio]);

  // Fetch all marcos
  const fetchAllMarcos = useCallback(async () => {
    if (projects.length === 0) return;
    setLoading(true);
    try {
      const body = {
        projects: projects.map(p => ({
          projectCode: p.project_code_norm,
          smartsheetId: p.smartsheet_id || null,
          projectName: p.project_name || p.project_code_norm,
        })),
      };
      const res = await axios.post(`${API_URL}/api/marcos-projeto/enriched-batch`, body, {
        withCredentials: true,
      });
      if (res.data?.success) {
        setMarcosMap(res.data.data || {});
      }
    } catch (err) {
      console.error('Erro ao buscar marcos batch:', err);
    } finally {
      setLoading(false);
    }
  }, [projects]);

  useEffect(() => {
    fetchAllMarcos();
  }, [fetchAllMarcos]);

  // Auto-expand selected project
  useEffect(() => {
    if (selectedProjectId) {
      setExpandedProjects(prev => ({ ...prev, [selectedProjectId]: true }));
    }
  }, [selectedProjectId]);

  // Sort projects: selected first, then alphabetical
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const aCode = a.project_code_norm;
      const bCode = b.project_code_norm;
      if (aCode === selectedProjectId) return -1;
      if (bCode === selectedProjectId) return 1;
      return (a.project_name || '').localeCompare(b.project_name || '');
    });
  }, [projects, selectedProjectId]);

  // Compute KPIs
  const kpis = useMemo(() => {
    let total = 0, comDesvio = 0, naoVinculados = 0, concluidos = 0;
    for (const pc of Object.keys(marcosMap)) {
      const { marcos } = marcosMap[pc];
      if (!marcos) continue;
      for (const m of marcos) {
        total++;
        const desvio = calcDesvio(m);
        if (desvio !== null && desvio > 0) comDesvio++;
        if (!m.smartsheet_row_id) naoVinculados++;
        if (m.status === 'feito') concluidos++;
      }
    }
    return { total, comDesvio, naoVinculados, concluidos };
  }, [marcosMap]);

  // Toggle project expansion
  const toggleProject = (projectCode) => {
    setExpandedProjects(prev => ({ ...prev, [projectCode]: !prev[projectCode] }));
  };

  // Link modal handlers
  const openLinkModal = async (marco, project) => {
    const ssId = project.smartsheet_id;
    const pName = project.project_name || project.project_code_norm;
    if (!ssId && !pName) return;

    setLinkingMarco({
      id: marco.id,
      nome: marco.nome,
      projectCode: project.project_code_norm,
      smartsheetId: ssId,
      projectName: pName,
    });
    setLinkSearch('');
    setCronogramaLoading(true);
    setCronogramaTasks([]);

    try {
      const res = await axios.get(`${API_URL}/api/projetos/cronograma`, {
        params: { smartsheetId: ssId, projectName: pName },
        withCredentials: true,
      });
      setCronogramaTasks(res.data?.data || []);
    } catch (err) {
      console.error('Erro ao buscar cronograma:', err);
    } finally {
      setCronogramaLoading(false);
    }
  };

  const closeLinkModal = () => {
    setLinkingMarco(null);
    setCronogramaTasks([]);
    setLinkSearch('');
  };

  const handleSelectTask = async (task) => {
    if (!linkingMarco) return;
    const rowId = task.rowId ?? task.row_id;
    try {
      await axios.put(
        `${API_URL}/api/marcos-projeto/${linkingMarco.id}/link`,
        {
          smartsheet_row_id: String(rowId),
          smartsheet_task_name: task.NomeDaTarefa || '',
        },
        { withCredentials: true }
      );
      closeLinkModal();
      await fetchAllMarcos();
    } catch (err) {
      console.error('Erro ao vincular:', err);
    }
  };

  const filteredTasks = useMemo(() => {
    if (!linkSearch.trim()) return cronogramaTasks;
    const q = linkSearch.toLowerCase();
    return cronogramaTasks.filter(t =>
      (t.NomeDaTarefa || '').toLowerCase().includes(q) ||
      (t.Disciplina || '').toLowerCase().includes(q)
    );
  }, [cronogramaTasks, linkSearch]);

  // Mark seen handler
  const handleMarkSeen = async (projectCode) => {
    try {
      await axios.put(
        `${API_URL}/api/marcos-projeto/edit-log/mark-seen`,
        { projectCode },
        { withCredentials: true }
      );
      setMarcosMap(prev => ({
        ...prev,
        [projectCode]: { ...prev[projectCode], pendingCount: 0 },
      }));
    } catch (err) {
      console.error('Erro ao marcar como visto:', err);
    }
  };

  if (loading) {
    return <div className="mct-loading">Carregando marcos de todos os projetos...</div>;
  }

  return (
    <div className="mct-container">
      {/* KPI Strip */}
      <div className="mct-kpi-strip">
        <div className="mct-kpi-card">
          <span className="mct-kpi-value">{kpis.total}</span>
          <span className="mct-kpi-label">Total marcos</span>
        </div>
        <div className="mct-kpi-card mct-kpi-danger">
          <span className="mct-kpi-value">{kpis.comDesvio}</span>
          <span className="mct-kpi-label">Com desvio</span>
        </div>
        <div className="mct-kpi-card mct-kpi-warning">
          <span className="mct-kpi-value">{kpis.naoVinculados}</span>
          <span className="mct-kpi-label">Nao vinculados</span>
        </div>
        <div className="mct-kpi-card mct-kpi-success">
          <span className="mct-kpi-value">{kpis.concluidos}</span>
          <span className="mct-kpi-label">Concluidos</span>
        </div>
      </div>

      {/* Project groups */}
      {sortedProjects.map(project => {
        const pc = project.project_code_norm;
        const data = marcosMap[pc] || { marcos: [], pendingCount: 0 };
        const marcos = data.marcos || [];
        const pendingCount = data.pendingCount || 0;
        const isExpanded = !!expandedProjects[pc];
        const isSelected = pc === selectedProjectId;

        return (
          <div key={pc} className={`mct-project-group ${isSelected ? 'mct-selected' : ''}`}>
            <div className="mct-project-header" onClick={() => toggleProject(pc)}>
              <span className={`mct-arrow ${isExpanded ? 'open' : ''}`}>{'\u25B6'}</span>
              <span className="mct-project-name">
                {project.project_name || pc}
              </span>
              <span className="mct-project-count">({marcos.length} marcos)</span>
              {pendingCount > 0 && (
                <span className="mct-pending-badge">{pendingCount}</span>
              )}
            </div>

            {isExpanded && (
              <div className="mct-project-body">
                {pendingCount > 0 && (
                  <div className="mct-pending-bar">
                    <span>{pendingCount} alteracao(oes) nao vista(s)</span>
                    <button className="mct-mark-seen-btn" onClick={(e) => {
                      e.stopPropagation();
                      handleMarkSeen(pc);
                    }}>
                      Marcar como visto
                    </button>
                  </div>
                )}

                {marcos.length === 0 ? (
                  <div className="mct-empty-project">Nenhum marco cadastrado.</div>
                ) : (
                  <table className="mct-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Exp. Cliente</th>
                        <th>Cronograma</th>
                        <th>Desvio</th>
                        <th>Status</th>
                        <th>Tarefa Vinculada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marcos.map(m => {
                        const desvio = calcDesvio(m);
                        const statusInfo = STATUS_MAP[m.status] || STATUS_MAP.pendente;
                        const hasLinked = !!(m.smartsheet_task_name || m.smartsheet_row_id);

                        return (
                          <tr key={m.id}>
                            <td className="mct-td-nome">{m.nome}</td>
                            <td>{formatDate(m.cliente_expectativa_data)}</td>
                            <td>{formatDate(m.smartsheet_data_termino || m.prazo_atual)}</td>
                            <td>
                              {desvio !== null ? (
                                <span className={`mct-desvio ${desvio > 0 ? 'atrasado' : desvio < 0 ? 'adiantado' : ''}`}>
                                  {desvio > 0 ? '+' : ''}{desvio}d
                                </span>
                              ) : '-'}
                            </td>
                            <td>
                              <span className={`mct-status-badge ${statusInfo.className}`}>
                                {statusInfo.label}
                              </span>
                            </td>
                            <td>
                              {hasLinked ? (
                                <span className="mct-task-linked">
                                  {m.smartsheet_task_name || `Row ${m.smartsheet_row_id}`}
                                </span>
                              ) : (
                                <button
                                  className="mct-link-btn"
                                  onClick={() => openLinkModal(m, project)}
                                >
                                  Vincular
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })}

      {sortedProjects.length === 0 && (
        <div className="mct-empty">Nenhum projeto no portfolio.</div>
      )}

      {/* Link Modal */}
      {linkingMarco && (
        <div className="mct-link-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) closeLinkModal();
        }}>
          <div className="mct-link-modal">
            <div className="mct-link-modal-header">
              <h3>Vincular "{linkingMarco.nome}" a tarefa do cronograma</h3>
              <button className="mct-link-modal-close" onClick={closeLinkModal}>{'\u2715'}</button>
            </div>
            <div className="mct-link-search">
              <input
                type="text"
                placeholder="Buscar tarefa por nome ou disciplina..."
                value={linkSearch}
                onChange={e => setLinkSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="mct-link-list">
              {cronogramaLoading ? (
                <div className="mct-link-loading">Carregando tarefas...</div>
              ) : filteredTasks.length === 0 ? (
                <div className="mct-link-empty">
                  {cronogramaTasks.length === 0 ? 'Nenhuma tarefa no cronograma.' : 'Nenhuma tarefa corresponde a busca.'}
                </div>
              ) : (
                filteredTasks.map((task, idx) => {
                  const taskRowId = task.rowId ?? task.row_id ?? idx;
                  return (
                    <div key={taskRowId} className="mct-link-item" onClick={() => handleSelectTask(task)}>
                      <div className="mct-link-item-info">
                        <div className="mct-link-item-name">{task.NomeDaTarefa || 'Sem nome'}</div>
                        <div className="mct-link-item-meta">
                          <span>Termino: {formatDate(task.DataDeTermino)}</span>
                          {task.Disciplina && <span>Disc: {task.Disciplina}</span>}
                          {task.Status && <span>{task.Status}</span>}
                        </div>
                      </div>
                      <button className="mct-select-btn">Selecionar</button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MarcosClienteTab;
