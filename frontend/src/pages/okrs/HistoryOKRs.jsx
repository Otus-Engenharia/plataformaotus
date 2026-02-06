/**
 * HistoryOKRs - Histórico e comparativo de OKRs entre anos
 *
 * Funcionalidades:
 * - Seleção de anos para comparação
 * - Cards de resumo (objetivos, KRs, progresso médio)
 * - Gráfico de barras: progresso por ciclo
 * - Evolução por setor com trend indicators
 * - Lista de objetivos por ciclo
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { calculateKRProgress } from '../../utils/indicator-utils';
import './HistoryOKRs.css';

// Helper: extract year and cycle from quarter field (e.g., "Q1-2026" -> { year: 2026, cycle: 'q1' })
function parseQuarter(quarter) {
  if (!quarter) return { year: null, cycle: null };
  const parts = quarter.split('-');
  if (parts.length !== 2) return { year: null, cycle: null };
  const cycle = parts[0].toLowerCase();
  const year = parseInt(parts[1], 10);
  return { year, cycle };
}

// Icons
const icons = {
  arrowLeft: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  ),
  target: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  key: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  ),
  chart: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  ),
  trendUp: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M23 6l-9.5 9.5-5-5L1 18" />
      <path d="M17 6h6v6" />
    </svg>
  ),
  trendDown: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M23 18l-9.5-9.5-5 5L1 6" />
      <path d="M17 18h6v-6" />
    </svg>
  ),
  minus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 12h14" />
    </svg>
  ),
  calendar: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  chevronRight: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  ),
  building: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  ),
  swap: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 16V4m0 12l-3-3m3 3l3-3" />
      <path d="M17 8v12m0-12l3 3m-3-3l-3 3" />
    </svg>
  ),
};

// Stat Card Component
function StatCard({ icon, label, value, comparison, comparisonYear, trend, trendValue, delay = 0 }) {
  const getTrendColor = () => {
    if (trend === 'up') return 'var(--hist-green)';
    if (trend === 'down') return 'var(--hist-red)';
    return 'var(--hist-muted)';
  };

  return (
    <div className="hist-stat-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="hist-stat-card__icon">
        {icon}
      </div>
      <div className="hist-stat-card__content">
        <span className="hist-stat-card__label">{label}</span>
        <div className="hist-stat-card__value-row">
          <span className="hist-stat-card__value">{value}</span>
          {trendValue !== undefined && trendValue !== 0 && (
            <span
              className="hist-stat-card__trend"
              style={{ color: getTrendColor(), background: `${getTrendColor()}15` }}
            >
              {trend === 'up' && icons.trendUp}
              {trend === 'down' && icons.trendDown}
              {trend === 'stable' && icons.minus}
              {trendValue > 0 ? '+' : ''}{trendValue}
            </span>
          )}
        </div>
        {comparison !== undefined && (
          <span className="hist-stat-card__comparison">
            vs <strong>{comparison}</strong> em {comparisonYear}
          </span>
        )}
      </div>
    </div>
  );
}

// Year Selector Component
function YearSelector({ selectedYear, comparisonYear, years, onSelectYear, onSelectComparison }) {
  return (
    <div className="hist-year-selector">
      <div className="hist-year-selector__group">
        <label className="hist-year-selector__label">Ano Principal</label>
        <div className="hist-year-selector__buttons">
          {years.map(y => (
            <button
              key={y}
              className={`hist-year-btn ${y === selectedYear ? 'hist-year-btn--active' : ''}`}
              onClick={() => onSelectYear(y)}
            >
              {y}
            </button>
          ))}
        </div>
      </div>
      <div className="hist-year-selector__divider">
        {icons.swap}
      </div>
      <div className="hist-year-selector__group">
        <label className="hist-year-selector__label">Comparar com</label>
        <div className="hist-year-selector__buttons">
          {years.filter(y => y !== selectedYear).map(y => (
            <button
              key={y}
              className={`hist-year-btn hist-year-btn--secondary ${y === comparisonYear ? 'hist-year-btn--active-secondary' : ''}`}
              onClick={() => onSelectComparison(y)}
            >
              {y}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Enhanced Bar Chart Component
function BarChart({ data, selectedYear, comparisonYear }) {
  const maxValue = 100;

  return (
    <div className="hist-chart">
      <div className="hist-chart__legend">
        <div className="hist-chart__legend-item">
          <span className="hist-chart__legend-dot hist-chart__legend-dot--primary"></span>
          <span>{selectedYear}</span>
        </div>
        <div className="hist-chart__legend-item">
          <span className="hist-chart__legend-dot hist-chart__legend-dot--secondary"></span>
          <span>{comparisonYear}</span>
        </div>
      </div>

      <div className="hist-chart__container">
        {data.map((item, idx) => {
          const primaryHeight = Math.max((item[selectedYear] / maxValue) * 100, 3);
          const secondaryHeight = Math.max((item[comparisonYear] / maxValue) * 100, 3);
          const diff = item[selectedYear] - item[comparisonYear];

          return (
            <div key={idx} className="hist-chart__group" style={{ animationDelay: `${idx * 80}ms` }}>
              <div className="hist-chart__bars">
                <div className="hist-chart__bar-wrapper">
                  <span className="hist-chart__value hist-chart__value--primary">
                    {item[selectedYear]}%
                  </span>
                  <div
                    className="hist-chart__bar hist-chart__bar--primary"
                    style={{ height: `${primaryHeight}%` }}
                  />
                </div>
                <div className="hist-chart__bar-wrapper">
                  <span className="hist-chart__value hist-chart__value--secondary">
                    {item[comparisonYear]}%
                  </span>
                  <div
                    className="hist-chart__bar hist-chart__bar--secondary"
                    style={{ height: `${secondaryHeight}%` }}
                  />
                </div>
              </div>
              <span className="hist-chart__label">{item.cycle}</span>
              {diff !== 0 && (
                <span className={`hist-chart__diff ${diff > 0 ? 'hist-chart__diff--positive' : 'hist-chart__diff--negative'}`}>
                  {diff > 0 ? '+' : ''}{diff}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Sector Comparison Card Component
function SectorComparisonCard({ sector, selectedProgress, comparisonProgress, diff, trend, selectedYear, comparisonYear }) {
  return (
    <div className="hist-sector-card">
      <div className="hist-sector-card__header">
        <div className="hist-sector-card__icon">
          {icons.building}
        </div>
        <div className="hist-sector-card__name">{sector.name || sector.nome}</div>
        <div className={`hist-sector-card__trend hist-sector-card__trend--${trend}`}>
          {trend === 'up' && icons.trendUp}
          {trend === 'down' && icons.trendDown}
          {trend === 'stable' && icons.minus}
          <span>{diff > 0 ? '+' : ''}{diff}%</span>
        </div>
      </div>

      <div className="hist-sector-card__progress">
        <div className="hist-sector-card__progress-row">
          <span className="hist-sector-card__year">{selectedYear}</span>
          <div className="hist-sector-card__bar-container">
            <div
              className="hist-sector-card__bar hist-sector-card__bar--primary"
              style={{ width: `${selectedProgress}%` }}
            />
          </div>
          <span className="hist-sector-card__percent hist-sector-card__percent--primary">
            {selectedProgress}%
          </span>
        </div>
        <div className="hist-sector-card__progress-row">
          <span className="hist-sector-card__year">{comparisonYear}</span>
          <div className="hist-sector-card__bar-container">
            <div
              className="hist-sector-card__bar hist-sector-card__bar--secondary"
              style={{ width: `${comparisonProgress}%` }}
            />
          </div>
          <span className="hist-sector-card__percent hist-sector-card__percent--secondary">
            {comparisonProgress}%
          </span>
        </div>
      </div>
    </div>
  );
}

// Cycle Card Component
function CycleCard({ cycleData, navigate }) {
  const getProgressColor = (progress) => {
    if (progress >= 70) return 'var(--hist-green)';
    if (progress >= 40) return 'var(--hist-yellow)';
    return 'var(--hist-red)';
  };

  return (
    <div className="hist-cycle-card">
      <div className="hist-cycle-card__header">
        <div className="hist-cycle-card__title">
          {icons.calendar}
          <span>{cycleData.label}</span>
        </div>
        <div className="hist-cycle-card__stats">
          <span className="hist-cycle-card__count">
            {cycleData.objectives.length} objetivo{cycleData.objectives.length !== 1 ? 's' : ''}
          </span>
          <div
            className="hist-cycle-card__progress-ring"
            style={{ '--progress-color': getProgressColor(cycleData.overallProgress) }}
          >
            <svg viewBox="0 0 36 36">
              <path
                className="hist-cycle-card__progress-bg"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="hist-cycle-card__progress-fill"
                strokeDasharray={`${cycleData.overallProgress}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="hist-cycle-card__progress-value">{cycleData.overallProgress}%</span>
          </div>
        </div>
      </div>

      <div className="hist-cycle-card__objectives">
        {cycleData.objectives.slice(0, 5).map(obj => (
          <div
            key={obj.id}
            className="hist-objective-item"
            onClick={() => navigate(`/okrs/objetivo/${obj.id}`)}
          >
            <div className="hist-objective-item__content">
              <h4 className="hist-objective-item__title">{obj.titulo}</h4>
              <span className="hist-objective-item__krs">
                {obj.keyResultsCount} KR{obj.keyResultsCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="hist-objective-item__progress">
              <div className="hist-objective-item__bar">
                <div
                  className="hist-objective-item__bar-fill"
                  style={{
                    width: `${obj.progress}%`,
                    background: getProgressColor(obj.progress)
                  }}
                />
              </div>
              <span
                className="hist-objective-item__percent"
                style={{ color: getProgressColor(obj.progress) }}
              >
                {obj.progress}%
              </span>
            </div>
            <div className="hist-objective-item__arrow">
              {icons.chevronRight}
            </div>
          </div>
        ))}
        {cycleData.objectives.length > 5 && (
          <div className="hist-cycle-card__more">
            +{cycleData.objectives.length - 5} mais objetivos
          </div>
        )}
      </div>
    </div>
  );
}

export default function HistoryOKRs() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [comparisonYear, setComparisonYear] = useState(currentYear - 1);
  const [objectives, setObjectives] = useState([]);
  const [keyResults, setKeyResults] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const okrsResponse = await axios.get('/api/okrs', { withCredentials: true });
        if (okrsResponse.data.success) {
          const allOkrs = okrsResponse.data.data || [];
          const mappedOkrs = allOkrs.map(okr => ({
            ...okr,
            key_results: okr.keyResults || okr.key_results || []
          }));

          setObjectives(mappedOkrs);

          const allKrs = mappedOkrs.flatMap(o => o.key_results || []);
          setKeyResults(allKrs);

          const krIds = allKrs.map(kr => kr.id);
          if (krIds.length > 0) {
            const checkInsResponse = await axios.get('/api/okrs/check-ins', {
              params: { keyResultIds: krIds.join(',') },
              withCredentials: true
            });
            if (checkInsResponse.data.success) {
              setCheckIns(checkInsResponse.data.data || []);
            }
          }
        }

        const sectorsResponse = await axios.get('/api/ind/sectors', { withCredentials: true });
        if (sectorsResponse.data.success) {
          setSectors(sectorsResponse.data.data || []);
        }

      } catch (error) {
        console.error('Error fetching history data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [selectedYear, comparisonYear]);

  // Process data by cycle
  const cycleDataByYear = useMemo(() => {
    const result = {
      [selectedYear]: [],
      [comparisonYear]: [],
    };

    const teamObjectives = objectives.filter(o => o.nivel !== 'empresa');

    [selectedYear, comparisonYear].forEach(year => {
      const yearObjectives = teamObjectives.filter(o => {
        const { year: objYear } = parseQuarter(o.quarter);
        return objYear === year;
      });
      const cycles = ['anual', 'q1', 'q2', 'q3', 'q4'];

      cycles.forEach(cycle => {
        const cycleObjectives = yearObjectives.filter(o => {
          const { cycle: objCycle } = parseQuarter(o.quarter);
          return objCycle === cycle;
        });
        if (cycleObjectives.length === 0) return;

        const objectivesWithProgress = cycleObjectives.map(obj => {
          const objKRs = keyResults.filter(kr => kr.okr_id === obj.id);
          const krsWithProgress = objKRs.map(kr => {
            const krCheckIns = checkIns.filter(c => c.key_result_id === kr.id);
            return calculateKRProgress(kr, krCheckIns);
          }).filter(p => p !== null); // Ignorar KRs não medidos

          const avgProgress = krsWithProgress.length > 0
            ? krsWithProgress.reduce((a, b) => a + b, 0) / krsWithProgress.length
            : 0;

          return {
            ...obj,
            progress: Math.round(avgProgress),
            keyResultsCount: objKRs.length,
          };
        });

        const overallProgress = objectivesWithProgress.length > 0
          ? Math.round(objectivesWithProgress.reduce((a, b) => a + b.progress, 0) / objectivesWithProgress.length)
          : 0;

        result[year].push({
          cycle,
          year,
          label: cycle === 'anual' ? `Anual ${year}` : `${cycle.toUpperCase()} ${year}`,
          objectives: objectivesWithProgress,
          overallProgress,
        });
      });
    });

    return result;
  }, [objectives, keyResults, checkIns, selectedYear, comparisonYear]);

  // Chart data comparing cycles
  const comparisonChartData = useMemo(() => {
    const cycles = ['anual', 'q1', 'q2', 'q3', 'q4'];
    return cycles.map(cycle => {
      const selectedCycleData = cycleDataByYear[selectedYear].find(c => c.cycle === cycle);
      const comparisonCycleData = cycleDataByYear[comparisonYear].find(c => c.cycle === cycle);

      return {
        cycle: cycle === 'anual' ? 'Anual' : cycle.toUpperCase(),
        [selectedYear]: selectedCycleData?.overallProgress || 0,
        [comparisonYear]: comparisonCycleData?.overallProgress || 0,
      };
    });
  }, [cycleDataByYear, selectedYear, comparisonYear]);

  // Sector progress comparison
  const sectorComparison = useMemo(() => {
    const teamObjectives = objectives.filter(o => o.nivel !== 'empresa');

    return sectors.map(sector => {
      const selectedYearObjs = teamObjectives.filter(o => {
        const { year } = parseQuarter(o.quarter);
        return year === selectedYear && o.setor_id === sector.id;
      });
      const comparisonYearObjs = teamObjectives.filter(o => {
        const { year } = parseQuarter(o.quarter);
        return year === comparisonYear && o.setor_id === sector.id;
      });

      const calculateSectorProgress = (objs) => {
        if (objs.length === 0) return 0;
        const progresses = objs.map(obj => {
          const objKRs = keyResults.filter(kr => kr.okr_id === obj.id);
          const krsProgress = objKRs.map(kr => {
            const krCheckIns = checkIns.filter(c => c.key_result_id === kr.id);
            return calculateKRProgress(kr, krCheckIns);
          }).filter(p => p !== null); // Ignorar KRs não medidos
          return krsProgress.length > 0 ? krsProgress.reduce((a, b) => a + b, 0) / krsProgress.length : 0;
        });
        return Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length);
      };

      const selectedProgress = calculateSectorProgress(selectedYearObjs);
      const comparisonProgress = calculateSectorProgress(comparisonYearObjs);
      const diff = selectedProgress - comparisonProgress;

      return {
        sector,
        selectedProgress,
        comparisonProgress,
        diff,
        trend: diff > 5 ? 'up' : diff < -5 ? 'down' : 'stable',
      };
    }).filter(s => s.selectedProgress > 0 || s.comparisonProgress > 0);
  }, [sectors, objectives, keyResults, checkIns, selectedYear, comparisonYear]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const teamObjectives = objectives.filter(o => o.nivel !== 'empresa');

    const selectedObjectives = teamObjectives.filter(o => {
      const { year } = parseQuarter(o.quarter);
      return year === selectedYear;
    });
    const comparisonObjectives = teamObjectives.filter(o => {
      const { year } = parseQuarter(o.quarter);
      return year === comparisonYear;
    });

    const selectedKRs = keyResults.filter(kr => {
      const obj = teamObjectives.find(o => o.id === kr.okr_id);
      if (!obj) return false;
      const { year } = parseQuarter(obj.quarter);
      return year === selectedYear;
    });
    const comparisonKRs = keyResults.filter(kr => {
      const obj = teamObjectives.find(o => o.id === kr.okr_id);
      if (!obj) return false;
      const { year } = parseQuarter(obj.quarter);
      return year === comparisonYear;
    });

    const selectedCycles = cycleDataByYear[selectedYear];
    const avgSelected = selectedCycles.length > 0
      ? Math.round(selectedCycles.reduce((a, b) => a + b.overallProgress, 0) / selectedCycles.length)
      : 0;
    const comparisonCycles = cycleDataByYear[comparisonYear];
    const avgComparison = comparisonCycles.length > 0
      ? Math.round(comparisonCycles.reduce((a, b) => a + b.overallProgress, 0) / comparisonCycles.length)
      : 0;

    return {
      objectives: {
        selected: selectedObjectives.length,
        comparison: comparisonObjectives.length,
        diff: selectedObjectives.length - comparisonObjectives.length,
      },
      keyResults: {
        selected: selectedKRs.length,
        comparison: comparisonKRs.length,
        diff: selectedKRs.length - comparisonKRs.length,
      },
      progress: {
        selected: avgSelected,
        comparison: avgComparison,
        diff: avgSelected - avgComparison,
      },
    };
  }, [objectives, keyResults, cycleDataByYear, selectedYear, comparisonYear]);

  if (isLoading) {
    return (
      <div className="hist-dashboard">
        <div className="hist-loading">
          <div className="hist-loading__spinner"></div>
          <span>Carregando histórico...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="hist-dashboard">
      {/* Header */}
      <header className="hist-header">
        <div className="hist-header__top">
          <button className="hist-back-btn" onClick={() => navigate('/okrs')}>
            {icons.arrowLeft}
            <span>Voltar</span>
          </button>
        </div>
        <div className="hist-header__main">
          <div className="hist-header__title-area">
            <h1 className="hist-header__title">Histórico de OKRs</h1>
            <p className="hist-header__subtitle">
              Compare o desempenho entre diferentes anos e identifique tendências
            </p>
          </div>
        </div>
      </header>

      {/* Year Selector */}
      <YearSelector
        selectedYear={selectedYear}
        comparisonYear={comparisonYear}
        years={years}
        onSelectYear={setSelectedYear}
        onSelectComparison={setComparisonYear}
      />

      {/* Summary Stats */}
      <section className="hist-stats">
        <StatCard
          icon={icons.target}
          label="Objetivos"
          value={summaryStats.objectives.selected}
          comparison={summaryStats.objectives.comparison}
          comparisonYear={comparisonYear}
          trend={summaryStats.objectives.diff > 0 ? 'up' : summaryStats.objectives.diff < 0 ? 'down' : 'stable'}
          trendValue={summaryStats.objectives.diff}
          delay={0}
        />
        <StatCard
          icon={icons.key}
          label="Key Results"
          value={summaryStats.keyResults.selected}
          comparison={summaryStats.keyResults.comparison}
          comparisonYear={comparisonYear}
          trend={summaryStats.keyResults.diff > 0 ? 'up' : summaryStats.keyResults.diff < 0 ? 'down' : 'stable'}
          trendValue={summaryStats.keyResults.diff}
          delay={100}
        />
        <StatCard
          icon={icons.chart}
          label="Progresso Médio"
          value={`${summaryStats.progress.selected}%`}
          comparison={`${summaryStats.progress.comparison}%`}
          comparisonYear={comparisonYear}
          trend={summaryStats.progress.diff > 0 ? 'up' : summaryStats.progress.diff < 0 ? 'down' : 'stable'}
          trendValue={summaryStats.progress.diff}
          delay={200}
        />
      </section>

      {/* Chart Section */}
      <section className="hist-section">
        <div className="hist-card">
          <div className="hist-card__header">
            <h2 className="hist-card__title">Progresso por Ciclo</h2>
            <p className="hist-card__subtitle">
              Comparação do progresso médio por trimestre entre {selectedYear} e {comparisonYear}
            </p>
          </div>
          <BarChart
            data={comparisonChartData}
            selectedYear={selectedYear}
            comparisonYear={comparisonYear}
          />
        </div>
      </section>

      {/* Sector Comparison */}
      {sectorComparison.length > 0 && (
        <section className="hist-section">
          <div className="hist-section__header">
            <h2 className="hist-section__title">Evolução por Setor</h2>
            <p className="hist-section__subtitle">
              Comparativo de progresso entre setores em {selectedYear} vs {comparisonYear}
            </p>
          </div>
          <div className="hist-sectors-grid">
            {sectorComparison.map(({ sector, selectedProgress, comparisonProgress, diff, trend }) => (
              <SectorComparisonCard
                key={sector.id}
                sector={sector}
                selectedProgress={selectedProgress}
                comparisonProgress={comparisonProgress}
                diff={diff}
                trend={trend}
                selectedYear={selectedYear}
                comparisonYear={comparisonYear}
              />
            ))}
          </div>
        </section>
      )}

      {/* Objectives by Cycle */}
      <section className="hist-section">
        <div className="hist-section__header">
          <h2 className="hist-section__title">Objetivos por Ciclo</h2>
          <p className="hist-section__subtitle">
            Detalhamento dos objetivos de {selectedYear} por trimestre
          </p>
        </div>

        {cycleDataByYear[selectedYear].length === 0 ? (
          <div className="hist-empty">
            <div className="hist-empty__icon">{icons.target}</div>
            <h3 className="hist-empty__title">Nenhum objetivo encontrado</h3>
            <p className="hist-empty__text">
              Não há objetivos registrados para {selectedYear}
            </p>
          </div>
        ) : (
          <div className="hist-cycles-grid">
            {cycleDataByYear[selectedYear].map(cycleData => (
              <CycleCard key={cycleData.cycle} cycleData={cycleData} navigate={navigate} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
