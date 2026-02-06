import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getCycleOptions, getCurrentCycle, getCurrentYear, getCycleLabel } from '../../utils/indicator-utils';
import './OverviewIndicadores.css';

const API_URL = import.meta.env.VITE_API_URL || '';

// Score Ring Component
function ScoreRing({ score, size = 48, strokeWidth = 4 }) {
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
      <span className="score-ring-value" style={{ color: getColor(), fontSize: size * 0.22 }}>
        {score.toFixed(0)}
      </span>
    </div>
  );
}

// Person Card Component (same as TeamView)
function PersonCard({ person, index }) {
  const score = person.score || 0;

  const getStatus = () => {
    if (score >= 100) return 'success';
    if (score >= 80) return 'warning';
    return 'danger';
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  return (
    <Link
      to={`/ind/pessoa/${person.id}`}
      className={`person-row person-row--${getStatus()}`}
      style={{ animationDelay: `${50 + index * 30}ms` }}
    >
      <div className="person-row__avatar">
        {person.avatar_url ? (
          <img src={person.avatar_url} alt="" className="avatar-img" />
        ) : (
          getInitials(person.name)
        )}
      </div>

      <div className="person-row__info">
        <h4 className="person-row__name">{person.name}</h4>
        <span className="person-row__position">{person.cargo?.name || 'Sem cargo'}</span>
      </div>

      <div className="person-row__metrics">
        <div className="person-row__stat">
          <span className="person-row__stat-value">{person.indicadoresCount || 0}</span>
          <span className="person-row__stat-label">indicadores</span>
        </div>
      </div>

      <ScoreRing score={score} size={40} strokeWidth={3} />

      <svg className="person-row__arrow" viewBox="0 0 24 24" width="18" height="18">
        <path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
      </svg>
    </Link>
  );
}

// Sector Card Component
function SectorCard({ sector, isExpanded, onToggle, onPersonClick }) {
  const score = sector.avg_score || 0;
  const peopleCount = sector.people_count || 0;
  const atRiskCount = sector.at_risk_count || 0;
  const people = sector.people || [];

  const getStatus = () => {
    if (score >= 100) return 'success';
    if (score >= 80) return 'warning';
    return 'danger';
  };

  return (
    <div className={`sector-card ${isExpanded ? 'sector-card--expanded' : ''}`}>
      <button
        type="button"
        className="sector-card__header"
        onClick={onToggle}
      >
        <div className="sector-card__icon">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
          </svg>
        </div>

        <div className="sector-card__info">
          <h3 className="sector-card__name">{sector.name}</h3>
          <span className="sector-card__count">{peopleCount} {peopleCount === 1 ? 'pessoa' : 'pessoas'}</span>
        </div>

        <div className="sector-card__stats">
          {atRiskCount > 0 && (
            <span className="sector-card__risk">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
              </svg>
              {atRiskCount} em risco
            </span>
          )}
        </div>

        <ScoreRing score={score} size={44} strokeWidth={4} />

        <svg className={`sector-card__chevron ${isExpanded ? 'rotated' : ''}`} viewBox="0 0 24 24" width="24" height="24">
          <path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
        </svg>
      </button>

      {isExpanded && (
        <div className="sector-card__content">
          {people.length === 0 ? (
            <div className="sector-card__empty">
              <p>Nenhum colaborador com indicadores neste período.</p>
            </div>
          ) : (
            <div className="sector-card__people">
              {people.map((person, index) => (
                <PersonCard key={person.id} person={person} index={index} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OverviewIndicadores() {
  const { isPrivileged } = useAuth();

  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSectors, setExpandedSectors] = useState(new Set());

  // Filters
  const [ciclo, setCiclo] = useState(getCurrentCycle());
  const [ano, setAno] = useState(getCurrentYear());

  useEffect(() => {
    fetchOverview();
  }, [ciclo, ano]);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/ind/overview?ciclo=${ciclo}&ano=${ano}`, {
        credentials: 'include'
      });

      if (!res.ok) throw new Error('Erro ao carregar visão geral');

      const data = await res.json();
      console.log('Overview response:', data);
      setSectors(data.data?.sectors || data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSector = (sectorId) => {
    setExpandedSectors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectorId)) {
        newSet.delete(sectorId);
      } else {
        newSet.add(sectorId);
      }
      return newSet;
    });
  };

  // Metrics
  const totalPeople = sectors.reduce((sum, s) => sum + (s.people_count || 0), 0);
  const avgScore = sectors.length > 0
    ? Math.round(sectors.reduce((sum, s) => sum + (s.avg_score || 0), 0) / sectors.length)
    : 0;
  const totalAtRisk = sectors.reduce((sum, s) => sum + (s.at_risk_count || 0), 0);

  if (!isPrivileged) {
    return (
      <div className="overview-page overview-page--error">
        <div className="error-state">
          <svg viewBox="0 0 24 24" width="48" height="48" className="error-state__icon">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-2h2v2h-2zm0-4V7h2v6h-2z"/>
          </svg>
          <p className="error-state__message">Acesso não autorizado</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="overview-page overview-page--loading">
        <div className="loading-pulse">
          <div className="loading-pulse__ring" />
          <div className="loading-pulse__ring" />
          <div className="loading-pulse__ring" />
        </div>
        <p className="loading-text">Carregando visão geral...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="overview-page overview-page--error">
        <div className="error-state">
          <svg viewBox="0 0 24 24" width="48" height="48" className="error-state__icon">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <p className="error-state__message">{error}</p>
          <button onClick={fetchOverview} className="btn btn--primary">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="overview-page">
      {/* Background */}
      <div className="overview-page__bg">
        <div className="overview-page__gradient" />
      </div>

      {/* Header */}
      <header className="overview-header">
        <div className="overview-header__left">
          <h1 className="overview-header__title">Visão Geral</h1>
          <p className="overview-header__subtitle">
            Desempenho de todos os setores
          </p>
        </div>

        <div className="overview-header__filters">
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
      <section className="overview-metrics">
        <div className="metric-card" style={{ animationDelay: '0ms' }}>
          <div className="metric-card__glow" />
          <div className="metric-card__content">
            <div className="metric-card__header">
              <span className="metric-card__title">Setores</span>
              <svg viewBox="0 0 24 24" width="20" height="20" className="metric-card__icon">
                <path fill="currentColor" d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
              </svg>
            </div>
            <div className="metric-card__value">{sectors.length}</div>
            <div className="metric-card__subtitle">cadastrados</div>
          </div>
        </div>

        <div className="metric-card" style={{ animationDelay: '50ms' }}>
          <div className="metric-card__glow" />
          <div className="metric-card__content">
            <div className="metric-card__header">
              <span className="metric-card__title">Pessoas</span>
              <svg viewBox="0 0 24 24" width="20" height="20" className="metric-card__icon">
                <path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
            </div>
            <div className="metric-card__value">{totalPeople}</div>
            <div className="metric-card__subtitle">com indicadores</div>
          </div>
        </div>

        <div className="metric-card metric-card--featured" style={{ animationDelay: '100ms' }}>
          <div className="metric-card__glow metric-card__glow--featured" />
          <div className="metric-card__content">
            <div className="metric-card__header">
              <span className="metric-card__title">Score Geral</span>
              <svg viewBox="0 0 24 24" width="20" height="20" className="metric-card__icon">
                <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
              </svg>
            </div>
            <div className="metric-card--featured__body">
              <ScoreRing score={avgScore} size={64} strokeWidth={5} />
              <div className="metric-card--featured__info">
                <span className="metric-card--featured__percent">{avgScore}%</span>
                <span className="metric-card__subtitle">média ponderada</span>
              </div>
            </div>
          </div>
        </div>

        <div className={`metric-card ${totalAtRisk > 0 ? 'metric-card--danger' : 'metric-card--success'}`} style={{ animationDelay: '150ms' }}>
          <div className="metric-card__glow" />
          <div className="metric-card__content">
            <div className="metric-card__header">
              <span className="metric-card__title">Em Risco</span>
              <svg viewBox="0 0 24 24" width="20" height="20" className="metric-card__icon">
                <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
              </svg>
            </div>
            <div className="metric-card__value">{totalAtRisk}</div>
            <div className="metric-card__subtitle">indicadores</div>
          </div>
        </div>
      </section>

      {/* Sectors Section */}
      <section className="overview-section">
        <div className="overview-section__header">
          <h2 className="overview-section__title">Setores</h2>
          <span className="overview-section__count">{sectors.length} setores</span>
        </div>

        {sectors.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">
              <svg viewBox="0 0 24 24" width="64" height="64">
                <path fill="currentColor" d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
              </svg>
            </div>
            <h3 className="empty-state__title">Nenhum setor cadastrado</h3>
            <p className="empty-state__description">
              Cadastre setores para visualizar o desempenho da equipe.
            </p>
            <Link to="/ind/admin/setores" className="btn btn--primary">
              Cadastrar Setores
            </Link>
          </div>
        ) : (
          <div className="sectors-list">
            {sectors.map(sector => (
              <SectorCard
                key={sector.id}
                sector={sector}
                isExpanded={expandedSectors.has(sector.id)}
                onToggle={() => toggleSector(sector.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
