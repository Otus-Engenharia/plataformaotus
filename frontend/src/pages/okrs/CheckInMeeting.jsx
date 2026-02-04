import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { calculateKRProgress } from '../../utils/indicator-utils';
import './CheckInMeeting.css';

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const statusConfig = {
  on_track: { label: 'No prazo', color: 'success' },
  at_risk: { label: 'Em risco', color: 'warning' },
  delayed: { label: 'Atrasado', color: 'danger' },
  completed: { label: 'Concluído', color: 'success' }
};

// Icons
const icons = {
  calendar: (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path fill="currentColor" d="M10 8v8l5-4-5-4zm9-5H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path fill="currentColor" d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
    </svg>
  ),
  document: (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path fill="currentColor" d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
    </svg>
  ),
  building: (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path fill="currentColor" d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
    </svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
  ),
  chevronRight: (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
    </svg>
  ),
  chevronLeft: (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
    </svg>
  ),
  fullscreen: (
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path fill="currentColor" d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
    </svg>
  )
};


// Progress Ring Component
function ProgressRing({ progress, size = 52, strokeWidth = 4, className = '' }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;
  const color = progress >= 100 ? 'success' : progress >= 70 ? 'warning' : 'danger';

  return (
    <div className={`chk-kr-item__progress-ring ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          className="chk-kr-item__progress-bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
        />
        <circle
          className={`chk-kr-item__progress-fill chk-kr-item__progress-fill--${color}`}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="chk-kr-item__progress-value">{progress}%</span>
    </div>
  );
}

// Stat Card Component
function StatCard({ icon, value, label, isActive, onClick, variant = 'primary' }) {
  let activeClass = '';
  if (isActive) {
    activeClass = variant === 'primary' ? 'chk-stat--active' :
      variant === 'danger' ? 'chk-stat--active-danger' :
        variant === 'warning' ? 'chk-stat--active-warning' :
          'chk-stat--active-info';
  }

  return (
    <button className={`chk-stat ${activeClass}`} onClick={onClick}>
      <div className={`chk-stat__icon chk-stat__icon--${variant}`}>
        {icon}
      </div>
      <div className="chk-stat__content">
        <span className={`chk-stat__value ${variant !== 'primary' ? `chk-stat__value--${variant}` : ''}`}>
          {value}
        </span>
        <span className="chk-stat__label">{label}</span>
      </div>
    </button>
  );
}

// Sector Card Component
function SectorCard({ sector, isActive, onClick }) {
  const color = sector.progress >= 100 ? 'success' : sector.progress >= 70 ? 'warning' : 'danger';

  return (
    <button
      className={`chk-sector-card ${isActive ? 'chk-sector-card--active' : ''}`}
      onClick={onClick}
    >
      <div className="chk-sector-card__header">
        <span className="chk-sector-card__name">{sector.name}</span>
        <span className={`chk-sector-card__percent chk-sector-card__percent--${color}`}>
          {sector.progress}%
        </span>
      </div>
      <div className="chk-sector-card__bar">
        <div
          className={`chk-sector-card__bar-fill chk-sector-card__bar-fill--${color}`}
          style={{ width: `${sector.progress}%` }}
        />
      </div>
      <div className="chk-sector-card__footer">
        <span>{sector.krsCount} KRs</span>
        {sector.delayedCount > 0 && (
          <span className="chk-sector-card__alert">
            <svg viewBox="0 0 24 24" width="12" height="12">
              <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
            </svg>
            {sector.delayedCount}
          </span>
        )}
      </div>
    </button>
  );
}

// KR Item Component
function KRItem({ kr, monthNames }) {
  const statusInfo = statusConfig[kr.status] || statusConfig.on_track;

  return (
    <Link
      to={`/okrs/kr/${kr.id}`}
      className={`chk-kr-item ${kr.needsRecoveryPlan ? 'chk-kr-item--danger' : ''}`}
    >
      <ProgressRing progress={kr.progress} />

      <div className="chk-kr-item__content">
        <div className="chk-kr-item__badges">
          <span className={`chk-badge chk-badge--${statusInfo.color}`}>
            {statusInfo.label}
          </span>
          {kr.needsRecoveryPlan && (
            <span className="chk-badge chk-badge--danger">
              {icons.warning}
              Sem plano
            </span>
          )}
          {kr.comments.length > 0 && (
            <span className="chk-badge chk-badge--secondary">
              {icons.chat}
              {kr.comments.length}
            </span>
          )}
        </div>
        <h4 className="chk-kr-item__title">{kr.titulo || kr.descricao}</h4>
        <p className="chk-kr-item__objective">{kr.objective?.titulo}</p>
      </div>

      {kr.monthsBehind.length > 0 && (
        <div className="chk-kr-item__months">
          {kr.monthsBehind.slice(0, 3).map(m => (
            <span
              key={m.month}
              className={`chk-badge ${m.hasRecoveryPlan ? 'chk-badge--warning' : 'chk-badge--danger'}`}
            >
              {monthNames[m.month - 1].substring(0, 3)}
            </span>
          ))}
          {kr.monthsBehind.length > 3 && (
            <span className="chk-kr-item__more">+{kr.monthsBehind.length - 3}</span>
          )}
        </div>
      )}

      <span className="chk-kr-item__arrow">{icons.chevronRight}</span>
    </Link>
  );
}

export default function CheckInMeeting() {
  const navigate = useNavigate();
  const { isPrivileged } = useAuth();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [sectors, setSectors] = useState([]);
  const [keyResults, setKeyResults] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [comments, setComments] = useState([]);
  const [recoveryPlans, setRecoveryPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedSectorId, setSelectedSectorId] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [currentKRIndex, setCurrentKRIndex] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const sectorsResponse = await axios.get('/api/ind/sectors', { withCredentials: true });
      const sectorsData = sectorsResponse.data.success ? sectorsResponse.data.data : [];
      setSectors(sectorsData);

      const okrsResponse = await axios.get('/api/okrs', { withCredentials: true });
      if (!okrsResponse.data.success) {
        setKeyResults([]);
        setLoading(false);
        return;
      }

      const allOkrs = (okrsResponse.data.data || []).filter(obj =>
        obj.quarter?.includes(String(selectedYear)) && obj.nivel !== 'empresa'
      );

      if (allOkrs.length === 0) {
        setKeyResults([]);
        setLoading(false);
        return;
      }

      const enrichedKRs = allOkrs.flatMap(objective => {
        const krs = objective.keyResults || objective.key_results || [];
        const sector = objective.setor_id ? sectorsData.find(s => s.id === objective.setor_id) : null;
        return krs.map(kr => ({ ...kr, objective, sector }));
      });

      if (enrichedKRs.length === 0) {
        setKeyResults([]);
        setLoading(false);
        return;
      }

      setKeyResults(enrichedKRs);

      const krIds = enrichedKRs.map(kr => kr.id);
      const checkInsResponse = await axios.get('/api/okrs/check-ins', {
        params: { keyResultIds: krIds.join(',') },
        withCredentials: true
      });
      setCheckIns(checkInsResponse.data.data || []);
      setComments([]);
      setRecoveryPlans([]);

    } catch (err) {
      console.error('Error fetching check-in data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const enrichedKRs = useMemo(() => {
    return keyResults.map(kr => {
      const krCheckIns = checkIns.filter(c => c.key_result_id === kr.id);
      const krComments = comments.filter(c => c.key_result_id === kr.id);
      const krPlans = recoveryPlans.filter(p => p.key_result_id === kr.id);

      const monthlyTargets = kr.monthly_targets || {};
      const isInverse = kr.is_inverse || false;
      const monthsBehind = [];

      Object.entries(monthlyTargets).forEach(([month, target]) => {
        const monthNum = parseInt(month);
        if (monthNum <= selectedMonth) {
          const checkIn = krCheckIns.find(c => c.mes === monthNum && c.ano === selectedYear);
          const actual = checkIn ? checkIn.valor : null;
          const isBehind = actual !== null
            ? (isInverse ? actual > target : actual < target)
            : false;
          const hasRecoveryPlan = krPlans.some(
            p => p.mes_referencia === monthNum && p.ano_referencia === selectedYear
          );

          if (isBehind || (actual === null && monthNum < selectedMonth)) {
            monthsBehind.push({ month: monthNum, target, actual, hasRecoveryPlan });
          }
        }
      });

      const needsRecoveryPlan = monthsBehind.some(m => !m.hasRecoveryPlan && m.actual !== null);
      const progress = calculateKRProgress(kr, krCheckIns);

      return {
        ...kr,
        checkIns: krCheckIns,
        comments: krComments,
        recoveryPlans: krPlans,
        monthsBehind,
        needsRecoveryPlan,
        progress
      };
    });
  }, [keyResults, checkIns, comments, recoveryPlans, selectedMonth, selectedYear]);

  const filteredKRs = useMemo(() => {
    let filtered = enrichedKRs;

    if (selectedSectorId !== 'all') {
      filtered = filtered.filter(kr => kr.sector?.id === selectedSectorId);
    }

    switch (filterType) {
      case 'delayed':
        filtered = filtered.filter(kr => kr.monthsBehind.length > 0);
        break;
      case 'needs_plan':
        filtered = filtered.filter(kr => kr.needsRecoveryPlan);
        break;
      case 'has_comments':
        filtered = filtered.filter(kr => kr.comments.length > 0);
        break;
    }

    return filtered;
  }, [enrichedKRs, selectedSectorId, filterType]);

  const krsBySector = useMemo(() => {
    const grouped = {};
    filteredKRs.forEach(kr => {
      const sectorName = kr.sector?.name || 'Sem Setor';
      if (!grouped[sectorName]) grouped[sectorName] = [];
      grouped[sectorName].push(kr);
    });
    return grouped;
  }, [filteredKRs]);

  const stats = useMemo(() => {
    const total = enrichedKRs.length;
    const delayed = enrichedKRs.filter(kr => kr.monthsBehind.length > 0).length;
    const needsPlan = enrichedKRs.filter(kr => kr.needsRecoveryPlan).length;
    const withComments = enrichedKRs.filter(kr => kr.comments.length > 0).length;
    return { total, delayed, needsPlan, withComments };
  }, [enrichedKRs]);

  const sectorProgress = useMemo(() => {
    const grouped = {};

    enrichedKRs.forEach(kr => {
      const sectorId = kr.sector?.id || 'none';
      const sectorName = kr.sector?.name || 'Sem Setor';

      if (!grouped[sectorId]) {
        grouped[sectorId] = {
          sectorId,
          name: sectorName,
          totalWeight: 0,
          weightedProgress: 0,
          krsCount: 0,
          delayedCount: 0
        };
      }

      grouped[sectorId].weightedProgress += kr.progress * (kr.peso || 1);
      grouped[sectorId].totalWeight += (kr.peso || 1);
      grouped[sectorId].krsCount++;
      if (kr.monthsBehind.length > 0) grouped[sectorId].delayedCount++;
    });

    return Object.values(grouped).map(s => ({
      ...s,
      progress: s.totalWeight > 0 ? Math.round(s.weightedProgress / s.totalWeight) : 0
    })).sort((a, b) => b.progress - a.progress);
  }, [enrichedKRs]);

  const currentKR = filteredKRs[currentKRIndex];
  const nextKR = () => setCurrentKRIndex(i => Math.min(i + 1, filteredKRs.length - 1));
  const prevKR = () => setCurrentKRIndex(i => Math.max(i - 1, 0));

  const togglePresentationMode = () => {
    if (!isPresentationMode) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsPresentationMode(!isPresentationMode);
    setCurrentKRIndex(0);
  };

  const formatValue = (value, kr) => {
    if (!kr) return value;
    if (kr.tipo_metrica === 'percentage') return `${value}%`;
    if (kr.tipo_metrica === 'currency') return `R$ ${value?.toLocaleString('pt-BR')}`;
    if (kr.tipo_metrica === 'boolean') return value >= 1 ? 'Sim' : 'Não';
    return value?.toLocaleString('pt-BR') || value;
  };

  const getProgressColor = (progress) => {
    if (progress >= 100) return 'success';
    if (progress >= 70) return 'warning';
    return 'danger';
  };

  // Presentation Mode View
  if (isPresentationMode && currentKR) {
    const statusInfo = statusConfig[currentKR.status] || statusConfig.on_track;
    const progressColor = getProgressColor(currentKR.progress);
    const radius = 60;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (currentKR.progress / 100) * circumference;

    return (
      <div className="chk-presentation">
        <header className="chk-presentation__header">
          <div className="chk-presentation__header-left">
            <span className="chk-presentation__badge chk-presentation__badge--outline">
              {currentKR.sector?.name || 'Sem Setor'}
            </span>
            <span className="chk-presentation__badge chk-presentation__badge--counter">
              {currentKRIndex + 1} / {filteredKRs.length}
            </span>
          </div>
          <div className="chk-presentation__header-right">
            <span className="chk-presentation__date">
              {monthNames[selectedMonth - 1]} {selectedYear}
            </span>
            <button className="chk-presentation__exit-btn" onClick={togglePresentationMode}>
              {icons.fullscreen}
              Sair
            </button>
          </div>
        </header>

        <main className="chk-presentation__content">
          <div className="chk-presentation__kr">
            <div className="chk-presentation__kr-header">
              <div className="chk-presentation__kr-badges">
                <span className={`chk-presentation__status-badge chk-presentation__status-badge--${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
                {currentKR.needsRecoveryPlan && (
                  <span className="chk-presentation__status-badge chk-presentation__status-badge--danger">
                    {icons.warning}
                    Precisa de Plano
                  </span>
                )}
              </div>
              <h1 className="chk-presentation__kr-title">{currentKR.titulo}</h1>
              <p className="chk-presentation__kr-objective">
                {icons.target}
                {currentKR.objective?.titulo}
              </p>
            </div>

            <div className="chk-presentation__progress-card">
              <div className="chk-presentation__progress-ring">
                <svg width="140" height="140">
                  <circle
                    className="chk-presentation__progress-ring-bg"
                    cx="70"
                    cy="70"
                    r={radius}
                  />
                  <circle
                    className={`chk-presentation__progress-ring-fill chk-presentation__progress-ring-fill--${progressColor}`}
                    cx="70"
                    cy="70"
                    r={radius}
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={offset}
                  />
                </svg>
                <span className="chk-presentation__progress-ring-value">{currentKR.progress}%</span>
              </div>
              <div className="chk-presentation__progress-values">
                <div className="chk-presentation__progress-item">
                  <span className="chk-presentation__progress-label">Inicial</span>
                  <span className="chk-presentation__progress-value">
                    {formatValue(currentKR.valor_inicial || 0, currentKR)}
                  </span>
                </div>
                <div className="chk-presentation__progress-item chk-presentation__progress-item--highlight">
                  <span className="chk-presentation__progress-label">Atual</span>
                  <span className="chk-presentation__progress-value">
                    {formatValue(currentKR.atual || 0, currentKR)}
                  </span>
                </div>
                <div className="chk-presentation__progress-item">
                  <span className="chk-presentation__progress-label">Meta</span>
                  <span className="chk-presentation__progress-value">
                    {formatValue(currentKR.meta || 0, currentKR)}
                  </span>
                </div>
              </div>
            </div>

            {currentKR.monthsBehind.length > 0 && (
              <div className="chk-presentation__section chk-presentation__section--danger">
                <h3 className="chk-presentation__section-title">
                  {icons.x}
                  Meses Abaixo da Meta
                </h3>
                <div className="chk-presentation__months">
                  {currentKR.monthsBehind.map(m => (
                    <div
                      key={m.month}
                      className={`chk-presentation__month ${m.hasRecoveryPlan ? 'chk-presentation__month--warning' : 'chk-presentation__month--danger'}`}
                    >
                      <span className="chk-presentation__month-name">{monthNames[m.month - 1]}</span>
                      <span className="chk-presentation__month-values">
                        Meta: {formatValue(m.target, currentKR)} | Real: {m.actual !== null ? formatValue(m.actual, currentKR) : '—'}
                      </span>
                      <span className={`chk-badge ${m.hasRecoveryPlan ? 'chk-badge--warning' : 'chk-badge--danger'}`}>
                        {m.hasRecoveryPlan ? 'Com plano' : 'Sem plano'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentKR.comments.length > 0 && (
              <div className="chk-presentation__section">
                <h3 className="chk-presentation__section-title">
                  {icons.chat}
                  Comentários ({currentKR.comments.length})
                </h3>
                <div className="chk-presentation__comments">
                  {currentKR.comments.map(comment => (
                    <div key={comment.id} className="chk-presentation__comment">
                      <span className="chk-presentation__comment-author">{comment.author_id}</span>
                      <p>{comment.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>

        <footer className="chk-presentation__footer">
          <button className="chk-presentation__nav-btn" onClick={prevKR} disabled={currentKRIndex === 0}>
            {icons.chevronLeft}
            Anterior
          </button>

          <div className="chk-presentation__dots">
            {filteredKRs.slice(Math.max(0, currentKRIndex - 3), Math.min(filteredKRs.length, currentKRIndex + 4)).map((kr, idx) => {
              const actualIdx = Math.max(0, currentKRIndex - 3) + idx;
              return (
                <button
                  key={kr.id}
                  onClick={() => setCurrentKRIndex(actualIdx)}
                  className={`chk-presentation__dot ${actualIdx === currentKRIndex ? 'chk-presentation__dot--active' : ''} ${kr.needsRecoveryPlan ? 'chk-presentation__dot--danger' : ''}`}
                />
              );
            })}
          </div>

          <button className="chk-presentation__nav-btn" onClick={nextKR} disabled={currentKRIndex === filteredKRs.length - 1}>
            Próximo
            {icons.chevronRight}
          </button>
        </footer>
      </div>
    );
  }

  // Loading State
  if (loading) {
    return (
      <div className="chk-dashboard">
        <div className="chk-loading">
          <div className="chk-loading__spinner" />
          <span className="chk-loading__text">Carregando dados...</span>
        </div>
      </div>
    );
  }

  // Normal View
  return (
    <div className="chk-dashboard">
      {/* Header */}
      <header className="chk-header">
        <div className="chk-header__left">
          <h1 className="chk-header__title">Reunião de Check-in</h1>
          <p className="chk-header__subtitle">Acompanhamento estratégico de OKRs</p>
        </div>
        <div className="chk-header__right">
          <div className="chk-filters">
            <div className="chk-filter">
              <span className="chk-filter__icon">{icons.calendar}</span>
              <select
                className="chk-filter__select"
                value={selectedMonth}
                onChange={e => setSelectedMonth(parseInt(e.target.value))}
              >
                {monthNames.map((name, idx) => (
                  <option key={idx} value={idx + 1}>{name}</option>
                ))}
              </select>
            </div>
            <div className="chk-filter">
              <select
                className="chk-filter__select"
                value={selectedYear}
                onChange={e => setSelectedYear(parseInt(e.target.value))}
              >
                <option value={currentYear - 1}>{currentYear - 1}</option>
                <option value={currentYear}>{currentYear}</option>
                <option value={currentYear + 1}>{currentYear + 1}</option>
              </select>
            </div>
          </div>
          <button
            className="chk-btn chk-btn--primary"
            onClick={togglePresentationMode}
            disabled={filteredKRs.length === 0}
          >
            {icons.play}
            Apresentação
          </button>
        </div>
      </header>

      {/* Summary Section */}
      <section className="chk-summary">
        {/* Stats */}
        <div className="chk-stats">
          <StatCard
            icon={icons.check}
            value={stats.total}
            label="Total KRs"
            isActive={filterType === 'all'}
            onClick={() => setFilterType('all')}
            variant="primary"
          />
          <StatCard
            icon={icons.x}
            value={stats.delayed}
            label="Atrasados"
            isActive={filterType === 'delayed'}
            onClick={() => setFilterType('delayed')}
            variant="danger"
          />
          <StatCard
            icon={icons.document}
            value={stats.needsPlan}
            label="Sem plano"
            isActive={filterType === 'needs_plan'}
            onClick={() => setFilterType('needs_plan')}
            variant="warning"
          />
          <StatCard
            icon={icons.chat}
            value={stats.withComments}
            label="Comentários"
            isActive={filterType === 'has_comments'}
            onClick={() => setFilterType('has_comments')}
            variant="info"
          />
        </div>

        {/* Sectors Panel */}
        <div className="chk-sectors-panel">
          <div className="chk-sectors-panel__header">
            <span className="chk-sectors-panel__icon">{icons.chart}</span>
            <h3 className="chk-sectors-panel__title">Progresso por Setor</h3>
          </div>
          {sectorProgress.length > 0 ? (
            <div className="chk-sectors-grid">
              {sectorProgress.map(sector => (
                <SectorCard
                  key={sector.sectorId}
                  sector={sector}
                  isActive={selectedSectorId === sector.sectorId}
                  onClick={() => setSelectedSectorId(selectedSectorId === sector.sectorId ? 'all' : sector.sectorId)}
                />
              ))}
            </div>
          ) : (
            <div className="chk-sectors-empty">Nenhum dado de setor disponível</div>
          )}
        </div>
      </section>

      {/* KR List Section */}
      <section className="chk-section">
        <div className="chk-section__header">
          <h2 className="chk-section__title">
            <span className="chk-section__bar" />
            Todos os Key Results
            {filterType !== 'all' && (
              <span className="chk-badge chk-badge--secondary">
                {filterType === 'delayed' ? 'Atrasados' : filterType === 'needs_plan' ? 'Sem plano' : 'Com comentários'}
              </span>
            )}
          </h2>
          <div className="chk-section__actions">
            <div className="chk-filter">
              <span className="chk-filter__icon">{icons.building}</span>
              <select
                className="chk-filter__select"
                value={selectedSectorId}
                onChange={e => setSelectedSectorId(e.target.value)}
              >
                <option value="all">Todos os setores</option>
                {sectors.map(sector => (
                  <option key={sector.id} value={sector.id}>{sector.name}</option>
                ))}
              </select>
            </div>
            {filterType !== 'all' && (
              <button className="chk-btn chk-btn--outline chk-btn--sm" onClick={() => setFilterType('all')}>
                Limpar filtro
              </button>
            )}
          </div>
        </div>

        {filteredKRs.length === 0 ? (
          <div className="chk-empty">
            <div className="chk-empty__icon">{icons.check}</div>
            <h3 className="chk-empty__title">Nenhum Key Result encontrado</h3>
            <p className="chk-empty__text">
              {filterType === 'all'
                ? 'Não há Key Results cadastrados para este período.'
                : 'Nenhum Key Result corresponde aos filtros selecionados.'}
            </p>
          </div>
        ) : (
          <div className="chk-kr-list">
            {Object.entries(krsBySector).map(([sectorName, krs]) => (
              <div key={sectorName} className="chk-kr-group">
                <div className="chk-kr-group__header">
                  <span className="chk-kr-group__icon">{icons.building}</span>
                  <h3 className="chk-kr-group__name">{sectorName}</h3>
                  <span className="chk-kr-group__count">{krs.length} KRs</span>
                </div>
                <div className="chk-kr-group__items">
                  {krs.map(kr => (
                    <KRItem key={kr.id} kr={kr} monthNames={monthNames} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
