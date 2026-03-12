/**
 * Marcos Lider View - Gestao de Marcos pelo Lider do Projeto
 *
 * Modos:
 * - Overview: mostra marcos de TODOS os projetos agrupados (batch fetch)
 * - Single-project: CRUD completo + activity panel para um projeto
 *
 * Filtros (header):
 * - Time (todos)
 * - Lider (admin+ only)
 * - Projeto (drill-down para single-project mode)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { useAuth } from '../../contexts/AuthContext';
import './MarcosLiderView.css';

/* ---- Constants ---- */
const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente', className: 'pendente' },
  { value: 'andamento', label: 'Em Andamento', className: 'andamento' },
  { value: 'atrasado', label: 'Atrasado', className: 'atrasado' },
  { value: 'feito', label: 'Feito', className: 'feito' },
];

/* ---- Helpers ---- */
function formatDateInput(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatDateTimestamp(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function getLogItemClass(entry) {
  if (entry.change_source === 'smartsheet' && entry.change_type === 'deleted') {
    return 'smartsheet-delete';
  }
  if (entry.change_source === 'smartsheet') {
    return 'smartsheet-change';
  }
  return 'client-edit';
}

function getLogIcon(entry) {
  if (entry.change_source === 'smartsheet' && entry.change_type === 'deleted') {
    return '\u2715'; // x mark
  }
  if (entry.change_source === 'smartsheet') {
    return '\u2630'; // trigram / sheet icon
  }
  return '\u270E'; // pencil
}

function getLogText(entry) {
  if (entry.description) return entry.description;

  const source = entry.change_source === 'smartsheet' ? 'Smartsheet' : (entry.changed_by_name || 'Cliente');
  const field = entry.field_changed || 'campo';
  const marco = entry.marco_nome || 'marco';
  const oldVal = entry.old_value || '?';
  const newVal = entry.new_value || '?';

  if (entry.change_type === 'deleted') {
    return `${source}: Tarefa vinculada a '${marco}' foi removida do cronograma`;
  }

  return `${source} alterou '${field}' do marco '${marco}' de ${oldVal} para ${newVal}`;
}


function MarcosLiderView() {
  const { data: portfolioData, loading: portfolioLoading, uniqueTimes, uniqueLiders } = usePortfolio();
  const { hasFullAccess } = useAuth();

  /* ---- Filters ---- */
  const [localTimeFilter, setLocalTimeFilter] = useState('');
  const [localLiderFilter, setLocalLiderFilter] = useState('');

  /* ---- Project selection ---- */
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const sortedProjects = useMemo(() => {
    if (!portfolioData || !Array.isArray(portfolioData)) return [];
    return [...portfolioData]
      .filter(p => p.project_code_norm)
      .sort((a, b) => (a.project_name || '').localeCompare(b.project_name || ''));
  }, [portfolioData]);

  const filteredProjects = useMemo(() => {
    let result = sortedProjects;
    if (localTimeFilter) {
      result = result.filter(p => p.nome_time === localTimeFilter);
    }
    if (localLiderFilter) {
      result = result.filter(p => p.lider === localLiderFilter);
    }
    return result;
  }, [sortedProjects, localTimeFilter, localLiderFilter]);

  const isOverviewMode = !selectedProjectId;

  const selectedProject = useMemo(() => {
    if (!selectedProjectId || !sortedProjects.length) return null;
    return sortedProjects.find(p => p.project_code_norm === selectedProjectId) || null;
  }, [selectedProjectId, sortedProjects]);

  const projectCode = selectedProject?.project_code_norm || '';
  const smartsheetId = selectedProject?.smartsheet_id || '';
  const projectName = selectedProject?.project_name || selectedProject?.project_code_norm || '';

  // Reset project selection when filters change
  const handleTimeFilterChange = (val) => {
    setLocalTimeFilter(val);
    setSelectedProjectId('');
  };
  const handleLiderFilterChange = (val) => {
    setLocalLiderFilter(val);
    setSelectedProjectId('');
  };

  /* ---- Overview Mode State ---- */
  const [allMarcosMap, setAllMarcosMap] = useState({});
  const [allMarcosLoading, setAllMarcosLoading] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState({});

  /* ---- Section 1: Activity Panel State ---- */
  const [editLogs, setEditLogs] = useState([]);
  const [editLogsLoading, setEditLogsLoading] = useState(false);
  const [markingSeenLoading, setMarkingSeenLoading] = useState(false);

  const [baselineRequests, setBaselineRequests] = useState([]);
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [expandedSnapshots, setExpandedSnapshots] = useState({});
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processingBaseline, setProcessingBaseline] = useState(null);

  /* ---- Section 2: Marcos Table State ---- */
  const [marcos, setMarcos] = useState([]);
  const [marcosLoading, setMarcosLoading] = useState(false);

  /* ---- Section 3: Link Modal State ---- */
  const [linkingMarcoId, setLinkingMarcoId] = useState(null);
  const [linkingMarcoNome, setLinkingMarcoNome] = useState('');
  const [linkingProject, setLinkingProject] = useState(null);
  const [cronogramaTasks, setCronogramaTasks] = useState([]);
  const [cronogramaLoading, setCronogramaLoading] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkBaseline, setLinkBaseline] = useState(false);

  /* ---- Section 4: CRUD Form State ---- */
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    nome: '', status: 'pendente', prazo_baseline: '', prazo_atual: '', descricao: '',
  });

  /* ================================================================
     DATA FETCHING
     ================================================================ */

  // Overview: batch fetch marcos for all filtered projects
  const fetchAllMarcos = useCallback(async () => {
    if (filteredProjects.length === 0) { setAllMarcosMap({}); return; }
    setAllMarcosLoading(true);
    try {
      const body = {
        projects: filteredProjects.map(p => ({
          projectCode: p.project_code_norm,
          smartsheetId: p.smartsheet_id || null,
          projectName: p.project_name || p.project_code_norm,
        })),
      };
      const res = await axios.post(`${API_URL}/api/marcos-projeto/enriched-batch`, body, {
        withCredentials: true,
      });
      if (res.data?.success) {
        setAllMarcosMap(res.data.data || {});
      }
    } catch (err) {
      console.error('Erro ao buscar marcos batch:', err);
    } finally {
      setAllMarcosLoading(false);
    }
  }, [filteredProjects]);

  // Fetch overview when in overview mode
  useEffect(() => {
    if (isOverviewMode) {
      fetchAllMarcos();
    }
  }, [isOverviewMode, fetchAllMarcos]);

  // Single-project: fetch enriched marcos
  const fetchMarcos = useCallback(async () => {
    if (!projectCode) { setMarcos([]); return; }
    setMarcosLoading(true);
    try {
      const params = { projectCode };
      if (smartsheetId) params.smartsheetId = smartsheetId;
      if (projectName) params.projectName = projectName;

      const res = await axios.get(`${API_URL}/api/marcos-projeto/enriched`, {
        params,
        withCredentials: true,
      });
      setMarcos(res.data?.data || []);
    } catch (err) {
      console.error('Erro ao buscar marcos enriched:', err);
      setMarcos([]);
    } finally {
      setMarcosLoading(false);
    }
  }, [projectCode, smartsheetId, projectName]);

  // Fetch edit logs (unseen)
  const fetchEditLogs = useCallback(async () => {
    if (!projectCode) { setEditLogs([]); return; }
    setEditLogsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/marcos-projeto/edit-log`, {
        params: { projectCode, unseen_only: true },
        withCredentials: true,
      });
      setEditLogs(res.data?.data || []);
    } catch (err) {
      console.error('Erro ao buscar edit logs:', err);
      setEditLogs([]);
    } finally {
      setEditLogsLoading(false);
    }
  }, [projectCode]);

  // Fetch pending baseline requests
  const fetchBaselineRequests = useCallback(async () => {
    if (!projectCode) { setBaselineRequests([]); return; }
    setBaselineLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/marcos-projeto/baseline-requests`, {
        params: { projectCode },
        withCredentials: true,
      });
      const all = res.data?.data || [];
      setBaselineRequests(all.filter(r => r.status === 'pendente'));
    } catch (err) {
      console.error('Erro ao buscar baseline requests:', err);
      setBaselineRequests([]);
    } finally {
      setBaselineLoading(false);
    }
  }, [projectCode]);

  // Fetch single-project data when project changes
  useEffect(() => {
    if (!isOverviewMode) {
      fetchMarcos();
      fetchEditLogs();
      fetchBaselineRequests();
    }
  }, [isOverviewMode, fetchMarcos, fetchEditLogs, fetchBaselineRequests]);

  /* ================================================================
     OVERVIEW: COMPUTED
     ================================================================ */

  const overviewKpis = useMemo(() => {
    let total = 0, comDesvio = 0, naoVinculados = 0, concluidos = 0;
    for (const pc of Object.keys(allMarcosMap)) {
      const { marcos: projectMarcos } = allMarcosMap[pc] || {};
      if (!projectMarcos) continue;
      for (const m of projectMarcos) {
        total++;
        if (m.variacao_dias != null && m.variacao_dias > 0) comDesvio++;
        if (!m.smartsheet_row_id) naoVinculados++;
        if (m.status === 'feito') concluidos++;
      }
    }
    return { total, comDesvio, naoVinculados, concluidos };
  }, [allMarcosMap]);

  // Projects that have marcos (sorted, with counts)
  const overviewProjects = useMemo(() => {
    return filteredProjects
      .map(p => {
        const entry = allMarcosMap[p.project_code_norm];
        const projectMarcos = entry?.marcos || [];
        const pendingCount = entry?.pendingCount || 0;
        return { ...p, marcosCount: projectMarcos.length, pendingCount };
      })
      .filter(p => p.marcosCount > 0)
      .sort((a, b) => {
        // Pending first, then alphabetical
        if (a.pendingCount > 0 && b.pendingCount === 0) return -1;
        if (b.pendingCount > 0 && a.pendingCount === 0) return 1;
        return (a.project_name || '').localeCompare(b.project_name || '');
      });
  }, [filteredProjects, allMarcosMap]);

  const toggleProjectExpand = (code) => {
    setExpandedProjects(prev => ({ ...prev, [code]: !prev[code] }));
  };

  /* ================================================================
     SECTION 1: ACTIVITY PANEL HANDLERS
     ================================================================ */

  const handleMarkSeen = async () => {
    if (!projectCode) return;
    setMarkingSeenLoading(true);
    try {
      await axios.put(
        `${API_URL}/api/marcos-projeto/edit-log/mark-seen`,
        { projectCode },
        { withCredentials: true }
      );
      setEditLogs([]);
    } catch (err) {
      console.error('Erro ao marcar como visto:', err);
      alert('Erro ao marcar como visto: ' + (err.response?.data?.error || err.message));
    } finally {
      setMarkingSeenLoading(false);
    }
  };

  const toggleSnapshot = (id) => {
    setExpandedSnapshots(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleApproveBaseline = async (id) => {
    if (!window.confirm('Confirma a aprovacao desta solicitacao de baseline?')) return;
    setProcessingBaseline(id);
    try {
      await axios.post(
        `${API_URL}/api/marcos-projeto/baseline-requests/${id}/approve`,
        {},
        { withCredentials: true }
      );
      await fetchBaselineRequests();
      await fetchMarcos();
    } catch (err) {
      console.error('Erro ao aprovar baseline:', err);
      alert('Erro ao aprovar: ' + (err.response?.data?.error || err.message));
    } finally {
      setProcessingBaseline(null);
    }
  };

  const handleRejectBaseline = async (id) => {
    if (!rejectReason.trim()) {
      alert('Justificativa e obrigatoria para rejeicao.');
      return;
    }
    setProcessingBaseline(id);
    try {
      await axios.post(
        `${API_URL}/api/marcos-projeto/baseline-requests/${id}/reject`,
        { rejection_reason: rejectReason },
        { withCredentials: true }
      );
      setRejectingId(null);
      setRejectReason('');
      await fetchBaselineRequests();
    } catch (err) {
      console.error('Erro ao rejeitar baseline:', err);
      alert('Erro ao rejeitar: ' + (err.response?.data?.error || err.message));
    } finally {
      setProcessingBaseline(null);
    }
  };

  /* ================================================================
     SECTION 2 + 5: MARCOS CRUD HANDLERS
     ================================================================ */

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return;

    try {
      if (editingId) {
        await axios.put(
          `${API_URL}/api/marcos-projeto/${editingId}`,
          { ...form, nome: form.nome.trim() },
          { withCredentials: true }
        );
      } else {
        await axios.post(
          `${API_URL}/api/marcos-projeto`,
          { ...form, project_code: projectCode, nome: form.nome.trim() },
          { withCredentials: true }
        );
      }
      resetForm();
      await fetchMarcos();
    } catch (err) {
      console.error('Erro ao salvar marco:', err);
      alert('Erro ao salvar: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (id, nome) => {
    if (!window.confirm(`Remover marco "${nome}"?`)) return;
    try {
      await axios.delete(`${API_URL}/api/marcos-projeto/${id}`, { withCredentials: true });
      await fetchMarcos();
    } catch (err) {
      console.error('Erro ao remover marco:', err);
      alert('Erro ao remover: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleEdit = (marco) => {
    setEditingId(marco.id);
    setForm({
      nome: marco.nome || '',
      status: marco.status || 'pendente',
      prazo_baseline: formatDateInput(marco.prazo_baseline),
      prazo_atual: formatDateInput(marco.prazo_atual),
      descricao: marco.descricao || '',
    });
    setShowForm(true);
  };

  const handleMove = async (index, direction) => {
    const swapIdx = index + direction;
    if (swapIdx < 0 || swapIdx >= marcos.length) return;

    const items = [
      { id: marcos[index].id, sort_order: marcos[swapIdx].sort_order },
      { id: marcos[swapIdx].id, sort_order: marcos[index].sort_order },
    ];

    try {
      await axios.put(`${API_URL}/api/marcos-projeto/reorder`, { items }, { withCredentials: true });
      await fetchMarcos();
    } catch (err) {
      console.error('Erro ao reordenar:', err);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ nome: '', status: 'pendente', prazo_baseline: '', prazo_atual: '', descricao: '' });
  };

  /* ================================================================
     SECTION 3: LINK TO SMARTSHEET HANDLERS
     ================================================================ */

  const openLinkModal = async (marcoId, marcoNome, project) => {
    const ssId = project?.smartsheet_id || smartsheetId;
    const pName = project?.project_name || projectName;
    setLinkingMarcoId(marcoId);
    setLinkingMarcoNome(marcoNome);
    setLinkingProject(project || selectedProject);
    setLinkSearch('');
    setLinkBaseline(false);

    if (!ssId && !pName) {
      alert('Este projeto nao possui Smartsheet vinculado.');
      return;
    }

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
      setCronogramaTasks([]);
    } finally {
      setCronogramaLoading(false);
    }
  };

  const closeLinkModal = () => {
    setLinkingMarcoId(null);
    setLinkingMarcoNome('');
    setLinkingProject(null);
    setCronogramaTasks([]);
    setLinkSearch('');
    setLinkBaseline(false);
  };

  const handleSelectTask = async (task) => {
    if (!linkingMarcoId) return;
    const rowId = task.rowId ?? task.row_id;

    try {
      await axios.put(
        `${API_URL}/api/marcos-projeto/${linkingMarcoId}/link`,
        {
          smartsheet_row_id: String(rowId),
          smartsheet_task_name: task.NomeDaTarefa || '',
          vinculado_baseline: linkBaseline,
        },
        { withCredentials: true }
      );
      closeLinkModal();
      // Refresh appropriate data
      if (isOverviewMode) {
        await fetchAllMarcos();
      } else {
        await fetchMarcos();
      }
    } catch (err) {
      console.error('Erro ao vincular tarefa:', err);
      alert('Erro ao vincular: ' + (err.response?.data?.error || err.message));
    }
  };

  const filteredCronogramaTasks = useMemo(() => {
    if (!linkSearch.trim()) return cronogramaTasks;
    const q = linkSearch.toLowerCase();
    return cronogramaTasks.filter(t =>
      (t.NomeDaTarefa || '').toLowerCase().includes(q) ||
      (t.Disciplina || '').toLowerCase().includes(q)
    );
  }, [cronogramaTasks, linkSearch]);

  /* ================================================================
     COMPUTED (single-project mode)
     ================================================================ */

  const activityCount = editLogs.length + baselineRequests.length;
  const hasActivity = activityCount > 0 || editLogsLoading || baselineLoading;

  /* ================================================================
     RENDER
     ================================================================ */

  return (
    <div className="mlv-container">
      {/* ---- Header ---- */}
      <div className="mlv-header">
        <div className="mlv-header-title-row">
          <h1 className="mlv-page-title">Marcos do Projeto</h1>
        </div>
        <div className="mlv-header-controls">
          {/* Time filter */}
          <select
            value={localTimeFilter}
            onChange={e => handleTimeFilterChange(e.target.value)}
            className="mlv-filter-select"
            disabled={portfolioLoading}
          >
            <option value="">Todos os Times</option>
            {uniqueTimes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Leader filter (admin+ only) */}
          {hasFullAccess && (
            <select
              value={localLiderFilter}
              onChange={e => handleLiderFilterChange(e.target.value)}
              className="mlv-filter-select"
              disabled={portfolioLoading}
            >
              <option value="">Todos os Lideres</option>
              {uniqueLiders.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          )}

          {/* Project selector */}
          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="mlv-project-select"
            disabled={portfolioLoading}
          >
            <option value="">
              {portfolioLoading ? 'Carregando...' : `Todos os projetos (${filteredProjects.length})`}
            </option>
            {filteredProjects.map(p => (
              <option key={p.project_code_norm} value={p.project_code_norm}>
                {p.project_name || p.project_code_norm}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ================================================================
         OVERVIEW MODE
         ================================================================ */}
      {isOverviewMode && (
        <>
          {/* KPI strip */}
          {!allMarcosLoading && overviewKpis.total > 0 && (
            <div className="mlv-kpi-strip">
              <div className="mlv-kpi-card">
                <span className="mlv-kpi-value">{overviewKpis.total}</span>
                <span className="mlv-kpi-label">Total</span>
              </div>
              <div className="mlv-kpi-card mlv-kpi-danger">
                <span className="mlv-kpi-value">{overviewKpis.comDesvio}</span>
                <span className="mlv-kpi-label">Com Desvio</span>
              </div>
              <div className="mlv-kpi-card mlv-kpi-warning">
                <span className="mlv-kpi-value">{overviewKpis.naoVinculados}</span>
                <span className="mlv-kpi-label">Nao Vinculados</span>
              </div>
              <div className="mlv-kpi-card mlv-kpi-success">
                <span className="mlv-kpi-value">{overviewKpis.concluidos}</span>
                <span className="mlv-kpi-label">Concluidos</span>
              </div>
            </div>
          )}

          {/* Grouped projects */}
          <div className="mlv-table-card">
            {allMarcosLoading ? (
              <div className="mlv-loading">Carregando marcos de todos os projetos...</div>
            ) : overviewProjects.length === 0 ? (
              <div className="mlv-empty">
                {filteredProjects.length === 0
                  ? 'Nenhum projeto encontrado com os filtros selecionados.'
                  : 'Nenhum marco cadastrado nos projetos filtrados.'}
              </div>
            ) : (
              <div className="mlv-project-groups">
                {overviewProjects.map(proj => {
                  const entry = allMarcosMap[proj.project_code_norm] || {};
                  const projectMarcos = entry.marcos || [];
                  const isExpanded = expandedProjects[proj.project_code_norm];

                  return (
                    <div key={proj.project_code_norm} className="mlv-project-group">
                      <div
                        className="mlv-project-group-header"
                        onClick={() => toggleProjectExpand(proj.project_code_norm)}
                      >
                        <span className={`mlv-project-group-arrow ${isExpanded ? 'open' : ''}`}>
                          {'\u25B6'}
                        </span>
                        <span className="mlv-project-group-name">
                          {proj.project_name || proj.project_code_norm}
                        </span>
                        <span className="mlv-project-group-count">{proj.marcosCount}</span>
                        {proj.pendingCount > 0 && (
                          <span className="mlv-project-group-pending">{proj.pendingCount}</span>
                        )}
                        <button
                          className="mlv-project-group-open-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProjectId(proj.project_code_norm);
                          }}
                          title="Abrir projeto (modo CRUD)"
                        >
                          Gerenciar
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="mlv-project-group-body">
                          <table className="mlv-table">
                            <thead>
                              <tr>
                                <th>Nome</th>
                                <th>Data Cliente</th>
                                <th>Data Cronograma</th>
                                <th>Variacao</th>
                                <th>Tarefa Vinculada</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {projectMarcos.map(m => {
                                const statusOpt = STATUS_OPTIONS.find(s => s.value === m.status) || STATUS_OPTIONS[0];
                                const variacao = m.variacao_dias;
                                const hasLinkedTask = !!(m.smartsheet_task_name || m.smartsheet_row_id);

                                return (
                                  <tr key={m.id}>
                                    <td className="mlv-td-nome">
                                      <span className="mlv-nome">{m.nome}</span>
                                      {m.descricao && (
                                        <span className="mlv-descricao">{m.descricao}</span>
                                      )}
                                    </td>
                                    <td>{formatDateDisplay(m.prazo_atual)}</td>
                                    <td>{formatDateDisplay(m.data_cronograma || m.smartsheet_date)}</td>
                                    <td>
                                      {variacao != null && variacao !== 0 ? (
                                        <span className={`mlv-variacao ${variacao > 0 ? 'atrasado' : 'adiantado'}`}>
                                          {variacao > 0 ? '+' : ''}{variacao}d
                                        </span>
                                      ) : '-'}
                                    </td>
                                    <td>
                                      {hasLinkedTask ? (
                                        <span className="mlv-task-linked">
                                          <span className="mlv-task-linked-icon">{'\u{1F517}'}</span>
                                          {m.smartsheet_task_name || `Row ${m.smartsheet_row_id}`}
                                        </span>
                                      ) : (
                                        <span className="mlv-task-unlinked">
                                          <button
                                            className="mlv-link-btn"
                                            onClick={() => openLinkModal(m.id, m.nome, proj)}
                                            title="Vincular a uma tarefa do cronograma"
                                          >
                                            Vincular
                                          </button>
                                        </span>
                                      )}
                                    </td>
                                    <td>
                                      <span className={`mlv-status-badge ${statusOpt.className}`}>
                                        {statusOpt.label}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ================================================================
         SINGLE-PROJECT MODE (existing behavior)
         ================================================================ */}
      {!isOverviewMode && (
        <>
          {/* ---- Section 1: Activity Panel ---- */}
          {projectCode && hasActivity && (
            <div className="mlv-activity-panel">
              <div className="mlv-activity-header">
                <div className="mlv-activity-header-left">
                  <span className="mlv-activity-icon">{'\u26A0'}</span>
                  <h2 className="mlv-activity-title">Atividades Recentes</h2>
                  {activityCount > 0 && (
                    <span className="mlv-activity-badge">{activityCount}</span>
                  )}
                </div>
              </div>

              <div className="mlv-activity-body">
                {/* 1a. Edit Logs */}
                {editLogsLoading ? (
                  <div className="mlv-loading">Carregando notificacoes...</div>
                ) : editLogs.length > 0 ? (
                  <div className="mlv-edit-log-section">
                    <div className="mlv-subsection-header">
                      <span className="mlv-subsection-title">Alteracoes nao vistas</span>
                      <button
                        className="mlv-mark-seen-btn"
                        onClick={handleMarkSeen}
                        disabled={markingSeenLoading}
                      >
                        {markingSeenLoading ? 'Marcando...' : 'Marcar como visto'}
                      </button>
                    </div>
                    <div className="mlv-log-list">
                      {editLogs.map((entry, idx) => (
                        <div key={entry.id || idx} className={`mlv-log-item ${getLogItemClass(entry)}`}>
                          <span className="mlv-log-icon">{getLogIcon(entry)}</span>
                          <span className="mlv-log-text">{getLogText(entry)}</span>
                          <span className="mlv-log-date">{formatDateTimestamp(entry.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* 1b. Baseline Requests */}
                {baselineLoading ? (
                  <div className="mlv-loading">Carregando solicitacoes de baseline...</div>
                ) : baselineRequests.length > 0 ? (
                  <div className="mlv-baseline-section">
                    <div className="mlv-subsection-header">
                      <span className="mlv-subsection-title">Solicitacoes de Baseline Pendentes</span>
                    </div>
                    {baselineRequests.map(req => (
                      <div key={req.id} className="mlv-baseline-card">
                        <div className="mlv-baseline-card-header">
                          <span className="mlv-baseline-requester">
                            {req.requested_by_name || req.requested_by_email || 'Solicitante'}
                          </span>
                          <span className="mlv-baseline-date">
                            {formatDateTimestamp(req.created_at)}
                          </span>
                        </div>

                        {req.justificativa && (
                          <div className="mlv-baseline-justificativa">
                            <strong>Justificativa:</strong> {req.justificativa}
                          </div>
                        )}

                        {/* Expandable Snapshot */}
                        {req.marcos_snapshot && Array.isArray(req.marcos_snapshot) && req.marcos_snapshot.length > 0 && (
                          <>
                            <button
                              className="mlv-snapshot-toggle"
                              onClick={() => toggleSnapshot(req.id)}
                            >
                              <span className={`mlv-snapshot-arrow ${expandedSnapshots[req.id] ? 'open' : ''}`}>
                                {'\u25B6'}
                              </span>
                              Ver marcos ({req.marcos_snapshot.length})
                            </button>

                            {expandedSnapshots[req.id] && (
                              <div className="mlv-snapshot-list">
                                {req.marcos_snapshot.map((snap, i) => (
                                  <div key={i} className="mlv-snapshot-item">
                                    <span className="mlv-snapshot-name">{snap.nome || snap.name || '-'}</span>
                                    <span className="mlv-snapshot-date">
                                      Baseline: {formatDateDisplay(snap.prazo_baseline)}
                                    </span>
                                    <span className="mlv-snapshot-date">
                                      Atual: {formatDateDisplay(snap.prazo_atual)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}

                        {/* Actions */}
                        <div className="mlv-baseline-actions">
                          {rejectingId === req.id ? (
                            <div className="mlv-reject-form">
                              <textarea
                                className="mlv-reject-input"
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                placeholder="Justificativa da rejeicao (obrigatorio)..."
                                rows={2}
                                autoFocus
                              />
                              <div className="mlv-reject-form-btns">
                                <button
                                  className="mlv-btn mlv-btn-cancel mlv-btn-sm"
                                  onClick={() => { setRejectingId(null); setRejectReason(''); }}
                                >
                                  Cancelar
                                </button>
                                <button
                                  className="mlv-btn mlv-btn-reject mlv-btn-sm"
                                  onClick={() => handleRejectBaseline(req.id)}
                                  disabled={processingBaseline === req.id}
                                >
                                  {processingBaseline === req.id ? 'Rejeitando...' : 'Confirmar Rejeicao'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                className="mlv-btn mlv-btn-approve mlv-btn-sm"
                                onClick={() => handleApproveBaseline(req.id)}
                                disabled={processingBaseline === req.id}
                              >
                                {processingBaseline === req.id ? 'Aprovando...' : 'Aprovar'}
                              </button>
                              <button
                                className="mlv-btn mlv-btn-reject-start mlv-btn-sm"
                                onClick={() => setRejectingId(req.id)}
                              >
                                Rejeitar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Empty state when no activity */}
                {!editLogsLoading && !baselineLoading && editLogs.length === 0 && baselineRequests.length === 0 && (
                  <div className="mlv-activity-empty">
                    Nenhuma atividade pendente para este projeto.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---- Section 4: Actions Bar ---- */}
          {projectCode && (
            <div className="mlv-actions-bar">
              <button
                className="mlv-btn mlv-btn-primary"
                onClick={() => { resetForm(); setShowForm(true); }}
              >
                + Novo Marco
              </button>
            </div>
          )}

          {/* ---- Create/Edit Form ---- */}
          {showForm && (
            <div className="mlv-form-card">
              <h3>{editingId ? 'Editar Marco' : 'Novo Marco'}</h3>
              <form onSubmit={handleSubmit}>
                <div className="mlv-form-grid">
                  <div className="mlv-field">
                    <label>Nome *</label>
                    <input
                      type="text"
                      value={form.nome}
                      onChange={e => setForm({ ...form, nome: e.target.value })}
                      placeholder="Ex: Protocolo Prefeitura"
                      required
                    />
                  </div>
                  <div className="mlv-field">
                    <label>Status</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                      {STATUS_OPTIONS.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mlv-field">
                    <label>Prazo Baseline</label>
                    <input
                      type="date"
                      value={form.prazo_baseline}
                      onChange={e => setForm({ ...form, prazo_baseline: e.target.value })}
                    />
                  </div>
                  <div className="mlv-field">
                    <label>Prazo Atual</label>
                    <input
                      type="date"
                      value={form.prazo_atual}
                      onChange={e => setForm({ ...form, prazo_atual: e.target.value })}
                    />
                  </div>
                  <div className="mlv-field mlv-field-full">
                    <label>Descricao</label>
                    <textarea
                      value={form.descricao}
                      onChange={e => setForm({ ...form, descricao: e.target.value })}
                      placeholder="Descricao do marco (opcional)"
                      rows={2}
                    />
                  </div>
                </div>
                <div className="mlv-form-actions">
                  <button type="submit" className="mlv-btn mlv-btn-primary">
                    {editingId ? 'Salvar' : 'Criar'}
                  </button>
                  <button type="button" className="mlv-btn mlv-btn-ghost" onClick={resetForm}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ---- Section 2: Marcos Table ---- */}
          <div className="mlv-table-card">
            {marcosLoading ? (
              <div className="mlv-loading">Carregando marcos...</div>
            ) : marcos.length === 0 ? (
              <div className="mlv-empty">
                Nenhum marco cadastrado para este projeto.
                <br />
                <span className="mlv-empty-hint">
                  Use "+ Novo Marco" para criar marcos manualmente.
                </span>
              </div>
            ) : (
              <table className="mlv-table">
                <thead>
                  <tr>
                    <th className="mlv-th-order">#</th>
                    <th>Nome</th>
                    <th>Data Cliente</th>
                    <th>Data Cronograma</th>
                    <th>Variacao</th>
                    <th>Tarefa Vinculada</th>
                    <th>Status</th>
                    <th className="mlv-th-actions">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {marcos.map((m, idx) => {
                    const statusOpt = STATUS_OPTIONS.find(s => s.value === m.status) || STATUS_OPTIONS[0];
                    const variacao = m.variacao_dias;
                    const hasLinkedTask = !!(m.smartsheet_task_name || m.smartsheet_row_id);

                    return (
                      <tr key={m.id}>
                        {/* Order */}
                        <td className="mlv-td-order">
                          <div className="mlv-order-btns">
                            <button
                              className="mlv-order-btn"
                              onClick={() => handleMove(idx, -1)}
                              disabled={idx === 0}
                              title="Mover para cima"
                            >{'\u25B2'}</button>
                            <button
                              className="mlv-order-btn"
                              onClick={() => handleMove(idx, 1)}
                              disabled={idx === marcos.length - 1}
                              title="Mover para baixo"
                            >{'\u25BC'}</button>
                          </div>
                        </td>

                        {/* Nome */}
                        <td className="mlv-td-nome">
                          <span className="mlv-nome">{m.nome}</span>
                          {m.descricao && (
                            <span className="mlv-descricao">{m.descricao}</span>
                          )}
                        </td>

                        {/* Data Cliente (prazo_atual do marco) */}
                        <td>{formatDateDisplay(m.prazo_atual)}</td>

                        {/* Data Cronograma (from enriched smartsheet data) */}
                        <td>{formatDateDisplay(m.data_cronograma || m.smartsheet_date)}</td>

                        {/* Variacao */}
                        <td>
                          {variacao != null && variacao !== 0 ? (
                            <span className={`mlv-variacao ${variacao > 0 ? 'atrasado' : 'adiantado'}`}>
                              {variacao > 0 ? '+' : ''}{variacao}d
                            </span>
                          ) : '-'}
                        </td>

                        {/* Tarefa Vinculada */}
                        <td>
                          {hasLinkedTask ? (
                            <span className="mlv-task-linked">
                              <span className="mlv-task-linked-icon">{'\u{1F517}'}</span>
                              {m.smartsheet_task_name || `Row ${m.smartsheet_row_id}`}
                            </span>
                          ) : (
                            <span className="mlv-task-unlinked">
                              <button
                                className="mlv-link-btn"
                                onClick={() => openLinkModal(m.id, m.nome)}
                                title="Vincular a uma tarefa do cronograma"
                              >
                                Vincular
                              </button>
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td>
                          <span className={`mlv-status-badge ${statusOpt.className}`}>
                            {statusOpt.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="mlv-td-actions">
                          <button
                            className="mlv-action-btn link"
                            onClick={() => openLinkModal(m.id, m.nome)}
                            title="Vincular tarefa"
                          >{'\u{1F517}'}</button>
                          <button
                            className="mlv-action-btn edit"
                            onClick={() => handleEdit(m)}
                            title="Editar"
                          >{'\u270E'}</button>
                          <button
                            className="mlv-action-btn delete"
                            onClick={() => handleDelete(m.id, m.nome)}
                            title="Remover"
                          >{'\u2715'}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ---- Section 3: Link to Smartsheet Modal ---- */}
      {linkingMarcoId && (
        <div className="mlv-link-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) closeLinkModal();
        }}>
          <div className="mlv-link-modal">
            <div className="mlv-link-modal-header">
              <h3 className="mlv-link-modal-title">
                Vincular "{linkingMarcoNome}" a tarefa do cronograma
              </h3>
              <button className="mlv-link-modal-close" onClick={closeLinkModal}>
                {'\u2715'}
              </button>
            </div>

            <div className="mlv-link-search">
              <input
                type="text"
                placeholder="Buscar tarefa por nome ou disciplina..."
                value={linkSearch}
                onChange={e => setLinkSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div className="mlv-link-list">
              {cronogramaLoading ? (
                <div className="mlv-link-loading">Carregando tarefas do cronograma...</div>
              ) : filteredCronogramaTasks.length === 0 ? (
                <div className="mlv-link-empty">
                  {cronogramaTasks.length === 0
                    ? 'Nenhuma tarefa encontrada no cronograma.'
                    : 'Nenhuma tarefa corresponde a busca.'}
                </div>
              ) : (
                filteredCronogramaTasks.map((task, idx) => {
                  const taskRowId = task.rowId ?? task.row_id ?? idx;
                  return (
                    <div
                      key={taskRowId}
                      className="mlv-link-item"
                      onClick={() => handleSelectTask(task)}
                    >
                      <div className="mlv-link-item-info">
                        <div className="mlv-link-item-name">
                          {task.NomeDaTarefa || 'Sem nome'}
                        </div>
                        <div className="mlv-link-item-meta">
                          <span>Termino: {formatDateDisplay(task.DataDeTermino)}</span>
                          {task.Disciplina && <span>Disciplina: {task.Disciplina}</span>}
                          {task.Status && <span>Status: {task.Status}</span>}
                        </div>
                      </div>
                      <div className="mlv-link-item-select-btn">
                        <button className="mlv-btn mlv-btn-secondary mlv-btn-sm">
                          Selecionar
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mlv-link-baseline-check">
              <label>
                <input
                  type="checkbox"
                  checked={linkBaseline}
                  onChange={e => setLinkBaseline(e.target.checked)}
                />
                {' '}Amarrar a baseline (vinculado_baseline)
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MarcosLiderView;
