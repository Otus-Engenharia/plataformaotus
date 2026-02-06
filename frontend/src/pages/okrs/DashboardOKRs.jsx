import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { calculateKRProgress, calculateKRProgressVsMeta } from '../../utils/indicator-utils';
import './DashboardOKRs.css';

// Score Ring Component (matching indicadores style)
function ScoreRing({ score, size = 72, strokeWidth = 6 }) {
  const isNotMeasured = score === null;
  const displayScore = isNotMeasured ? 0 : score;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = Math.min(displayScore, 100) / 100;
  const offset = circumference - (progress * circumference);

  const getColor = () => {
    if (isNotMeasured) return '#9ca3af'; // muted
    if (score >= 100) return '#22c55e';  // success
    if (score >= 70) return '#f59e0b';   // warning
    return '#ef4444';                     // danger
  };

  return (
    <div className="okr-score-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="okr-score-ring-bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        {!isNotMeasured && (
          <circle
            className="okr-score-ring-progress"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ stroke: getColor() }}
          />
        )}
      </svg>
      <span className="okr-score-ring-value" style={{ color: getColor() }}>
        {isNotMeasured ? '-' : `${displayScore.toFixed(0)}%`}
      </span>
    </div>
  );
}

// Metric Card Component
function MetricCard({ title, value, subtitle, icon, variant = 'default', delay = 0 }) {
  return (
    <div
      className={`okr-metric-card okr-metric-card--${variant}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="okr-metric-card__glow" />
      <div className="okr-metric-card__content">
        <div className="okr-metric-card__header">
          <span className="okr-metric-card__title">{title}</span>
          {icon && <span className="okr-metric-card__icon">{icon}</span>}
        </div>
        <div className="okr-metric-card__value">{value}</div>
        {subtitle && <div className="okr-metric-card__subtitle">{subtitle}</div>}
      </div>
    </div>
  );
}

/**
 * Calcula o progresso de um OKR (média ponderada dos KRs pelo peso_kr)
 * @param {Object} objective - Objetivo com key_results
 * @param {Array} checkIns - Check-ins de todos os KRs
 * @returns {number} Progresso de 0 a 100
 */
function calculateOKRProgressWeighted(objective, checkIns = []) {
  const krs = objective.key_results || [];
  if (krs.length === 0) return null; // Sem KRs = não medido

  let totalKrWeight = 0;
  let weightedSum = 0;

  krs.forEach(kr => {
    const krCheckIns = checkIns.filter(c => c.key_result_id === kr.id);
    const progress = calculateKRProgress(kr, krCheckIns);

    // Ignorar KRs não medidos (progress === null)
    if (progress !== null) {
      const peso = kr.peso || 1;
      weightedSum += progress * peso;
      totalKrWeight += peso;
    }
  });

  // Se todos os KRs são não medidos, retorna null
  return totalKrWeight > 0 ? Math.round(weightedSum / totalKrWeight) : null;
}

/**
 * Calcula o progresso de um setor (soma dos progressos × peso absoluto)
 * Peso representa % de contribuição para o total (soma ideal = 100%)
 * @param {Array} objectives - Objetivos do setor
 * @param {Array} checkIns - Check-ins de todos os KRs
 * @returns {number} Progresso de 0 a 100
 */
function calculateSectorProgressWeighted(objectives, checkIns = []) {
  if (objectives.length === 0) return null; // Sem objetivos = não medido

  let weightedSum = 0;
  let hasMeasured = false;

  objectives.forEach(obj => {
    const okrProgress = calculateOKRProgressWeighted(obj, checkIns);
    // Ignorar OKRs não medidos (progress === null)
    if (okrProgress !== null) {
      const peso = obj.peso || 1; // peso em %
      weightedSum += (okrProgress / 100) * peso; // contribuição absoluta
      hasMeasured = true;
    }
  });

  // Se todos os OKRs são não medidos, retorna null
  return hasMeasured ? Math.round(weightedSum) : null;
}

/**
 * Calcula o progresso de um setor vs meta final (soma dos progressos × peso absoluto)
 * Peso representa % de contribuição para o total (soma ideal = 100%)
 * @param {Array} objectives - Objetivos do setor
 * @returns {number|null} Progresso percentual ou null se não medido
 */
function calculateSectorProgressVsMeta(objectives) {
  if (objectives.length === 0) return null;

  let weightedSum = 0;
  let hasMeasured = false;

  objectives.forEach(obj => {
    const okrProgressVsMeta = calculateOKRProgressVsMeta(obj);
    // Ignorar OKRs não medidos
    if (okrProgressVsMeta !== null) {
      const peso = obj.peso || 1; // peso em %
      weightedSum += (okrProgressVsMeta / 100) * peso; // contribuição absoluta
      hasMeasured = true;
    }
  });

  return hasMeasured ? Math.round(weightedSum) : null;
}

/**
 * Calcula o progresso de um OKR vs meta final (média ponderada dos KRs)
 * @param {Object} objective - Objetivo com key_results
 * @returns {number|null} Progresso percentual ou null se não medido
 */
function calculateOKRProgressVsMeta(objective) {
  const krs = objective.key_results || [];
  if (krs.length === 0) return null;

  let totalWeight = 0;
  let weightedSum = 0;

  krs.forEach(kr => {
    const progressVsMeta = calculateKRProgressVsMeta(kr);
    if (progressVsMeta !== null) {
      const peso = kr.peso || 1;
      weightedSum += progressVsMeta * peso;
      totalWeight += peso;
    }
  });

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
}

/**
 * Retorna a cor baseada no valor de progresso
 */
function getStatusColor(value) {
  if (value === null) return 'muted';
  if (value >= 100) return 'success';
  if (value >= 70) return 'warning';
  return 'danger';
}

// Sector Card Component
function SectorCard({ sector, objectives, checkIns, index }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  // Calculate sector progress using hierarchical weighted average
  // Setor = média ponderada dos OKRs (peso_okr), onde OKR = média ponderada dos KRs (peso_kr)
  const sectorProgress = calculateSectorProgressWeighted(objectives, checkIns);
  const sectorProgressVsMeta = calculateSectorProgressVsMeta(objectives);

  const sectorKRs = objectives.flatMap(obj => obj.key_results || []);
  const completedKRs = sectorKRs.filter(kr => kr.status === 'completed').length;
  // Conta KRs atrasados (delayed) e em risco (at_risk)
  const delayedKRs = sectorKRs.filter(kr => kr.status === 'delayed' || kr.status === 'at_risk').length;

  const getStatusColor = () => {
    if (sectorProgress === null) return 'muted';
    if (sectorProgress >= 100) return 'success';
    if (sectorProgress >= 70) return 'warning';
    return 'danger';
  };

  return (
    <div
      className={`okr-sector-card okr-sector-card--${getStatusColor()}`}
      style={{ animationDelay: `${100 + index * 50}ms` }}
    >
      <div className="okr-sector-card__header" onClick={() => setExpanded(!expanded)}>
        <div className="okr-sector-card__info">
          <div className="okr-sector-card__icon">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
            </svg>
          </div>
          <div>
            <h3 className="okr-sector-card__name">{sector.name}</h3>
            <p className="okr-sector-card__stats">
              {objectives.length} objetivo{objectives.length !== 1 ? 's' : ''} • {sectorKRs.length} KR{sectorKRs.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="okr-sector-card__progress">
          <div className="okr-sector-card__progress-dual">
            <div className="okr-sector-card__progress-item">
              <span className="okr-sector-card__progress-label">Ritmo</span>
              <ScoreRing score={sectorProgress} size={48} strokeWidth={4} />
            </div>
            <div className="okr-sector-card__progress-item">
              <span className="okr-sector-card__progress-label">Progresso</span>
              <ScoreRing score={sectorProgressVsMeta} size={48} strokeWidth={4} />
            </div>
          </div>
          <span className={`okr-sector-card__chevron ${expanded ? 'expanded' : ''}`}>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M7 10l5 5 5-5z"/>
            </svg>
          </span>
        </div>
      </div>

      {expanded && (
        <div className="okr-sector-card__body">
          <div className="okr-sector-card__mini-stats">
            <span className="okr-mini-stat okr-mini-stat--success">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              {completedKRs} concluído{completedKRs !== 1 ? 's' : ''}
            </span>
            {delayedKRs > 0 && (
              <span className="okr-mini-stat okr-mini-stat--danger">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                </svg>
                {delayedKRs} atrasado{delayedKRs !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="okr-sector-card__objectives">
            {objectives.map(obj => {
              const objProgress = calculateOKRProgressWeighted(obj, checkIns);
              const objProgressVsMeta = calculateOKRProgressVsMeta(obj);
              const responsavel = obj.responsavel_user?.name || obj.responsavel;
              const avatarUrl = obj.responsavel_user?.avatar_url;

              return (
                <Link
                  key={obj.id}
                  to={`/okrs/objetivo/${obj.id}`}
                  className="okr-objective-mini"
                >
                  <div className="okr-objective-mini__header">
                    <span className="okr-objective-mini__cycle">
                      {obj.quarter?.includes('Anual') ? 'Anual' : obj.quarter?.split('-')[0]?.toUpperCase() || 'Q1'}
                    </span>
                    <span className="okr-objective-mini__title">{obj.titulo}</span>
                  </div>
                  <div className="okr-objective-mini__metrics">
                    <span className="okr-objective-mini__metric">
                      <span className="okr-objective-mini__metric-label">Ritmo</span>
                      <span className={`okr-objective-mini__metric-value okr-objective-mini__metric-value--${getStatusColor(objProgress)}`}>
                        {objProgress === null ? '-' : `${objProgress}%`}
                      </span>
                    </span>
                    <span className="okr-objective-mini__metric">
                      <span className="okr-objective-mini__metric-label">Progresso</span>
                      <span className={`okr-objective-mini__metric-value okr-objective-mini__metric-value--${getStatusColor(objProgressVsMeta)}`}>
                        {objProgressVsMeta === null ? '-' : `${objProgressVsMeta}%`}
                      </span>
                    </span>
                    <span className="okr-objective-mini__metric">
                      <span className="okr-objective-mini__metric-label">Peso</span>
                      <span className="okr-objective-mini__metric-value">{obj.peso || 1}%</span>
                    </span>
                    {responsavel && (
                      <div className="okr-objective-mini__avatar" title={responsavel}>
                        {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{responsavel.charAt(0).toUpperCase()}</span>}
                      </div>
                    )}
                    <span className="okr-objective-mini__krs">
                      {(obj.key_results || []).length} KR{(obj.key_results || []).length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          <button
            className="okr-sector-card__view-btn"
            onClick={() => navigate(`/okrs/setor/${sector.id}`)}
          >
            Ver setor completo
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}


// Helper functions
function getCurrentQuarter() {
  const month = new Date().getMonth() + 1;
  if (month <= 3) return 'q1';
  if (month <= 6) return 'q2';
  if (month <= 9) return 'q3';
  return 'q4';
}

function getQuarterLabel(quarter) {
  const labels = { q1: 'Q1', q2: 'Q2', q3: 'Q3', q4: 'Q4', annual: 'Anual' };
  return labels[quarter] || quarter;
}

export default function DashboardOKRs() {
  const { isPrivileged, isAdmin, isDirector } = useAuth();
  const navigate = useNavigate();

  const [sectors, setSectors] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [ciclo, setCiclo] = useState(getCurrentQuarter());
  const [ano, setAno] = useState(new Date().getFullYear());
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch sectors via API
      const sectorsResponse = await axios.get('/api/ind/sectors', { withCredentials: true });
      if (sectorsResponse.data.success) {
        setSectors(sectorsResponse.data.data || []);
      }

      // Fetch OKRs via API (já vem com keyResults)
      const okrsResponse = await axios.get('/api/okrs', { withCredentials: true });
      if (!okrsResponse.data.success) throw new Error(okrsResponse.data.error);

      // Map keyResults to key_results for consistency
      const objectivesData = (okrsResponse.data.data || []).map(okr => ({
        ...okr,
        key_results: okr.keyResults || okr.key_results || []
      }));

      // Filter by year and cycle
      const filteredObjectives = objectivesData.filter(obj => {
        if (!obj.quarter) return false;

        // Excluir OKRs anuais da empresa do Dashboard (aparecem apenas em /okrs/empresa)
        const isAnnual = obj.quarter.toLowerCase().includes('anual');
        const isCompanyLevel = obj.nivel === 'empresa';
        if (isAnnual && isCompanyLevel) return false;

        const yearMatch = obj.quarter.includes(String(ano));
        const cycleMatch = ciclo === 'annual'
          ? isAnnual
          : obj.quarter.toLowerCase().includes(ciclo);

        return yearMatch && cycleMatch;
      });

      setObjectives(filteredObjectives);

      // Fetch check-ins for all KRs
      const allKrIds = filteredObjectives.flatMap(obj =>
        (obj.key_results || []).map(kr => kr.id)
      );

      if (allKrIds.length > 0) {
        const checkInsResponse = await axios.get('/api/okrs/check-ins', {
          params: { keyResultIds: allKrIds.join(',') },
          withCredentials: true
        });
        setCheckIns(checkInsResponse.data.data || []);
      } else {
        setCheckIns([]);
      }
    } catch (err) {
      console.error('Error fetching OKRs data:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [ciclo, ano]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate stats
  const totalKRs = objectives.reduce((acc, obj) => acc + (obj.key_results?.length || 0), 0);
  const completedKRs = objectives.reduce((acc, obj) =>
    acc + (obj.key_results?.filter(kr => kr.status === 'completed').length || 0), 0);
  // Conta KRs atrasados (status delayed/at_risk OU ritmo < 70%)
  const delayedKRs = objectives.reduce((acc, obj) => {
    const krs = obj.key_results || [];
    return acc + krs.filter(kr => {
      // Prioriza status explícito
      if (kr.status === 'delayed' || kr.status === 'at_risk') return true;
      // Senão, verifica ritmo
      const krCheckIns = checkIns.filter(c => c.key_result_id === kr.id);
      const progress = calculateKRProgress(kr, krCheckIns);
      return progress !== null && progress < 70;
    }).length;
  }, 0);

  // Get objectives by sector
  const getObjectivesBySector = (sectorId) =>
    objectives.filter(obj => obj.setor_id === sectorId);

  const getCheckInsBySector = (sectorId) => {
    const sectorKrIds = objectives
      .filter(obj => obj.setor_id === sectorId)
      .flatMap(obj => (obj.key_results || []).map(kr => kr.id));
    return checkIns.filter(c => sectorKrIds.includes(c.key_result_id));
  };

  // Company objectives (no sector)
  const companyObjectives = objectives.filter(obj => !obj.setor_id);

  // Calculate overall progress as average of all sectors with OKRs
  // Progresso Geral = média simples do progresso de todos os setores (que têm OKRs medidos)
  const sectorsWithOKRs = sectors.filter(sector =>
    getObjectivesBySector(sector.id).length > 0
  );

  const overallProgress = (() => {
    if (sectorsWithOKRs.length === 0) return null;

    let totalProgress = 0;
    let measuredSectors = 0;

    sectorsWithOKRs.forEach(sector => {
      const sectorObjectives = getObjectivesBySector(sector.id);
      const sectorCheckIns = getCheckInsBySector(sector.id);
      const sectorProgress = calculateSectorProgressWeighted(sectorObjectives, sectorCheckIns);
      // Ignorar setores não medidos
      if (sectorProgress !== null) {
        totalProgress += sectorProgress;
        measuredSectors++;
      }
    });

    return measuredSectors > 0 ? totalProgress / measuredSectors : null;
  })();

  // Progresso vs Meta Final = média simples do progresso vs meta de todos os setores
  const overallProgressVsMeta = (() => {
    if (sectorsWithOKRs.length === 0) return null;

    let totalProgress = 0;
    let measuredSectors = 0;

    sectorsWithOKRs.forEach(sector => {
      const sectorObjectives = getObjectivesBySector(sector.id);
      const sectorProgressVsMeta = calculateSectorProgressVsMeta(sectorObjectives);
      if (sectorProgressVsMeta !== null) {
        totalProgress += sectorProgressVsMeta;
        measuredSectors++;
      }
    });

    return measuredSectors > 0 ? totalProgress / measuredSectors : null;
  })();

  if (loading) {
    return (
      <div className="okr-dashboard okr-dashboard--loading">
        <div className="okr-loading-pulse">
          <div className="okr-loading-pulse__ring" />
          <div className="okr-loading-pulse__ring" />
          <div className="okr-loading-pulse__ring" />
        </div>
        <p className="okr-loading-text">Carregando OKRs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="okr-dashboard okr-dashboard--error">
        <div className="okr-error-state">
          <svg viewBox="0 0 24 24" width="48" height="48" className="okr-error-state__icon">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <p className="okr-error-state__message">Erro: {error}</p>
          <button onClick={fetchData} className="okr-btn okr-btn--primary">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="okr-dashboard">
      {/* Background effects */}
      <div className="okr-dashboard__bg">
        <div className="okr-dashboard__gradient" />
        <div className="okr-dashboard__noise" />
      </div>

      {/* Header */}
      <header className="okr-header">
        <div className="okr-header__left">
          <h1 className="okr-header__title">Dashboard OKRs</h1>
          <p className="okr-header__subtitle">
            {getQuarterLabel(ciclo)} {ano} • Objetivos e Resultados-Chave
          </p>
        </div>

        <div className="okr-header__actions">
          <div className="okr-header__filters">
            <div className="okr-filter-chip">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
              </svg>
              <select
                value={ciclo}
                onChange={(e) => setCiclo(e.target.value)}
                className="okr-filter-chip__select"
              >
                <option value="q1">Q1</option>
                <option value="q2">Q2</option>
                <option value="q3">Q3</option>
                <option value="q4">Q4</option>
                <option value="annual">Anual</option>
              </select>
            </div>
            <div className="okr-filter-chip">
              <select
                value={ano}
                onChange={(e) => setAno(parseInt(e.target.value, 10))}
                className="okr-filter-chip__select"
              >
                {[ano - 1, ano, ano + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {isPrivileged && (
            <button
              className="okr-btn okr-btn--primary"
              onClick={() => navigate('/okrs/empresa')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              Novo OKR
            </button>
          )}
        </div>
      </header>

      {/* Metrics Grid */}
      <section className="okr-metrics-grid">
        {/* Card RITMO */}
        <div className="okr-metric-card okr-metric-card--featured okr-metric-card--ritmo" style={{ animationDelay: '0ms' }}>
          <div className="okr-metric-card__glow okr-metric-card__glow--featured" />
          <div className="okr-metric-card__content">
            <div className="okr-metric-card__header">
              <span className="okr-metric-card__title">Ritmo Geral</span>
              <span className="okr-metric-card__subtitle-inline">vs planejado</span>
            </div>
            <div className="okr-metric-card--featured__body">
              <ScoreRing score={overallProgress} size={64} strokeWidth={6} />
              <div className="okr-metric-card--featured__info">
                <span className="okr-metric-card--featured__percent">
                  {overallProgress === null ? '-' : `${overallProgress.toFixed(0)}%`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card PROGRESSO */}
        <div className="okr-metric-card okr-metric-card--featured okr-metric-card--progresso" style={{ animationDelay: '25ms' }}>
          <div className="okr-metric-card__glow okr-metric-card__glow--featured" />
          <div className="okr-metric-card__content">
            <div className="okr-metric-card__header">
              <span className="okr-metric-card__title">Progresso Geral</span>
              <span className="okr-metric-card__subtitle-inline">vs meta final</span>
            </div>
            <div className="okr-metric-card--featured__body">
              <ScoreRing score={overallProgressVsMeta} size={64} strokeWidth={6} />
              <div className="okr-metric-card--featured__info">
                <span className="okr-metric-card--featured__percent">
                  {overallProgressVsMeta === null ? '-' : `${overallProgressVsMeta.toFixed(0)}%`}
                </span>
              </div>
            </div>
          </div>
        </div>

        <MetricCard
          title="Total de KRs"
          value={totalKRs}
          subtitle="resultados-chave"
          icon={
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          }
          variant="default"
          delay={50}
        />

        <MetricCard
          title="Concluídos"
          value={completedKRs}
          subtitle="KRs finalizados"
          icon={
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          }
          variant={completedKRs > 0 ? 'success' : 'default'}
          delay={100}
        />

        <MetricCard
          title="Atrasados"
          value={delayedKRs}
          subtitle="precisam atenção"
          icon={
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
            </svg>
          }
          variant={delayedKRs > 0 ? 'danger' : 'default'}
          delay={150}
        />
      </section>

      {/* Company OKRs Section */}
      {companyObjectives.length > 0 && (
        <section className="okr-section">
          <div className="okr-section__header">
            <h2 className="okr-section__title">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10z"/>
              </svg>
              OKRs da Empresa
            </h2>
            <Link to="/okrs/empresa" className="okr-section__link">
              Ver todos
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
            </Link>
          </div>
          <div className="okr-company-objectives">
            {companyObjectives.slice(0, 3).map((obj, index) => (
              <Link
                key={obj.id}
                to={`/okrs/objetivo/${obj.id}`}
                className="okr-company-obj-card"
                style={{ animationDelay: `${200 + index * 50}ms` }}
              >
                <div className="okr-company-obj-card__header">
                  <span className="okr-company-obj-card__cycle">
                    {obj.quarter || 'Anual'}
                  </span>
                  <span className="okr-company-obj-card__krs">
                    {(obj.key_results || []).length} KRs
                  </span>
                </div>
                <h3 className="okr-company-obj-card__title">{obj.titulo}</h3>
                {obj.descricao && (
                  <p className="okr-company-obj-card__desc">{obj.descricao}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Sectors Section */}
      <section className="okr-section">
        <div className="okr-section__header">
          <h2 className="okr-section__title">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"/>
            </svg>
            Setores
          </h2>
        </div>

        {sectorsWithOKRs.length === 0 ? (
          <div className="okr-empty-state">
            <div className="okr-empty-state__icon">
              <svg viewBox="0 0 24 24" width="64" height="64">
                <path fill="currentColor" d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"/>
              </svg>
            </div>
            <h3 className="okr-empty-state__title">Nenhum OKR cadastrado</h3>
            <p className="okr-empty-state__description">
              Cadastre OKRs nos setores para visualizar o progresso.
            </p>
            {isPrivileged && (
              <Link to="/ind/admin/setores" className="okr-btn okr-btn--primary">
                Gerenciar Setores
              </Link>
            )}
          </div>
        ) : (
          <div className="okr-sectors-grid">
            {sectorsWithOKRs.map((sector, index) => (
              <SectorCard
                key={sector.id}
                sector={sector}
                objectives={getObjectivesBySector(sector.id)}
                checkIns={getCheckInsBySector(sector.id)}
                index={index}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
