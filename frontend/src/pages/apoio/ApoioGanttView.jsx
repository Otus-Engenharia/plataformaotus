/**
 * Vista Gantt Modelagem do Apoio de Projetos
 *
 * Gantt visual das atividades de Modelagem/BIM,
 * alimentado pelo endpoint de próximas tarefas.
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import GanttTimeline from '../../components/apoio/GanttTimeline';
import '../../styles/ApoioProjetosView.css';

export default function ApoioGanttView() {
  const [tarefas, setTarefas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [weeksFilter, setWeeksFilter] = useState(4);

  const fetchTarefas = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `${API_URL}/api/apoio-projetos/proximas-tarefas`,
        {
          params: { weeksAhead: weeksFilter },
          withCredentials: true,
        }
      );

      if (response.data?.success) {
        setTarefas(response.data.data || []);
      } else {
        setError(response.data?.error || 'Erro ao carregar tarefas');
      }
    } catch (err) {
      console.error('Erro ao buscar próximas tarefas:', err);
      setError(err.response?.data?.error || 'Erro ao carregar tarefas');
    } finally {
      setLoading(false);
    }
  }, [weeksFilter]);

  useEffect(() => {
    fetchTarefas();
  }, [fetchTarefas]);

  return (
    <div className="apoio-container">
      {/* Header */}
      <div className="apoio-header">
        <h2>Gantt Modelagem</h2>
        <button
          className="apoio-refresh-btn"
          onClick={fetchTarefas}
          disabled={loading}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Atualizar
        </button>
      </div>

      {/* Filtro de semanas */}
      <div className="apoio-filters">
        <div className="apoio-filter-group">
          <label className="apoio-filter-label">Semanas à frente:</label>
          <select
            className="apoio-weeks-select"
            value={weeksFilter}
            onChange={(e) => setWeeksFilter(parseInt(e.target.value))}
          >
            <option value={1}>1 semana</option>
            <option value={2}>2 semanas</option>
            <option value={4}>4 semanas</option>
            <option value={8}>8 semanas</option>
            <option value={12}>12 semanas</option>
          </select>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="apoio-loading">
          <div className="apoio-spinner"></div>
          <span>Carregando tarefas...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="apoio-error">
          <p>{error}</p>
          <button onClick={fetchTarefas}>Tentar novamente</button>
        </div>
      )}

      {/* Gantt */}
      {!loading && !error && (
        <GanttTimeline tarefas={tarefas} weeksAhead={weeksFilter} />
      )}
    </div>
  );
}
