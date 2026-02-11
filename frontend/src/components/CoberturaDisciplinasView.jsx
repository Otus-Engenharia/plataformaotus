/**
 * Componente: Vista de Cobertura de Disciplinas (Portfolio)
 *
 * Tabela-resumo mostrando cobertura de disciplinas de todos os projetos.
 * Permite expandir cada projeto para ver o DisciplineCoveragePanel detalhado.
 * Usa o endpoint batch POST /api/portfolio/cobertura-disciplinas.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { usePortfolio } from '../contexts/PortfolioContext';
import { isFinalizedStatus, isPausedStatus } from '../utils/portfolio-utils';
import { getStatusColor } from './StatusDropdown';
import '../styles/CoberturaDisciplinasView.css';

const isNotStartedStatus = (status) => {
  if (!status || typeof status !== 'string') return false;
  const s = status.toLowerCase().trim();
  return s.includes('a iniciar') || s === 'planejamento';
};

const SortIcon = ({ active, direction }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={active ? '#1a1a1a' : '#c4c4c4'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    {direction === 'asc' ? (
      <polyline points="18 15 12 9 6 15" />
    ) : (
      <polyline points="6 9 12 15 18 9" />
    )}
  </svg>
);

function CoberturaDisciplinasView() {
  const { dataForKPIs, loading: portfolioLoading } = usePortfolio();

  const [coverageData, setCoverageData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'completionPercentage', direction: 'asc' });

  // Filtros de status
  const [hideFinalizedProjects, setHideFinalizedProjects] = useState(true);
  const [hidePausedProjects, setHidePausedProjects] = useState(true);
  const [hideNotStartedProjects, setHideNotStartedProjects] = useState(true);

  // Filtra portfolio por status antes de montar a lista
  const filteredPortfolio = useMemo(() => {
    if (!dataForKPIs || !Array.isArray(dataForKPIs)) return [];
    return dataForKPIs.filter(p => {
      if (hideFinalizedProjects && isFinalizedStatus(p.status)) return false;
      if (hidePausedProjects && isPausedStatus(p.status)) return false;
      if (hideNotStartedProjects && isNotStartedStatus(p.status)) return false;
      return true;
    });
  }, [dataForKPIs, hideFinalizedProjects, hidePausedProjects, hideNotStartedProjects]);

  // Monta lista de projetos a partir do portfolio filtrado
  const projectList = useMemo(() => {
    return filteredPortfolio.map(p => ({
      construflowId: p.construflow_id ? String(p.construflow_id) : null,
      smartsheetId: p.smartsheet_id ? String(p.smartsheet_id) : null,
      projectName: p.project_name || p.project_code_norm || '',
      projectCode: p.project_code_norm || '',
      lider: p.lider || '',
      nomeTime: p.nome_time || '',
      status: p.status || ''
    }));
  }, [filteredPortfolio]);

  // Chave estavel para detectar mudancas na lista
  const projectListKey = useMemo(() => {
    return projectList.map(p => p.projectCode).sort().join(',');
  }, [projectList]);

  // Fetch batch coverage
  const fetchCoverage = useCallback(async () => {
    if (projectList.length === 0) {
      setCoverageData([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(
        `${API_URL}/api/portfolio/cobertura-disciplinas`,
        { projects: projectList },
        { withCredentials: true }
      );
      if (response.data?.success) {
        setCoverageData(response.data.data || []);
      } else {
        setError(response.data?.error || 'Erro ao buscar cobertura');
      }
    } catch (err) {
      console.error('Erro ao buscar cobertura de disciplinas:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [projectListKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchCoverage();
  }, [fetchCoverage]);

  // Sorting
  const sortedData = useMemo(() => {
    if (!coverageData || coverageData.length === 0) return [];
    const sorted = [...coverageData];
    sorted.sort((a, b) => {
      let aVal, bVal;
      switch (sortConfig.key) {
        case 'completionPercentage':
          aVal = a.analysis?.completionPercentage ?? 0;
          bVal = b.analysis?.completionPercentage ?? 0;
          break;
        case 'totalUnique':
          aVal = a.analysis?.totalUnique ?? 0;
          bVal = b.analysis?.totalUnique ?? 0;
          break;
        case 'completeInAll3':
          aVal = a.analysis?.completeInAll3 ?? 0;
          bVal = b.analysis?.completeInAll3 ?? 0;
          break;
        case 'pendingCount':
          aVal = a.analysis?.pendingCount ?? 0;
          bVal = b.analysis?.pendingCount ?? 0;
          break;
        default:
          aVal = a[sortConfig.key] || '';
          bVal = b[sortConfig.key] || '';
      }
      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal, 'pt-BR')
          : bVal.localeCompare(aVal, 'pt-BR');
      }
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [coverageData, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Contagem de projetos por status (do portfolio total com construflow_id)
  const statusCounts = useMemo(() => {
    if (!dataForKPIs || !Array.isArray(dataForKPIs)) return { finalized: 0, paused: 0, notStarted: 0 };
    const withCf = dataForKPIs.filter(p => p.construflow_id);
    return {
      finalized: withCf.filter(p => isFinalizedStatus(p.status)).length,
      paused: withCf.filter(p => isPausedStatus(p.status)).length,
      notStarted: withCf.filter(p => isNotStartedStatus(p.status)).length
    };
  }, [dataForKPIs]);

  // Totais
  const totals = useMemo(() => {
    if (!coverageData || coverageData.length === 0) return { projects: 0, avgCoverage: 0, totalComplete: 0, totalPending: 0 };
    const projects = coverageData.length;
    const totalComplete = coverageData.reduce((sum, p) => sum + (p.analysis?.completeInAll3 ?? 0), 0);
    const totalPending = coverageData.reduce((sum, p) => sum + (p.analysis?.pendingCount ?? 0), 0);
    const avgCoverage = coverageData.reduce((sum, p) => sum + (p.analysis?.completionPercentage ?? 0), 0) / projects;
    return { projects, avgCoverage: Math.round(avgCoverage * 10) / 10, totalComplete, totalPending };
  }, [coverageData]);

  const getCoverageBadgeClass = (pct) => {
    if (pct >= 80) return 'cobertura-badge--green';
    if (pct >= 40) return 'cobertura-badge--yellow';
    return 'cobertura-badge--red';
  };

  // Columns config
  const columns = [
    { key: 'projectName', label: 'Projeto', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'lider', label: 'Lider', sortable: true },
    { key: 'nomeTime', label: 'Time', sortable: true },
    { key: 'completionPercentage', label: 'Cobertura', sortable: true },
    { key: 'totalUnique', label: 'Total', sortable: true },
    { key: 'completeInAll3', label: 'Completo', sortable: true },
    { key: 'pendingCount', label: 'Pendentes', sortable: true }
  ];

  if (portfolioLoading) {
    return (
      <div className="cobertura-container">
        <div className="cobertura-loading">
          <div className="cobertura-loading-spinner" />
          <span>Carregando portfolio...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="cobertura-container">
      {/* KPI Cards resumo */}
      <div className="cobertura-summary">
        <div className="cobertura-summary-card">
          <div className="cobertura-summary-value">{totals.projects}</div>
          <div className="cobertura-summary-label">Projetos Analisados</div>
        </div>
        <div className="cobertura-summary-card">
          <div className={`cobertura-summary-value ${getCoverageBadgeClass(totals.avgCoverage)}`}>
            {totals.avgCoverage}%
          </div>
          <div className="cobertura-summary-label">Cobertura Media</div>
        </div>
        <div className="cobertura-summary-card">
          <div className="cobertura-summary-value" style={{ color: '#15803d' }}>{totals.totalComplete}</div>
          <div className="cobertura-summary-label">Disciplinas Completas</div>
        </div>
        <div className="cobertura-summary-card">
          <div className="cobertura-summary-value" style={{ color: '#dc2626' }}>{totals.totalPending}</div>
          <div className="cobertura-summary-label">Disciplinas Pendentes</div>
        </div>
      </div>

      {/* Filtros de status */}
      <div className="cobertura-filters">
        <label className="cobertura-filter-toggle" title="Ocultar projetos com status finalizado, encerrado, cancelado, etc.">
          <input
            type="checkbox"
            checked={hideFinalizedProjects}
            onChange={() => setHideFinalizedProjects(v => !v)}
          />
          <span className="cobertura-filter-slider" />
          <span className="cobertura-filter-label">Ocultar Finalizados ({statusCounts.finalized})</span>
        </label>
        <label className="cobertura-filter-toggle" title="Ocultar projetos com status de pausa">
          <input
            type="checkbox"
            checked={hidePausedProjects}
            onChange={() => setHidePausedProjects(v => !v)}
          />
          <span className="cobertura-filter-slider" />
          <span className="cobertura-filter-label">Ocultar Pausados ({statusCounts.paused})</span>
        </label>
        <label className="cobertura-filter-toggle" title="Ocultar projetos com status 'a iniciar' ou 'planejamento'">
          <input
            type="checkbox"
            checked={hideNotStartedProjects}
            onChange={() => setHideNotStartedProjects(v => !v)}
          />
          <span className="cobertura-filter-slider" />
          <span className="cobertura-filter-label">Ocultar Nao Iniciados ({statusCounts.notStarted})</span>
        </label>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="cobertura-loading">
          <div className="cobertura-loading-spinner" />
          <span>Calculando cobertura de disciplinas de {projectList.length} projetos...</span>
        </div>
      ) : error ? (
        <div className="cobertura-error">
          <p>Erro ao carregar cobertura: {error}</p>
          <button onClick={fetchCoverage} className="cobertura-retry">Tentar novamente</button>
        </div>
      ) : sortedData.length === 0 ? (
        <div className="cobertura-empty">
          <p>Nenhum projeto com ConstruFlow ID encontrado no portfolio filtrado.</p>
        </div>
      ) : (
        <div className="cobertura-table-wrapper">
          <table className="cobertura-table">
            <thead>
              <tr>
                {columns.map(col => (
                  <th
                    key={col.key}
                    className={`cobertura-th ${col.sortable ? 'cobertura-th--sortable' : ''} ${sortConfig.key === col.key ? 'cobertura-th--active' : ''}`}
                    onClick={() => col.sortable && handleSort(col.key)}
                    title={col.sortable ? `Ordenar por ${col.label}` : undefined}
                  >
                    <span>{col.label}</span>
                    {col.sortable && (
                      <SortIcon active={sortConfig.key === col.key} direction={sortConfig.key === col.key ? sortConfig.direction : 'asc'} />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedData.map(item => {
                const pct = item.analysis?.completionPercentage ?? 0;
                return (
                  <tr key={item.construflowId || item.projectCode} className="cobertura-row">
                    <td className="cobertura-td-name" title={item.projectName}>
                      {item.projectName || item.projectCode}
                    </td>
                    <td className="cobertura-td-status">
                      <span
                        className="cobertura-status-pill"
                        style={{ background: getStatusColor(item.status), color: '#fff' }}
                      >
                        {item.status || '—'}
                      </span>
                    </td>
                    <td className="cobertura-td-text">{item.lider}</td>
                    <td className="cobertura-td-text">{item.nomeTime}</td>
                    <td className="cobertura-td-coverage">
                      <span className={`cobertura-badge ${getCoverageBadgeClass(pct)}`}>
                        {pct}%
                      </span>
                      <div className="cobertura-bar">
                        <div
                          className={`cobertura-bar-fill ${getCoverageBadgeClass(pct)}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="cobertura-td-num">{item.analysis?.totalUnique ?? 0}</td>
                    <td className="cobertura-td-num cobertura-td-num--green">{item.analysis?.completeInAll3 ?? 0}</td>
                    <td className="cobertura-td-num cobertura-td-num--red">{item.analysis?.pendingCount ?? 0}</td>
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

export default CoberturaDisciplinasView;
