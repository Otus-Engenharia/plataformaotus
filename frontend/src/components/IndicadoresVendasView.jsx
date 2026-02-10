/**
 * Componente: Indicadores de Vendas (Líderes de Projeto)
 *
 * Dashboard de indicadores de vendas por projeto:
 * custos, tickets, tempo e complexidade.
 * Dados: Supabase (portfolio) + BigQuery (custos agregados).
 * Filtros por gerente/líder, status, cliente.
 * Copiar dados para planilha (TSV).
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { getStatusColor } from './StatusDropdown';
import { isFinalizedStatus, isPausedStatus } from '../utils/portfolio-utils';
import '../styles/IndicadoresVendasView.css';

/* ─── Column Definitions ─── */
const COLUMNS = [
  { key: 'project_name',        label: 'Projeto',                  type: 'text' },
  { key: 'status',              label: 'Status',                   type: 'status' },
  { key: 'area_efetiva',        label: 'Área Efetiva',             type: 'number' },
  { key: 'custo_total',         label: 'Custo Total',              type: 'currency' },
  { key: 'meses_com_custo',     label: 'Meses com Custo',          type: 'number' },
  { key: 'custo_mensal',        label: 'Custo Mensal',             type: 'currency' },
  { key: 'ticket_vendas',       label: 'Ticket de Vendas (GER)',   type: 'currency' },
  { key: 'tempo_total_projeto', label: 'Tempo Total (meses)',      type: 'number' },
  { key: 'ticket_por_mes',      label: '*ticket/mes',              type: 'currency' },
  { key: 'complexidade',        label: 'Complexidade',             type: 'number' },
];

/* ─── Formatting Utilities ─── */
function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '–';
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return '–';
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '–';
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return '–';
  return num % 1 === 0
    ? num.toLocaleString('pt-BR')
    : num.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

function formatCell(value, type) {
  if (type === 'currency') return formatCurrency(value);
  if (type === 'number') return formatNumber(value);
  if (value === null || value === undefined) return '–';
  return String(value);
}

function formatCellPlain(value, type) {
  if (type === 'currency') {
    if (value === null || value === undefined || value === '') return '';
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return '';
    return num.toFixed(2).replace('.', ',');
  }
  if (type === 'number') {
    if (value === null || value === undefined || value === '') return '';
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return '';
    return num % 1 === 0 ? String(num) : num.toFixed(2).replace('.', ',');
  }
  if (value === null || value === undefined) return '';
  return String(value);
}

/* ─── Multi-Select Dropdown ─── */
function MultiSelectDropdown({ label, options, selected, setSelected, isOpen, setIsOpen, closeOthers }) {
  const toggleOption = (opt) => {
    setSelected(prev =>
      prev.includes(opt) ? prev.filter(s => s !== opt) : [...prev, opt]
    );
  };

  const toggleAll = () => {
    setSelected(prev =>
      prev.length === options.length ? [] : [...options]
    );
  };

  return (
    <div className="iv-multi-select-wrapper">
      <button
        type="button"
        className="iv-multi-select-button"
        onClick={() => { closeOthers(); setIsOpen(!isOpen); }}
      >
        <span>
          {selected.length === 0
            ? label
            : selected.length === 1
              ? selected[0]
              : `${selected.length} selecionados`}
        </span>
        <span className="iv-dropdown-arrow">{isOpen ? '\u25B2' : '\u25BC'}</span>
      </button>
      {isOpen && (
        <div className="iv-multi-select-dropdown">
          <div className="iv-multi-select-header">
            <label className="iv-select-all">
              <input
                type="checkbox"
                checked={selected.length === options.length && options.length > 0}
                onChange={toggleAll}
              />
              Todos
            </label>
          </div>
          <div className="iv-multi-select-options">
            {options.map(opt => (
              <label key={opt} className="iv-multi-select-option">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggleOption(opt)}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Dual-Handle Range Slider ─── */
function RangeSlider({ min, max, valueMin, valueMax, onChangeMin, onChangeMax }) {
  const trackRef = useRef(null);

  const range = max - min || 1;
  const pctMin = ((valueMin - min) / range) * 100;
  const pctMax = ((valueMax - min) / range) * 100;

  const getValueFromPointer = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(min + pct * range);
  };

  const handlePointerDown = (which, e) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      const val = getValueFromPointer(ev.clientX);
      if (which === 'min') {
        onChangeMin(Math.min(val, valueMax));
      } else {
        onChangeMax(Math.max(val, valueMin));
      }
    };

    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  };

  const handleTrackClick = (e) => {
    if (e.target !== trackRef.current && !e.target.classList.contains('iv-slider-fill')) return;
    const val = getValueFromPointer(e.clientX);
    const distToMin = Math.abs(val - valueMin);
    const distToMax = Math.abs(val - valueMax);
    if (distToMin <= distToMax) {
      onChangeMin(Math.min(val, valueMax));
    } else {
      onChangeMax(Math.max(val, valueMin));
    }
  };

  return (
    <div
      className="iv-slider-track"
      ref={trackRef}
      onClick={handleTrackClick}
    >
      <div
        className="iv-slider-fill"
        style={{ left: `${pctMin}%`, width: `${pctMax - pctMin}%` }}
      />
      <div
        className="iv-slider-handle"
        style={{ left: `${pctMin}%` }}
        onPointerDown={(e) => handlePointerDown('min', e)}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={valueMin}
        tabIndex={0}
      />
      <div
        className="iv-slider-handle"
        style={{ left: `${pctMax}%` }}
        onPointerDown={(e) => handlePointerDown('max', e)}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={valueMax}
        tabIndex={0}
      />
    </div>
  );
}

/* ─── Main Component ─── */
function IndicadoresVendasView() {
  // Data state
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [liderFilter, setLiderFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState([]);
  const [clientFilter, setClientFilter] = useState([]);
  const [showFinalizedProjects, setShowFinalizedProjects] = useState(false);
  const [showPausedProjects, setShowPausedProjects] = useState(true);
  const [areaMin, setAreaMin] = useState('');
  const [areaMax, setAreaMax] = useState('');

  // Dropdown open states
  const [liderDropdownOpen, setLiderDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);

  // Sort
  const [sortConfig, setSortConfig] = useState({ key: 'custo_total', direction: 'desc' });

  // Copy feedback
  const [copyFeedback, setCopyFeedback] = useState('');

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_URL}/api/indicadores-vendas`, { withCredentials: true });
      if (res.data?.success) {
        setData(res.data.data || []);
      } else {
        setError('Erro ao buscar dados');
      }
    } catch (err) {
      console.error('Erro ao buscar indicadores de vendas:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.iv-multi-select-wrapper')) {
        setLiderDropdownOpen(false);
        setStatusDropdownOpen(false);
        setClientDropdownOpen(false);
      }
    };
    if (liderDropdownOpen || statusDropdownOpen || clientDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [liderDropdownOpen, statusDropdownOpen, clientDropdownOpen]);

  // Unique values for filters
  const uniqueLiders = useMemo(() => {
    const s = new Set();
    data.forEach(row => { if (row.lider) s.add(row.lider); });
    return Array.from(s).sort();
  }, [data]);

  const uniqueStatuses = useMemo(() => {
    const s = new Set();
    data.forEach(row => { if (row.status) s.add(row.status); });
    return Array.from(s).sort();
  }, [data]);

  const uniqueClients = useMemo(() => {
    const s = new Set();
    data.forEach(row => { if (row.client) s.add(row.client); });
    return Array.from(s).sort();
  }, [data]);

  // Limites de área efetiva (para referência no filtro)
  const areaBounds = useMemo(() => {
    const areas = data
      .map(r => Number(r.area_efetiva))
      .filter(v => !isNaN(v) && v > 0);
    if (areas.length === 0) return { min: 0, max: 0 };
    return { min: Math.floor(Math.min(...areas)), max: Math.ceil(Math.max(...areas)) };
  }, [data]);

  // Filtered + sorted data
  const filteredData = useMemo(() => {
    let filtered = [...data];

    if (!showFinalizedProjects) {
      filtered = filtered.filter(row => !isFinalizedStatus(row.status));
    }
    if (!showPausedProjects) {
      filtered = filtered.filter(row => !isPausedStatus(row.status));
    }
    if (liderFilter.length > 0) {
      filtered = filtered.filter(row => liderFilter.includes(String(row.lider || '')));
    }
    if (statusFilter.length > 0) {
      filtered = filtered.filter(row => statusFilter.includes(String(row.status || '')));
    }
    if (clientFilter.length > 0) {
      filtered = filtered.filter(row => clientFilter.includes(String(row.client || '')));
    }
    // Filtro de área efetiva (range)
    const areaMinNum = areaMin !== '' ? parseFloat(areaMin) : null;
    const areaMaxNum = areaMax !== '' ? parseFloat(areaMax) : null;
    if (areaMinNum !== null || areaMaxNum !== null) {
      filtered = filtered.filter(row => {
        const area = Number(row.area_efetiva);
        if (isNaN(area) || row.area_efetiva == null) return false;
        if (areaMinNum !== null && area < areaMinNum) return false;
        if (areaMaxNum !== null && area > areaMaxNum) return false;
        return true;
      });
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(row =>
        Object.values(row).some(v =>
          v !== null && v !== undefined && String(v).toLowerCase().includes(term)
        )
      );
    }

    // Sort
    const { key, direction } = sortConfig;
    filtered.sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let cmp = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal), 'pt-BR', { numeric: true, sensitivity: 'base' });
      }
      return direction === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [data, searchTerm, liderFilter, statusFilter, clientFilter, sortConfig, showFinalizedProjects, showPausedProjects, areaMin, areaMax]);

  // KPIs
  const kpis = useMemo(() => {
    const count = filteredData.length;
    const custoTotal = filteredData.reduce((s, r) => s + (Number(r.custo_total) || 0), 0);
    const ticketTotal = filteredData.reduce((s, r) => s + (Number(r.ticket_vendas) || 0), 0);
    const tempoTotal = filteredData.reduce((s, r) => s + (Number(r.tempo_total_projeto) || 0), 0);
    const ticketMedioMes = tempoTotal > 0 ? ticketTotal / tempoTotal : 0;
    return { count, custoTotal, ticketTotal, ticketMedioMes };
  }, [filteredData]);

  // Totals row
  const totals = useMemo(() => {
    const areaTotal = filteredData.reduce((s, r) => s + (Number(r.area_efetiva) || 0), 0);
    const custoTotal = filteredData.reduce((s, r) => s + (Number(r.custo_total) || 0), 0);
    const mesesTotal = filteredData.reduce((s, r) => s + (Number(r.meses_com_custo) || 0), 0);
    const ticketTotal = filteredData.reduce((s, r) => s + (Number(r.ticket_vendas) || 0), 0);
    const tempoTotal = filteredData.reduce((s, r) => s + (Number(r.tempo_total_projeto) || 0), 0);
    const complexidadeTotal = filteredData.reduce((s, r) => s + (Number(r.complexidade) || 0), 0);

    return {
      area_efetiva: areaTotal,
      custo_total: custoTotal,
      meses_com_custo: mesesTotal,
      custo_mensal: mesesTotal > 0 ? custoTotal / mesesTotal : 0,
      ticket_vendas: ticketTotal,
      tempo_total_projeto: tempoTotal,
      ticket_por_mes: tempoTotal > 0 ? ticketTotal / tempoTotal : 0,
      complexidade: complexidadeTotal,
    };
  }, [filteredData]);

  // Sort handler
  const handleSort = (columnKey) => {
    setSortConfig(prev => ({
      key: columnKey,
      direction: prev.key === columnKey && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Copy to clipboard (TSV format)
  const handleCopy = async () => {
    const header = COLUMNS.map(col => col.label).join('\t');
    const rows = filteredData.map(row =>
      COLUMNS.map(col => formatCellPlain(row[col.key], col.type)).join('\t')
    );
    const tsv = [header, ...rows].join('\n');

    try {
      await navigator.clipboard.writeText(tsv);
      setCopyFeedback('Copiado!');
      setTimeout(() => setCopyFeedback(''), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = tsv;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopyFeedback('Copiado!');
      setTimeout(() => setCopyFeedback(''), 2500);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setLiderFilter([]);
    setStatusFilter([]);
    setClientFilter([]);
    setAreaMin('');
    setAreaMax('');
    setShowFinalizedProjects(false);
    setShowPausedProjects(true);
    setSortConfig({ key: 'custo_total', direction: 'desc' });
  };

  const hasAreaFilter = areaMin !== '' || areaMax !== '';
  const activeFiltersCount = liderFilter.length + statusFilter.length + clientFilter.length + (hasAreaFilter ? 1 : 0);

  // Render cell with status dot for project_name and status column
  const renderCell = (row, col) => {
    if (col.key === 'project_name') {
      const statusColor = getStatusColor(row.status);
      const dotColor = typeof statusColor === 'string'
        ? statusColor
        : statusColor?.bg || statusColor?.color || '#d4d4d4';
      return (
        <div className="iv-project-cell">
          <span className="iv-status-dot" style={{ background: dotColor }} />
          <span>{row.project_name || '–'}</span>
        </div>
      );
    }
    if (col.key === 'status') {
      return row.status || '–';
    }
    return formatCell(row[col.key], col.type);
  };

  // Cell class
  const cellClass = (col) => {
    if (col.type === 'currency') return 'iv-cell-currency';
    if (col.type === 'number') return 'iv-cell-number';
    return '';
  };

  // --- States ---
  if (loading) {
    return (
      <div className="iv-container">
        <div className="iv-loading">
          <div className="iv-spinner" />
          <span>Carregando indicadores de vendas...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="iv-container">
        <div className="iv-error">
          <h2>Erro ao carregar dados</h2>
          <p>{error}</p>
          <button className="iv-btn iv-btn-primary" onClick={fetchData}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="iv-container">
        <div className="iv-empty">
          <h2>Sem dados disponíveis</h2>
          <p>Não foram encontrados registros de indicadores de vendas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="iv-container">
      {/* ─── Header ─── */}
      <div className="iv-header">
        <div>
          <h2>Indicadores de Vendas</h2>
          <p className="iv-subtitle">Análise de custos, tickets e performance por projeto</p>
        </div>
        <div className="iv-header-actions">
          <button
            className={`iv-btn iv-btn-copy ${copyFeedback ? 'iv-btn-success' : ''}`}
            onClick={handleCopy}
          >
            {copyFeedback || '⎘ Copiar tabela'}
          </button>
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="iv-kpis">
        <div className="iv-kpi-card">
          <span className="iv-kpi-label">Custo Total</span>
          <span className="iv-kpi-value">{formatCurrency(kpis.custoTotal)}</span>
        </div>
        <div className="iv-kpi-card">
          <span className="iv-kpi-label">Ticket Total</span>
          <span className="iv-kpi-value iv-kpi-green">{formatCurrency(kpis.ticketTotal)}</span>
        </div>
        <div className="iv-kpi-card">
          <span className="iv-kpi-label">Ticket Médio / Mês</span>
          <span className="iv-kpi-value">{formatCurrency(kpis.ticketMedioMes)}</span>
        </div>
        <div className="iv-kpi-card">
          <span className="iv-kpi-label">Projetos</span>
          <span className="iv-kpi-value iv-kpi-amber">{kpis.count}</span>
        </div>
      </div>

      {/* ─── Filters ─── */}
      <div className="iv-filters-sticky">
        <div className="iv-filters-row">
          <div className="iv-search-bar">
            <input
              type="text"
              className="iv-search-input"
              placeholder="Buscar em todas as colunas..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <label className="iv-toggle">
            <input
              type="checkbox"
              checked={showFinalizedProjects}
              onChange={e => setShowFinalizedProjects(e.target.checked)}
            />
            <span className="iv-toggle-slider" />
            <span className="iv-toggle-label">Mostrar Finalizados</span>
          </label>
          <label className="iv-toggle">
            <input
              type="checkbox"
              checked={showPausedProjects}
              onChange={e => setShowPausedProjects(e.target.checked)}
            />
            <span className="iv-toggle-slider" />
            <span className="iv-toggle-label">Mostrar Pausados</span>
          </label>
        </div>

        <div className="iv-filters-dropdowns">
          <MultiSelectDropdown
            label="Todos os Gerentes"
            options={uniqueLiders}
            selected={liderFilter}
            setSelected={setLiderFilter}
            isOpen={liderDropdownOpen}
            setIsOpen={setLiderDropdownOpen}
            closeOthers={() => { setStatusDropdownOpen(false); setClientDropdownOpen(false); }}
          />
          <MultiSelectDropdown
            label="Todos os Status"
            options={uniqueStatuses}
            selected={statusFilter}
            setSelected={setStatusFilter}
            isOpen={statusDropdownOpen}
            setIsOpen={setStatusDropdownOpen}
            closeOthers={() => { setLiderDropdownOpen(false); setClientDropdownOpen(false); }}
          />
          <MultiSelectDropdown
            label="Todos os Clientes"
            options={uniqueClients}
            selected={clientFilter}
            setSelected={setClientFilter}
            isOpen={clientDropdownOpen}
            setIsOpen={setClientDropdownOpen}
            closeOthers={() => { setLiderDropdownOpen(false); setStatusDropdownOpen(false); }}
          />

          {/* Range filter - Área Efetiva (dual-handle slider) */}
          {areaBounds.max > 0 && (
            <div className="iv-range-filter">
              <span className="iv-range-label">Área Efetiva (m²)</span>
              <RangeSlider
                min={areaBounds.min}
                max={areaBounds.max}
                valueMin={areaMin !== '' ? Math.max(parseFloat(areaMin), areaBounds.min) : areaBounds.min}
                valueMax={areaMax !== '' ? Math.min(parseFloat(areaMax), areaBounds.max) : areaBounds.max}
                onChangeMin={v => setAreaMin(v <= areaBounds.min ? '' : String(v))}
                onChangeMax={v => setAreaMax(v >= areaBounds.max ? '' : String(v))}
              />
              <div className="iv-range-inputs">
                <input
                  type="number"
                  className="iv-range-input"
                  placeholder={formatNumber(areaBounds.min)}
                  value={areaMin}
                  onChange={e => setAreaMin(e.target.value)}
                  min={areaBounds.min}
                  max={areaBounds.max}
                />
                <span className="iv-range-separator">—</span>
                <input
                  type="number"
                  className="iv-range-input"
                  placeholder={formatNumber(areaBounds.max)}
                  value={areaMax}
                  onChange={e => setAreaMax(e.target.value)}
                  min={areaBounds.min}
                  max={areaBounds.max}
                />
              </div>
            </div>
          )}
        </div>

        {(activeFiltersCount > 0 || searchTerm) && (
          <div className="iv-active-filters">
            {liderFilter.map(f => (
              <span key={`l-${f}`} className="iv-filter-chip">
                {f}
                <button onClick={() => setLiderFilter(prev => prev.filter(x => x !== f))}>×</button>
              </span>
            ))}
            {statusFilter.map(f => (
              <span key={`s-${f}`} className="iv-filter-chip">
                {f}
                <button onClick={() => setStatusFilter(prev => prev.filter(x => x !== f))}>×</button>
              </span>
            ))}
            {clientFilter.map(f => (
              <span key={`c-${f}`} className="iv-filter-chip">
                {f}
                <button onClick={() => setClientFilter(prev => prev.filter(x => x !== f))}>×</button>
              </span>
            ))}
            {hasAreaFilter && (
              <span className="iv-filter-chip">
                Área: {areaMin || '0'} – {areaMax || '∞'} m²
                <button onClick={() => { setAreaMin(''); setAreaMax(''); }}>×</button>
              </span>
            )}
            <button className="iv-clear-btn" onClick={clearFilters}>Limpar filtros</button>
          </div>
        )}
      </div>

      {/* ─── Results Info ─── */}
      <div className="iv-results-info">
        Mostrando {filteredData.length} registros ({data.length} total)
      </div>

      {/* ─── Table ─── */}
      <div className="iv-table-wrapper">
        <div className="iv-table-scroll">
          <table className="iv-table">
            <thead>
              <tr>
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    className={col.type !== 'text' ? 'th-numeric' : ''}
                    onClick={() => handleSort(col.key)}
                  >
                    <div className="iv-th-content">
                      <span>{col.label}</span>
                      {sortConfig.key === col.key && (
                        <span className="iv-sort-indicator">
                          {sortConfig.direction === 'asc' ? '\u25B2' : '\u25BC'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, i) => (
                <tr key={`${row.project_code_norm}-${i}`}>
                  {COLUMNS.map(col => (
                    <td key={col.key} className={cellClass(col)}>
                      {renderCell(row, col)}
                    </td>
                  ))}
                </tr>
              ))}
              {filteredData.length > 0 && (
                <tr className="iv-totals-row">
                  <td className="iv-totals-label">Total</td>
                  {COLUMNS.slice(1).map(col => (
                    <td key={`total-${col.key}`} className={cellClass(col)}>
                      {totals[col.key] != null
                        ? formatCell(totals[col.key], col.type)
                        : '–'}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default IndicadoresVendasView;
