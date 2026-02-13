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

// Status "a iniciar" (planejamento/pre-execucao)
function isAIniciarStatus(status) {
  if (!status) return false;
  return status.toLowerCase().trim().includes('a iniciar');
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
  Search: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Folder: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Edit: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Plus: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  X: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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
  const [selectedFases, setSelectedFases] = useState(new Set());
  const [showFinalizados, setShowFinalizados] = useState(false);
  const [showPausados, setShowPausados] = useState(false);
  const [showAIniciar, setShowAIniciar] = useState(false);

  // Edicao inline do link IFC
  const [editingIfcCode, setEditingIfcCode] = useState(null);
  const [editingIfcValue, setEditingIfcValue] = useState('');

  const toggleFase = (fase) => {
    setSelectedFases(prev => {
      const next = new Set(prev);
      if (next.has(fase)) next.delete(fase);
      else next.add(fase);
      return next;
    });
  };

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

  const uniqueFases = useMemo(() => {
    const set = new Set();
    data.forEach(r => {
      if (r.status && /^fase\s+\d+/i.test(r.status.trim())) {
        set.add(r.status.trim());
      }
    });
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

    // Filtro por fases selecionadas (multi-select)
    if (selectedFases.size > 0) {
      filtered = filtered.filter(r => selectedFases.has(r.status?.trim()));
    }

    // Toggles de visibilidade (excluem quando OFF)
    if (!showFinalizados) {
      filtered = filtered.filter(r => !isFinalizedStatus(r.status));
    }
    if (!showPausados) {
      filtered = filtered.filter(r => !isPausedStatus(r.status));
    }
    if (!showAIniciar) {
      filtered = filtered.filter(r => !isAIniciarStatus(r.status));
    }

    return filtered;
  }, [data, searchTerm, timeFilter, liderFilter, controleFilter, selectedFases, showFinalizados, showPausados, showAIniciar]);

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

  // Handlers de edicao do link IFC
  const startEditingIfc = (projectCode, currentValue) => {
    setEditingIfcCode(projectCode);
    setEditingIfcValue(currentValue || '');
  };

  const cancelEditingIfc = () => {
    setEditingIfcCode(null);
    setEditingIfcValue('');
  };

  const saveIfcLink = async (projectCode) => {
    const value = editingIfcValue.trim() || null;
    const oldValue = data.find(r => r.project_code_norm === projectCode)?.link_ifc;

    setData(prev => prev.map(row =>
      row.project_code_norm === projectCode
        ? { ...row, link_ifc: value }
        : row
    ));
    setEditingIfcCode(null);
    setEditingIfcValue('');

    try {
      await axios.put(
        `${API_URL}/api/apoio-projetos/portfolio/${projectCode}/link-ifc`,
        { link_ifc: value },
        { withCredentials: true }
      );
    } catch (err) {
      setData(prev => prev.map(row =>
        row.project_code_norm === projectCode
          ? { ...row, link_ifc: oldValue }
          : row
      ));
      alert('Erro ao salvar link IFC: ' + (err.response?.data?.error || err.message));
    }
  };

  const removeIfcLink = async (projectCode) => {
    const oldValue = data.find(r => r.project_code_norm === projectCode)?.link_ifc;

    setData(prev => prev.map(row =>
      row.project_code_norm === projectCode
        ? { ...row, link_ifc: null }
        : row
    ));

    try {
      await axios.put(
        `${API_URL}/api/apoio-projetos/portfolio/${projectCode}/link-ifc`,
        { link_ifc: null },
        { withCredentials: true }
      );
    } catch (err) {
      setData(prev => prev.map(row =>
        row.project_code_norm === projectCode
          ? { ...row, link_ifc: oldValue }
          : row
      ));
      alert('Erro ao remover link IFC: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="apoio-container">
      {/* Header */}
      <div className="apoio-header">
        <h2 className="apoio-portfolio-title">Portfolio</h2>
        <button
          className="apoio-refresh-btn"
          onClick={fetchData}
          disabled={loading}
          title="Atualizar dados"
        >
          <Icons.Refresh />
        </button>
      </div>

      {/* KPIs - 2 fileiras */}
      <div className="apoio-kpi-grid">
        <div className="apoio-kpi-card">
          <span className="apoio-kpi-value">{kpis.total}</span>
          <span className="apoio-kpi-label">Total</span>
        </div>
        <div className="apoio-kpi-card">
          <span className="apoio-kpi-value">{kpis.elegiveis}</span>
          <span className="apoio-kpi-label">Elegiveis</span>
        </div>
        <div className="apoio-kpi-card apoio-kpi-card--green">
          <span className="apoio-kpi-value">{kpis.controlados}</span>
          <span className="apoio-kpi-label">Controlados</span>
        </div>
        <div className="apoio-kpi-card apoio-kpi-hero">
          <span className="apoio-kpi-value">{kpis.indicador}%</span>
          <span className="apoio-kpi-label">Indicador</span>
        </div>
        <div className="apoio-kpi-card apoio-kpi-card--amber">
          <span className="apoio-kpi-value">{kpis.dispensados}</span>
          <span className="apoio-kpi-label">Dispensados</span>
        </div>
        <div className="apoio-kpi-card">
          <span className="apoio-kpi-value">{kpis.encerrados}</span>
          <span className="apoio-kpi-label">Encerrados</span>
        </div>
        <div className="apoio-kpi-card">
          <span className="apoio-kpi-value">{kpis.pausados}</span>
          <span className="apoio-kpi-label">Pausados</span>
        </div>
      </div>

      {/* Busca */}
      <div className="apoio-search-bar">
        <Icons.Search />
        <input
          type="text"
          className="apoio-search-input"
          placeholder="Buscar por codigo, nome, lider, time..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Toggle Section - Fases + Visibilidade */}
      <div className="apoio-toggle-section">
        <div className="apoio-toggle-row">
          <span className="apoio-toggle-row-label">Fases</span>
          {uniqueFases.map(fase => (
            <button
              key={fase}
              className={`apoio-fase-btn ${selectedFases.has(fase) ? 'active' : ''}`}
              onClick={() => toggleFase(fase)}
              style={selectedFases.has(fase) ? { '--fase-color': getStatusColor(fase) } : {}}
            >
              {fase.replace(/fase\s+/i, 'F')}
            </button>
          ))}
          {selectedFases.size > 0 && (
            <button className="apoio-toggle-clear" onClick={() => setSelectedFases(new Set())}>
              Limpar
            </button>
          )}
        </div>
        <div className="apoio-toggle-row">
          <span className="apoio-toggle-row-label">Incluir</span>
          <button
            className={`apoio-toggle-btn ${showFinalizados ? 'active' : ''}`}
            onClick={() => setShowFinalizados(!showFinalizados)}
          >
            Finalizados
          </button>
          <button
            className={`apoio-toggle-btn ${showPausados ? 'active' : ''}`}
            onClick={() => setShowPausados(!showPausados)}
          >
            Pausados
          </button>
          <button
            className={`apoio-toggle-btn ${showAIniciar ? 'active' : ''}`}
            onClick={() => setShowAIniciar(!showAIniciar)}
          >
            A Iniciar
          </button>
        </div>
      </div>

      {/* Filtros dropdown */}
      <div className="apoio-filters">
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

        <div className="apoio-portfolio-count">
          <strong>{filteredData.length}</strong> projeto{filteredData.length !== 1 ? 's' : ''}
        </div>
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
                <th style={{ width: 80 }}>IFC</th>
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
                  <td className="apoio-ifc-cell">
                    {editingIfcCode === row.project_code_norm ? (
                      <div className="apoio-ifc-edit">
                        <input
                          type="url"
                          className="apoio-ifc-input"
                          value={editingIfcValue}
                          onChange={(e) => setEditingIfcValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveIfcLink(row.project_code_norm);
                            if (e.key === 'Escape') cancelEditingIfc();
                          }}
                          placeholder="Cole o link..."
                          autoFocus
                        />
                        <button
                          className="apoio-ifc-btn apoio-ifc-btn--save"
                          onClick={() => saveIfcLink(row.project_code_norm)}
                          title="Salvar"
                        >
                          <Icons.Check />
                        </button>
                        <button
                          className="apoio-ifc-btn apoio-ifc-btn--cancel"
                          onClick={cancelEditingIfc}
                          title="Cancelar"
                        >
                          <Icons.X />
                        </button>
                      </div>
                    ) : row.link_ifc ? (
                      <div className="apoio-ifc-actions">
                        <a
                          href={row.link_ifc}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="apoio-ifc-link"
                          title="Abrir pasta IFC"
                        >
                          <Icons.Folder />
                        </a>
                        {hasFullAccess && (
                          <>
                            <button
                              className="apoio-ifc-btn apoio-ifc-btn--edit"
                              onClick={() => startEditingIfc(row.project_code_norm, row.link_ifc)}
                              title="Editar link"
                            >
                              <Icons.Edit />
                            </button>
                            <button
                              className="apoio-ifc-btn apoio-ifc-btn--remove"
                              onClick={() => removeIfcLink(row.project_code_norm)}
                              title="Remover link"
                            >
                              <Icons.X />
                            </button>
                          </>
                        )}
                      </div>
                    ) : hasFullAccess ? (
                      <button
                        className="apoio-ifc-btn apoio-ifc-btn--add"
                        onClick={() => startEditingIfc(row.project_code_norm, '')}
                        title="Adicionar link IFC"
                      >
                        <Icons.Plus />
                      </button>
                    ) : (
                      <span className="apoio-ifc-empty">-</span>
                    )}
                  </td>
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
