import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PersonCard } from '../../components/indicadores';
import './TeamView.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function TeamView() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [team, setTeam] = useState([]);
  const [sector, setSector] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState('score');

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/ind/team`, {
        credentials: 'include'
      });

      if (!res.ok) throw new Error('Erro ao carregar equipe');

      const data = await res.json();
      setTeam(data.data?.pessoas || []);
      setSector(data.data?.setor || null);
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
    .sort((a, b) => {
      if (sortBy === 'score') {
        return (b.score || 0) - (a.score || 0);
      }
      if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'cargo') {
        return (a.cargo?.name || '').localeCompare(b.cargo?.name || '');
      }
      return 0;
    });

  const avgScore = team.length > 0
    ? Math.round(team.reduce((sum, p) => sum + (p.score || 0), 0) / team.length)
    : 0;

  const atRiskCount = team.filter(p => (p.score || 0) < 80).length;

  if (loading) {
    return (
      <div className="team-view loading-state">
        <div className="loading-spinner"></div>
        <p>Carregando equipe...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="team-view">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="team-view">
      {/* Header */}
      <header className="team-header">
        <div>
          <h1>Minha Equipe</h1>
          {sector && (
            <p className="team-subtitle">
              Setor: <strong>{sector.name}</strong>
            </p>
          )}
        </div>
      </header>

      {/* Stats */}
      <div className="team-stats">
        <div className="stat-card glass-card">
          <span className="stat-value">{team.length}</span>
          <span className="stat-label">Colaboradores</span>
        </div>
        <div className="stat-card glass-card">
          <span className={`stat-value ${avgScore >= 80 ? 'text-success' : avgScore >= 60 ? 'text-warning' : 'text-danger'}`}>
            {avgScore}
          </span>
          <span className="stat-label">Score Médio</span>
        </div>
        <div className="stat-card glass-card">
          <span className={`stat-value ${atRiskCount > 0 ? 'text-danger' : 'text-success'}`}>
            {atRiskCount}
          </span>
          <span className="stat-label">Em Risco</span>
        </div>
      </div>

      {/* Filters */}
      <div className="team-filters glass-card">
        <input
          type="text"
          placeholder="Buscar por nome ou cargo..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="filter-input"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="filter-select"
        >
          <option value="score">Ordenar por Score</option>
          <option value="name">Ordenar por Nome</option>
          <option value="cargo">Ordenar por Cargo</option>
        </select>
      </div>

      {/* Team Grid */}
      {filteredTeam.length === 0 ? (
        <div className="empty-state glass-card">
          {team.length === 0 ? (
            <>
              <svg viewBox="0 0 24 24" width="48" height="48">
                <path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
              <p>Nenhum colaborador encontrado no seu setor.</p>
            </>
          ) : (
            <p>Nenhum resultado para "{filter}"</p>
          )}
        </div>
      ) : (
        <div className="team-grid">
          {filteredTeam.map(person => (
            <PersonCard
              key={person.id}
              person={person}
              onClick={() => navigate(`/ind/pessoa/${person.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
