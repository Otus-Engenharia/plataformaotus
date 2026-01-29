import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { SectorCard, PersonCard } from '../../components/indicadores';
import './OverviewIndicadores.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function OverviewIndicadores() {
  const navigate = useNavigate();
  const { isPrivileged } = useAuth();

  const [sectors, setSectors] = useState([]);
  const [peopleAtRisk, setPeopleAtRisk] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState('sectors');

  useEffect(() => {
    fetchOverview();
  }, [selectedYear]);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/ind/overview?year=${selectedYear}`, {
        credentials: 'include'
      });

      if (!res.ok) throw new Error('Erro ao carregar visão geral');

      const data = await res.json();
      setSectors(data.data?.sectors || []);
      setPeopleAtRisk(data.data?.people_at_risk || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalPeople = sectors.reduce((sum, s) => sum + (s.people_count || 0), 0);
  const avgScore = sectors.length > 0
    ? Math.round(sectors.reduce((sum, s) => sum + (s.avg_score || 0), 0) / sectors.length)
    : 0;

  if (!isPrivileged) {
    return (
      <div className="overview-page">
        <div className="error-message">Acesso não autorizado</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="overview-page loading-state">
        <div className="loading-spinner"></div>
        <p>Carregando visão geral...</p>
      </div>
    );
  }

  return (
    <div className="overview-page">
      {/* Header */}
      <header className="overview-header">
        <div>
          <h1>Visão Geral</h1>
          <p className="overview-subtitle">Acompanhe o desempenho de todos os setores</p>
        </div>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="year-select"
        >
          {[2024, 2025, 2026].map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </header>

      {error && <div className="error-message">{error}</div>}

      {/* Summary Stats */}
      <div className="overview-stats">
        <div className="stat-card glass-card">
          <span className="stat-value">{sectors.length}</span>
          <span className="stat-label">Setores</span>
        </div>
        <div className="stat-card glass-card">
          <span className="stat-value">{totalPeople}</span>
          <span className="stat-label">Colaboradores</span>
        </div>
        <div className="stat-card glass-card">
          <span className={`stat-value ${avgScore >= 80 ? 'text-success' : avgScore >= 60 ? 'text-warning' : 'text-danger'}`}>
            {avgScore}
          </span>
          <span className="stat-label">Score Médio</span>
        </div>
        <div className="stat-card glass-card">
          <span className={`stat-value ${peopleAtRisk.length > 0 ? 'text-danger' : 'text-success'}`}>
            {peopleAtRisk.length}
          </span>
          <span className="stat-label">Em Risco</span>
        </div>
      </div>

      {/* View Toggle */}
      <div className="view-toggle">
        <button
          className={`toggle-btn ${viewMode === 'sectors' ? 'active' : ''}`}
          onClick={() => setViewMode('sectors')}
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zm-6-7h5V5h-5v6zm6-6v6h5V5h-5z"/>
          </svg>
          Por Setores
        </button>
        <button
          className={`toggle-btn ${viewMode === 'risk' ? 'active' : ''}`}
          onClick={() => setViewMode('risk')}
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
          Em Risco ({peopleAtRisk.length})
        </button>
      </div>

      {/* Sectors View */}
      {viewMode === 'sectors' && (
        <section className="overview-section">
          {sectors.length === 0 ? (
            <div className="empty-state glass-card">
              <svg viewBox="0 0 24 24" width="48" height="48">
                <path fill="currentColor" d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
              </svg>
              <p>Nenhum setor cadastrado.</p>
              <button
                className="btn-primary"
                onClick={() => navigate('/ind/admin/setores')}
              >
                Cadastrar Setores
              </button>
            </div>
          ) : (
            <div className="sectors-grid">
              {sectors.map(sector => (
                <SectorCard
                  key={sector.id}
                  sector={sector}
                  onClick={() => {/* future: navigate to sector detail */}}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* At Risk View */}
      {viewMode === 'risk' && (
        <section className="overview-section">
          {peopleAtRisk.length === 0 ? (
            <div className="empty-state glass-card success-state">
              <svg viewBox="0 0 24 24" width="48" height="48">
                <path fill="#34A853" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              <p>Nenhum colaborador em risco!</p>
              <span className="success-hint">Todos os indicadores estão dentro da meta.</span>
            </div>
          ) : (
            <>
              <p className="risk-description">
                Colaboradores com score abaixo de 80 pontos precisam de atenção.
              </p>
              <div className="people-grid">
                {peopleAtRisk.map(person => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    onClick={() => navigate(`/ind/pessoa/${person.id}`)}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
