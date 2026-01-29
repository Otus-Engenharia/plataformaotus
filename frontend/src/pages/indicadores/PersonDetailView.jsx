import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  getTrafficLightColor,
  formatValue
} from '../../utils/indicator-utils';
import {
  TrafficLightBadge,
  ScoreProgressBar,
  IndicadorCard
} from '../../components/indicadores';
import './PersonDetailView.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function PersonDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isPrivileged } = useAuth();

  const [person, setPerson] = useState(null);
  const [indicadores, setIndicadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCycle, setSelectedCycle] = useState('anual');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchPerson();
  }, [id, selectedCycle, selectedYear]);

  const fetchPerson = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/ind/people/${id}?cycle=${selectedCycle}&year=${selectedYear}`,
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

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  const getScoreColor = (score) => {
    if (score >= 100) return 'blue';
    if (score >= 80) return 'green';
    if (score >= 60) return 'yellow';
    return 'red';
  };

  if (loading) {
    return (
      <div className="person-detail loading-state">
        <div className="loading-spinner"></div>
        <p>Carregando...</p>
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="person-detail">
        <div className="error-message">
          {error || 'Pessoa não encontrada'}
        </div>
        <button className="btn-secondary" onClick={() => navigate(-1)}>
          Voltar
        </button>
      </div>
    );
  }

  const score = person.score || 0;
  const scoreColor = getScoreColor(score);
  const atRisk = indicadores.filter(i => (i.score || 0) < 80);
  const onTrack = indicadores.filter(i => (i.score || 0) >= 80);

  return (
    <div className="person-detail">
      {/* Header */}
      <header className="detail-header">
        <button className="btn-back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          Voltar
        </button>
      </header>

      {/* Profile Card */}
      <div className="profile-card glass-card">
        <div className="profile-avatar" style={{ borderColor: `var(--color-${scoreColor})` }}>
          {getInitials(person.name)}
        </div>
        <div className="profile-info">
          <h1>{person.name}</h1>
          <p className="profile-email">{person.email}</p>
          <div className="profile-tags">
            {person.cargo && (
              <span className="tag tag-cargo">{person.cargo.name}</span>
            )}
            {person.setor && (
              <span className="tag tag-setor">{person.setor.name}</span>
            )}
          </div>
        </div>
        <div className="profile-score">
          <ScoreProgressBar
            score={score}
            variant="circular"
            size={120}
            showLabel
          />
          <span className="score-label">Score Geral</span>
        </div>
      </div>

      {/* Stats */}
      <div className="person-stats">
        <div className="stat-item glass-card">
          <span className="stat-value">{indicadores.length}</span>
          <span className="stat-label">Indicadores</span>
        </div>
        <div className="stat-item glass-card">
          <span className="stat-value text-success">{onTrack.length}</span>
          <span className="stat-label">No Alvo</span>
        </div>
        <div className="stat-item glass-card">
          <span className="stat-value text-danger">{atRisk.length}</span>
          <span className="stat-label">Em Risco</span>
        </div>
      </div>

      {/* Filters */}
      <div className="person-filters glass-card">
        <select
          value={selectedCycle}
          onChange={(e) => setSelectedCycle(e.target.value)}
          className="filter-select"
        >
          <option value="anual">Ciclo Anual</option>
          <option value="q1">Q1 (Jan-Mar)</option>
          <option value="q2">Q2 (Abr-Jun)</option>
          <option value="q3">Q3 (Jul-Set)</option>
          <option value="q4">Q4 (Out-Dez)</option>
        </select>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="filter-select"
        >
          {[2024, 2025, 2026].map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Indicators at Risk */}
      {atRisk.length > 0 && (
        <section className="indicator-section">
          <h2 className="section-title">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="#EA4335" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
            </svg>
            Indicadores em Risco ({atRisk.length})
          </h2>
          <div className="indicators-grid">
            {atRisk.map(indicador => (
              <IndicadorCard
                key={indicador.id}
                indicador={indicador}
                onClick={() => navigate(`/ind/indicador/${indicador.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Indicators on Track */}
      {onTrack.length > 0 && (
        <section className="indicator-section">
          <h2 className="section-title">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="#34A853" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            No Alvo ({onTrack.length})
          </h2>
          <div className="indicators-grid">
            {onTrack.map(indicador => (
              <IndicadorCard
                key={indicador.id}
                indicador={indicador}
                onClick={() => navigate(`/ind/indicador/${indicador.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {indicadores.length === 0 && (
        <div className="empty-state glass-card">
          <svg viewBox="0 0 24 24" width="48" height="48">
            <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
          </svg>
          <p>Nenhum indicador encontrado para este período.</p>
        </div>
      )}
    </div>
  );
}
