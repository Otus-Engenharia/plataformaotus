/**
 * ConfigWeeklyReportsView - Painel de indicadores de relatórios semanais por time
 *
 * Visão exclusiva para DEVs/Directors/Admins no módulo de Configurações.
 * Exibe tabela comparativa de todos os times e gráfico expandível por time.
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
import { API_URL } from '../api';
import '../styles/ConfigWeeklyReportsView.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function getPillColorClass(value) {
  if (value >= 80) return 'cwr-pill-green';
  if (value >= 50) return 'cwr-pill-yellow';
  return 'cwr-pill-red';
}

function getCardColorClass(value) {
  if (value >= 80) return 'cwr-card-green';
  if (value >= 50) return 'cwr-card-yellow';
  return 'cwr-card-red';
}

function TrendIcon({ trend }) {
  if (trend === 'up') {
    return (
      <span className="cwr-trend cwr-trend-up">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
        </svg>
        Crescendo
      </span>
    );
  }
  if (trend === 'down') {
    return (
      <span className="cwr-trend cwr-trend-down">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
        </svg>
        Caindo
      </span>
    );
  }
  return (
    <span className="cwr-trend cwr-trend-stable">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="15 8 19 12 15 16" />
      </svg>
      Estavel
    </span>
  );
}

function TeamDetailChart({ weeks }) {
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
          maxRotation: 45,
          minRotation: 30,
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
    layout: {
      padding: { top: 4, bottom: 16, left: 4, right: 4 },
    },
  };

  return <Bar data={chartData} options={chartOptions} />;
}

function TeamDetailTable({ weeks }) {
  return (
    <table className="cwr-team-detail-table">
      <thead>
        <tr>
          <th>Semana</th>
          <th className="cwr-text-right">Proj. Ativos</th>
          <th className="cwr-text-right">Toggle ON</th>
          <th className="cwr-text-right">Enviados</th>
          <th className="cwr-text-right">% Ativos</th>
          <th className="cwr-text-right">% Enviados</th>
        </tr>
      </thead>
      <tbody>
        {weeks.map((week, index) => {
          const isCurrentWeek = index === weeks.length - 1;
          return (
            <tr key={`${week.weekYear}-${week.weekNumber}`} className={isCurrentWeek ? 'cwr-row-current' : ''}>
              <td>
                {week.weekText || `S${week.weekNumber}`}
                {isCurrentWeek && <span className="cwr-badge-current">Atual</span>}
              </td>
              <td className="cwr-text-right">{week.totalActive != null ? week.totalActive : '—'}</td>
              <td className="cwr-text-right">{week.reportEnabled != null ? week.reportEnabled : '—'}</td>
              <td className="cwr-text-right">{week.reportsSent != null ? week.reportsSent : '—'}</td>
              <td className="cwr-text-right">
                {week.pctReportEnabled != null ? (
                  <span className={`cwr-pill ${getPillColorClass(week.pctReportEnabled)}`}>
                    {week.pctReportEnabled.toFixed(1)}%
                  </span>
                ) : '—'}
              </td>
              <td className="cwr-text-right">
                {week.pctReportsSent != null ? (
                  <span className={`cwr-pill ${getPillColorClass(week.pctReportsSent)}`}>
                    {week.pctReportsSent.toFixed(1)}%
                  </span>
                ) : '—'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ConfigWeeklyReportsView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTeams, setExpandedTeams] = useState(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `${API_URL}/api/weekly-reports/stats/by-team?weeks=12`,
        { withCredentials: true }
      );

      if (response.data && response.data.success) {
        setData(response.data.data);
      } else {
        setError('Resposta inesperada do servidor.');
      }
    } catch (err) {
      console.error('Erro ao carregar indicadores por time:', err);
      setError(
        err.response?.data?.error ||
        'Erro ao carregar indicadores por time.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleTeam = (teamId) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="cwr-container">
        <div className="cwr-loading">
          <div className="cwr-loading-spinner" />
          <p>Carregando indicadores por time...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cwr-container">
        <div className="cwr-error">
          <div className="cwr-error-content">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
          <button className="cwr-retry-btn" onClick={fetchData}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  if (!data || !data.teams || data.teams.length === 0) {
    return (
      <div className="cwr-container">
        <div className="cwr-empty">Nenhum time encontrado.</div>
      </div>
    );
  }

  const { teams, totals } = data;
  const totalsSummary = totals?.summary || {};

  // Calculate aggregate values for summary cards
  const totalTeams = teams.length;
  const totalProjects = totalsSummary.totalAllActive || 0;
  const avgPctEnabled = totalsSummary.currentPctEnabled || 0;
  const avgPctSent = totalsSummary.currentPctSent || 0;

  return (
    <div className="cwr-container">
      {/* Header */}
      <div className="cwr-header">
        <div>
          <h3 className="cwr-title">Indicadores de Relatorios Semanais por Time</h3>
          <p className="cwr-subtitle">
            Comparativo de cobertura de relatorios entre todos os times
          </p>
        </div>
        <button className="cwr-refresh-btn" onClick={fetchData}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Atualizar
        </button>
      </div>

      {/* Summary Cards */}
      <div className="cwr-summary-cards">
        <div className="cwr-card cwr-card-neutral">
          <div className="cwr-card-label">Total de Times</div>
          <div className="cwr-card-value">{totalTeams}</div>
          <div className="cwr-card-context">{totalProjects} projetos ativos</div>
        </div>

        <div className={`cwr-card ${getCardColorClass(avgPctEnabled)}`}>
          <div className="cwr-card-label">Cobertura Geral (Ativos)</div>
          <div className="cwr-card-value">{avgPctEnabled.toFixed(1)}%</div>
          <div className="cwr-card-context">{totalsSummary.totalReportEnabled || 0} de {totalProjects} com toggle ON</div>
        </div>

        <div className={`cwr-card ${getCardColorClass(avgPctSent)}`}>
          <div className="cwr-card-label">Cobertura Geral (Enviados)</div>
          <div className="cwr-card-value">{avgPctSent.toFixed(1)}%</div>
          <div className="cwr-card-context">{totalsSummary.totalReportsSent || 0} de {totalsSummary.totalReportEnabled || 0} enviados</div>
        </div>
      </div>

      {/* Team Comparison Table */}
      <div className="cwr-table-section">
        <h4 className="cwr-section-title">Comparativo por Time</h4>
        <div className="cwr-table-wrapper">
          <table className="cwr-table">
            <thead>
              <tr>
                <th>Time</th>
                <th className="cwr-text-right">Proj. Ativos</th>
                <th className="cwr-text-right">Toggle ON</th>
                <th className="cwr-text-right">Enviados</th>
                <th className="cwr-text-right">% Ativos</th>
                <th className="cwr-text-right">% Enviados</th>
                <th className="cwr-text-center">Tendencia</th>
                <th className="cwr-text-center"></th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => {
                const s = team.summary || {};
                const isExpanded = expandedTeams.has(team.teamId);

                return (
                  <React.Fragment key={team.teamId}>
                    <tr>
                      <td>
                        <span className="cwr-team-name">{team.teamName}</span>
                      </td>
                      <td className="cwr-text-right">{s.totalAllActive || 0}</td>
                      <td className="cwr-text-right">{s.totalReportEnabled || 0}</td>
                      <td className="cwr-text-right">{s.totalReportsSent || 0}</td>
                      <td className="cwr-text-right">
                        <span className={`cwr-pill ${getPillColorClass(s.currentPctEnabled || 0)}`}>
                          {(s.currentPctEnabled || 0).toFixed(1)}%
                        </span>
                      </td>
                      <td className="cwr-text-right">
                        <span className={`cwr-pill ${getPillColorClass(s.currentPctSent || 0)}`}>
                          {(s.currentPctSent || 0).toFixed(1)}%
                        </span>
                      </td>
                      <td className="cwr-text-center">
                        <TrendIcon trend={s.trendSent || 'stable'} />
                      </td>
                      <td className="cwr-text-center">
                        <button
                          className="cwr-expand-btn"
                          onClick={() => toggleTeam(team.teamId)}
                          title={isExpanded ? 'Recolher' : 'Expandir detalhes'}
                        >
                          <svg
                            className={`cwr-expand-icon ${isExpanded ? 'cwr-expand-icon-open' : ''}`}
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="9 6 15 12 9 18" />
                          </svg>
                          {isExpanded ? 'Recolher' : 'Detalhar'}
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={8} style={{ padding: 0 }}>
                          <div className="cwr-team-detail">
                            <div className="cwr-team-detail-inner">
                              <h5 className="cwr-team-detail-title">
                                Historico - {team.teamName}
                              </h5>
                              <div className="cwr-team-chart-wrapper">
                                <TeamDetailChart weeks={team.weeks || []} />
                              </div>
                              <TeamDetailTable weeks={team.weeks || []} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Totals row */}
              <tr className="cwr-row-totals">
                <td><span className="cwr-team-name">Totais</span></td>
                <td className="cwr-text-right">{totalsSummary.totalAllActive || 0}</td>
                <td className="cwr-text-right">{totalsSummary.totalReportEnabled || 0}</td>
                <td className="cwr-text-right">{totalsSummary.totalReportsSent || 0}</td>
                <td className="cwr-text-right">
                  <span className={`cwr-pill ${getPillColorClass(totalsSummary.currentPctEnabled || 0)}`}>
                    {(totalsSummary.currentPctEnabled || 0).toFixed(1)}%
                  </span>
                </td>
                <td className="cwr-text-right">
                  <span className={`cwr-pill ${getPillColorClass(totalsSummary.currentPctSent || 0)}`}>
                    {(totalsSummary.currentPctSent || 0).toFixed(1)}%
                  </span>
                </td>
                <td className="cwr-text-center">
                  <TrendIcon trend={totalsSummary.trendSent || 'stable'} />
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ConfigWeeklyReportsView;
