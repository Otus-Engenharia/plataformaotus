/**
 * Componente: Vista de Indicadores de Feedbacks
 *
 * Dashboard analytics com KPIs, distribuição por status/área/autor,
 * evolução mensal e tempo de resolução. Recebe feedbacks como prop
 * (já carregados pelo FeedbackKanbanView).
 */

import React, { useMemo } from 'react';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { format, parseISO, differenceInDays, startOfMonth, eachMonthOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import './FeedbackAnalyticsView.css';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
);

// Labels amigáveis
const STATUS_LABELS = {
  pendente: 'Pendente',
  em_analise: 'Em Análise',
  em_progresso: 'Em Progresso',
  backlog_desenvolvimento: 'Em Progresso',
  backlog_treinamento: 'Em Progresso',
  analise_funcionalidade: 'Em Progresso',
  finalizado: 'Finalizado',
  recusado: 'Recusado',
};

const STATUS_COLORS = {
  Pendente: '#f59e0b',
  'Em Análise': '#3b82f6',
  'Em Progresso': '#8b5cf6',
  Finalizado: '#22c55e',
  Recusado: '#6b7280',
};

const AREA_LABELS = {
  projetos: 'Projetos',
  lideres: 'Líderes de Projeto',
  cs: 'CS',
  apoio: 'Apoio de Projetos',
  admin_financeiro: 'Admin & Financeiro',
  vendas: 'Vendas',
  workspace: 'Workspace',
  vista_cliente: 'Vista do Cliente',
  indicadores: 'Indicadores',
  okrs: 'OKRs',
  configuracoes: 'Configurações',
};

const CATEGORY_LABELS = {
  sugestao_plataforma: 'Sugestão Plataforma',
  sugestao_processo: 'Sugestão Processo',
  bug: 'Bug',
  erro: 'Erro',
  outro: 'Outro',
};

const TYPE_LABELS = {
  feedback_plataforma: 'Plataforma',
  feedback_processo: 'Processo',
  bug: 'Bug',
  erro: 'Erro',
  outro: 'Outro',
};

// Opções base dos charts
const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(26, 26, 26, 0.9)',
      titleFont: { size: 13, weight: '600' },
      bodyFont: { size: 12 },
      padding: 10,
      cornerRadius: 8,
    },
  },
};

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const val = item[key] || 'sem_classificacao';
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
}

export default function FeedbackAnalyticsView({ feedbacks = [] }) {
  const analytics = useMemo(() => {
    const total = feedbacks.length;
    if (total === 0) return null;

    // KPIs
    const pendentes = feedbacks.filter(f =>
      ['pendente', 'em_analise'].includes(f.status)
    ).length;

    const finalizados = feedbacks.filter(f => f.status === 'finalizado').length;
    const taxaResolucao = total > 0 ? (finalizados / total * 100) : 0;

    // Tempo médio de resolução (dias)
    const resolvedFeedbacks = feedbacks.filter(f => f.resolved_at && f.created_at);
    let tempoMedioResolucao = null;
    if (resolvedFeedbacks.length > 0) {
      const totalDias = resolvedFeedbacks.reduce((sum, f) => {
        return sum + differenceInDays(parseISO(f.resolved_at), parseISO(f.created_at));
      }, 0);
      tempoMedioResolucao = Math.round(totalDias / resolvedFeedbacks.length);
    }

    // Por Status (agrupado por label amigável)
    const statusRaw = groupBy(feedbacks, 'status');
    const porStatus = {};
    for (const [key, count] of Object.entries(statusRaw)) {
      const label = STATUS_LABELS[key] || key;
      porStatus[label] = (porStatus[label] || 0) + count;
    }

    // Por Área
    const porArea = groupBy(feedbacks, 'area');

    // Por Tipo
    const porTipo = groupBy(feedbacks, 'type');

    // Por Categoria
    const porCategoria = groupBy(feedbacks, 'category');

    // Top autores
    const autorMap = {};
    feedbacks.forEach(f => {
      const name = f.author_name || f.author_email?.split('@')[0] || 'Desconhecido';
      autorMap[name] = (autorMap[name] || 0) + 1;
    });
    const topAutores = Object.entries(autorMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Evolução mensal
    const dates = feedbacks.map(f => f.created_at).filter(Boolean).map(d => parseISO(d));
    const resolvedDates = feedbacks.map(f => f.resolved_at).filter(Boolean).map(d => parseISO(d));

    let meses = [];
    let criadosPorMes = {};
    let resolvidosPorMes = {};

    if (dates.length > 0) {
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date();
      meses = eachMonthOfInterval({ start: startOfMonth(minDate), end: startOfMonth(maxDate) });

      meses.forEach(m => {
        const key = format(m, 'yyyy-MM');
        criadosPorMes[key] = 0;
        resolvidosPorMes[key] = 0;
      });

      dates.forEach(d => {
        const key = format(d, 'yyyy-MM');
        if (criadosPorMes[key] !== undefined) criadosPorMes[key]++;
      });

      resolvedDates.forEach(d => {
        const key = format(d, 'yyyy-MM');
        if (resolvidosPorMes[key] !== undefined) resolvidosPorMes[key]++;
      });
    }

    return {
      total, pendentes, finalizados, taxaResolucao, tempoMedioResolucao,
      porStatus, porArea, porTipo, porCategoria, topAutores,
      meses, criadosPorMes, resolvidosPorMes,
    };
  }, [feedbacks]);

  if (!analytics) {
    return (
      <div className="fanalytics">
        <div className="fanalytics__empty">Nenhum feedback para analisar.</div>
      </div>
    );
  }

  // ---- Chart Data ----

  // Doughnut: Por Status
  const statusLabels = Object.keys(analytics.porStatus);
  const statusData = {
    labels: statusLabels,
    datasets: [{
      data: Object.values(analytics.porStatus),
      backgroundColor: statusLabels.map(l => STATUS_COLORS[l] || '#94a3b8'),
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  // Bar horizontal: Por Área
  const areaEntries = Object.entries(analytics.porArea)
    .map(([key, val]) => [AREA_LABELS[key] || key, val])
    .sort((a, b) => b[1] - a[1]);
  const areaData = {
    labels: areaEntries.map(e => e[0]),
    datasets: [{
      data: areaEntries.map(e => e[1]),
      backgroundColor: '#ffdd00',
      borderRadius: 6,
      barThickness: 24,
    }],
  };

  // Line: Evolução mensal
  const mesLabels = analytics.meses.map(m => format(m, 'MMM yy', { locale: ptBR }));
  const mesKeys = analytics.meses.map(m => format(m, 'yyyy-MM'));
  const evolucaoData = {
    labels: mesLabels,
    datasets: [
      {
        label: 'Criados',
        data: mesKeys.map(k => analytics.criadosPorMes[k] || 0),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 6,
      },
      {
        label: 'Resolvidos',
        data: mesKeys.map(k => analytics.resolvidosPorMes[k] || 0),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 6,
      },
    ],
  };

  // Bar horizontal: Top autores
  const autoresData = {
    labels: analytics.topAutores.map(a => a[0]),
    datasets: [{
      data: analytics.topAutores.map(a => a[1]),
      backgroundColor: '#3b82f6',
      borderRadius: 6,
      barThickness: 20,
    }],
  };

  // Bar: Por Tipo
  const tipoEntries = Object.entries(analytics.porTipo)
    .map(([key, val]) => [TYPE_LABELS[key] || key, val])
    .sort((a, b) => b[1] - a[1]);
  const tipoColors = ['#ffdd00', '#3b82f6', '#ef4444', '#f59e0b', '#6b7280'];
  const tipoData = {
    labels: tipoEntries.map(e => e[0]),
    datasets: [{
      data: tipoEntries.map(e => e[1]),
      backgroundColor: tipoEntries.map((_, i) => tipoColors[i % tipoColors.length]),
      borderRadius: 6,
      barThickness: 40,
    }],
  };

  const horizontalBarOptions = {
    ...CHART_DEFAULTS,
    indexAxis: 'y',
    scales: {
      x: { grid: { display: false }, ticks: { precision: 0 } },
      y: { grid: { display: false } },
    },
  };

  const verticalBarOptions = {
    ...CHART_DEFAULTS,
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { precision: 0 } },
    },
  };

  const lineOptions = {
    ...CHART_DEFAULTS,
    plugins: {
      ...CHART_DEFAULTS.plugins,
      legend: { display: true, position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', padding: 16 } },
    },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { precision: 0 }, beginAtZero: true },
    },
  };

  const doughnutOptions = {
    ...CHART_DEFAULTS,
    cutout: '65%',
    plugins: {
      ...CHART_DEFAULTS.plugins,
      legend: { display: true, position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12 } },
    },
  };

  return (
    <div className="fanalytics">
      {/* KPI Cards */}
      <div className="fanalytics__kpis">
        <div className="fanalytics__kpi fanalytics__kpi--yellow">
          <div className="fanalytics__kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div className="fanalytics__kpi-info">
            <span className="fanalytics__kpi-value">{analytics.total}</span>
            <span className="fanalytics__kpi-label">Total</span>
          </div>
        </div>

        <div className="fanalytics__kpi fanalytics__kpi--orange">
          <div className="fanalytics__kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="fanalytics__kpi-info">
            <span className="fanalytics__kpi-value">{analytics.pendentes}</span>
            <span className="fanalytics__kpi-label">Pendentes</span>
          </div>
        </div>

        <div className="fanalytics__kpi fanalytics__kpi--green">
          <div className="fanalytics__kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div className="fanalytics__kpi-info">
            <span className="fanalytics__kpi-value">{analytics.taxaResolucao.toFixed(0)}%</span>
            <span className="fanalytics__kpi-label">Taxa de Resolução</span>
          </div>
        </div>

        <div className="fanalytics__kpi fanalytics__kpi--blue">
          <div className="fanalytics__kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="fanalytics__kpi-info">
            <span className="fanalytics__kpi-value">
              {analytics.tempoMedioResolucao !== null ? `${analytics.tempoMedioResolucao}d` : '—'}
            </span>
            <span className="fanalytics__kpi-label">Tempo Médio Resolução</span>
          </div>
        </div>
      </div>

      {/* Row 2: Status + Área */}
      <div className="fanalytics__row">
        <div className="fanalytics__card">
          <h3 className="fanalytics__card-title">Por Status</h3>
          <div className="fanalytics__chart fanalytics__chart--doughnut">
            <Doughnut data={statusData} options={doughnutOptions} />
          </div>
        </div>
        <div className="fanalytics__card">
          <h3 className="fanalytics__card-title">Por Área</h3>
          <div className="fanalytics__chart fanalytics__chart--bar">
            <Bar data={areaData} options={horizontalBarOptions} />
          </div>
        </div>
      </div>

      {/* Row 3: Evolução + Autores */}
      <div className="fanalytics__row">
        <div className="fanalytics__card">
          <h3 className="fanalytics__card-title">Evolução Mensal</h3>
          <div className="fanalytics__chart fanalytics__chart--line">
            <Line data={evolucaoData} options={lineOptions} />
          </div>
        </div>
        <div className="fanalytics__card">
          <h3 className="fanalytics__card-title">Top 10 Autores</h3>
          <div className="fanalytics__chart fanalytics__chart--bar">
            <Bar data={autoresData} options={horizontalBarOptions} />
          </div>
        </div>
      </div>

      {/* Row 4: Por Tipo */}
      <div className="fanalytics__row fanalytics__row--full">
        <div className="fanalytics__card">
          <h3 className="fanalytics__card-title">Por Tipo</h3>
          <div className="fanalytics__chart fanalytics__chart--tipo">
            <Bar data={tipoData} options={verticalBarOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}
