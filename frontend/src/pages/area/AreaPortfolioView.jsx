/**
 * Vista de Portfolio simplificada para CS-Area e Admin-Financeiro
 *
 * Read-only, colunas de "Informacoes do Projeto", "A Iniciar" ON por padrao.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { getStatusColor } from '../../components/StatusDropdown';
import {
  VIEWS,
  COLUMN_NAMES_PT,
  COLUMN_WIDTHS,
  isFinalizedStatus,
  isPausedStatus,
  isAIniciarStatus,
  isAtivoStatus,
  getColumnLabel,
  formatValue,
  detectColumnType,
} from '../../utils/portfolio-utils';
import { initSeenProjects, markProjectSeen, pruneSeenCodes } from '../../utils/projectSeenTracker';
import '../../styles/AreaPortfolioView.css';

const VIEW_OPTIONS = [
  { key: 'info', label: 'Informações' },
  { key: 'empreendimento', label: 'Empreendimento' },
];

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
  Copy: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
};

export default function AreaPortfolioView() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [newProjectCodes, setNewProjectCodes] = useState(new Set());

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState('');
  const [liderFilter, setLiderFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [showFinalizados, setShowFinalizados] = useState(false);
  const [showPausados, setShowPausados] = useState(false);
  const [showAIniciar, setShowAIniciar] = useState(true); // ON por padrao
  const [showAtivos, setShowAtivos] = useState(false);

  // Vista ativa
  const [activeView, setActiveView] = useState('info');
  const columns = VIEWS[activeView]?.columns || VIEWS.info.columns;

  // Sorting
  const [sortKey, setSortKey] = useState('project_order');
  const [sortDir, setSortDir] = useState('asc');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/api/portfolio`, { withCredentials: true });
      if (response.data?.success) {
        const projects = response.data.data || [];
        setData(projects);

        // Calcular projetos novos
        if (user?.id) {
          const allCodes = projects.map(p => p.project_code_norm).filter(Boolean);
          const newCodes = initSeenProjects(user.id, allCodes);
          setNewProjectCodes(newCodes);
          pruneSeenCodes(user.id, allCodes);
        }
      } else {
        setError(response.data?.error || 'Erro ao carregar portfolio');
      }
    } catch (err) {
      console.error('Erro ao buscar portfolio:', err);
      setError(err.response?.data?.error || 'Erro ao carregar portfolio');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  const uniqueClients = useMemo(() => {
    const set = new Set();
    data.forEach(r => { if (r.client) set.add(r.client); });
    return Array.from(set).sort();
  }, [data]);

  // Dados filtrados
  const filteredData = useMemo(() => {
    let filtered = data;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        [r.project_code_norm, r.project_name, r.comercial_name, r.lider, r.nome_time, r.client]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(term))
      );
    }

    if (timeFilter) filtered = filtered.filter(r => r.nome_time === timeFilter);
    if (liderFilter) filtered = filtered.filter(r => r.lider === liderFilter);
    if (clientFilter) filtered = filtered.filter(r => r.client === clientFilter);

    if (!showFinalizados) filtered = filtered.filter(r => !isFinalizedStatus(r.status));
    if (!showPausados) filtered = filtered.filter(r => !isPausedStatus(r.status));
    if (!showAIniciar) filtered = filtered.filter(r => !isAIniciarStatus(r.status));
    if (!showAtivos) filtered = filtered.filter(r => !isAtivoStatus(r.status));

    return filtered;
  }, [data, searchTerm, timeFilter, liderFilter, clientFilter, showFinalizados, showPausados, showAIniciar, showAtivos]);

  // Sorting
  const sortedData = useMemo(() => {
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      if (va == null) va = '';
      if (vb == null) vb = '';
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      if (sa < sb) return sortDir === 'asc' ? -1 : 1;
      if (sa > sb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredData, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleRowClick = (projectCode) => {
    if (!projectCode || !user?.id || !newProjectCodes.has(String(projectCode))) return;
    markProjectSeen(user.id, projectCode);
    setNewProjectCodes(prev => {
      const next = new Set(prev);
      next.delete(String(projectCode));
      return next;
    });
    window.dispatchEvent(new Event('portfolio-project-seen'));
  };

  // KPIs
  const kpis = useMemo(() => {
    const total = data.length;
    const ativos = data.filter(r => isAtivoStatus(r.status)).length;
    const aIniciar = data.filter(r => isAIniciarStatus(r.status)).length;
    const novos = newProjectCodes.size;
    return { total, ativos, aIniciar, novos };
  }, [data, newProjectCodes]);

  // Copiar TSV
  const handleCopy = () => {
    const headers = columns.map(col => {
      const label = COLUMN_NAMES_PT[col] || col;
      return label.replace(/<br\/?>/g, ' ');
    });
    const rows = sortedData.map(row =>
      columns.map(col => {
        const val = row[col];
        if (val == null) return '';
        return String(val);
      }).join('\t')
    );
    const tsv = [headers.join('\t'), ...rows].join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  // Render coluna
  const renderCell = (row, col) => {
    const val = row[col];

    if (col === 'project_code_norm') {
      return <td key={col} className="area-pf-code">{val || '-'}</td>;
    }

    if (col === 'project_name') {
      return <td key={col} className="area-pf-name" title={val}>{val || '-'}</td>;
    }

    if (col === 'cs_responsavel_name') {
      return (
        <td key={col}>
          {val ? (
            <span className="area-pf-cs-resp">
              {row.cs_responsavel_avatar && (
                <img className="area-pf-cs-avatar" src={row.cs_responsavel_avatar} alt={val} />
              )}
              {val}
            </span>
          ) : '-'}
        </td>
      );
    }

    if (col === 'status') {
      return (
        <td key={col}>
          {val ? (
            <span
              className="area-pf-status-badge"
              style={{
                backgroundColor: `${getStatusColor(val)}15`,
                color: getStatusColor(val),
                borderColor: `${getStatusColor(val)}40`,
              }}
            >
              <span className="area-pf-status-dot" style={{ backgroundColor: getStatusColor(val) }} />
              {val}
            </span>
          ) : '-'}
        </td>
      );
    }

    const type = detectColumnType(val, col);
    return <td key={col}>{formatValue(val, type)}</td>;
  };

  return (
    <div className="area-pf-container">
      {/* Header */}
      <div className="area-pf-header">
        <h2 className="area-pf-title">Portfolio</h2>
        <button
          className="area-pf-refresh-btn"
          onClick={fetchData}
          disabled={loading}
          title="Atualizar dados"
        >
          <Icons.Refresh />
        </button>
      </div>

      {/* KPIs */}
      <div className="area-pf-kpi-grid">
        <div className="area-pf-kpi-card">
          <span className="area-pf-kpi-value">{kpis.total}</span>
          <span className="area-pf-kpi-label">Total</span>
        </div>
        <div className="area-pf-kpi-card">
          <span className="area-pf-kpi-value">{kpis.ativos}</span>
          <span className="area-pf-kpi-label">Ativos</span>
        </div>
        <div className="area-pf-kpi-card">
          <span className="area-pf-kpi-value">{kpis.aIniciar}</span>
          <span className="area-pf-kpi-label">A Iniciar</span>
        </div>
        {kpis.novos > 0 && (
          <div className="area-pf-kpi-card area-pf-kpi-card--accent">
            <span className="area-pf-kpi-value">{kpis.novos}</span>
            <span className="area-pf-kpi-label">Novos</span>
          </div>
        )}
      </div>

      {/* View Selector */}
      <div className="area-pf-view-selector">
        {VIEW_OPTIONS.map(v => (
          <button
            key={v.key}
            className={`area-pf-view-btn ${activeView === v.key ? 'active' : ''}`}
            onClick={() => setActiveView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Busca */}
      <div className="area-pf-search-bar">
        <Icons.Search />
        <input
          type="text"
          className="area-pf-search-input"
          placeholder="Buscar por codigo, nome, lider, time, cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Toggles */}
      <div className="area-pf-toggle-section">
        <div className="area-pf-toggle-row">
          <span className="area-pf-toggle-row-label">Incluir</span>
          <button
            className={`area-pf-toggle-btn ${showFinalizados ? 'active' : ''}`}
            onClick={() => setShowFinalizados(!showFinalizados)}
          >
            Finalizados
          </button>
          <button
            className={`area-pf-toggle-btn ${showPausados ? 'active' : ''}`}
            onClick={() => setShowPausados(!showPausados)}
          >
            Pausados
          </button>
          <button
            className={`area-pf-toggle-btn ${showAIniciar ? 'active' : ''}`}
            onClick={() => setShowAIniciar(!showAIniciar)}
          >
            A Iniciar
          </button>
          <button
            className={`area-pf-toggle-btn ${showAtivos ? 'active' : ''}`}
            onClick={() => setShowAtivos(!showAtivos)}
          >
            Ativos
          </button>
        </div>
      </div>

      {/* Filtros dropdown */}
      <div className="area-pf-filters">
        <div className="area-pf-filter-group">
          <label className="area-pf-filter-label">Time:</label>
          <select className="area-pf-select" value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
            <option value="">Todos</option>
            {uniqueTimes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="area-pf-filter-group">
          <label className="area-pf-filter-label">Lider:</label>
          <select className="area-pf-select" value={liderFilter} onChange={(e) => setLiderFilter(e.target.value)}>
            <option value="">Todos</option>
            {uniqueLiders.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="area-pf-filter-group">
          <label className="area-pf-filter-label">Cliente:</label>
          <select className="area-pf-select" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
            <option value="">Todos</option>
            {uniqueClients.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <button
          className={`area-pf-copy-btn ${copySuccess ? 'area-pf-copy-btn--success' : ''}`}
          onClick={handleCopy}
          title="Copiar tabela (TSV)"
        >
          <Icons.Copy /> {copySuccess ? 'Copiado!' : 'Copiar'}
        </button>

        <div className="area-pf-count">
          <strong>{sortedData.length}</strong> projeto{sortedData.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Conteudo */}
      {loading ? (
        <div className="area-pf-loading">
          <div className="area-pf-spinner"></div>
          <p>Carregando portfolio...</p>
        </div>
      ) : error ? (
        <div className="area-pf-error">
          <p>{error}</p>
          <button onClick={fetchData} className="area-pf-refresh-btn">Tentar novamente</button>
        </div>
      ) : sortedData.length === 0 ? (
        <div className="area-pf-empty">
          <p className="area-pf-empty-message">Nenhum projeto encontrado</p>
          <p className="area-pf-empty-hint">Tente ajustar os filtros</p>
        </div>
      ) : (
        <div className="area-pf-table-wrapper">
          <table className="area-pf-table">
            <thead>
              <tr>
                {columns.map(col => (
                  <th
                    key={col}
                    style={{ width: COLUMN_WIDTHS[col] || 'auto' }}
                    className={sortKey === col ? 'area-pf-sorted' : ''}
                    onClick={() => handleSort(col)}
                    dangerouslySetInnerHTML={{
                      __html: getColumnLabel(col) + (sortKey === col
                        ? `<span class="area-pf-sort-arrow">${sortDir === 'asc' ? ' ▲' : ' ▼'}</span>`
                        : '')
                    }}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row) => {
                const code = row.project_code_norm;
                const isNew = code && newProjectCodes.has(String(code));
                return (
                  <tr
                    key={code || row.project_name}
                    className={isNew ? 'area-pf-row-new' : ''}
                    onClick={() => isNew && handleRowClick(code)}
                    style={isNew ? { cursor: 'pointer' } : undefined}
                  >
                    {columns.map(col => renderCell(row, col))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
