/**
 * Vista de Portfolio simplificada para CS-Area e Admin-Financeiro
 *
 * Read-only, colunas de "Informacoes do Projeto", "A Iniciar" ON por padrao.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import StatusDropdown, { getStatusColor } from '../../components/StatusDropdown';
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

const CS_EDITABLE_COLUMNS = ['comercial_name', 'status', 'client', 'nome_time', 'lider'];

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
  const { user, canEditPortfolio } = useAuth();
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

  // Edicao inline
  const [editingCell, setEditingCell] = useState(null);   // { projectCode, field }
  const [csUsers, setCsUsers] = useState(null);           // [{ id, name, avatar_url }]
  const [editOptions, setEditOptions] = useState(null);   // { teams, companies, leaders, csUsers }
  const [savedCell, setSavedCell] = useState(null);        // { projectCode, field }
  const [errorCell, setErrorCell] = useState(null);        // { projectCode, field, message }

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

  // Busca opcoes de edicao se usuario tem permissao
  useEffect(() => {
    if (!canEditPortfolio) return;
    axios.get(`${API_URL}/api/portfolio/edit-options`, { withCredentials: true })
      .then(res => {
        if (res.data?.success) {
          setEditOptions(res.data.data);
          setCsUsers(res.data.data.csUsers || []);
        }
      })
      .catch(err => console.error('Erro ao buscar edit options:', err));
  }, [canEditPortfolio]);

  // Handler para trocar responsavel CS
  const handleCsResponsavelChange = useCallback(async (projectCode, newUserId) => {
    setEditingCell(null);
    const prev = data;
    // Optimistic update
    setData(d => d.map(row => {
      if (row.project_code_norm !== projectCode) return row;
      const selectedUser = newUserId ? csUsers?.find(u => u.id === newUserId) : null;
      return {
        ...row,
        _cs_responsavel_id: newUserId || null,
        cs_responsavel_name: selectedUser?.name || null,
        cs_responsavel_avatar: selectedUser?.avatar_url || null,
      };
    }));

    try {
      await axios.put(`${API_URL}/api/projetos/cs-responsavel`,
        { projectCode, csResponsavelId: newUserId || null },
        { withCredentials: true }
      );
      setSavedCell({ projectCode, field: 'cs_responsavel_name' });
      setTimeout(() => setSavedCell(null), 1500);
    } catch (err) {
      console.error('Erro ao atualizar responsavel CS:', err);
      setData(prev);
    }
  }, [data, csUsers]);

  // Handler generico para editar campos do portfolio
  const updatePortfolioField = useCallback(async (projectCode, field, newValue, oldValue, displayValue) => {
    const idFieldMap = { client: '_company_id', nome_time: '_team_id', lider: '_project_manager_id' };
    const fieldToUpdate = ['client', 'nome_time', 'lider'].includes(field)
      ? { [field]: displayValue, [idFieldMap[field]]: newValue }
      : { [field]: newValue };

    setEditingCell(null);
    const prev = data;
    setData(d => d.map(row =>
      row.project_code_norm === projectCode ? { ...row, ...fieldToUpdate } : row
    ));

    try {
      const response = await axios.put(
        `${API_URL}/api/portfolio/${projectCode}`,
        { field, value: newValue, oldValue },
        { withCredentials: true }
      );
      if (!response.data?.success) throw new Error(response.data?.error || 'Erro ao atualizar');
      setSavedCell({ projectCode, field });
      setTimeout(() => setSavedCell(null), 1500);
    } catch (err) {
      const rollbackUpdate = ['client', 'nome_time', 'lider'].includes(field)
        ? { [field]: oldValue, [idFieldMap[field]]: oldValue }
        : { [field]: oldValue };
      setData(prev.map(row =>
        row.project_code_norm === projectCode ? { ...row, ...rollbackUpdate } : row
      ));
      const errorMsg = err.response?.data?.error || err.message || 'Erro ao atualizar';
      setErrorCell({ projectCode, field, message: errorMsg });
      setTimeout(() => setErrorCell(null), 3000);
    }
  }, [data]);

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
      const code = row.project_code_norm;
      const isEditing = editingCell?.projectCode === code && editingCell?.field === 'cs_responsavel_name';
      const justSaved = savedCell?.projectCode === code && savedCell?.field === 'cs_responsavel_name';

      if (isEditing && csUsers) {
        return (
          <td key={col}>
            <select
              className="area-pf-inline-select"
              autoFocus
              defaultValue={row._cs_responsavel_id || ''}
              onChange={(e) => handleCsResponsavelChange(code, e.target.value || null)}
              onBlur={() => setEditingCell(null)}
              onKeyDown={(e) => e.key === 'Escape' && setEditingCell(null)}
            >
              <option value="">Sem responsavel</option>
              {csUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </td>
        );
      }

      return (
        <td key={col} className={justSaved ? 'area-pf-just-saved' : ''}>
          {canEditPortfolio && csUsers ? (
            <span
              className="area-pf-editable area-pf-cs-resp"
              onClick={() => setEditingCell({ projectCode: code, field: 'cs_responsavel_name' })}
            >
              {row.cs_responsavel_avatar && (
                <img className="area-pf-cs-avatar" src={row.cs_responsavel_avatar} alt={val} />
              )}
              {val || '-'}
              {justSaved && <span className="area-pf-save-check">&#10003;</span>}
            </span>
          ) : val ? (
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

    // Colunas editaveis pelo CS/admin
    const code = row.project_code_norm;
    const canEditCol = canEditPortfolio && CS_EDITABLE_COLUMNS.includes(col);
    const isEditing = editingCell?.projectCode === code && editingCell?.field === col;
    const justSaved = savedCell?.projectCode === code && savedCell?.field === col;
    const cellError = errorCell?.projectCode === code && errorCell?.field === col ? errorCell : null;

    // Status
    if (col === 'status') {
      if (isEditing && canEditCol) {
        return (
          <td key={col}>
            <StatusDropdown
              value={val}
              onChange={(newValue) => {
                updatePortfolioField(code, col, newValue, val);
              }}
              inline
              defaultOpen
            />
          </td>
        );
      }
      const statusColor = getStatusColor(val);
      return (
        <td key={col} className={justSaved ? 'area-pf-just-saved' : ''}>
          <span
            className={`area-pf-status-badge${canEditCol ? ' area-pf-editable-cell' : ''}${cellError ? ' area-pf-has-error' : ''}`}
            style={{
              backgroundColor: `${statusColor}15`,
              color: statusColor,
              borderColor: `${statusColor}40`,
            }}
            onClick={canEditCol ? () => setEditingCell({ projectCode: code, field: col }) : undefined}
            title={canEditCol ? 'Clique para editar' : undefined}
          >
            <span className="area-pf-status-dot" style={{ backgroundColor: statusColor }} />
            {val || '-'}
            {justSaved && <span className="area-pf-save-check">&#10003;</span>}
          </span>
          {cellError && <span className="area-pf-error-tooltip">{cellError.message}</span>}
        </td>
      );
    }

    // Client - dropdown com companies
    if (col === 'client' && isEditing && canEditCol) {
      return (
        <td key={col}>
          <select
            className="area-pf-inline-select"
            defaultValue={row._company_id || ''}
            autoFocus
            onChange={(e) => {
              const selectedId = e.target.value;
              const selectedName = editOptions?.companies?.find(c => String(c.id) === String(selectedId))?.name;
              updatePortfolioField(code, col, selectedId || null, row._company_id, selectedName || '');
            }}
            onBlur={() => setEditingCell(null)}
            onKeyDown={(e) => e.key === 'Escape' && setEditingCell(null)}
          >
            <option value="">Selecionar...</option>
            {editOptions?.companies?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </td>
      );
    }

    // Time - dropdown com teams
    if (col === 'nome_time' && isEditing && canEditCol) {
      return (
        <td key={col}>
          <select
            className="area-pf-inline-select"
            defaultValue={row._team_id || ''}
            autoFocus
            onChange={(e) => {
              const selectedId = e.target.value;
              const team = editOptions?.teams?.find(t => String(t.id) === String(selectedId));
              const selectedName = team?.team_name || '';
              updatePortfolioField(code, col, selectedId || null, row._team_id, selectedName);
            }}
            onBlur={() => setEditingCell(null)}
            onKeyDown={(e) => e.key === 'Escape' && setEditingCell(null)}
          >
            <option value="">Sem time</option>
            {editOptions?.teams?.map(t => (
              <option key={t.id} value={t.id}>
                {t.team_number ? `Time ${t.team_number} - ${t.team_name}` : t.team_name}
              </option>
            ))}
          </select>
        </td>
      );
    }

    // Lider - dropdown com leaders
    if (col === 'lider' && isEditing && canEditCol) {
      return (
        <td key={col}>
          <select
            className="area-pf-inline-select"
            defaultValue={row._project_manager_id || ''}
            autoFocus
            onChange={(e) => {
              const selectedId = e.target.value;
              const selectedName = editOptions?.leaders?.find(l => String(l.id) === String(selectedId))?.name;
              updatePortfolioField(code, col, selectedId || null, row._project_manager_id, selectedName || '');
            }}
            onBlur={() => setEditingCell(null)}
            onKeyDown={(e) => e.key === 'Escape' && setEditingCell(null)}
          >
            <option value="">Sem lider</option>
            {editOptions?.leaders?.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </td>
      );
    }

    // Comercial name - input texto
    if (col === 'comercial_name' && isEditing && canEditCol) {
      return (
        <td key={col}>
          <input
            type="text"
            className="area-pf-inline-input"
            defaultValue={val || ''}
            autoFocus
            onBlur={(e) => {
              const newVal = e.target.value.trim();
              if (newVal !== (val || '')) {
                updatePortfolioField(code, col, newVal, val);
              } else {
                setEditingCell(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.target.blur();
              if (e.key === 'Escape') setEditingCell(null);
            }}
          />
        </td>
      );
    }

    // Celula editavel em modo visualizacao
    if (canEditCol) {
      return (
        <td key={col} className={justSaved ? 'area-pf-just-saved' : ''}>
          <span
            className={`area-pf-editable-cell${cellError ? ' area-pf-has-error' : ''}`}
            onClick={() => setEditingCell({ projectCode: code, field: col })}
            title="Clique para editar"
          >
            {val || <span style={{ color: '#c0c0c0' }}>-</span>}
            {justSaved && <span className="area-pf-save-check">&#10003;</span>}
          </span>
          {cellError && <span className="area-pf-error-tooltip">{cellError.message}</span>}
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
