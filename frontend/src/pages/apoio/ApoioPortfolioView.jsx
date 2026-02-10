/**
 * Vista de Portfolio do Apoio de Projetos
 *
 * Tabela de projetos com indicadores de controle do setor de Tecnologia,
 * KPIs de cobertura e filtros.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { getStatusColor } from '../../components/StatusDropdown';
import { isFinalizedStatus, isPausedStatus } from '../../utils/portfolio-utils';
import '../../styles/ApoioPortfolioView.css';

// Status considerados "ativos elegiveis" para o indicador principal
const ELIGIBLE_STATUSES = ['fase 01', 'fase 02', 'fase 03', 'fase 04'];

// Opcoes do controle de apoio
const CONTROLE_OPTIONS = [
  { value: null, label: '-', color: '#9ca3af' },
  { value: 'Controlando', label: 'Controlando', color: '#22c55e' },
  { value: 'Não controlando', label: 'Não controlando', color: '#ef4444' },
  { value: 'Dispensado', label: 'Dispensado', color: '#f59e0b' },
];

function isEligibleStatus(status) {
  if (!status) return false;
  return ELIGIBLE_STATUSES.includes(status.toLowerCase().trim());
}

// Status encerrados especificos (close, termo, churn)
function isClosedStatus(status) {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return s === 'close' || s === 'termo de encerramento' || s === 'churn pelo cliente';
}

function getControleColor(value) {
  const option = CONTROLE_OPTIONS.find(o => o.value === value);
  return option?.color || '#9ca3af';
}

const Icons = {
  Refresh: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
};

export default function ApoioPortfolioView() {
  const { hasFullAccess } = useAuth();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState('');
  const [liderFilter, setLiderFilter] = useState('');
  const [controleFilter, setControleFilter] = useState('');
  const [statusGroupFilter, setStatusGroupFilter] = useState('todos');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `${API_URL}/api/apoio-projetos/portfolio`,
        { withCredentials: true }
      );

      if (response.data?.success) {
        setData(response.data.data || []);
      } else {
        setError(response.data?.error || 'Erro ao carregar portfolio');
      }
    } catch (err) {
      console.error('Erro ao buscar portfolio do apoio:', err);
      setError(err.response?.data?.error || 'Erro ao carregar portfolio');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Valores unicos para filtros
  const uniqueTimes = useMemo(() => {
    const set = new Set();
    data.forEach(r => { if (r.nome_time) set.add(r.nome_time); });
    return Array.from(set).sort();
  }, [data]);

  const uniqueLiders = useMemo(() => {
    const set = new Set();
    data.forEach(r => { if (r.lider) set.add(r.lider); });
    return Array.from(set).sort();
  }, [data]);

  // Dados filtrados
  const filteredData = useMemo(() => {
    let filtered = data;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        [r.project_code_norm, r.project_name, r.lider, r.nome_time, r.plataforma_acd]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(term))
      );
    }

    if (timeFilter) {
      filtered = filtered.filter(r => r.nome_time === timeFilter);
    }

    if (liderFilter) {
      filtered = filtered.filter(r => r.lider === liderFilter);
    }

    if (controleFilter) {
      if (controleFilter === 'null') {
        filtered = filtered.filter(r => !r.controle_apoio);
      } else {
        filtered = filtered.filter(r => r.controle_apoio === controleFilter);
      }
    }

    if (statusGroupFilter === 'elegiveis') {
      filtered = filtered.filter(r => isEligibleStatus(r.status));
    } else if (statusGroupFilter === 'encerrados') {
      filtered = filtered.filter(r => isClosedStatus(r.status));
    } else if (statusGroupFilter === 'pausados') {
      filtered = filtered.filter(r => isPausedStatus(r.status));
    } else if (statusGroupFilter === 'ativos') {
      filtered = filtered.filter(r => !isFinalizedStatus(r.status) && !isPausedStatus(r.status));
    }

    return filtered;
  }, [data, searchTerm, timeFilter, liderFilter, controleFilter, statusGroupFilter]);

  // KPIs calculados sobre TODOS os dados (sem filtros de tabela)
  const kpis = useMemo(() => {
    const total = data.length;
    const elegiveis = data.filter(r => isEligibleStatus(r.status)).length;
    const controlados = data.filter(r => r.controle_apoio === 'Controlando').length;
    const dispensados = data.filter(r => r.controle_apoio === 'Dispensado').length;
    const encerrados = data.filter(r => isClosedStatus(r.status)).length;
    const pausados = data.filter(r => isPausedStatus(r.status)).length;
    const indicador = elegiveis > 0 ? ((controlados / elegiveis) * 100).toFixed(1) : '0.0';

    return { total, elegiveis, controlados, dispensados, encerrados, pausados, indicador };
  }, [data]);

  // Handler de edicao do controle
  const handleControleChange = async (projectCode, newValue, oldValue) => {
    const value = newValue === '' ? null : newValue;

    setData(prev => prev.map(row =>
      row.project_code_norm === projectCode
        ? { ...row, controle_apoio: value }
        : row
    ));

    try {
      await axios.put(
        `${API_URL}/api/apoio-projetos/portfolio/${projectCode}/controle`,
        { controle_apoio: value },
        { withCredentials: true }
      );
    } catch (err) {
      setData(prev => prev.map(row =>
        row.project_code_norm === projectCode
          ? { ...row, controle_apoio: oldValue }
          : row
      ));
      alert('Erro ao atualizar: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="apoio-container">
      {/* Header */}
      <div className="apoio-header">
        <h2 className="apoio-portfolio-title">Portfolio - Controle de Projetos</h2>
        <button
          className="apoio-refresh-btn"
          onClick={fetchData}
          disabled={loading}
          title="Atualizar dados"
        >
          <Icons.Refresh />
        </button>
      </div>

      {/* KPIs */}
      <div className="apoio-summary">
        <div className="apoio-summary-card">
          <span className="apoio-summary-value">{kpis.total}</span>
          <span className="apoio-summary-label">Total de Projetos</span>
        </div>
        <div className="apoio-summary-card">
          <span className="apoio-summary-value">{kpis.elegiveis}</span>
          <span className="apoio-summary-label">Ativos Elegiveis</span>
        </div>
        <div className="apoio-summary-card" style={{ borderLeft: '4px solid #22c55e' }}>
          <span className="apoio-summary-value">{kpis.controlados}</span>
          <span className="apoio-summary-label">Controlados</span>
        </div>
        <div className="apoio-summary-card apoio-summary-card-highlight">
          <span className="apoio-summary-value">{kpis.indicador}%</span>
          <span className="apoio-summary-label">Indicador Controle</span>
        </div>
        <div className="apoio-summary-card">
          <span className="apoio-summary-value">{kpis.dispensados}</span>
          <span className="apoio-summary-label">Dispensados</span>
        </div>
        <div className="apoio-summary-card">
          <span className="apoio-summary-value">{kpis.encerrados}</span>
          <span className="apoio-summary-label">Encerrados</span>
        </div>
        <div className="apoio-summary-card">
          <span className="apoio-summary-value">{kpis.pausados}</span>
          <span className="apoio-summary-label">Pausados</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="apoio-filters">
        <input
          type="text"
          className="apoio-search-input"
          placeholder="Buscar por codigo, nome, lider, time..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className="apoio-filter-group">
          <label className="apoio-filter-label">Status:</label>
          <select
            className="apoio-weeks-select"
            value={statusGroupFilter}
            onChange={(e) => setStatusGroupFilter(e.target.value)}
          >
            <option value="todos">Todos</option>
            <option value="elegiveis">Ativos Elegiveis (Fase 01-04)</option>
            <option value="ativos">Todos Ativos (nao encerrados)</option>
            <option value="encerrados">Encerrados</option>
            <option value="pausados">Pausados</option>
          </select>
        </div>

        <div className="apoio-filter-group">
          <label className="apoio-filter-label">Time:</label>
          <select
            className="apoio-weeks-select"
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
          >
            <option value="">Todos</option>
            {uniqueTimes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="apoio-filter-group">
          <label className="apoio-filter-label">Lider:</label>
          <select
            className="apoio-weeks-select"
            value={liderFilter}
            onChange={(e) => setLiderFilter(e.target.value)}
          >
            <option value="">Todos</option>
            {uniqueLiders.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="apoio-filter-group">
          <label className="apoio-filter-label">Controle:</label>
          <select
            className="apoio-weeks-select"
            value={controleFilter}
            onChange={(e) => setControleFilter(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="Controlando">Controlando</option>
            <option value="Não controlando">Nao controlando</option>
            <option value="Dispensado">Dispensado</option>
            <option value="null">Nao definido</option>
          </select>
        </div>
      </div>

      {/* Contagem filtrada */}
      <div className="apoio-portfolio-count">
        {filteredData.length} projeto{filteredData.length !== 1 ? 's' : ''} exibido{filteredData.length !== 1 ? 's' : ''}
      </div>

      {/* Conteudo */}
      {loading ? (
        <div className="apoio-loading">
          <div className="apoio-spinner"></div>
          <p>Carregando portfolio...</p>
        </div>
      ) : error ? (
        <div className="apoio-error">
          <p>{error}</p>
          <button onClick={fetchData} className="apoio-refresh-btn">Tentar novamente</button>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="apoio-empty">
          <p className="apoio-empty-message">Nenhum projeto encontrado</p>
          <p className="apoio-empty-hint">Tente ajustar os filtros</p>
        </div>
      ) : (
        <div className="apoio-table-wrapper">
          <table className="apoio-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>Codigo</th>
                <th style={{ width: 220 }}>Nome do Projeto</th>
                <th style={{ width: 120 }}>Status</th>
                <th style={{ width: 120 }}>Lider</th>
                <th style={{ width: 120 }}>Time</th>
                <th style={{ width: 100 }}>ACD</th>
                <th style={{ width: 150 }}>Controle</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row) => (
                <tr key={row.project_code_norm || row.project_name}>
                  <td className="apoio-portfolio-code">{row.project_code_norm || '-'}</td>
                  <td className="apoio-portfolio-name" title={row.project_name}>
                    {row.project_name || '-'}
                  </td>
                  <td>
                    {row.status ? (
                      <span
                        className="apoio-status-badge"
                        style={{
                          backgroundColor: `${getStatusColor(row.status)}15`,
                          color: getStatusColor(row.status),
                          borderColor: `${getStatusColor(row.status)}40`,
                        }}
                      >
                        <span
                          className="apoio-status-dot"
                          style={{ backgroundColor: getStatusColor(row.status) }}
                        />
                        {row.status}
                      </span>
                    ) : '-'}
                  </td>
                  <td>{row.lider || '-'}</td>
                  <td>{row.nome_time || '-'}</td>
                  <td>{row.plataforma_acd || '-'}</td>
                  <td>
                    {hasFullAccess ? (
                      <select
                        className="apoio-controle-select"
                        value={row.controle_apoio || ''}
                        onChange={(e) => handleControleChange(
                          row.project_code_norm,
                          e.target.value,
                          row.controle_apoio
                        )}
                        style={{
                          color: getControleColor(row.controle_apoio),
                          borderColor: `${getControleColor(row.controle_apoio)}60`,
                        }}
                      >
                        {CONTROLE_OPTIONS.map(opt => (
                          <option key={opt.label} value={opt.value || ''}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className="apoio-controle-badge"
                        style={{
                          backgroundColor: `${getControleColor(row.controle_apoio)}15`,
                          color: getControleColor(row.controle_apoio),
                        }}
                      >
                        {row.controle_apoio || '-'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
