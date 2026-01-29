import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import './HistoryView.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

const API_URL = import.meta.env.VITE_API_URL || '';

// Score Ring Component
function ScoreRing({ score, size = 40 }) {
  const normalizedScore = Math.min(Math.max(score || 0, 0), 120);
  const circumference = 2 * Math.PI * 16;
  const progress = (normalizedScore / 100) * circumference;

  const getColor = (s) => {
    if (s >= 100) return '#22c55e';
    if (s >= 80) return '#ffd000';
    return '#ef4444';
  };

  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 40 40">
        <circle
          cx="20" cy="20" r="16"
          fill="none"
          stroke="rgba(0,0,0,0.08)"
          strokeWidth="3"
        />
        <circle
          cx="20" cy="20" r="16"
          fill="none"
          stroke={getColor(normalizedScore)}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          transform="rotate(-90 20 20)"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span className="score-ring__value">{Math.round(score || 0)}%</span>
    </div>
  );
}

// Traffic Light Badge
function TrafficLightBadge({ score }) {
  const getClass = () => {
    if (score >= 100) return 'traffic-badge--green';
    if (score >= 80) return 'traffic-badge--yellow';
    return 'traffic-badge--red';
  };

  return (
    <span className={`traffic-badge ${getClass()}`}>
      {Math.round(score || 0)}%
    </span>
  );
}

export default function HistoryView() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [comparisonYear, setComparisonYear] = useState(currentYear - 1);
  const [indicators, setIndicators] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  useEffect(() => {
    fetchData();
  }, [selectedYear, comparisonYear, user?.email]);

  const fetchData = async () => {
    if (!user?.email) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch indicators for both years
      const params = new URLSearchParams({
        years: [selectedYear, comparisonYear].join(','),
        email: user.email
      });

      const res = await fetch(`${API_URL}/api/ind/my-history?${params}`, {
        credentials: 'include'
      });

      if (!res.ok) throw new Error('Erro ao carregar histórico');

      const result = await res.json();
      setIndicators(result.data?.indicators || []);
      setCheckIns(result.data?.checkIns || []);
    } catch (err) {
      console.error('Error fetching history:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate scores for each indicator
  const indicatorsWithScores = useMemo(() => {
    return indicators.map(indicator => {
      const indicatorCheckIns = checkIns.filter(c => c.indicador_id === indicator.id);

      // Calculate consolidated value
      let consolidatedValue = indicator.valor || 0;
      if (indicatorCheckIns.length > 0) {
        const values = indicatorCheckIns.map(c => Number(c.valor));
        if (indicator.consolidation_type === 'sum') {
          consolidatedValue = values.reduce((a, b) => a + b, 0);
        } else if (indicator.consolidation_type === 'average') {
          consolidatedValue = values.reduce((a, b) => a + b, 0) / values.length;
        } else {
          consolidatedValue = values[values.length - 1];
        }
      }

      // Calculate score
      const meta = indicator.meta || 100;
      let score = meta > 0 ? (consolidatedValue / meta) * 100 : 0;

      // Apply inverse logic if needed
      if (indicator.is_inverse && consolidatedValue > 0) {
        score = (meta / consolidatedValue) * 100;
      }

      // Cap at 120%
      score = Math.min(score, 120);

      return { ...indicator, score: Math.round(score), consolidatedValue };
    });
  }, [indicators, checkIns]);

  // Group by year
  const selectedYearIndicators = indicatorsWithScores.filter(i => i.ano === selectedYear);
  const comparisonYearIndicators = indicatorsWithScores.filter(i => i.ano === comparisonYear);

  // Calculate averages
  const selectedYearAvg = selectedYearIndicators.length > 0
    ? Math.round(selectedYearIndicators.reduce((sum, i) => sum + i.score, 0) / selectedYearIndicators.length)
    : 0;
  const comparisonYearAvg = comparisonYearIndicators.length > 0
    ? Math.round(comparisonYearIndicators.reduce((sum, i) => sum + i.score, 0) / comparisonYearIndicators.length)
    : 0;
  const scoreDiff = selectedYearAvg - comparisonYearAvg;

  // Chart data - compare same indicators between years
  const comparisonChartData = useMemo(() => {
    const indicatorNames = [...new Set(indicators.map(i => i.nome))];
    const labels = indicatorNames.map(name =>
      name.length > 15 ? name.substring(0, 15) + '...' : name
    );

    const selectedData = indicatorNames.map(name => {
      const ind = indicatorsWithScores.find(i => i.nome === name && i.ano === selectedYear);
      return ind?.score || 0;
    });

    const comparisonData = indicatorNames.map(name => {
      const ind = indicatorsWithScores.find(i => i.nome === name && i.ano === comparisonYear);
      return ind?.score || 0;
    });

    return {
      labels,
      datasets: [
        {
          label: String(selectedYear),
          data: selectedData,
          backgroundColor: '#1a1a1a',
          borderRadius: 4,
        },
        {
          label: String(comparisonYear),
          data: comparisonData,
          backgroundColor: '#d4d4d4',
          borderRadius: 4,
        },
      ],
    };
  }, [indicatorsWithScores, selectedYear, comparisonYear, indicators]);

  // Monthly evolution for selected year
  const monthlyEvolutionData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const selectedIndicatorIds = selectedYearIndicators.map(i => i.id);

    const values = months.map((_, index) => {
      const monthNum = index + 1;
      const monthCheckIns = checkIns.filter(
        c => c.mes === monthNum && selectedIndicatorIds.includes(c.indicador_id)
      );

      if (monthCheckIns.length === 0) return null;
      return Math.round(monthCheckIns.reduce((sum, c) => sum + Number(c.valor), 0) / monthCheckIns.length);
    });

    return {
      labels: months,
      datasets: [
        {
          label: 'Valor médio',
          data: values,
          borderColor: '#1a1a1a',
          backgroundColor: '#1a1a1a',
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#1a1a1a',
          spanGaps: true,
        },
      ],
    };
  }, [checkIns, selectedYearIndicators]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: { family: 'DM Sans', size: 12 }
        }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 120,
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: { font: { family: 'DM Sans', size: 11 } }
      },
      x: {
        grid: { display: false },
        ticks: { font: { family: 'DM Sans', size: 11 } }
      }
    },
  };

  const lineChartOptions = {
    ...chartOptions,
    scales: {
      ...chartOptions.scales,
      y: { ...chartOptions.scales.y, max: undefined }
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="history-view history-view--loading">
        <div className="loading-pulse">
          <div className="loading-pulse__ring" />
          <div className="loading-pulse__ring" />
          <div className="loading-pulse__ring" />
        </div>
        <p className="loading-text">Carregando histórico...</p>
      </div>
    );
  }

  return (
    <div className="history-view">
      <div className="history-view__bg">
        <div className="history-view__gradient" />
      </div>

      {/* Header */}
      <header className="history-view__header">
        <div>
          <h1 className="history-view__title">Histórico</h1>
          <p className="history-view__subtitle">
            Evolução dos seus indicadores ao longo do tempo
          </p>
        </div>

        <div className="history-view__selectors">
          <span className="history-view__label">Comparar</span>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="history-view__select"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <span className="history-view__label">com</span>
          <select
            value={comparisonYear}
            onChange={e => setComparisonYear(Number(e.target.value))}
            className="history-view__select"
          >
            {years.filter(y => y !== selectedYear).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </header>

      {error && (
        <div className="history-view__error">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="history-view__summary">
        <div className="summary-card">
          <span className="summary-card__label">Indicadores em {selectedYear}</span>
          <div className="summary-card__value">{selectedYearIndicators.length}</div>
          <span className="summary-card__comparison">
            vs {comparisonYearIndicators.length} em {comparisonYear}
          </span>
        </div>

        <div className="summary-card">
          <span className="summary-card__label">Score Médio {selectedYear}</span>
          <div className="summary-card__value">
            {selectedYearAvg}%
            {scoreDiff !== 0 && (
              <span className={`summary-card__badge ${scoreDiff > 0 ? 'positive' : 'negative'}`}>
                {scoreDiff > 0 ? '+' : ''}{scoreDiff}%
              </span>
            )}
          </div>
          <span className="summary-card__comparison">
            vs {comparisonYearAvg}% em {comparisonYear}
          </span>
        </div>

        <div className="summary-card">
          <span className="summary-card__label">Tendência</span>
          <div className="summary-card__trend">
            {scoreDiff > 5 && (
              <>
                <svg viewBox="0 0 24 24" width="28" height="28" className="trend-icon trend-icon--up">
                  <path fill="currentColor" d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
                </svg>
                <span>Melhorando</span>
              </>
            )}
            {scoreDiff < -5 && (
              <>
                <svg viewBox="0 0 24 24" width="28" height="28" className="trend-icon trend-icon--down">
                  <path fill="currentColor" d="M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6z"/>
                </svg>
                <span>Piorando</span>
              </>
            )}
            {scoreDiff >= -5 && scoreDiff <= 5 && (
              <>
                <svg viewBox="0 0 24 24" width="28" height="28" className="trend-icon trend-icon--stable">
                  <path fill="currentColor" d="M22 12l-4-4v3H3v2h15v3z"/>
                </svg>
                <span>Estável</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Charts */}
      {comparisonChartData.labels.length > 0 && (
        <div className="history-view__chart-section">
          <div className="chart-card">
            <div className="chart-card__header">
              <h2 className="chart-card__title">Comparativo por Indicador</h2>
              <p className="chart-card__subtitle">
                Score de cada indicador entre {selectedYear} e {comparisonYear}
              </p>
            </div>
            <div className="chart-card__content" style={{ height: 300 }}>
              <Bar data={comparisonChartData} options={chartOptions} />
            </div>
          </div>
        </div>
      )}

      {monthlyEvolutionData.datasets[0].data.some(v => v !== null) && (
        <div className="history-view__chart-section">
          <div className="chart-card">
            <div className="chart-card__header">
              <h2 className="chart-card__title">Evolução Mensal - {selectedYear}</h2>
              <p className="chart-card__subtitle">
                Média dos valores registrados em cada mês
              </p>
            </div>
            <div className="chart-card__content" style={{ height: 250 }}>
              <Line data={monthlyEvolutionData} options={lineChartOptions} />
            </div>
          </div>
        </div>
      )}

      {/* Indicators List */}
      <div className="history-view__indicators">
        <h2 className="history-view__section-title">Indicadores - {selectedYear}</h2>

        {selectedYearIndicators.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" width="48" height="48" className="empty-state__icon">
              <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
            <h3 className="empty-state__title">Nenhum indicador encontrado</h3>
            <p className="empty-state__description">
              Não há indicadores registrados para {selectedYear}
            </p>
          </div>
        ) : (
          <div className="indicators-list">
            {selectedYearIndicators.map(indicator => {
              const comparisonInd = comparisonYearIndicators.find(
                i => i.nome === indicator.nome
              );
              const diff = comparisonInd
                ? indicator.score - comparisonInd.score
                : null;

              return (
                <div
                  key={indicator.id}
                  className="indicator-row"
                  onClick={() => navigate(`/indicadores/meus/${indicator.id}`)}
                >
                  <div className="indicator-row__left">
                    <TrafficLightBadge score={indicator.score} />
                    <div className="indicator-row__info">
                      <span className="indicator-row__name">{indicator.nome}</span>
                      <span className="indicator-row__meta">
                        {indicator.ciclo?.toUpperCase()} • Peso {indicator.peso || 1}
                      </span>
                    </div>
                  </div>

                  <div className="indicator-row__right">
                    {diff !== null && (
                      <div className={`indicator-row__diff ${diff > 0 ? 'positive' : diff < 0 ? 'negative' : ''}`}>
                        {diff > 0 && (
                          <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M7 14l5-5 5 5z"/>
                          </svg>
                        )}
                        {diff < 0 && (
                          <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M7 10l5 5 5-5z"/>
                          </svg>
                        )}
                        {diff === 0 && (
                          <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M5 12h14v2H5z"/>
                          </svg>
                        )}
                        <span>{diff > 0 ? '+' : ''}{diff}%</span>
                        <span className="indicator-row__vs">vs {comparisonYear}</span>
                      </div>
                    )}
                    <div className="indicator-row__progress">
                      <div
                        className="indicator-row__progress-bar"
                        style={{
                          width: `${Math.min(indicator.score, 100)}%`,
                          backgroundColor: indicator.score >= 100 ? '#22c55e' : indicator.score >= 80 ? '#ffd000' : '#ef4444'
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
