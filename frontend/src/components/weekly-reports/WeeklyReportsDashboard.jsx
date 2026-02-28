/**
 * WeeklyReportsDashboard - Dashboard de KPIs de Relatorios Semanais
 *
 * Exibe indicadores de eficiencia: projetos ativos vs relatorios enviados por semana.
 * Inclui cards de resumo, grafico de barras agrupado e tabela detalhada.
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { API_URL } from '../../api';
import '../../styles/WeeklyReportsDashboard.css';

// Registra componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

/**
 * Retorna a classe CSS de cor baseada no percentual de cobertura.
 * >= 80% = verde, >= 50% = amarelo, < 50% = vermelho
 */
function getCoverageColorClass(value) {
  if (value >= 80) return 'wrd-color-green';
  if (value >= 50) return 'wrd-color-yellow';
  return 'wrd-color-red';
}

/**
 * Icone SVG de seta para cima (tendencia positiva)
 */
function ArrowUpIcon() {
  return (
    <svg
      className="wrd-trend-icon wrd-trend-up"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

/**
 * Icone SVG de seta para baixo (tendencia negativa)
 */
function ArrowDownIcon() {
  return (
    <svg
      className="wrd-trend-icon wrd-trend-down"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
}

/**
 * Icone SVG de linha horizontal (tendencia estavel)
 */
function ArrowStableIcon() {
  return (
    <svg
      className="wrd-trend-icon wrd-trend-stable"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="15 8 19 12 15 16" />
    </svg>
  );
}

/**
 * Retorna o icone e o texto da tendencia
 */
function getTrendDisplay(trend) {
  if (trend === 'up') {
    return { Icon: ArrowUpIcon, label: 'Crescendo', className: 'wrd-trend-up' };
  }
  if (trend === 'down') {
    return { Icon: ArrowDownIcon, label: 'Caindo', className: 'wrd-trend-down' };
  }
  return { Icon: ArrowStableIcon, label: 'Estavel', className: 'wrd-trend-stable' };
}

function WeeklyReportsDashboard({ leaderName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ weeks: '12' });
      if (leaderName) {
        params.set('leader', leaderName);
      }

      const response = await axios.get(
        `${API_URL}/api/weekly-reports/stats?${params.toString()}`,
        { withCredentials: true }
      );

      setData(response.data);
    } catch (err) {
      console.error('Erro ao carregar estatisticas de relatorios semanais:', err);
      setError(
        err.response?.data?.error ||
        'Erro ao carregar dados do dashboard de relatorios semanais.'
      );
    } finally {
      setLoading(false);
    }
  }, [leaderName]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // --- Loading state ---
  if (loading) {
    return (
      <div className="wrd-container">
        <div className="wrd-loading">
          <div className="wrd-loading-spinner" />
          <p>Carregando dashboard de relatorios...</p>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="wrd-container">
        <div className="wrd-error">
          <div className="wrd-error-content">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#dc2626"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
          <button className="wrd-retry-btn" onClick={fetchStats}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // --- No data ---
  if (!data || !data.summary) {
    return (
      <div className="wrd-container">
        <div className="wrd-empty">
          Nenhum dado disponivel para o dashboard de relatorios semanais.
        </div>
      </div>
    );
  }

  const { summary, weeks = [], missingCurrentWeek = [] } = data;
  const trendDisplay = getTrendDisplay(summary.trend);

  // --- Chart data ---
  const chartData = {
    labels: weeks.map((w) => w.label || `S${w.week}`),
    datasets: [
      {
        label: 'Projetos Ativos',
        data: weeks.map((w) => w.active || 0),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        borderRadius: 3,
      },
      {
        label: 'Relatorios Enviados',
        data: weeks.map((w) => w.sent || 0),
        backgroundColor: 'rgba(34, 197, 94, 0.7)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
        borderRadius: 3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            size: 11,
            family: 'Verdana, sans-serif',
          },
          color: '#1a1a1a',
          usePointStyle: true,
          pointStyle: 'rectRounded',
          padding: 16,
        },
      },
      title: {
        display: true,
        text: 'Projetos Ativos vs Relatorios Enviados',
        font: {
          size: 13,
          weight: 'bold',
          family: 'Verdana, sans-serif',
        },
        color: '#1a1a1a',
        padding: {
          bottom: 16,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(26, 26, 26, 0.9)',
        padding: 10,
        titleFont: {
          size: 11,
          weight: 'bold',
          family: 'Verdana',
        },
        bodyFont: {
          size: 10,
          family: 'Verdana',
        },
        cornerRadius: 4,
        callbacks: {
          afterBody: (tooltipItems) => {
            if (!tooltipItems || tooltipItems.length < 2) return '';
            const active = tooltipItems[0]?.raw || 0;
            const sent = tooltipItems[1]?.raw || 0;
            const pct = active > 0 ? ((sent / active) * 100).toFixed(1) : '0.0';
            return `Cobertura: ${pct}%`;
          },
        },
      },
      datalabels: {
        display: false,
      },
    },
    scales: {
      x: {
        ticks: {
          font: {
            size: 10,
            family: 'Verdana',
          },
          color: '#737373',
        },
        grid: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          font: {
            size: 10,
            family: 'Verdana',
          },
          color: '#737373',
        },
        grid: {
          color: '#ededed',
          drawBorder: false,
        },
      },
    },
    layout: {
      padding: {
        top: 4,
        bottom: 4,
        left: 4,
        right: 4,
      },
    },
  };

  return (
    <div className="wrd-container">
      {/* Header */}
      <div className="wrd-header">
        <div>
          <h3 className="wrd-title">Dashboard de Relatorios Semanais</h3>
          <p className="wrd-subtitle">
            Acompanhamento de cobertura: projetos ativos vs relatorios enviados
          </p>
        </div>
        <button className="wrd-refresh-btn" onClick={fetchStats}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Atualizar
        </button>
      </div>

      {/* Summary Cards */}
      <div className="wrd-summary-cards">
        {/* Card 1: Cobertura Semana */}
        <div className={`wrd-card ${getCoverageColorClass(summary.currentCoverage)}`}>
          <div className="wrd-card-label">Cobertura Semana</div>
          <div className="wrd-card-value">
            {summary.currentCoverage != null
              ? `${summary.currentCoverage.toFixed(1)}%`
              : '--'}
          </div>
          <div className="wrd-card-context">
            {summary.totalActive != null
              ? `${summary.totalActive} projetos ativos`
              : ''}
          </div>
        </div>

        {/* Card 2: Media 4 Semanas */}
        <div className={`wrd-card ${getCoverageColorClass(summary.avgCoverage4Weeks)}`}>
          <div className="wrd-card-label">Media 4 Semanas</div>
          <div className="wrd-card-value">
            {summary.avgCoverage4Weeks != null
              ? `${summary.avgCoverage4Weeks.toFixed(1)}%`
              : '--'}
          </div>
          <div className="wrd-card-context">Media movel recente</div>
        </div>

        {/* Card 3: Tendencia */}
        <div className={`wrd-card wrd-card-trend ${trendDisplay.className}`}>
          <div className="wrd-card-label">Tendencia</div>
          <div className="wrd-card-value wrd-card-trend-value">
            <trendDisplay.Icon />
            <span>{trendDisplay.label}</span>
          </div>
          <div className="wrd-card-context">Comparativo ultimas semanas</div>
        </div>
      </div>

      {/* Bar Chart */}
      {weeks.length > 0 && (
        <div className="wrd-chart-section">
          <div className="wrd-chart-wrapper">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* Detail Table */}
      {weeks.length > 0 && (
        <div className="wrd-table-section">
          <h4 className="wrd-section-title">Detalhamento por Semana</h4>
          <div className="wrd-table-wrapper">
            <table className="wrd-table">
              <thead>
                <tr>
                  <th>Semana</th>
                  <th className="wrd-text-right">Ativos</th>
                  <th className="wrd-text-right">Enviados</th>
                  <th className="wrd-text-right">Cobertura %</th>
                  <th>Faltantes</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((week, index) => {
                  const coverage =
                    week.active > 0
                      ? ((week.sent / week.active) * 100).toFixed(1)
                      : '0.0';
                  const isCurrentWeek = index === weeks.length - 1;
                  const missing = week.missing || [];

                  return (
                    <tr
                      key={week.label || index}
                      className={isCurrentWeek ? 'wrd-row-current' : ''}
                    >
                      <td>
                        <span className="wrd-week-label">
                          {week.label || `S${week.week}`}
                        </span>
                        {isCurrentWeek && (
                          <span className="wrd-badge-current">Atual</span>
                        )}
                      </td>
                      <td className="wrd-text-right">{week.active || 0}</td>
                      <td className="wrd-text-right">{week.sent || 0}</td>
                      <td className="wrd-text-right">
                        <span
                          className={`wrd-coverage-pill ${getCoverageColorClass(
                            parseFloat(coverage)
                          )}`}
                        >
                          {coverage}%
                        </span>
                      </td>
                      <td>
                        {missing.length > 0 ? (
                          <span className="wrd-missing-list" title={missing.join(', ')}>
                            {missing.length <= 3
                              ? missing.join(', ')
                              : `${missing.slice(0, 3).join(', ')} +${missing.length - 3}`}
                          </span>
                        ) : (
                          <span className="wrd-all-sent">Todos enviados</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Missing Current Week Alert */}
      {missingCurrentWeek.length > 0 && (
        <div className="wrd-alert-section">
          <div className="wrd-alert">
            <div className="wrd-alert-header">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#d97706"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>
                {missingCurrentWeek.length} projeto{missingCurrentWeek.length !== 1 ? 's' : ''} sem relatorio esta semana
              </span>
            </div>
            <div className="wrd-alert-list">
              {missingCurrentWeek.map((project, i) => (
                <span key={i} className="wrd-alert-project">
                  {project}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WeeklyReportsDashboard;
