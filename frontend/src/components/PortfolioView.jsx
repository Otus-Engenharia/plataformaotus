/**
 * Componente: Vista do Portfolio - Tabela de Projetos
 *
 * Tabela profissional com 3 vistas diferentes e filtros
 * KPIs e analytics foram movidos para IndicadoresView
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import {
  VIEWS,
  CONTRACT_INFO_COLUMNS,
  DATE_COLUMNS,
  COLUMN_WIDTHS,
  getColumnLabel,
  detectColumnType,
  formatValue,
  calculateMonthDifference,
  getDifferenceStatus,
  isFinalizedStatus,
  isPausedStatus,
  isAIniciarStatus
} from '../utils/portfolio-utils';
import '../styles/PortfolioView.css';
import StatusDropdown, { getStatusColor } from './StatusDropdown';

// Colunas editaveis (apenas na vista 'info')
const EDITABLE_COLUMNS = ['comercial_name', 'status', 'client', 'nome_time', 'lider'];

function PortfolioView() {
  const { isPrivileged, hasFullAccess } = useAuth();
  const {
    data,
    loading,
    error,
    fetchPortfolioData,
    timeFilter,
    setTimeFilter,
    liderFilter,
    setLiderFilter,
    uniqueTimes,
    uniqueLiders,
    // Edicao inline
    editingCell,
    setEditingCell,
    editOptions,
    fetchEditOptions,
    updatePortfolioField,
    savedCell,
    errorCell
  } = usePortfolio();

  // Estados locais para a tabela
  const [activeView, setActiveView] = useState('info');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState([]);
  const [clientFilter, setClientFilter] = useState([]);
  const [differenceFilter, setDifferenceFilter] = useState([]);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [timeDropdownOpen, setTimeDropdownOpen] = useState(false);
  const [liderDropdownOpen, setLiderDropdownOpen] = useState(false);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [differenceDropdownOpen, setDifferenceDropdownOpen] = useState(false);
  const [showFinalizedProjects, setShowFinalizedProjects] = useState(false);
  const [showPausedProjects, setShowPausedProjects] = useState(true);
  const [showAIniciar, setShowAIniciar] = useState(false);
  const [showNoTeam, setShowNoTeam] = useState(false);
  const [showNoLeader, setShowNoLeader] = useState(false);
  const [showContractInfoColumns, setShowContractInfoColumns] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'project_order', direction: 'asc' });

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.multi-select-wrapper')) {
        setStatusDropdownOpen(false);
        setTimeDropdownOpen(false);
        setLiderDropdownOpen(false);
        setClientDropdownOpen(false);
        setDifferenceDropdownOpen(false);
      }
    };

    if (statusDropdownOpen || timeDropdownOpen || liderDropdownOpen || clientDropdownOpen || differenceDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [statusDropdownOpen, timeDropdownOpen, liderDropdownOpen, clientDropdownOpen, differenceDropdownOpen]);

  // Busca opcoes de edicao se usuario tem acesso total
  useEffect(() => {
    if (hasFullAccess && !editOptions) {
      fetchEditOptions();
    }
  }, [hasFullAccess, editOptions, fetchEditOptions]);

  // Detecta e organiza as colunas baseado na vista ativa
  const columns = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return [];

    try {
      const firstRow = data[0];
      if (!firstRow || typeof firstRow !== 'object') return [];

      const viewColumns = VIEWS[activeView].columns;
      const orderedColumns = [];

      viewColumns.forEach(key => {
        if (key === 'diferenca_cronograma_contrato') {
          orderedColumns.push({
            key: key,
            label: getColumnLabel(key),
            type: 'difference',
            isNumeric: true,
            isCalculated: true,
            width: COLUMN_WIDTHS[key] || 100
          });
        } else if (firstRow.hasOwnProperty(key)) {
          let columnType;
          if (DATE_COLUMNS.includes(key?.toLowerCase())) {
            columnType = 'date';
          } else {
            columnType = detectColumnType(firstRow[key], key);
          }

          orderedColumns.push({
            key: key,
            label: getColumnLabel(key),
            type: columnType,
            isNumeric: columnType === 'number' || columnType === 'currency',
            width: COLUMN_WIDTHS[key] || null
          });
        }
      });

      if (activeView === 'prazos' && !showContractInfoColumns) {
        return orderedColumns.filter(col => !CONTRACT_INFO_COLUMNS.includes(col.key));
      }

      return orderedColumns;
    } catch (err) {
      console.error('Erro ao processar colunas:', err);
      return [];
    }
  }, [data, activeView, showContractInfoColumns]);

  // Valores unicos para filtros
  const uniqueStatuses = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    const statuses = new Set();
    data.forEach(row => {
      if (row.status) statuses.add(row.status);
    });
    return Array.from(statuses).sort();
  }, [data]);

  const uniqueClients = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    const clients = new Set();
    data.forEach(row => {
      if (row.client) clients.add(row.client);
    });
    return Array.from(clients).sort();
  }, [data]);

  // Contagens para toggles
  const finalizedCount = useMemo(() => {
    if (!data || !Array.isArray(data)) return 0;
    return data.filter(row => row && isFinalizedStatus(row.status)).length;
  }, [data]);

  const pausedCount = useMemo(() => {
    if (!data || !Array.isArray(data)) return 0;
    return data.filter(row => row && isPausedStatus(row.status)).length;
  }, [data]);

  const aIniciarCount = useMemo(() => {
    if (!data || !Array.isArray(data)) return 0;
    return data.filter(row => row && isAIniciarStatus(row.status)).length;
  }, [data]);

  // Contagens para toggles "Sem Time" e "Sem Lider"
  const noTeamCount = useMemo(() => {
    if (!data || !Array.isArray(data)) return 0;
    return data.filter(row => {
      if (!row || typeof row !== 'object') return false;
      if (!showFinalizedProjects && isFinalizedStatus(row.status)) return false;
      if (!showPausedProjects && isPausedStatus(row.status)) return false;
      if (!showAIniciar && isAIniciarStatus(row.status)) return false;
      return !row.nome_time || row.nome_time === '-';
    }).length;
  }, [data, showFinalizedProjects, showPausedProjects, showAIniciar]);

  const noLeaderCount = useMemo(() => {
    if (!data || !Array.isArray(data)) return 0;
    return data.filter(row => {
      if (!row || typeof row !== 'object') return false;
      if (!showFinalizedProjects && isFinalizedStatus(row.status)) return false;
      if (!showPausedProjects && isPausedStatus(row.status)) return false;
      if (!showAIniciar && isAIniciarStatus(row.status)) return false;
      return !row.lider || row.lider === '-';
    }).length;
  }, [data, showFinalizedProjects, showPausedProjects, showAIniciar]);

  // Verifica se coluna e editavel
  const isEditableColumn = (columnKey) => {
    return activeView === 'info' && hasFullAccess && EDITABLE_COLUMNS.includes(columnKey);
  };

  // Renderiza celula (editavel ou normal)
  const renderCell = (row, col) => {
    const value = row[col.key];
    const projectCode = row.project_code_norm;
    const isEditing = editingCell?.projectCode === projectCode && editingCell?.field === col.key;
    const canEdit = isEditableColumn(col.key);

    // Status SEMPRE renderiza como badge colorido (edit on/off, admin/non-admin)
    if (col.key === 'status' && activeView === 'info') {
      if (isEditing && canEdit) {
        return (
          <StatusDropdown
            value={value}
            onChange={(newValue) => {
              updatePortfolioField(projectCode, col.key, newValue, value);
              setEditingCell(null);
            }}
            inline
            defaultOpen
          />
        );
      }
      const statusColor = getStatusColor(value);
      const justSaved = savedCell?.projectCode === projectCode && savedCell?.field === col.key;
      const cellError = errorCell?.projectCode === projectCode && errorCell?.field === col.key ? errorCell : null;
      return (
        <span
          className={`status-cell${canEdit ? ' editable-cell' : ''}${justSaved ? ' just-saved' : ''}${cellError ? ' has-error' : ''}`}
          onClick={canEdit ? () => setEditingCell({ projectCode, field: col.key }) : undefined}
          title={canEdit ? 'Clique para editar' : undefined}
        >
          <span
            className="status-badge-inline"
            style={{
              backgroundColor: `${statusColor}15`,
              color: statusColor,
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: statusColor
            }} />
            {value || '-'}
          </span>
          {justSaved && <span className="save-check">&#10003;</span>}
          {cellError && <span className="inline-error-tooltip">{cellError.message}</span>}
        </span>
      );
    }

    // Demais campos: check editavel normalmente
    if (!canEdit) {
      return formatValue(value, col.type);
    }

    // Se esta editando esta celula
    if (isEditing) {
      // Dropdown para client (companies)
      if (col.key === 'client') {
        return (
          <select
            className="inline-select"
            defaultValue={row._company_id || ''}
            autoFocus
            onChange={(e) => {
              const selectedId = e.target.value;
              const selectedName = editOptions?.companies?.find(c => String(c.id) === String(selectedId))?.name;
              updatePortfolioField(projectCode, col.key, selectedId || null, row._company_id, selectedName || '');
            }}
            onBlur={() => setEditingCell(null)}
            onKeyDown={(e) => e.key === 'Escape' && setEditingCell(null)}
          >
            <option value="">Selecionar...</option>
            {editOptions?.companies?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        );
      }

      // Dropdown para nome_time (teams)
      if (col.key === 'nome_time') {
        return (
          <select
            className="inline-select"
            defaultValue={row._team_id || ''}
            autoFocus
            onChange={(e) => {
              const selectedId = e.target.value;
              const team = editOptions?.teams?.find(t => String(t.id) === String(selectedId));
              const selectedName = team?.team_name || '';
              updatePortfolioField(projectCode, col.key, selectedId || null, row._team_id, selectedName);
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
        );
      }

      // Dropdown para lider (users)
      if (col.key === 'lider') {
        return (
          <select
            className="inline-select"
            defaultValue={row._project_manager_id || ''}
            autoFocus
            onChange={(e) => {
              const selectedId = e.target.value;
              const selectedName = editOptions?.leaders?.find(l => String(l.id) === String(selectedId))?.name;
              updatePortfolioField(projectCode, col.key, selectedId || null, row._project_manager_id, selectedName || '');
            }}
            onBlur={() => setEditingCell(null)}
            onKeyDown={(e) => e.key === 'Escape' && setEditingCell(null)}
          >
            <option value="">Sem lider</option>
            {editOptions?.leaders?.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        );
      }

      // Input texto para comercial_name
      return (
        <input
          type="text"
          className="inline-input"
          defaultValue={value || ''}
          autoFocus
          onBlur={(e) => {
            const newVal = e.target.value.trim();
            if (newVal !== (value || '')) {
              updatePortfolioField(projectCode, col.key, newVal, value);
            } else {
              setEditingCell(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.target.blur();
            if (e.key === 'Escape') setEditingCell(null);
          }}
        />
      );
    }

    // Feedback states
    const justSaved = savedCell?.projectCode === projectCode && savedCell?.field === col.key;
    const cellError = errorCell?.projectCode === projectCode && errorCell?.field === col.key ? errorCell : null;

    // Celula clicavel (modo visualizacao)
    return (
      <span
        className={`editable-cell${justSaved ? ' just-saved' : ''}${cellError ? ' has-error' : ''}`}
        onClick={() => setEditingCell({ projectCode, field: col.key })}
        title="Clique para editar"
      >
        {formatValue(value, col.type) || <span className="placeholder-text">-</span>}
        {justSaved && <span className="save-check">&#10003;</span>}
        {cellError && <span className="inline-error-tooltip">{cellError.message}</span>}
      </span>
    );
  };

  // Dados filtrados
  const filteredData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    // Calcula diferenca e adiciona como propriedade
    let filtered = data.map(row => {
      if (!row || typeof row !== 'object') return row;

      const terminoCronograma = row.data_termino_cronograma;
      const terminoContrato = row.data_termino_contrato_com_pausas || row.data_termino_contrato;

      const difference = calculateMonthDifference(terminoCronograma, terminoContrato);
      const differenceStatus = getDifferenceStatus(difference);

      return {
        ...row,
        diferenca_cronograma_contrato: difference,
        diferenca_cronograma_contrato_status: differenceStatus
      };
    });

    // Filtro por projetos finalizados
    if (!showFinalizedProjects) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        return !isFinalizedStatus(row.status);
      });
    }

    // Filtro por projetos pausados
    if (!showPausedProjects) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        return !isPausedStatus(row.status);
      });
    }

    // Filtro por projetos a iniciar
    if (!showAIniciar) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        return !isAIniciarStatus(row.status);
      });
    }

    // Filtro por projetos sem time
    if (showNoTeam) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        return !row.nome_time || row.nome_time === '-';
      });
    }

    // Filtro por projetos sem lider
    if (showNoLeader) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        return !row.lider || row.lider === '-';
      });
    }

    // Filtro por Status
    if (statusFilter && statusFilter.length > 0) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        return statusFilter.includes(String(row.status || ''));
      });
    }

    // Filtro por Time
    if (timeFilter && timeFilter.length > 0) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        return timeFilter.includes(String(row.nome_time || ''));
      });
    }

    // Filtro por Lider
    if (liderFilter && liderFilter.length > 0) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        return liderFilter.includes(String(row.lider || ''));
      });
    }

    // Filtro por Cliente
    if (clientFilter && clientFilter.length > 0) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        return clientFilter.includes(String(row.client || ''));
      });
    }

    // Filtro por Diferenca
    if (differenceFilter && differenceFilter.length > 0) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        const status = row.diferenca_cronograma_contrato_status || 'unknown';
        return differenceFilter.includes(status);
      });
    }

    // Busca global
    if (searchTerm && searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        return Object.values(row).some(value =>
          value !== null && value !== undefined &&
          String(value).toLowerCase().includes(term)
        );
      });
    }

    // Ordenacao
    const sortKey = sortConfig.key || 'project_order';
    const sortDirection = sortConfig.direction || 'asc';

    filtered.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;

      if (sortKey === 'project_code_norm') {
        comparison = String(aVal).localeCompare(String(bVal), 'pt-BR', { numeric: true, sensitivity: 'base' });
      } else if (sortKey === 'project_order' ||
                 typeof aVal === 'number' ||
                 typeof bVal === 'number' ||
                 (!isNaN(Number(aVal)) && !isNaN(Number(bVal)) && aVal !== '' && bVal !== '')) {
        const numA = typeof aVal === 'number' ? aVal : Number(aVal);
        const numB = typeof bVal === 'number' ? bVal : Number(bVal);

        if (isNaN(numA) || isNaN(numB)) {
          comparison = String(aVal).localeCompare(String(bVal), 'pt-BR', { numeric: true, sensitivity: 'base' });
        } else {
          comparison = numA - numB;
        }
      } else {
        comparison = String(aVal).localeCompare(String(bVal), 'pt-BR', { numeric: true, sensitivity: 'base' });
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [data, searchTerm, statusFilter, timeFilter, liderFilter, clientFilter, differenceFilter, sortConfig, showFinalizedProjects, showPausedProjects, showAIniciar, showNoTeam, showNoLeader]);

  // Handlers
  const handleSort = (columnKey) => {
    setSortConfig(prev => ({
      key: columnKey,
      direction: prev.key === columnKey && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter([]);
    setTimeFilter([]);
    setLiderFilter([]);
    setClientFilter([]);
    setDifferenceFilter([]);
    setShowFinalizedProjects(false);
    setShowPausedProjects(true);
    setSortConfig({ key: 'project_order', direction: 'asc' });
  };

  const handleStatusToggle = (status) => {
    setStatusFilter(prev => {
      if (prev.includes(status)) {
        return prev.filter(s => s !== status);
      } else {
        return [...prev, status];
      }
    });
  };

  const handleTimeToggle = (time) => {
    setTimeFilter(prev => {
      if (prev.includes(time)) {
        return prev.filter(t => t !== time);
      } else {
        return [...prev, time];
      }
    });
  };

  const handleLiderToggle = (lider) => {
    setLiderFilter(prev => {
      if (prev.includes(lider)) {
        return prev.filter(l => l !== lider);
      } else {
        return [...prev, lider];
      }
    });
  };

  const handleSelectAllLider = () => {
    if (liderFilter.length === uniqueLiders.length) {
      setLiderFilter([]);
    } else {
      setLiderFilter([...uniqueLiders]);
    }
  };

  const handleSelectAllStatus = () => {
    if (statusFilter.length === uniqueStatuses.length) {
      setStatusFilter([]);
    } else {
      setStatusFilter([...uniqueStatuses]);
    }
  };

  const handleSelectAllTime = () => {
    if (timeFilter.length === uniqueTimes.length) {
      setTimeFilter([]);
    } else {
      setTimeFilter([...uniqueTimes]);
    }
  };

  const handleClientToggle = (client) => {
    setClientFilter(prev => {
      if (prev.includes(client)) {
        return prev.filter(c => c !== client);
      } else {
        return [...prev, client];
      }
    });
  };

  const handleSelectAllClient = () => {
    if (clientFilter.length === uniqueClients.length) {
      setClientFilter([]);
    } else {
      setClientFilter([...uniqueClients]);
    }
  };

  const differenceOptions = [
    { value: 'green', label: 'Verde (OK)' },
    { value: 'yellow', label: 'Amarelo (1-2 meses)' },
    { value: 'red', label: 'Vermelho (3+ meses)' }
  ];

  const handleDifferenceToggle = (status) => {
    setDifferenceFilter(prev => {
      if (prev.includes(status)) {
        return prev.filter(s => s !== status);
      } else {
        return [...prev, status];
      }
    });
  };

  const handleSelectAllDifference = () => {
    if (differenceFilter.length === differenceOptions.length) {
      setDifferenceFilter([]);
    } else {
      setDifferenceFilter(differenceOptions.map(opt => opt.value));
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="portfolio-container">
        <div className="loading">
          <p>Carregando dados do portfolio...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="portfolio-container">
        <div className="error">
          <h2>Erro ao carregar dados</h2>
          <p>{error}</p>
          <button onClick={fetchPortfolioData} className="retry-button">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // No data state
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="portfolio-container">
        <div className="no-data">
          <h2>Nenhum dado disponivel</h2>
          <p>Nao ha dados para exibir no momento.</p>
          <button onClick={fetchPortfolioData} className="retry-button">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // No columns state
  if (columns.length === 0) {
    return (
      <div className="portfolio-container">
        <div className="no-data">
          <h2>Estrutura de dados nao identificada</h2>
          <p>Os dados retornados nao tem uma estrutura valida.</p>
          <button onClick={fetchPortfolioData} className="retry-button">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="portfolio-container">
      {/* Cabecalho */}
      <div className="header">
        <h2>Detalhamento dos Projetos</h2>
        <div className="header-actions">
          <button onClick={fetchPortfolioData} className="refresh-button">
            Atualizar
          </button>
        </div>
      </div>

      {/* Filtros Principais - Sticky no topo */}
      <div className="top-filters-sticky">
        <div className="top-filters-container">
          <div className="top-filters-label">Filtros Principais:</div>
          <div className="top-filters-dropdowns">
            {/* Filtro de Time */}
            <div className="multi-select-wrapper">
              <button
                type="button"
                className="multi-select-button"
                onClick={() => {
                  setTimeDropdownOpen(!timeDropdownOpen);
                  setLiderDropdownOpen(false);
                  setStatusDropdownOpen(false);
                  setClientDropdownOpen(false);
                  setDifferenceDropdownOpen(false);
                }}
              >
                <span>
                  {timeFilter.length === 0
                    ? 'Todos os Times'
                    : timeFilter.length === 1
                      ? timeFilter[0]
                      : `${timeFilter.length} Times selecionados`}
                </span>
                <span className="dropdown-arrow">{timeDropdownOpen ? '\u25B2' : '\u25BC'}</span>
              </button>
              {timeDropdownOpen && (
                <div className="multi-select-dropdown">
                  <div className="multi-select-header">
                    <label className="select-all-checkbox">
                      <input
                        type="checkbox"
                        checked={timeFilter.length === uniqueTimes.length && uniqueTimes.length > 0}
                        onChange={handleSelectAllTime}
                      />
                      <span>Selecionar Todos</span>
                    </label>
                  </div>
                  <div className="multi-select-options">
                    {uniqueTimes.map(time => (
                      <label key={time} className="multi-select-option">
                        <input
                          type="checkbox"
                          checked={timeFilter.includes(time)}
                          onChange={() => handleTimeToggle(time)}
                        />
                        <span>{time}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Filtro de Lider - apenas para diretora/admin/ceo */}
            {hasFullAccess && (
              <div className="multi-select-wrapper">
                <button
                  type="button"
                  className="multi-select-button"
                  onClick={() => {
                    setLiderDropdownOpen(!liderDropdownOpen);
                    setTimeDropdownOpen(false);
                    setStatusDropdownOpen(false);
                    setClientDropdownOpen(false);
                    setDifferenceDropdownOpen(false);
                  }}
                >
                  <span>
                    {liderFilter.length === 0
                      ? 'Todos os Lideres'
                      : liderFilter.length === 1
                        ? liderFilter[0]
                        : `${liderFilter.length} Lideres selecionados`}
                  </span>
                  <span className="dropdown-arrow">{liderDropdownOpen ? '\u25B2' : '\u25BC'}</span>
                </button>
                {liderDropdownOpen && (
                  <div className="multi-select-dropdown">
                    <div className="multi-select-header">
                      <label className="select-all-checkbox">
                        <input
                          type="checkbox"
                          checked={liderFilter.length === uniqueLiders.length && uniqueLiders.length > 0}
                          onChange={handleSelectAllLider}
                        />
                        <span>Selecionar Todos</span>
                      </label>
                    </div>
                    <div className="multi-select-options">
                      {uniqueLiders.map(lider => (
                        <label key={lider} className="multi-select-option">
                          <input
                            type="checkbox"
                            checked={liderFilter.includes(lider)}
                            onChange={() => handleLiderToggle(lider)}
                          />
                          <span>{lider}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DETALHAMENTO - Tabela */}
      <div className="detail-section">
        <div className="detail-header">
          <h3 className="detail-title">Analise Detalhada</h3>
          <p className="detail-subtitle">Filtre e navegue pelos projetos</p>
        </div>

        {/* Botoes de Vista */}
        <div className="view-selector">
          {Object.values(VIEWS).map(view => (
            <button
              key={view.id}
              className={`view-button ${activeView === view.id ? 'active' : ''}`}
              onClick={() => {
                setActiveView(view.id);
                          }}
            >
              {view.name}
            </button>
          ))}

          {/* Botao para colapsar/expandir colunas de info de contrato */}
          {activeView === 'prazos' && (
            <button
              className={`contract-info-toggle ${showContractInfoColumns ? 'expanded' : ''}`}
              onClick={() => setShowContractInfoColumns(!showContractInfoColumns)}
            >
              <span className="toggle-icon">{showContractInfoColumns ? '\u25BC' : '\u25B6'}</span>
              <span className="toggle-text">Info Contrato</span>
            </button>
          )}

        </div>

        {/* Filtros da Tabela */}
        <div className="filters-section">
          <div className="filters-row">
            {/* Toggle para projetos finalizados */}
            <div className="finalized-toggle-wrapper">
              <label className="finalized-toggle">
                <input
                  type="checkbox"
                  checked={showFinalizedProjects}
                  onChange={(e) => {
                    setShowFinalizedProjects(e.target.checked);
                                  }}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-label">Mostrar Finalizados <span className="toggle-count">{finalizedCount}</span></span>
              </label>
            </div>

            {/* Toggle para projetos pausados */}
            <div className="finalized-toggle-wrapper">
              <label className="finalized-toggle">
                <input
                  type="checkbox"
                  checked={showPausedProjects}
                  onChange={(e) => {
                    setShowPausedProjects(e.target.checked);
                                  }}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-label">Mostrar Pausados <span className="toggle-count">{pausedCount}</span></span>
              </label>
            </div>

            {/* Toggle para projetos a iniciar */}
            <div className="finalized-toggle-wrapper">
              <label className="finalized-toggle">
                <input
                  type="checkbox"
                  checked={showAIniciar}
                  onChange={(e) => setShowAIniciar(e.target.checked)}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-label">Mostrar A Iniciar <span className="toggle-count">{aIniciarCount}</span></span>
              </label>
            </div>

            {/* Toggle para projetos sem time */}
            <div className="finalized-toggle-wrapper">
              <label className="finalized-toggle">
                <input
                  type="checkbox"
                  checked={showNoTeam}
                  onChange={(e) => setShowNoTeam(e.target.checked)}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-label">Sem Time <span className="toggle-count">{noTeamCount}</span></span>
              </label>
            </div>

            {/* Toggle para projetos sem lider */}
            <div className="finalized-toggle-wrapper">
              <label className="finalized-toggle">
                <input
                  type="checkbox"
                  checked={showNoLeader}
                  onChange={(e) => setShowNoLeader(e.target.checked)}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-label">Sem Lider <span className="toggle-count">{noLeaderCount}</span></span>
              </label>
            </div>

            {/* Busca */}
            <div className="search-bar">
              <input
                type="text"
                placeholder="Buscar em todas as colunas..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                              }}
                className="search-input"
              />
            </div>
          </div>

          <div className="filter-dropdowns">
            {/* Filtro de Status */}
            <div className="multi-select-wrapper">
              <button
                type="button"
                className="multi-select-button"
                onClick={() => {
                  setStatusDropdownOpen(!statusDropdownOpen);
                  setTimeDropdownOpen(false);
                  setLiderDropdownOpen(false);
                  setClientDropdownOpen(false);
                  setDifferenceDropdownOpen(false);
                }}
              >
                <span>
                  {statusFilter.length === 0
                    ? 'Todos os Status'
                    : statusFilter.length === 1
                      ? statusFilter[0]
                      : `${statusFilter.length} Status selecionados`}
                </span>
                <span className="dropdown-arrow">{statusDropdownOpen ? '\u25B2' : '\u25BC'}</span>
              </button>
              {statusDropdownOpen && (
                <div className="multi-select-dropdown">
                  <div className="multi-select-header">
                    <label className="select-all-checkbox">
                      <input
                        type="checkbox"
                        checked={statusFilter.length === uniqueStatuses.length && uniqueStatuses.length > 0}
                        onChange={handleSelectAllStatus}
                      />
                      <span>Selecionar Todos</span>
                    </label>
                  </div>
                  <div className="multi-select-options">
                    {uniqueStatuses.map(status => (
                      <label key={status} className="multi-select-option">
                        <input
                          type="checkbox"
                          checked={statusFilter.includes(status)}
                          onChange={() => handleStatusToggle(status)}
                        />
                        <span>{status}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Filtro de Cliente */}
            <div className="multi-select-wrapper">
              <button
                type="button"
                className="multi-select-button"
                onClick={() => {
                  setClientDropdownOpen(!clientDropdownOpen);
                  setStatusDropdownOpen(false);
                  setTimeDropdownOpen(false);
                  setLiderDropdownOpen(false);
                  setDifferenceDropdownOpen(false);
                }}
              >
                <span>
                  {clientFilter.length === 0
                    ? 'Todos os Clientes'
                    : clientFilter.length === 1
                      ? clientFilter[0]
                      : `${clientFilter.length} Clientes selecionados`}
                </span>
                <span className="dropdown-arrow">{clientDropdownOpen ? '\u25B2' : '\u25BC'}</span>
              </button>
              {clientDropdownOpen && (
                <div className="multi-select-dropdown">
                  <div className="multi-select-header">
                    <label className="select-all-checkbox">
                      <input
                        type="checkbox"
                        checked={clientFilter.length === uniqueClients.length && uniqueClients.length > 0}
                        onChange={handleSelectAllClient}
                      />
                      <span>Selecionar Todos</span>
                    </label>
                  </div>
                  <div className="multi-select-options">
                    {uniqueClients.map(client => (
                      <label key={client} className="multi-select-option">
                        <input
                          type="checkbox"
                          checked={clientFilter.includes(client)}
                          onChange={() => handleClientToggle(client)}
                        />
                        <span>{client}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Filtro de Diferenca - apenas na vista de prazos */}
            {activeView === 'prazos' && (
              <div className="multi-select-wrapper">
                <button
                  type="button"
                  className="multi-select-button"
                  onClick={() => {
                    setDifferenceDropdownOpen(!differenceDropdownOpen);
                    setStatusDropdownOpen(false);
                    setTimeDropdownOpen(false);
                    setLiderDropdownOpen(false);
                    setClientDropdownOpen(false);
                  }}
                >
                  <span>
                    {differenceFilter.length === 0
                      ? 'Todas as Diferencas'
                      : `${differenceFilter.length} selecionados`}
                  </span>
                  <span className="dropdown-arrow">{differenceDropdownOpen ? '\u25B2' : '\u25BC'}</span>
                </button>
                {differenceDropdownOpen && (
                  <div className="multi-select-dropdown">
                    <div className="multi-select-header">
                      <label className="select-all-checkbox">
                        <input
                          type="checkbox"
                          checked={differenceFilter.length === differenceOptions.length}
                          onChange={handleSelectAllDifference}
                        />
                        <span>Selecionar Todos</span>
                      </label>
                    </div>
                    <div className="multi-select-options">
                      {differenceOptions.map(opt => (
                        <label key={opt.value} className="multi-select-option">
                          <input
                            type="checkbox"
                            checked={differenceFilter.includes(opt.value)}
                            onChange={() => handleDifferenceToggle(opt.value)}
                          />
                          <span className={`difference-indicator difference-${opt.value}`}></span>
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Chips de filtros ativos */}
          {(searchTerm || statusFilter.length > 0 || clientFilter.length > 0 || timeFilter.length > 0 || liderFilter.length > 0) && (
            <div className="active-filters-bar">
              {searchTerm && (
                <span className="filter-chip">
                  Busca: "{searchTerm}"
                  <button onClick={() => setSearchTerm('')} title="Remover filtro">x</button>
                </span>
              )}
              {statusFilter.map(s => (
                <span key={s} className="filter-chip">
                  Status: {s}
                  <button onClick={() => setStatusFilter(prev => prev.filter(x => x !== s))} title="Remover filtro">x</button>
                </span>
              ))}
              {clientFilter.map(c => (
                <span key={c} className="filter-chip">
                  Cliente: {c}
                  <button onClick={() => setClientFilter(prev => prev.filter(x => x !== c))} title="Remover filtro">x</button>
                </span>
              ))}
              {timeFilter.map(t => (
                <span key={t} className="filter-chip">
                  Time: {t}
                  <button onClick={() => setTimeFilter(prev => prev.filter(x => x !== t))} title="Remover filtro">x</button>
                </span>
              ))}
              {liderFilter.map(l => (
                <span key={l} className="filter-chip">
                  Lider: {l}
                  <button onClick={() => setLiderFilter(prev => prev.filter(x => x !== l))} title="Remover filtro">x</button>
                </span>
              ))}
              <button
                className="clear-all-btn"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter([]);
                  setClientFilter([]);
                  setTimeFilter([]);
                  setLiderFilter([]);
                              }}
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>

        {/* Info dos resultados */}
        <div className="results-info">
          <span>Mostrando {filteredData.length} registros ({data.length} total)</span>
        </div>

        {/* Tabela */}
        <div className="table-wrapper">
          <div className="table-scroll-container">
            <table className="portfolio-table">
              <thead>
                <tr>
                  {columns.map((col, idx) => {
                    const isContractInfo = CONTRACT_INFO_COLUMNS.includes(col.key);
                    const isFirst = isContractInfo && idx > 0 && !CONTRACT_INFO_COLUMNS.includes(columns[idx - 1]?.key);
                    const isLast = isContractInfo && (idx === columns.length - 1 || !CONTRACT_INFO_COLUMNS.includes(columns[idx + 1]?.key));

                    const isPrimaryEdit = (col.key === 'comercial_name' || col.key === 'status') && activeView === 'info';
                    const isGroupStart = col.key === 'comercial_name' && activeView === 'info';

                    return (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className={`
                          ${col.isNumeric ? 'th-numeric' : ''}
                          ${isContractInfo ? 'contract-info-column' : ''}
                          ${isFirst ? 'contract-info-first' : ''}
                          ${isLast ? 'contract-info-last' : ''}
                          ${isGroupStart ? 'primary-group-start' : ''}
                          ${isPrimaryEdit ? 'primary-edit-column' : ''}
                          column-${col.key.replace(/_/g, '-')}
                        `}
                        style={col.width ? { width: col.width, minWidth: col.width, maxWidth: col.width } : {}}
                      >
                        <div className="th-content">
                          <span dangerouslySetInnerHTML={{ __html: col.label }}></span>
                          {sortConfig.key === col.key && (
                            <span className="sort-indicator">
                              {sortConfig.direction === 'asc' ? ' \u25B2' : ' \u25BC'}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {columns.map((col, colIdx) => {
                      const value = row[col.key];
                      const isContractInfo = CONTRACT_INFO_COLUMNS.includes(col.key);
                      const isFirst = isContractInfo && colIdx > 0 && !CONTRACT_INFO_COLUMNS.includes(columns[colIdx - 1]?.key);
                      const isLast = isContractInfo && (colIdx === columns.length - 1 || !CONTRACT_INFO_COLUMNS.includes(columns[colIdx + 1]?.key));

                      let cellClass = '';
                      if (col.type === 'number') cellClass = 'cell-number';
                      else if (col.type === 'currency') cellClass = 'cell-currency';
                      else if (col.type === 'date') cellClass = 'cell-date';
                      else if (col.type === 'boolean') cellClass = 'cell-boolean';
                      else if (col.type === 'difference') {
                        const status = row.diferenca_cronograma_contrato_status || 'unknown';
                        cellClass = `cell-difference-${status}`;
                      }

                      const isPrimaryEditCell = (col.key === 'comercial_name' || col.key === 'status') && activeView === 'info';

                      return (
                        <td
                          key={col.key}
                          className={`
                            ${cellClass}
                            ${isContractInfo ? 'contract-info-cell' : ''}
                            ${isFirst ? 'contract-info-cell-first' : ''}
                            ${isLast ? 'contract-info-cell-last' : ''}
                            ${isEditableColumn(col.key) ? 'editable-cell-td' : ''}
                            ${isEditableColumn(col.key) ? 'edit-mode-highlight' : ''}
                            ${isPrimaryEditCell ? 'primary-edit-cell' : ''}
                          `}
                        >
                          {renderCell(row, col)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

export default PortfolioView;
