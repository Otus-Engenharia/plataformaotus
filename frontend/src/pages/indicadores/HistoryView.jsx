import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getTrafficLightColor } from '../../utils/indicator-utils';
import { TrafficLightBadge } from '../../components/indicadores';
import './HistoryView.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function HistoryView() {
  const { isPrivileged } = useAuth();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYears, setSelectedYears] = useState([
    new Date().getFullYear() - 1,
    new Date().getFullYear()
  ]);
  const [viewType, setViewType] = useState('sectors');

  useEffect(() => {
    fetchHistory();
  }, [selectedYears]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      selectedYears.forEach(y => params.append('years', y));
      params.append('type', viewType);

      const res = await fetch(`${API_URL}/api/ind/history?${params}`, {
        credentials: 'include'
      });

      if (!res.ok) throw new Error('Erro ao carregar histórico');

      const result = await res.json();
      setData(result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleYear = (year) => {
    if (selectedYears.includes(year)) {
      if (selectedYears.length > 1) {
        setSelectedYears(selectedYears.filter(y => y !== year));
      }
    } else {
      setSelectedYears([...selectedYears, year].sort());
    }
  };

  const getScoreDiff = (current, previous) => {
    if (previous === null || previous === undefined) return null;
    return current - previous;
  };

  const availableYears = [2024, 2025, 2026];

  if (!isPrivileged) {
    return (
      <div className="history-page">
        <div className="error-message">Acesso não autorizado</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="history-page loading-state">
        <div className="loading-spinner"></div>
        <p>Carregando histórico...</p>
      </div>
    );
  }

  return (
    <div className="history-page">
      {/* Header */}
      <header className="history-header">
        <div>
          <h1>Histórico</h1>
          <p className="history-subtitle">Compare o desempenho entre anos</p>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      {/* Controls */}
      <div className="history-controls glass-card">
        <div className="control-group">
          <label>Anos para comparar:</label>
          <div className="year-chips">
            {availableYears.map(year => (
              <button
                key={year}
                className={`year-chip ${selectedYears.includes(year) ? 'active' : ''}`}
                onClick={() => toggleYear(year)}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <label>Visualizar por:</label>
          <div className="view-chips">
            <button
              className={`view-chip ${viewType === 'sectors' ? 'active' : ''}`}
              onClick={() => setViewType('sectors')}
            >
              Setores
            </button>
            <button
              className={`view-chip ${viewType === 'people' ? 'active' : ''}`}
              onClick={() => setViewType('people')}
            >
              Pessoas
            </button>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="history-table-container glass-card">
        <table className="history-table">
          <thead>
            <tr>
              <th>{viewType === 'sectors' ? 'Setor' : 'Pessoa'}</th>
              {selectedYears.map(year => (
                <th key={year} className="year-header">{year}</th>
              ))}
              {selectedYears.length >= 2 && (
                <th className="diff-header">Variação</th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={selectedYears.length + 2} className="empty-row">
                  Nenhum dado encontrado para o período selecionado.
                </td>
              </tr>
            ) : (
              data.map((item, idx) => {
                const scores = selectedYears.map(year => item.scores?.[year] ?? null);
                const diff = selectedYears.length >= 2
                  ? getScoreDiff(scores[scores.length - 1], scores[scores.length - 2])
                  : null;

                return (
                  <tr key={item.id || idx}>
                    <td className="name-cell">
                      <div className="name-info">
                        {viewType === 'people' && (
                          <div className="avatar-sm">
                            {item.name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?'}
                          </div>
                        )}
                        <div>
                          <span className="name">{item.name}</span>
                          {item.subtitle && (
                            <span className="subtitle">{item.subtitle}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    {scores.map((score, i) => (
                      <td key={i} className="score-cell">
                        {score !== null ? (
                          <div className="score-display">
                            <TrafficLightBadge score={score} size="small" />
                            <span className="score-value">{Math.round(score)}</span>
                          </div>
                        ) : (
                          <span className="no-data">-</span>
                        )}
                      </td>
                    ))}
                    {selectedYears.length >= 2 && (
                      <td className="diff-cell">
                        {diff !== null ? (
                          <span className={`diff-value ${diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral'}`}>
                            {diff > 0 && '+'}
                            {Math.round(diff)}
                            {diff !== 0 && (
                              <svg viewBox="0 0 24 24" width="14" height="14">
                                {diff > 0 ? (
                                  <path fill="currentColor" d="M7 14l5-5 5 5z"/>
                                ) : (
                                  <path fill="currentColor" d="M7 10l5 5 5-5z"/>
                                )}
                              </svg>
                            )}
                          </span>
                        ) : (
                          <span className="no-data">-</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Cards */}
      {data.length > 0 && selectedYears.length >= 2 && (
        <div className="history-summary">
          <div className="summary-card glass-card improvement">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="#34A853" d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
            </svg>
            <div className="summary-info">
              <span className="summary-value">
                {data.filter(d => {
                  const scores = selectedYears.map(y => d.scores?.[y] ?? null);
                  return scores.length >= 2 && scores[scores.length - 1] > scores[scores.length - 2];
                }).length}
              </span>
              <span className="summary-label">Melhoraram</span>
            </div>
          </div>

          <div className="summary-card glass-card decline">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="#EA4335" d="M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6z"/>
            </svg>
            <div className="summary-info">
              <span className="summary-value">
                {data.filter(d => {
                  const scores = selectedYears.map(y => d.scores?.[y] ?? null);
                  return scores.length >= 2 && scores[scores.length - 1] < scores[scores.length - 2];
                }).length}
              </span>
              <span className="summary-label">Pioraram</span>
            </div>
          </div>

          <div className="summary-card glass-card stable">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="#737373" d="M22 12l-4-4v3H3v2h15v3z"/>
            </svg>
            <div className="summary-info">
              <span className="summary-value">
                {data.filter(d => {
                  const scores = selectedYears.map(y => d.scores?.[y] ?? null);
                  return scores.length >= 2 && scores[scores.length - 1] === scores[scores.length - 2];
                }).length}
              </span>
              <span className="summary-label">Estáveis</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
