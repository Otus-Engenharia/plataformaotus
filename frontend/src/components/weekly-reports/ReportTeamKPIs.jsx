/**
 * ReportTeamKPIs - Indicadores de equipe para Relatorios Semanais
 *
 * Exibe KPIs de equipe: % de relatorios ativos e % de relatorios enviados,
 * com grafico historico de barras agrupadas e tabela detalhada por semana.
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import { API_URL } from '../../api';

/**
 * Retorna a classe CSS de cor para pills baseada no percentual.
 * >= 80% = verde, >= 50% = amarelo, < 50% = vermelho
 */
function getPillColorClass(value) {
  if (value >= 80) return 'wr-kpi-pill-green';
  if (value >= 50) return 'wr-kpi-pill-yellow';
  return 'wr-kpi-pill-red';
}

/**
 * Icone SVG de seta para cima (delta positivo)
 */
function ArrowUpIcon() {
  return (
    <svg
      width="16"
      height="16"
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
 * Icone SVG de seta para baixo (delta negativo)
 */
function ArrowDownIcon() {
  return (
    <svg
      width="16"
      height="16"
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
 * Icone SVG de linha horizontal (sem mudanca)
 */
function ArrowStableIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/**
 * Renderiza o indicador de delta com seta e valor formatado.
 */
function DeltaIndicator({ delta, trend }) {
  if (delta == null) return null;

  const isUp = trend === 'up';
  const isDown = trend === 'down';
  const colorClass = isUp
    ? 'wr-kpi-card-delta-up'
    : isDown
      ? 'wr-kpi-card-delta-down'
      : '';
  const sign = delta > 0 ? '+' : '';

  return (
    <div className={`wr-kpi-card-delta ${colorClass}`}>
      {isUp && <ArrowUpIcon />}
      {isDown && <ArrowDownIcon />}
      {!isUp && !isDown && <ArrowStableIcon />}
      <span>{sign}{delta.toFixed(1)}pp</span>
    </div>
  );
}

/**
 * Opcoes do grafico de barras agrupadas (% Ativos vs % Enviados por semana).
 */
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      labels: {
        font: { size: 11, family: 'Verdana' },
        usePointStyle: true,
        pointStyle: 'rectRounded',
        padding: 16,
      },
    },
    title: { display: false },
    tooltip: {
      backgroundColor: 'rgba(26,26,26,0.9)',
      padding: 10,
      titleFont: { size: 11, weight: 'bold', family: 'Verdana' },
      bodyFont: { size: 10, family: 'Verdana' },
      cornerRadius: 4,
      callbacks: {
        label: (context) => {
          const label = context.dataset.label || '';
          if (context.raw == null) return `${label}: sem dados`;
          return `${label}: ${context.raw.toFixed(1)}%`;
        },
      },
    },
    datalabels: { display: false },
  },
  scales: {
    x: {
      ticks: {
        font: { size: 10, family: 'Verdana' },
        color: '#737373',
      },
      grid: { display: false },
    },
    y: {
      beginAtZero: true,
      max: 100,
      ticks: {
        callback: (v) => v + '%',
        font: { size: 10, family: 'Verdana' },
        color: '#737373',
      },
      grid: { color: '#ededed' },
    },
  },
};

function ReportTeamKPIs() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tableExpanded, setTableExpanded] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `${API_URL}/api/weekly-reports/stats?weeks=12`,
        { withCredentials: true }
      );

      if (response.data && response.data.success) {
        setData(response.data.data);
      } else {
        setError('Resposta inesperada do servidor.');
      }
    } catch (err) {
      console.error('Erro ao carregar indicadores de equipe:', err);
      setError(
        err.response?.data?.error ||
        'Erro ao carregar indicadores de equipe.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Loading state ---
  if (loading) {
    return (
      <div className="wr-kpi-section">
        <div className="wrd-loading">
          <div className="wrd-loading-spinner" />
          <p>Carregando indicadores...</p>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="wr-kpi-section">
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
          <button className="wrd-retry-btn" onClick={fetchData}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // --- Empty state ---
  if (!data || !data.summary) {
    return (
      <div className="wr-kpi-section">
        <div className="wrd-empty">Nenhum dado disponivel</div>
      </div>
    );
  }

  const { summary, weeks = [] } = data;

  // --- Chart data (null = sem dados, Chart.js pula barras null) ---
  const chartData = {
    labels: weeks.map((w) => w.weekText || `S${w.weekNumber}`),
    datasets: [
      {
        label: '% Relatorios Ativos',
        data: weeks.map((w) => w.pctReportEnabled),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        borderRadius: 3,
      },
      {
        label: '% Relatorios Enviados',
        data: weeks.map((w) => w.pctReportsSent),
        backgroundColor: 'rgba(34, 197, 94, 0.7)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
        borderRadius: 3,
      },
    ],
  };

  return (
    <div className="wr-kpi-section">
      {/* Header */}
      <div className="wr-kpi-header">
        <h4>Indicadores de Equipe</h4>
        <button className="wrd-refresh-btn" onClick={fetchData}>
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

      {/* KPI Cards */}
      <div className="wr-kpi-cards">
        {/* Card 1: Relatorios Ativos */}
        <div className="wr-kpi-card">
          <div className="wr-kpi-card-label">Relatorios Ativos</div>
          <div className="wr-kpi-card-value">
            {summary.currentPctEnabled != null
              ? `${summary.currentPctEnabled.toFixed(1)}%`
              : '--'}
          </div>
          <div className="wr-kpi-card-context">
            {summary.totalReportEnabled != null && summary.totalAllActive != null
              ? `${summary.totalReportEnabled} de ${summary.totalAllActive} projetos`
              : ''}
          </div>
          <DeltaIndicator
            delta={summary.deltaPctEnabled}
            trend={summary.trendEnabled}
          />
        </div>

        {/* Card 2: Relatorios Enviados */}
        <div className="wr-kpi-card">
          <div className="wr-kpi-card-label">Relatorios Enviados</div>
          <div className="wr-kpi-card-value">
            {summary.currentPctSent != null
              ? `${summary.currentPctSent.toFixed(1)}%`
              : '--'}
          </div>
          <div className="wr-kpi-card-context">
            {summary.totalReportsSent != null && summary.totalReportEnabled != null
              ? `${summary.totalReportsSent} de ${summary.totalReportEnabled} projetos`
              : ''}
          </div>
          <DeltaIndicator
            delta={summary.deltaPctSent}
            trend={summary.trendSent}
          />
        </div>
      </div>

      {/* Bar Chart */}
      {weeks.length > 0 && (
        <div className="wr-kpi-chart-wrapper">
          <Bar data={chartData} options={chartOptions} />
        </div>
      )}

      {/* Collapsible Detail Table */}
      {weeks.length > 0 && (
        <div className="wr-kpi-table-wrapper">
          <button
            className="wrd-refresh-btn"
            onClick={() => setTableExpanded((prev) => !prev)}
            style={{ marginBottom: tableExpanded ? 12 : 0 }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: tableExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {tableExpanded ? 'Ocultar detalhamento' : 'Ver detalhamento por semana'}
          </button>

          {tableExpanded && (
            <table className="wr-kpi-table">
              <thead>
                <tr>
                  <th>Semana</th>
                  <th className="wrd-text-right">Proj. Ativos</th>
                  <th className="wrd-text-right">Toggle ON</th>
                  <th className="wrd-text-right">Enviados</th>
                  <th className="wrd-text-right">% Ativos</th>
                  <th className="wrd-text-right">% Enviados</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((week, index) => {
                  const isCurrentWeek = index === weeks.length - 1;

                  return (
                    <tr
                      key={`${week.weekYear}-${week.weekNumber}`}
                      className={isCurrentWeek ? 'wr-kpi-row-current' : ''}
                    >
                      <td>
                        <span>{week.weekText || `S${week.weekNumber}`}</span>
                        {isCurrentWeek && (
                          <span className="wrd-badge-current">Atual</span>
                        )}
                      </td>
                      <td className="wrd-text-right">{week.totalActive != null ? week.totalActive : '—'}</td>
                      <td className="wrd-text-right">{week.reportEnabled != null ? week.reportEnabled : '—'}</td>
                      <td className="wrd-text-right">{week.reportsSent != null ? week.reportsSent : '—'}</td>
                      <td className="wrd-text-right">
                        {week.pctReportEnabled != null ? (
                          <span
                            className={`wr-kpi-pill ${getPillColorClass(week.pctReportEnabled)}`}
                          >
                            {week.pctReportEnabled.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="wr-kpi-pill" style={{ opacity: 0.4 }}>—</span>
                        )}
                      </td>
                      <td className="wrd-text-right">
                        {week.pctReportsSent != null ? (
                          <span
                            className={`wr-kpi-pill ${getPillColorClass(week.pctReportsSent)}`}
                          >
                            {week.pctReportsSent.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="wr-kpi-pill" style={{ opacity: 0.4 }}>—</span>
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
}

export default ReportTeamKPIs;
