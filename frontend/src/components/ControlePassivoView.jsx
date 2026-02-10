/**
 * Componente: Controle Passivo (Admin & Financeiro)
 *
 * Tabela de projetos com dados financeiros consolidados:
 * valor contratado, receita recebida, datas e prazos.
 * Filtros por status, cliente.
 * Botao para copiar dados para area de transferencia (formato planilha).
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { getStatusColor } from './StatusDropdown';
import { isFinalizedStatus, isPausedStatus } from '../utils/portfolio-utils';
import '../styles/ControlePassivoView.css';

// Colunas da tabela com label e tipo (headers iguais à planilha)
const COLUMNS = [
  { key: 'project_code_norm', label: 'Código Projeto', type: 'text' },
  { key: 'project_name', label: 'Projeto', type: 'text' },
  { key: 'client', label: 'Cliente', type: 'text' },
  { key: 'valor_contratado', label: 'Valor Contrato com aditivo', type: 'currency' },
  { key: 'receita_recebida', label: 'Receita Recebida', type: 'currency' },
  { key: 'data_inicio_cronograma', label: 'Data Início operação', type: 'date' },
  { key: 'duracao_total_meses', label: 'Prazo contrato com aditivos', type: 'number' },
  { key: 'meses_ativos', label: 'Meses Ativos', type: 'number' },
  { key: 'status', label: 'Status', type: 'text' },
];

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return '-';
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return '-';
  try {
    const d = new Date(value.value || value);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('pt-BR');
  } catch {
    return '-';
  }
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return '-';
  return num % 1 === 0
    ? num.toLocaleString('pt-BR')
    : num.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

function formatCell(value, type) {
  if (type === 'currency') return formatCurrency(value);
  if (type === 'date') return formatDate(value);
  if (type === 'number') return formatNumber(value);
  if (value === null || value === undefined) return '-';
  return String(value);
}

function formatCellPlain(value, type) {
  if (type === 'currency') {
    if (value === null || value === undefined || value === '') return '';
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return '';
    return num.toFixed(2).replace('.', ',');
  }
  if (type === 'date') return formatDate(value);
  if (type === 'number') {
    if (value === null || value === undefined || value === '') return '';
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return '';
    return num % 1 === 0 ? String(num) : num.toFixed(2).replace('.', ',');
  }
  if (value === null || value === undefined) return '';
  return String(value);
}

function ControlePassivoView() {
  // Data state
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState([]);
  const [clientFilter, setClientFilter] = useState([]);
  const [showFinalizedProjects, setShowFinalizedProjects] = useState(false);
  const [showPausedProjects, setShowPausedProjects] = useState(true);

  // Dropdown open states
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);

  // Sort
  const [sortConfig, setSortConfig] = useState({ key: 'project_code_norm', direction: 'asc' });

  // Copy feedback
  const [copyFeedback, setCopyFeedback] = useState('');

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_URL}/api/controle-passivo`, { withCredentials: true });
      if (res.data?.success) {
        setData(res.data.data || []);
      } else {
        setError('Erro ao buscar dados');
      }
    } catch (err) {
      console.error('Erro ao buscar controle passivo:', err);
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
      if (!event.target.closest('.cp-multi-select-wrapper')) {
        setStatusDropdownOpen(false);
        setClientDropdownOpen(false);
      }
    };
    if (statusDropdownOpen || clientDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [statusDropdownOpen, clientDropdownOpen]);

  // Unique values for filters
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

  // Filtered + sorted data
  const filteredData = useMemo(() => {
    let filtered = [...data];

    if (!showFinalizedProjects) {
      filtered = filtered.filter(row => !isFinalizedStatus(row.status));
    }
    if (!showPausedProjects) {
      filtered = filtered.filter(row => !isPausedStatus(row.status));
    }
    if (statusFilter.length > 0) {
      filtered = filtered.filter(row => statusFilter.includes(String(row.status || '')));
    }
    if (clientFilter.length > 0) {
      filtered = filtered.filter(row => clientFilter.includes(String(row.client || '')));
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
  }, [data, searchTerm, statusFilter, clientFilter, sortConfig, showFinalizedProjects, showPausedProjects]);

  // Totals
  const totals = useMemo(() => {
    const t = {
      valor_contratado: 0,
      receita_recebida: 0,
    };
    filteredData.forEach(row => {
      t.valor_contratado += Number(row.valor_contratado) || 0;
      t.receita_recebida += Number(row.receita_recebida) || 0;
    });
    return t;
  }, [filteredData]);

  // Sort handler
  const handleSort = (columnKey) => {
    setSortConfig(prev => ({
      key: columnKey,
      direction: prev.key === columnKey && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Copy to clipboard (TSV format for spreadsheet paste)
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

  // Clear filters
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter([]);
    setClientFilter([]);
    setShowFinalizedProjects(false);
    setShowPausedProjects(true);
    setSortConfig({ key: 'project_code_norm', direction: 'asc' });
  };

  // Multi-select dropdown helper
  const renderMultiSelect = (label, options, selected, setSelected, isOpen, setIsOpen, closeOthers) => (
    <div className="cp-multi-select-wrapper">
      <button
        type="button"
        className="cp-multi-select-button"
        onClick={() => {
          closeOthers();
          setIsOpen(!isOpen);
        }}
      >
        <span>
          {selected.length === 0
            ? label
            : selected.length === 1
              ? selected[0]
              : `${selected.length} selecionados`}
        </span>
        <span className="cp-dropdown-arrow">{isOpen ? '\u25B2' : '\u25BC'}</span>
      </button>
      {isOpen && (
        <div className="cp-multi-select-dropdown">
          <div className="cp-multi-select-header">
            <label className="cp-select-all">
              <input
                type="checkbox"
                checked={selected.length === options.length && options.length > 0}
                onChange={() => {
                  if (selected.length === options.length) setSelected([]);
                  else setSelected([...options]);
                }}
              />
              <span>Selecionar Todos</span>
            </label>
          </div>
          <div className="cp-multi-select-options">
            {options.map(opt => (
              <label key={opt} className="cp-multi-select-option">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => {
                    if (selected.includes(opt)) setSelected(selected.filter(s => s !== opt));
                    else setSelected([...selected, opt]);
                  }}
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Loading / Error / Empty
  if (loading) {
    return (
      <div className="cp-container">
        <div className="cp-loading">Carregando dados do controle passivo...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cp-container">
        <div className="cp-error">
          <h2>Erro ao carregar dados</h2>
          <p>{error}</p>
          <button onClick={fetchData} className="cp-btn cp-btn-primary">Tentar novamente</button>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="cp-container">
        <div className="cp-empty">
          <h2>Nenhum dado disponivel</h2>
          <button onClick={fetchData} className="cp-btn cp-btn-primary">Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cp-container">
      {/* Header */}
      <div className="cp-header">
        <div>
          <h2>Controle Passivo</h2>
          <p className="cp-subtitle">Valores contratados vs receita recebida por projeto</p>
        </div>
        <div className="cp-header-actions">
          <button onClick={handleCopy} className="cp-btn cp-btn-copy" title="Copiar tabela para area de transferencia (formato planilha)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {copyFeedback || 'Copiar Tabela'}
          </button>
          <button onClick={fetchData} className="cp-btn cp-btn-primary">Atualizar</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="cp-kpis">
        <div className="cp-kpi-card">
          <span className="cp-kpi-label">Valor Contratado</span>
          <span className="cp-kpi-value">{formatCurrency(totals.valor_contratado)}</span>
        </div>
        <div className="cp-kpi-card">
          <span className="cp-kpi-label">Receita Recebida</span>
          <span className="cp-kpi-value cp-kpi-green">{formatCurrency(totals.receita_recebida)}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="cp-filters-sticky">
        <div className="cp-filters-row">
          {/* Search */}
          <div className="cp-search-bar">
            <input
              type="text"
              placeholder="Buscar em todas as colunas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="cp-search-input"
            />
          </div>

          {/* Toggle finalizados */}
          <label className="cp-toggle">
            <input
              type="checkbox"
              checked={showFinalizedProjects}
              onChange={(e) => setShowFinalizedProjects(e.target.checked)}
            />
            <span className="cp-toggle-slider"></span>
            <span className="cp-toggle-label">Finalizados</span>
          </label>

          {/* Toggle pausados */}
          <label className="cp-toggle">
            <input
              type="checkbox"
              checked={showPausedProjects}
              onChange={(e) => setShowPausedProjects(e.target.checked)}
            />
            <span className="cp-toggle-slider"></span>
            <span className="cp-toggle-label">Pausados</span>
          </label>
        </div>

        <div className="cp-filters-dropdowns">
          {renderMultiSelect('Todos os Status', uniqueStatuses, statusFilter, setStatusFilter, statusDropdownOpen, setStatusDropdownOpen, () => { setClientDropdownOpen(false); })}
          {renderMultiSelect('Todos os Clientes', uniqueClients, clientFilter, setClientFilter, clientDropdownOpen, setClientDropdownOpen, () => { setStatusDropdownOpen(false); })}
        </div>

        {/* Active filter chips */}
        {(searchTerm || statusFilter.length > 0 || clientFilter.length > 0) && (
          <div className="cp-active-filters">
            {searchTerm && (
              <span className="cp-filter-chip">
                Busca: "{searchTerm}"
                <button onClick={() => setSearchTerm('')}>x</button>
              </span>
            )}
            {statusFilter.map(s => (
              <span key={s} className="cp-filter-chip">
                Status: {s}
                <button onClick={() => setStatusFilter(prev => prev.filter(x => x !== s))}>x</button>
              </span>
            ))}
            {clientFilter.map(c => (
              <span key={c} className="cp-filter-chip">
                Cliente: {c}
                <button onClick={() => setClientFilter(prev => prev.filter(x => x !== c))}>x</button>
              </span>
            ))}
            <button className="cp-clear-btn" onClick={clearFilters}>Limpar filtros</button>
          </div>
        )}
      </div>

      {/* Results info */}
      <div className="cp-results-info">
        <span>Mostrando {filteredData.length} de {data.length} projetos</span>
      </div>

      {/* Table */}
      <div className="cp-table-wrapper">
        <div className="cp-table-scroll">
          <table className="cp-table">
            <thead>
              <tr>
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={col.type === 'currency' || col.type === 'number' ? 'th-numeric' : ''}
                  >
                    <div className="cp-th-content">
                      <span>{col.label}</span>
                      {sortConfig.key === col.key && (
                        <span className="cp-sort-indicator">
                          {sortConfig.direction === 'asc' ? ' \u25B2' : ' \u25BC'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, idx) => (
                <tr key={idx}>
                  {COLUMNS.map(col => {
                    const value = row[col.key];
                    let cellClass = '';
                    if (col.type === 'currency') cellClass = 'cell-currency';
                    else if (col.type === 'number') cellClass = 'cell-number';
                    else if (col.type === 'date') cellClass = 'cell-date';

                    // Special rendering for status
                    if (col.key === 'status') {
                      const statusColor = getStatusColor(value);
                      return (
                        <td key={col.key} className="cell-status">
                          <span
                            className="cp-status-badge"
                            style={{
                              backgroundColor: `${statusColor}15`,
                              color: statusColor,
                            }}
                          >
                            <span className="cp-status-dot" style={{ backgroundColor: statusColor }} />
                            {value || '-'}
                          </span>
                        </td>
                      );
                    }

                    return (
                      <td key={col.key} className={cellClass}>
                        {formatCell(value, col.type)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {/* Totals row */}
            <tfoot>
              <tr className="cp-totals-row">
                {COLUMNS.map(col => {
                  if (col.key === 'project_code_norm') {
                    return <td key={col.key} className="cp-totals-label">TOTAL ({filteredData.length})</td>;
                  }
                  if (totals.hasOwnProperty(col.key)) {
                    return (
                      <td key={col.key} className="cell-currency" style={{ fontWeight: 700 }}>
                        {formatCurrency(totals[col.key])}
                      </td>
                    );
                  }
                  return <td key={col.key}></td>;
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ControlePassivoView;
