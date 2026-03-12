/**
 * Portal do Cliente - Apontamentos
 *
 * Indicadores de apontamentos (issues) do projeto via portal.
 * Adaptado de VistaClienteApontamentosView para usar Bearer token auth.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { Chart, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { API_URL } from '../../api';
import { useClientAuth } from '../../contexts/ClientAuthContext';
import {
  isResolved, isReproved,
  processIssueData, computeIndicators,
  aggregateByPriority, aggregateByPhase,
  aggregateByDiscipline, aggregateByCategory, aggregateByLocal,
  extractUniqueLocals,
  sortPhaseLabels, sortPriorityLabels,
  aggregateByMonth,
} from '../../utils/apontamentosHelpers';
import '../../styles/VistaClienteView.css';
import '../vista-cliente/VistaClienteApontamentosView.css';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, ArcElement,
  LineElement, PointElement,
  Title, Tooltip, Legend, ChartDataLabels
);

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

// Colors
const COLOR_RESOLVED = '#15803d';
const COLOR_ACTIVE = '#dc2626';
const COLOR_REPROVED = '#d97706';

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

function ClientApontamentosView() {
  const { projectCode } = useParams();
  const { currentProject } = useOutletContext();
  const { getClientToken } = useClientAuth();

  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedLocals, setSelectedLocals] = useState([]);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const construflowId = currentProject?.construflowId || null;

  const clientAxios = useCallback(() => ({
    headers: { Authorization: `Bearer ${getClientToken()}` },
  }), [getClientToken]);

  // Fetch issues
  useEffect(() => {
    if (!construflowId || !projectCode) {
      setIssues([]);
      setLoading(false);
      return;
    }
    setSelectedLocals([]);
    async function loadIssues() {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(
          `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/apontamentos`,
          { ...clientAxios(), params: { construflowId } }
        );
        setIssues(processIssueData(res.data.data || []));
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Erro ao carregar apontamentos');
        setIssues([]);
      } finally {
        setLoading(false);
      }
    }
    loadIssues();
  }, [construflowId, projectCode, clientAxios]);

  // Filtered issues
  const filteredIssues = useMemo(() => {
    if (selectedLocals.length === 0) return issues;
    return issues.filter(issue => {
      const names = (issue.locals || []).map(l => typeof l === 'string' ? l : l.name || l);
      return selectedLocals.some(s => names.includes(s));
    });
  }, [issues, selectedLocals]);

  // Computed data
  const uniqueLocals = useMemo(() => extractUniqueLocals(issues), [issues]);
  const indicators = useMemo(() => computeIndicators(filteredIssues), [filteredIssues]);
  const priorityData = useMemo(() => aggregateByPriority(filteredIssues), [filteredIssues]);
  const phaseData = useMemo(() => aggregateByPhase(filteredIssues), [filteredIssues]);
  const disciplineData = useMemo(() => aggregateByDiscipline(filteredIssues), [filteredIssues]);
  const monthlyData = useMemo(() => aggregateByMonth(filteredIssues), [filteredIssues]);

  const categoryData = useMemo(() => aggregateByCategory(filteredIssues), [filteredIssues]);
  const localData = useMemo(() => aggregateByLocal(filteredIssues), [filteredIssues]);

  // Chart data
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

  const monthlyChartData = useMemo(() => {
    if (!monthlyData) return null;
    return {
      labels: monthlyData.labels,
      datasets: [
        {
          type: 'bar',
          label: 'Abertos no mês',
          data: monthlyData.opened,
          backgroundColor: 'rgba(239,68,68,0.7)',
          borderRadius: 4,
          yAxisID: 'y',
          order: 2,
        },
        {
          type: 'bar',
          label: 'Resolvidos no mês',
          data: monthlyData.resolved,
          backgroundColor: 'rgba(34,197,94,0.7)',
          borderRadius: 4,
          yAxisID: 'y',
          order: 2,
        },
        {
          type: 'line',
          label: 'Acumulado abertos',
          data: monthlyData.cumulativeOpened,
          borderColor: '#dc2626',
          backgroundColor: '#dc2626',
          tension: 0.3,
          pointRadius: 2,
          borderWidth: 2,
          yAxisID: 'y1',
          order: 1,
        },
        {
          type: 'line',
          label: 'Acumulado resolvidos',
          data: monthlyData.cumulativeResolved,
          borderColor: '#15803d',
          backgroundColor: '#15803d',
          tension: 0.3,
          pointRadius: 2,
          borderWidth: 2,
          yAxisID: 'y1',
          order: 1,
        },
      ],
    };
  }, [monthlyData]);

  const monthlyChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom' },
      datalabels: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        position: 'left',
        title: { display: true, text: 'Mensal' },
        ticks: { precision: 0 },
      },
      y1: {
        beginAtZero: true,
        position: 'right',
        title: { display: true, text: 'Acumulado' },
        ticks: { precision: 0 },
        grid: { drawOnChartArea: false },
      },
    },
  }), []);

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

  const retryLoad = () => {
    if (construflowId && projectCode) {
      setLoading(true);
      setError(null);
      axios.get(
        `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/apontamentos`,
        { ...clientAxios(), params: { construflowId } }
      ).then(res => {
        setIssues(processIssueData(res.data.data || []));
      }).catch(err => {
        setError(err.response?.data?.error || err.message);
      }).finally(() => setLoading(false));
    }
  };

  // No construflow integration
  if (!construflowId && !loading) {
    return (
      <div className="cp-view-empty">
        <span className="cp-view-empty-icon">&#128279;</span>
        Este projeto nao possui integracao com o Construflow.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="cp-view-loading">
        <div className="cp-view-spinner" />
        Carregando apontamentos...
      </div>
    );
  }

  if (error) {
    return (
      <div className="cp-view-error">
        <span>Erro: {error}</span>
        <button className="vca-error-retry" onClick={retryLoad}>Tentar novamente</button>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="cp-view-empty">
        <span className="cp-view-empty-icon">&#128196;</span>
        Nenhum apontamento encontrado para este projeto.
      </div>
    );
  }

  return (
    <div className="vista-cliente-container">
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
      </div>

      {/* Charts Grid */}
      <div className="vca-charts-grid">
        {/* Monthly Evolution (full width) */}
        {monthlyChartData && (
          <div className="vca-chart-card" style={{ gridColumn: '1 / -1' }}>
            <h4>Evolução Mensal</h4>
            <div style={{ height: '280px' }}>
              <Chart type="bar" data={monthlyChartData} options={monthlyChartOptions} />
            </div>
          </div>
        )}

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
    </div>
  );
}

export default ClientApontamentosView;
