import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getCycleOptions, getCurrentCycle, getCurrentYear, getCycleLabel } from '../../utils/indicator-utils';
import './TeamView.css';

const API_URL = import.meta.env.VITE_API_URL || '';

// Score Ring Component (same as DashboardIndicadores)
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

// Team Member Card Component
function TeamMemberCard({ person, index }) {
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
      className={`team-card team-card--${getStatus()}`}
      style={{ animationDelay: `${50 + index * 30}ms` }}
    >
      <div className="team-card__avatar">
        {getInitials(person.name)}
      </div>

      <div className="team-card__info">
        <h3 className="team-card__name">{person.name}</h3>
        <span className="team-card__position">{person.cargo?.name || 'Sem cargo'}</span>
      </div>

      <div className="team-card__metrics">
        <div className="team-card__stat">
          <span className="team-card__stat-value">{person.indicadoresCount || 0}</span>
          <span className="team-card__stat-label">indicadores</span>
        </div>
      </div>

      <ScoreRing score={score} size={48} strokeWidth={4} />

      <svg className="team-card__arrow" viewBox="0 0 24 24" width="20" height="20">
        <path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
      </svg>
    </Link>
  );
}

export default function TeamView({ showAll = false }) {
  const { user, isPrivileged, isDev } = useAuth();

  const [team, setTeam] = useState([]);
  const [sector, setSector] = useState(null);
  const [availableSectors, setAvailableSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');

  // Filters
  const [ciclo, setCiclo] = useState(getCurrentCycle());
  const [ano, setAno] = useState(getCurrentYear());
  const [selectedSectorId, setSelectedSectorId] = useState('');

  useEffect(() => {
    fetchTeam();
  }, [ciclo, ano, selectedSectorId, showAll]);

  const fetchTeam = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ciclo, ano: ano.toString() });
      if (showAll) {
        params.append('all', 'true');
      } else if (selectedSectorId) {
        params.append('sector_id', selectedSectorId);
      }

      const res = await fetch(`${API_URL}/api/ind/team?${params}`, {
        credentials: 'include'
      });

      if (!res.ok) throw new Error('Erro ao carregar equipe');

      const data = await res.json();
      setTeam(data.data?.pessoas || []);
      setSector(data.data?.setor || data.sector || null);
      setAvailableSectors(data.data?.availableSectors || []);

      if (!showAll && !selectedSectorId && data.data?.availableSectors?.length > 0 && !data.sector) {
        setSelectedSectorId(data.data.availableSectors[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredTeam = team
    .filter(person => {
      if (!filter) return true;
      return person.name?.toLowerCase().includes(filter.toLowerCase()) ||
             person.cargo?.name?.toLowerCase().includes(filter.toLowerCase());
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  // Metrics
  const avgScore = team.length > 0
    ? Math.round(team.reduce((sum, p) => sum + (p.score || 0), 0) / team.length)
    : 0;
  const atRiskCount = team.filter(p => (p.score || 0) < 80).length;
  const excellentCount = team.filter(p => (p.score || 0) >= 100).length;

  if (loading) {
    return (
      <div className="team-view team-view--loading">
        <div className="loading-pulse">
          <div className="loading-pulse__ring" />
          <div className="loading-pulse__ring" />
          <div className="loading-pulse__ring" />
        </div>
        <p className="loading-text">Carregando equipe...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="team-view team-view--error">
        <div className="error-state">
          <svg viewBox="0 0 24 24" width="48" height="48" className="error-state__icon">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <p className="error-state__message">{error}</p>
          <button onClick={fetchTeam} className="btn btn--primary">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="team-view">
      {/* Background */}
      <div className="team-view__bg">
        <div className="team-view__gradient" />
      </div>

      {/* Header */}
      <header className="team-header">
        <div className="team-header__left">
          <h1 className="team-header__title">{showAll ? 'Todos Indicadores' : 'Minha Equipe'}</h1>
          <p className="team-header__subtitle">
            {sector?.name || 'Todos os setores'} • {team.length} {team.length === 1 ? 'pessoa' : 'pessoas'}
          </p>
        </div>

        <div className="team-header__filters">
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

          {isPrivileged && availableSectors.length > 1 && (
            <div className="filter-chip">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
              </svg>
              <select
                value={selectedSectorId}
                onChange={(e) => setSelectedSectorId(e.target.value)}
                className="filter-chip__select"
              >
                {availableSectors.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      {/* Metrics Grid */}
      <section className="team-metrics">
        <div className="metric-card" style={{ animationDelay: '0ms' }}>
          <div className="metric-card__glow" />
          <div className="metric-card__content">
            <div className="metric-card__header">
              <span className="metric-card__title">Colaboradores</span>
              <svg viewBox="0 0 24 24" width="20" height="20" className="metric-card__icon">
                <path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
            </div>
            <div className="metric-card__value">{team.length}</div>
            <div className="metric-card__subtitle">na equipe</div>
          </div>
        </div>

        <div className="metric-card metric-card--featured" style={{ animationDelay: '50ms' }}>
          <div className="metric-card__glow metric-card__glow--featured" />
          <div className="metric-card__content">
            <div className="metric-card__header">
              <span className="metric-card__title">Score Médio</span>
            </div>
            <div className="metric-card--featured__body">
              <ScoreRing score={avgScore} size={64} strokeWidth={5} />
              <div className="metric-card--featured__info">
                <span className="metric-card--featured__percent">{avgScore}%</span>
                <span className="metric-card__subtitle">{getCycleLabel(ciclo)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={`metric-card ${excellentCount > 0 ? 'metric-card--success' : ''}`} style={{ animationDelay: '100ms' }}>
          <div className="metric-card__glow" />
          <div className="metric-card__content">
            <div className="metric-card__header">
              <span className="metric-card__title">Excelentes</span>
              <svg viewBox="0 0 24 24" width="20" height="20" className="metric-card__icon">
                <path fill="currentColor" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
              </svg>
            </div>
            <div className="metric-card__value">{excellentCount}</div>
            <div className="metric-card__subtitle">score ≥ 100%</div>
          </div>
        </div>

        <div className={`metric-card ${atRiskCount > 0 ? 'metric-card--danger' : ''}`} style={{ animationDelay: '150ms' }}>
          <div className="metric-card__glow" />
          <div className="metric-card__content">
            <div className="metric-card__header">
              <span className="metric-card__title">Em Risco</span>
              <svg viewBox="0 0 24 24" width="20" height="20" className="metric-card__icon">
                <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
              </svg>
            </div>
            <div className="metric-card__value">{atRiskCount}</div>
            <div className="metric-card__subtitle">score &lt; 80%</div>
          </div>
        </div>
      </section>

      {/* Search */}
      <div className="team-search-bar">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <input
          type="text"
          placeholder="Buscar por nome ou cargo..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {filter && (
          <button type="button" onClick={() => setFilter('')} className="team-search-bar__clear">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        )}
      </div>

      {/* Team List */}
      <section className="team-section">
        {filteredTeam.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">
              <svg viewBox="0 0 24 24" width="64" height="64">
                <path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
            </div>
            {team.length === 0 ? (
              <>
                <h3 className="empty-state__title">Nenhum colaborador encontrado</h3>
                <p className="empty-state__description">
                  Não há colaboradores cadastrados neste setor para o período selecionado.
                </p>
              </>
            ) : (
              <>
                <h3 className="empty-state__title">Nenhum resultado</h3>
                <p className="empty-state__description">
                  Não encontramos ninguém com "{filter}"
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="team-list">
            {filteredTeam.map((person, index) => (
              <TeamMemberCard key={person.id} person={person} index={index} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
