import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  calculatePersonScore,
  filterAtRiskIndicators,
  getIndicatorScore,
  formatValue,
  getCycleOptions,
  getCurrentCycle,
  getCurrentYear,
  getCycleLabel
} from '../../utils/indicator-utils';
import './DashboardIndicadores.css';

const API_URL = import.meta.env.VITE_API_URL || '';

// Animated Score Ring Component
function ScoreRing({ score, size = 72, strokeWidth = 6 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = Math.min(score, 120) / 120;
  const offset = circumference - (progress * circumference);

  const getColor = () => {
    if (score >= 100) return 'var(--color-success)';
    if (score >= 80) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="score-ring-bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="score-ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ stroke: getColor() }}
        />
      </svg>
      <span className="score-ring-value" style={{ color: getColor() }}>
        {score.toFixed(0)}
      </span>
    </div>
  );
}

// Premium Metric Card with glassmorphism
function MetricCard({ title, value, subtitle, icon, variant = 'default', delay = 0 }) {
  return (
    <div
      className={`metric-card metric-card--${variant}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="metric-card__glow" />
      <div className="metric-card__content">
        <div className="metric-card__header">
          <span className="metric-card__title">{title}</span>
          {icon && <span className="metric-card__icon">{icon}</span>}
        </div>
        <div className="metric-card__value">{value}</div>
        {subtitle && <div className="metric-card__subtitle">{subtitle}</div>}
      </div>
    </div>
  );
}

// Premium Indicator Card
function IndicadorCard({ indicador, index }) {
  const score = getIndicatorScore(indicador);
  const valorFormatado = formatValue(indicador.valor, indicador.metric_type);
  const metaFormatada = formatValue(indicador.meta, indicador.metric_type);
  const progress = indicador.meta > 0 ? Math.min((indicador.valor / indicador.meta) * 100, 100) : 0;

  const getStatus = () => {
    if (score >= 100) return 'success';
    if (score >= 80) return 'warning';
    return 'danger';
  };

  const status = getStatus();

  return (
    <Link
      to={`/ind/indicador/${indicador.id}`}
      className={`ind-card ind-card--${status}`}
      style={{ animationDelay: `${100 + index * 50}ms` }}
    >
      <div className="ind-card__header">
        <div className="ind-card__title-group">
          <h3 className="ind-card__title">{indicador.nome}</h3>
          {indicador.descricao && (
            <p className="ind-card__description">{indicador.descricao}</p>
          )}
        </div>
        <div className={`ind-card__score ind-card__score--${status}`}>
          <span className="ind-card__score-value">{score.toFixed(0)}%</span>
          <svg className="ind-card__score-icon" viewBox="0 0 24 24" width="14" height="14">
            {score >= 100 ? (
              <path fill="currentColor" d="M7 14l5-5 5 5z"/>
            ) : score >= 80 ? (
              <path fill="currentColor" d="M7 10h10v4H7z"/>
            ) : (
              <path fill="currentColor" d="M7 10l5 5 5-5z"/>
            )}
          </svg>
        </div>
      </div>

      <div className="ind-card__progress-container">
        <div className="ind-card__progress">
          <div
            className={`ind-card__progress-bar ind-card__progress-bar--${status}`}
            style={{ '--progress': `${progress}%` }}
          />
        </div>
        <div className="ind-card__progress-markers">
          <span>0%</span>
          <span>80%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="ind-card__footer">
        <div className="ind-card__stat">
          <span className="ind-card__stat-label">Atual</span>
          <span className="ind-card__stat-value">{valorFormatado}</span>
        </div>
        <div className="ind-card__stat">
          <span className="ind-card__stat-label">Meta</span>
          <span className="ind-card__stat-value">{metaFormatada}</span>
        </div>
        <div className="ind-card__stat ind-card__stat--weight">
          <span className="ind-card__stat-label">Peso</span>
          <span className="ind-card__stat-value">{indicador.peso || 1}</span>
        </div>
      </div>
    </Link>
  );
}

export default function PersonDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isPrivileged } = useAuth();

  const [person, setPerson] = useState(null);
  const [indicadores, setIndicadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ciclo, setCiclo] = useState(getCurrentCycle());
  const [ano, setAno] = useState(getCurrentYear());

  useEffect(() => {
    fetchPerson();
  }, [id, ciclo, ano]);

  const fetchPerson = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/ind/people/${id}?ciclo=${ciclo}&ano=${ano}`,
        { credentials: 'include' }
      );

      if (!res.ok) throw new Error('Erro ao carregar pessoa');

      const data = await res.json();
      setPerson(data.data);
      setIndicadores(data.data?.indicadores || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate metrics
  const scoreGeral = calculatePersonScore(indicadores) || 0;
  const indicadoresAtRisk = filterAtRiskIndicators(indicadores);
  const indicadoresAtingidos = indicadores.filter(i => getIndicatorScore(i) >= 100);

  if (loading) {
    return (
      <div className="dashboard-ind dashboard-ind--loading">
        <div className="loading-pulse">
          <div className="loading-pulse__ring" />
          <div className="loading-pulse__ring" />
          <div className="loading-pulse__ring" />
        </div>
        <p className="loading-text">Carregando indicadores...</p>
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="dashboard-ind dashboard-ind--error">
        <div className="error-state">
          <svg viewBox="0 0 24 24" width="48" height="48" className="error-state__icon">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <p className="error-state__message">{error || 'Pessoa não encontrada'}</p>
          <button onClick={() => navigate(-1)} className="btn btn--primary">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-ind">
      {/* Ambient background effects */}
      <div className="dashboard-ind__bg">
        <div className="dashboard-ind__gradient" />
        <div className="dashboard-ind__noise" />
      </div>

      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-header__left">
          <button onClick={() => navigate(-1)} className="btn btn--outline" style={{ marginBottom: '0.75rem' }}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            Voltar
          </button>
          <h1 className="dashboard-header__title">{person.name}</h1>
          <p className="dashboard-header__subtitle">
            {person.cargo?.name || 'Sem cargo'} • {person.setor?.name || 'Sem setor'}
          </p>
        </div>

        <div className="dashboard-header__filters">
          <div className="filter-chip">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
            </svg>
            <select
              value={ciclo}
              onChange={(e) => setCiclo(e.target.value)}
              className="filter-chip__select"
            >
              {getCycleOptions().map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="filter-chip">
            <select
              value={ano}
              onChange={(e) => setAno(parseInt(e.target.value, 10))}
              className="filter-chip__select"
            >
              {[getCurrentYear() - 1, getCurrentYear(), getCurrentYear() + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Metrics Grid */}
      <section className="metrics-grid">
        <div className="metric-card metric-card--featured" style={{ animationDelay: '0ms' }}>
          <div className="metric-card__glow metric-card__glow--featured" />
          <div className="metric-card__content">
            <div className="metric-card__header">
              <span className="metric-card__title">Score Geral</span>
              <svg viewBox="0 0 24 24" width="20" height="20" className="metric-card__trend-icon">
                {scoreGeral >= 80 ? (
                  <path fill="currentColor" d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
                ) : (
                  <path fill="currentColor" d="M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6z"/>
                )}
              </svg>
            </div>
            <div className="metric-card--featured__body">
              <ScoreRing score={scoreGeral} size={80} strokeWidth={7} />
              <div className="metric-card--featured__info">
                <span className="metric-card--featured__percent">{scoreGeral.toFixed(0)}%</span>
                <span className="metric-card__subtitle">{indicadores.length} indicadores</span>
              </div>
            </div>
          </div>
        </div>

        <MetricCard
          title="Cargo"
          value={person.cargo?.name || 'Não definido'}
          subtitle={person.setor?.name || '-'}
          icon={
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/>
            </svg>
          }
          variant="default"
          delay={50}
        />

        <MetricCard
          title="Em Risco"
          value={indicadoresAtRisk.length}
          subtitle="abaixo da meta"
          icon={
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
            </svg>
          }
          variant={indicadoresAtRisk.length > 0 ? 'danger' : 'default'}
          delay={100}
        />

        <MetricCard
          title="Atingidos"
          value={indicadoresAtingidos.length}
          subtitle="na meta ou acima"
          icon={
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          }
          variant={indicadoresAtingidos.length > 0 ? 'success' : 'default'}
          delay={150}
        />
      </section>

      {/* Indicators Section */}
      <section className="indicators-section">
        <div className="indicators-section__header">
          <h2 className="indicators-section__title">Indicadores</h2>
        </div>

        {indicadores.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">
              <svg viewBox="0 0 24 24" width="64" height="64">
                <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
              </svg>
            </div>
            <h3 className="empty-state__title">Nenhum indicador encontrado</h3>
            <p className="empty-state__description">
              Esta pessoa não tem indicadores para {getCycleLabel(ciclo)} de {ano}.
            </p>
          </div>
        ) : (
          <div className="indicators-grid">
            {indicadores.map((ind, index) => (
              <IndicadorCard key={ind.id} indicador={ind} index={index} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
