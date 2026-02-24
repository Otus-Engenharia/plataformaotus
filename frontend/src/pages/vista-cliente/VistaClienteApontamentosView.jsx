/**
 * Vista do Cliente - Apontamentos
 *
 * Página presentation-ready para apresentações ao cliente.
 * Mostra indicadores de apontamentos e pendências do cliente.
 * Layout: scroll único (sem abas) para facilitar apresentações.
 */

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { API_URL } from '../../api';
import {
  isResolved, isReproved, translatePriority,
  processIssueData, computeIndicators,
  aggregateByPriority, aggregateByPhase,
  aggregateByDiscipline, aggregateByCategory, aggregateByLocal,
  extractClientDisciplines, filterClientOpenIssues,
  extractUniqueLocals, getTimeSinceUpdate,
  sortPhaseLabels, sortPriorityLabels, PHASE_ORDER,
} from '../../utils/apontamentosHelpers';
import '../../styles/VistaClienteView.css';
import './VistaClienteApontamentosView.css';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, ArcElement,
  Title, Tooltip, Legend, ChartDataLabels
);

// ---- Constants ----
const FINALIZED_STATUSES = [
  'churn pelo cliente', 'close', 'obra finalizada', 'termo de encerramento',
  'termo de encerrame', 'encerrado', 'finalizado', 'concluído', 'concluido',
  'cancelado', 'execução', 'execucao',
];
const PAUSED_STATUSES = ['pausado', 'pausa', 'em pausa', 'pausado pelo cliente', 'suspenso', 'suspensão'];

const isFinalizedStatus = (s) => {
  if (!s) return false;
  const low = String(s).toLowerCase().trim();
  return FINALIZED_STATUSES.some(f => low === f.toLowerCase().trim() || low.includes(f.toLowerCase().trim()));
};
const isPausedStatus = (s) => {
  if (!s) return false;
  const low = String(s).toLowerCase().trim();
  return PAUSED_STATUSES.some(p => low === p.toLowerCase().trim() || low.includes(p.toLowerCase().trim()));
};

// Chart.js center text plugin for donut
const centerTextPlugin = {
  id: 'vcaCenterText',
  afterDraw: (chart) => {
    if (chart.config.type !== 'doughnut') return;
    const text = chart.options.plugins?.vcaCenterText?.text;
    if (!text) return;
    const { ctx, width, height } = chart;
    ctx.save();
    ctx.font = "700 26px 'Bricolage Grotesque', 'DM Sans', sans-serif";
    ctx.fillStyle = '#1c1917';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);
    ctx.restore();
  },
};
ChartJS.register(centerTextPlugin);

// Shared bar chart options
const vcBarOptions = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    datalabels: {
      display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0,
      color: '#ffffff',
      font: { size: 11, weight: '600', family: "'DM Sans', sans-serif" },
      anchor: 'center',
      align: 'center',
      formatter: (v) => v > 0 ? v : '',
    },
  },
  scales: {
    x: {
      stacked: true,
      beginAtZero: true,
      grid: { color: 'rgba(231,229,228,0.5)' },
      ticks: { font: { size: 11, family: "'DM Sans', sans-serif" } },
    },
    y: {
      stacked: true,
      ticks: { font: { size: 12, family: "'DM Sans', sans-serif" } },
      grid: { display: false },
    },
  },
};

// Total labels plugin (show total to right of stacked bars)
const totalLabelsPlugin = {
  id: 'vcaTotalLabels',
  afterDatasetsDraw: (chart) => {
    if (chart.config.type !== 'bar' || chart.config.options.indexAxis !== 'y') return;
    try {
      const ctx = chart.ctx;
      const meta = chart.getDatasetMeta(0);
      if (!meta?.data?.length) return;
      const totals = [];
      for (let i = 0; i < chart.data.labels.length; i++) {
        let total = 0;
        chart.data.datasets.forEach((ds) => { if (ds.data?.[i]) total += ds.data[i]; });
        totals.push(total);
      }
      meta.data.forEach((bar, index) => {
        const total = totals[index];
        if (total > 0 && bar && typeof bar.x === 'number' && typeof bar.y === 'number') {
          const lastMeta = chart.getDatasetMeta(chart.data.datasets.length - 1);
          const lastBar = lastMeta?.data?.[index];
          if (lastBar && typeof lastBar.x === 'number') {
            const x = lastBar.x + (lastBar.width || 0);
            ctx.save();
            ctx.fillStyle = '#78716c';
            ctx.font = "600 11px 'DM Sans', sans-serif";
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(total.toString(), x + 8, bar.y);
            ctx.restore();
          }
        }
      });
    } catch (e) { /* ignore */ }
  },
};
ChartJS.register(totalLabelsPlugin);

// ---- Colors ----
const COLOR_RESOLVED = '#15803d';
const COLOR_ACTIVE = '#dc2626';
const COLOR_REPROVED = '#d97706';

// ============================================================
//  Main Component
// ============================================================
function VistaClienteApontamentosView() {
  const [portfolio, setPortfolio] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedLocals, setSelectedLocals] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  // ---- Portfolio fetch ----
  useEffect(() => {
    async function load() {
      try {
        const res = await axios.get(`${API_URL}/api/portfolio`, { withCredentials: true });
        const data = res.data.data || [];
        setPortfolio(data);
        const valid = data
          .filter(p => p.project_code_norm && !isFinalizedStatus(p.status) && !isPausedStatus(p.status))
          .reduce((acc, p) => {
            if (!acc.find(x => x.project_code_norm === p.project_code_norm)) acc.push(p);
            return acc;
          }, [])
          .sort((a, b) => (a.project_name || '').localeCompare(b.project_name || '', 'pt-BR'));
        if (valid.length > 0) setSelectedProjectId(valid[0].project_code_norm);
      } catch (err) {
        console.error('Erro ao buscar portfolio:', err);
      }
    }
    load();
  }, []);

  // ---- Selected project ----
  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return portfolio.find(p => String(p.project_code_norm || p.project_code) === String(selectedProjectId));
  }, [portfolio, selectedProjectId]);

  const construflowId = selectedProject?.construflow_id;

  // ---- Issues fetch ----
  useEffect(() => {
    if (!construflowId) {
      setIssues([]);
      setLoading(false);
      return;
    }
    setSelectedLocals([]);
    async function loadIssues() {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${API_URL}/api/projetos/apontamentos`, {
          params: { construflowId },
          withCredentials: true,
        });
        setIssues(processIssueData(res.data.data || []));
        setLastUpdate(new Date());
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Erro ao carregar apontamentos');
        setIssues([]);
      } finally {
        setLoading(false);
      }
    }
    loadIssues();
  }, [construflowId]);

  // ---- Filtered issues ----
  const filteredIssues = useMemo(() => {
    if (selectedLocals.length === 0) return issues;
    return issues.filter(issue => {
      const names = (issue.locals || []).map(l => typeof l === 'string' ? l : l.name || l);
      return selectedLocals.some(s => names.includes(s));
    });
  }, [issues, selectedLocals]);

  // ---- Computed data ----
  const uniqueLocals = useMemo(() => extractUniqueLocals(issues), [issues]);
  const indicators = useMemo(() => computeIndicators(filteredIssues), [filteredIssues]);
  const clientDisciplines = useMemo(() => extractClientDisciplines(selectedProject), [selectedProject]);
  const clientOpenIssues = useMemo(() => filterClientOpenIssues(filteredIssues, clientDisciplines), [filteredIssues, clientDisciplines]);
  const priorityData = useMemo(() => aggregateByPriority(filteredIssues), [filteredIssues]);
  const phaseData = useMemo(() => aggregateByPhase(filteredIssues), [filteredIssues]);
  const disciplineData = useMemo(() => aggregateByDiscipline(filteredIssues), [filteredIssues]);
  const categoryData = useMemo(() => aggregateByCategory(filteredIssues), [filteredIssues]);
  const localData = useMemo(() => aggregateByLocal(filteredIssues), [filteredIssues]);

  // ---- Chart data ----
  const donutData = useMemo(() => ({
    labels: ['Resolvidos', 'Ativos'],
    datasets: [{
      data: [indicators.resolvidos, indicators.ativos],
      backgroundColor: [COLOR_RESOLVED, COLOR_ACTIVE],
      borderWidth: 2,
      borderColor: '#ffffff',
    }],
  }), [indicators]);

  const donutOptions = useMemo(() => {
    const pct = indicators.total > 0 ? ((indicators.resolvidos / indicators.total) * 100).toFixed(1) : '0';
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        vcaCenterText: { text: `${pct}%` },
        datalabels: {
          display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0,
          color: '#ffffff',
          font: { size: 13, weight: '700', family: "'DM Sans', sans-serif" },
          formatter: (v) => v > 0 ? v : '',
        },
      },
    };
  }, [indicators]);

  const priorityChartData = useMemo(() => {
    const labels = sortPriorityLabels(Object.keys(priorityData));
    return {
      labels,
      datasets: [
        { label: 'Resolvidos', data: labels.map(l => priorityData[l].resolvidos), backgroundColor: COLOR_RESOLVED },
        { label: 'Ativos', data: labels.map(l => priorityData[l].ativos), backgroundColor: COLOR_ACTIVE },
      ],
    };
  }, [priorityData]);

  const phaseChartData = useMemo(() => {
    const labels = sortPhaseLabels(Object.keys(phaseData));
    return {
      labels,
      datasets: [
        { label: 'Resolvidos', data: labels.map(l => phaseData[l].resolvidos), backgroundColor: COLOR_RESOLVED },
        { label: 'Ativos', data: labels.map(l => phaseData[l].ativos), backgroundColor: COLOR_ACTIVE },
      ],
    };
  }, [phaseData]);

  const disciplineChartData = useMemo(() => {
    const entries = Object.entries(disciplineData).sort((a, b) => b[1].total - a[1].total);
    const labels = entries.map(([n]) => n);
    return {
      labels,
      datasets: [
        { label: 'Resolvidos', data: entries.map(([, d]) => d.resolvidos), backgroundColor: COLOR_RESOLVED },
        { label: 'Ativos', data: entries.map(([, d]) => d.ativos), backgroundColor: COLOR_ACTIVE },
      ],
    };
  }, [disciplineData]);

  const categoryChartData = useMemo(() => {
    const entries = Object.entries(categoryData).sort((a, b) => b[1].total - a[1].total);
    const labels = entries.map(([n]) => n);
    return {
      labels,
      datasets: [
        { label: 'Resolvidos', data: entries.map(([, d]) => d.resolvidos), backgroundColor: COLOR_RESOLVED },
        { label: 'Ativos', data: entries.map(([, d]) => d.ativos), backgroundColor: COLOR_ACTIVE },
      ],
    };
  }, [categoryData]);

  const localChartData = useMemo(() => {
    const entries = Object.entries(localData).sort((a, b) => b[1].issues.length - a[1].issues.length);
    const labels = entries.map(([, d]) => d.abbreviation);
    return {
      labels,
      datasets: [
        { label: 'Resolvidos', data: entries.map(([, d]) => d.issues.filter(i => isResolved(i.status)).length), backgroundColor: COLOR_RESOLVED },
        { label: 'Ativos', data: entries.map(([, d]) => d.issues.filter(i => !isResolved(i.status) && !isReproved(i.status)).length), backgroundColor: COLOR_ACTIVE },
        { label: 'Reprovados', data: entries.map(([, d]) => d.issues.filter(i => isReproved(i.status)).length), backgroundColor: COLOR_REPROVED },
      ],
    };
  }, [localData]);

  // ---- Client open issues sorted ----
  const sortedClientIssues = useMemo(() => {
    const priorityOrder = { 'alta': 1, 'média': 2, 'media': 2, 'baixa': 3 };
    return [...clientOpenIssues].sort((a, b) => {
      const pA = translatePriority(a.priority).toLowerCase();
      const pB = translatePriority(b.priority).toLowerCase();
      const oA = priorityOrder[pA] || 999;
      const oB = priorityOrder[pB] || 999;
      if (oA !== oB) return oA - oB;
      const tA = getTimeSinceUpdate(a);
      const tB = getTimeSinceUpdate(b);
      return tB.days - tA.days;
    });
  }, [clientOpenIssues]);

  // ---- Project selector ----
  const sortedProjects = useMemo(() => {
    return portfolio
      .filter(p => {
        if (!p.project_code_norm) return false;
        if (showOnlyActive) {
          if (isFinalizedStatus(p.status) || isPausedStatus(p.status)) return false;
        }
        return true;
      })
      .reduce((acc, p) => {
        if (!acc.find(x => x.project_code_norm === p.project_code_norm)) acc.push(p);
        return acc;
      }, [])
      .sort((a, b) => (a.project_name || '').localeCompare(b.project_name || '', 'pt-BR'));
  }, [portfolio, showOnlyActive]);

  // ---- Helpers ----
  const toggleRow = (id) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getIssueLink = (issue) => {
    const cfProjectId = selectedProject?.construflow_project_id || selectedProject?.construflow_id;
    if (!cfProjectId || !issue.id) return '#';
    return `https://app.construflow.com.br/workspace/project/${cfProjectId}/issues?issueId=${issue.id}`;
  };

  const retryLoad = () => {
    if (construflowId) {
      setLoading(true);
      setError(null);
      axios.get(`${API_URL}/api/projetos/apontamentos`, {
        params: { construflowId },
        withCredentials: true,
      }).then(res => {
        setIssues(processIssueData(res.data.data || []));
        setLastUpdate(new Date());
      }).catch(err => {
        setError(err.response?.data?.error || err.message);
      }).finally(() => setLoading(false));
    }
  };

  // ============================================================
  //  RENDER
  // ============================================================
  return (
    <div className="vista-cliente-container">
      {/* ---- Header ---- */}
      <div className="vc-header">
        <div className="vc-header-title-row">
          <h1 className="vc-project-title">
            {selectedProject
              ? (selectedProject.project_name || selectedProject.project_code_norm)
              : 'Apontamentos'}
          </h1>
        </div>
        <div className="vc-header-controls">
          <select
            value={selectedProjectId || ''}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="vc-project-select"
          >
            <option value="">Selecione um projeto</option>
            {sortedProjects.map(p => (
              <option key={p.project_code_norm} value={p.project_code_norm}>
                {p.project_name || p.project_code_norm}
              </option>
            ))}
          </select>
          <label className="vc-active-toggle">
            <input
              type="checkbox"
              checked={showOnlyActive}
              onChange={e => setShowOnlyActive(e.target.checked)}
            />
            Somente Ativos
          </label>
          {lastUpdate && (
            <span className="vc-last-update">
              {lastUpdate.toLocaleDateString('pt-BR')} {lastUpdate.toLocaleTimeString('pt-BR')}
            </span>
          )}
        </div>
      </div>

      {/* ---- States ---- */}
      {!selectedProjectId && (
        <div className="vca-empty">
          <span className="vca-empty-icon">&#128203;</span>
          Selecione um projeto para visualizar os apontamentos.
        </div>
      )}

      {selectedProjectId && !construflowId && !loading && (
        <div className="vca-empty">
          <span className="vca-empty-icon">&#128279;</span>
          Este projeto não possui integração com o Construflow.
        </div>
      )}

      {loading && (
        <div className="vca-loading">Carregando apontamentos...</div>
      )}

      {error && (
        <div className="vca-error">
          <span>Erro: {error}</span>
          <button className="vca-error-retry" onClick={retryLoad}>Tentar novamente</button>
        </div>
      )}

      {/* ---- Main content ---- */}
      {!loading && !error && issues.length > 0 && (
        <>
          {/* Local filter */}
          {uniqueLocals.length > 1 && (
            <div className="vca-filter-bar">
              <span className="vca-filter-label">Filtrar por Local:</span>
              <div className="vca-filter-chips">
                {uniqueLocals.map(local => (
                  <button
                    key={local.name}
                    type="button"
                    className={`vca-filter-chip ${selectedLocals.includes(local.name) ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedLocals(prev =>
                        prev.includes(local.name) ? prev.filter(l => l !== local.name) : [...prev, local.name]
                      );
                    }}
                  >
                    {local.abbreviation || local.name}
                  </button>
                ))}
                {selectedLocals.length > 0 && (
                  <button type="button" className="vca-filter-clear" onClick={() => setSelectedLocals([])}>
                    Limpar
                  </button>
                )}
              </div>
              {selectedLocals.length > 0 && (
                <span className="vca-filter-info">
                  Mostrando {filteredIssues.length} de {issues.length} apontamentos
                </span>
              )}
            </div>
          )}

          {/* KPI Strip */}
          <div className="vc-kpi-strip">
            <div className="vc-kpi-card">
              <span className="vc-kpi-label">Total</span>
              <span className="vc-kpi-value">{indicators.total}</span>
              <span className="vc-kpi-detail">Apontamentos</span>
            </div>
            <div className={`vc-kpi-card ${indicators.resolvidos > 0 ? 'status-good' : ''}`}>
              <span className="vc-kpi-label">Resolvidos</span>
              <span className="vc-kpi-value">{indicators.resolvidos}</span>
              <span className="vc-kpi-detail">
                {indicators.total > 0
                  ? `${((indicators.resolvidos / indicators.total) * 100).toFixed(1)}% do total`
                  : '0% do total'}
              </span>
            </div>
            <div className={`vc-kpi-card ${indicators.ativos > indicators.total * 0.5 ? 'status-warning' : ''}`}>
              <span className="vc-kpi-label">Ativos</span>
              <span className="vc-kpi-value">{indicators.ativos}</span>
              <span className="vc-kpi-detail">
                {indicators.total > 0
                  ? `${((indicators.ativos / indicators.total) * 100).toFixed(1)}% do total`
                  : '0% do total'}
              </span>
            </div>
            <div className={`vc-kpi-card ${indicators.ativosAltaPrioridade > 0 ? 'status-danger' : ''}`}>
              <span className="vc-kpi-label">Alta Prioridade</span>
              <span className="vc-kpi-value">{indicators.ativosAltaPrioridade}</span>
              <span className="vc-kpi-detail">{indicators.percentualAltaPrioridade}% dos ativos</span>
            </div>
            <div className={`vc-kpi-card ${clientOpenIssues.length > 0 ? 'status-accent' : ''}`}>
              <span className="vc-kpi-label">Pendências do Cliente</span>
              <span className="vc-kpi-value">
                {clientDisciplines.length > 0 ? clientOpenIssues.length : '--'}
              </span>
              <span className="vc-kpi-detail">
                {clientDisciplines.length > 0 ? 'em aberto' : 'não configurado'}
              </span>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="vca-charts-grid">
            {/* Left: Donut + Priority */}
            <div className="vca-chart-card">
              <h4>Panorama Geral</h4>
              <div className="vca-donut-area">
                <Doughnut data={donutData} options={donutOptions} />
              </div>
              <div className="vca-legend">
                <span className="vca-legend-item">
                  <span className="vca-legend-dot" style={{ background: COLOR_RESOLVED }} />
                  Resolvidos
                </span>
                <span className="vca-legend-item">
                  <span className="vca-legend-dot" style={{ background: COLOR_ACTIVE }} />
                  Ativos
                </span>
              </div>
              {priorityChartData.labels.length > 0 && (
                <>
                  <div className="vca-chart-divider" />
                  <h4>Por Prioridade</h4>
                  <div className="vca-chart-area" style={{ minHeight: `${Math.max(120, priorityChartData.labels.length * 40)}px` }}>
                    <Bar data={priorityChartData} options={vcBarOptions} />
                  </div>
                </>
              )}
            </div>

            {/* Right: Phase + Discipline */}
            <div className="vca-chart-card">
              <h4>Por Fase</h4>
              <div className="vca-chart-area" style={{ minHeight: `${Math.max(120, phaseChartData.labels.length * 40)}px` }}>
                <Bar data={phaseChartData} options={vcBarOptions} />
              </div>
              {disciplineChartData.labels.length > 0 && (
                <>
                  <div className="vca-chart-divider" />
                  <h4>Por Disciplina</h4>
                  <div className="vca-chart-area-tall" style={{ minHeight: `${Math.max(200, disciplineChartData.labels.length * 32)}px` }}>
                    <Bar data={disciplineChartData} options={{ ...vcBarOptions, maintainAspectRatio: false }} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ---- PENDÊNCIAS DO CLIENTE (HERO) ---- */}
          <div className="vca-pendencias-section">
            <div className="vca-pendencias-header">
              <h3 className="vca-pendencias-title">Pendências do Cliente</h3>
              {clientDisciplines.length > 0 && (
                <span className="vca-pendencias-badge">
                  {clientOpenIssues.length} em aberto
                </span>
              )}
            </div>

            {clientDisciplines.length > 0 && (
              <div className="vca-pendencias-info">
                Disciplinas do cliente: <strong>{clientDisciplines.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}</strong>
              </div>
            )}

            {clientDisciplines.length === 0 && (
              <div className="vca-pendencias-empty">
                <span className="vca-pendencias-empty-icon">&#9881;</span>
                Disciplinas do cliente não configuradas para este projeto.
              </div>
            )}

            {clientDisciplines.length > 0 && sortedClientIssues.length === 0 && (
              <div className="vca-pendencias-empty">
                <span className="vca-pendencias-empty-icon">&#10003;</span>
                Nenhuma pendência em aberto. Tudo em dia!
              </div>
            )}

            {sortedClientIssues.length > 0 && (
              <div className="vca-table-container">
                <table className="vca-table">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>Código</th>
                      <th>Título</th>
                      <th style={{ width: 90 }}>Prioridade</th>
                      <th style={{ width: 120 }}>Disciplina</th>
                      <th style={{ width: 100 }}>Local</th>
                      <th style={{ width: 110 }}>Dias pendente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedClientIssues.map(issue => {
                      const priority = translatePriority(issue.priority);
                      const priorityClass = priority.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                      const timeSince = getTimeSinceUpdate(issue);
                      const isExpanded = expandedRows.has(issue.guid || issue.id);

                      // Client disciplines that match
                      const matchingDiscs = (issue.disciplines || [])
                        .filter(d => {
                          const name = String(d.name || '').toLowerCase();
                          const status = String(d.status || '').toLowerCase();
                          const isOpen = status === 'todo' || status === '' || !d.status;
                          return isOpen && clientDisciplines.some(cd =>
                            name.includes(cd) || cd.includes(name)
                          );
                        })
                        .map(d => d.name);

                      const localsStr = (issue.locals || [])
                        .map(l => l.abbreviation || l.name || l)
                        .join(', ') || '-';

                      return (
                        <React.Fragment key={issue.guid || issue.id}>
                          <tr>
                            <td>
                              <a href={getIssueLink(issue)} target="_blank" rel="noopener noreferrer" className="vca-issue-code">
                                {issue.code || '-'}
                              </a>
                            </td>
                            <td>
                              <div className="vca-issue-title-row">
                                <button className="vca-expand-btn" onClick={() => toggleRow(issue.guid || issue.id)}>
                                  {isExpanded ? '▼' : '▶'}
                                </button>
                                <span className="vca-issue-title">{issue.title || 'Sem título'}</span>
                              </div>
                              {isExpanded && issue.description && (
                                <div className="vca-issue-description">{issue.description}</div>
                              )}
                            </td>
                            <td>
                              <span className={`vca-priority-badge ${priorityClass}`}>
                                {priority}
                              </span>
                            </td>
                            <td>{matchingDiscs.join(', ') || '-'}</td>
                            <td>{localsStr}</td>
                            <td>
                              <span className={timeSince.days > 30 ? 'vca-days-danger' : ''}>
                                {timeSince.text}
                              </span>
                              <div className="vca-update-type">{timeSince.type}</div>
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ---- Breakdown (collapsible) ---- */}
          {(categoryChartData.labels.length > 0 || Object.keys(localData).length > 0) && (
            <div className="vca-breakdown-section">
              <button className="vca-breakdown-toggle" onClick={() => setBreakdownOpen(!breakdownOpen)}>
                <span className={`vca-breakdown-arrow ${breakdownOpen ? 'open' : ''}`}>▶</span>
                Detalhamento por Categoria e Local
              </button>
              {breakdownOpen && (
                <div className="vca-breakdown-grid">
                  {categoryChartData.labels.length > 0 && (
                    <div className="vca-chart-card">
                      <h4>Por Categoria</h4>
                      <div className="vca-chart-area-tall" style={{ minHeight: `${Math.max(200, categoryChartData.labels.length * 32)}px` }}>
                        <Bar data={categoryChartData} options={{ ...vcBarOptions, maintainAspectRatio: false }} />
                      </div>
                    </div>
                  )}
                  {Object.keys(localData).length > 0 && (
                    <div className="vca-chart-card">
                      <h4>Por Local</h4>
                      <div className="vca-legend" style={{ justifyContent: 'flex-start', marginBottom: 8 }}>
                        <span className="vca-legend-item"><span className="vca-legend-dot" style={{ background: COLOR_RESOLVED }} /> Resolvidos</span>
                        <span className="vca-legend-item"><span className="vca-legend-dot" style={{ background: COLOR_ACTIVE }} /> Ativos</span>
                        <span className="vca-legend-item"><span className="vca-legend-dot" style={{ background: COLOR_REPROVED }} /> Reprovados</span>
                      </div>
                      <div className="vca-chart-area-tall" style={{ minHeight: `${Math.max(200, localChartData.labels.length * 32)}px` }}>
                        <Bar data={localChartData} options={{
                          ...vcBarOptions,
                          maintainAspectRatio: false,
                          plugins: {
                            ...vcBarOptions.plugins,
                            legend: { display: false },
                          },
                        }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Empty issues */}
      {!loading && !error && issues.length === 0 && selectedProjectId && construflowId && (
        <div className="vca-empty">
          <span className="vca-empty-icon">&#128196;</span>
          Nenhum apontamento encontrado para este projeto.
        </div>
      )}
    </div>
  );
}

export default VistaClienteApontamentosView;
