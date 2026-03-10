import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import ParcelasProjetoPanel from './ParcelasProjetoPanel';
import CronogramaFisicoFinanceiroPanel from './CronogramaFisicoFinanceiroPanel';
import './PagamentosLiderView.css';
import './PagamentosFinanceiroView.css';

const formatCurrency = (v) => {
  if (v == null) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
};

const formatDate = (d) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR');
};

const STATUS_GROUPS = {
  'Ativos': ['planejamento', 'fase 01', 'fase 02', 'fase 03', 'fase 04'],
  'A Iniciar': ['a iniciar'],
  'Pausados': ['pausado - f01', 'pausado - f02', 'pausado - f04'],
  'Finalizados': ['close', 'obra finalizada', 'churn pelo cliente', 'termo de encerramento'],
};

function getStatusGroup(status) {
  const s = (status || '').toLowerCase();
  for (const [group, statuses] of Object.entries(STATUS_GROUPS)) {
    if (statuses.includes(s)) return group;
  }
  return 'Outro';
}

function getStatusBadgeClass(status) {
  const group = getStatusGroup(status);
  switch (group) {
    case 'Ativos': return 'pagamentos-fin-badge-ativo';
    case 'A Iniciar': return 'pagamentos-fin-badge-iniciar';
    case 'Pausados': return 'pagamentos-fin-badge-pausado';
    case 'Finalizados': return 'pagamentos-fin-badge-fechado';
    default: return 'pagamentos-fin-badge-outro';
  }
}

function getVincClass(vinculadas, total) {
  if (total === 0) return '';
  if (vinculadas === total) return 'pagamentos-fin-vinc-full';
  if (vinculadas > 0) return 'pagamentos-fin-vinc-partial';
  return 'pagamentos-fin-vinc-none';
}

function getVincColor(vinculadas, total) {
  if (total === 0) return 'vinc-none';
  if (vinculadas === total) return 'vinc-full';
  if (vinculadas > 0) return 'vinc-partial';
  return 'vinc-none';
}

export default function PagamentosLiderView() {
  const { user, hasFullAccess, isAdmin, isDirector } = useAuth();
  const showLiderFilter = hasFullAccess || isAdmin || isDirector;
  const [highlightSince] = useState(() => {
    if (!user?.id) return null;
    return localStorage.getItem(`spots_last_seen_${user.id}`) || null;
  });

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedProject, setExpandedProject] = useState(null);
  const [filterBusca, setFilterBusca] = useState('');
  const [filterStatus, setFilterStatus] = useState({ Ativos: true, 'A Iniciar': false, Pausados: false, Finalizados: false });
  const [filterVinculacao, setFilterVinculacao] = useState({ sem: false, todas: false });
  const [ocultarFaturados, setOcultarFaturados] = useState(false);
  const [filterLider, setFilterLider] = useState('');
  const [filterPrazo, setFilterPrazo] = useState({ atrasado: false, esse_mes: false, esse_quarter: false, futuro: false, sem_data: false });
  const [activeTab, setActiveTab] = useState('projetos');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const { data } = await axios.get('/api/pagamentos/meus-projetos');
      if (data.success) setProjects(data.data);
    } catch (err) {
      console.error('Erro ao carregar meus pagamentos:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Extract unique leaders for dropdown
  const leaders = useMemo(() => {
    const set = new Set(projects.map(p => p.gerente_name || p.gerente_email).filter(Boolean));
    return [...set].sort();
  }, [projects]);

  // Compute vinculadas per project
  const projectsEnriched = useMemo(() => {
    return projects
      .filter(p => p.total_parcelas > 0)
      .map(p => {
        const vinculadas = p.total_parcelas - p.parcelas_sem_vinculacao;
        return { ...p, vinculadas };
      });
  }, [projects]);

  // KPI computations
  const kpis = useMemo(() => {
    const totalProjetos = projectsEnriched.length;
    const valorTotal = projectsEnriched.reduce((sum, p) => sum + (p.valor_total || 0), 0);
    const parcelasSemVinc = projectsEnriched.reduce((sum, p) => sum + (p.parcelas_sem_vinculacao || 0), 0);

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const prox30Dias = projectsEnriched.filter(p => {
      if (!p.proximo_pagamento) return false;
      const d = new Date(p.proximo_pagamento);
      return d >= now && d <= in30Days;
    }).length;

    return { totalProjetos, valorTotal, parcelasSemVinc, prox30Dias };
  }, [projectsEnriched]);

  // Count per status group
  const statusCounts = useMemo(() => {
    const counts = { Ativos: 0, 'A Iniciar': 0, Pausados: 0, Finalizados: 0 };
    projectsEnriched.forEach(p => {
      const group = getStatusGroup(p.status);
      if (counts[group] !== undefined) counts[group]++;
    });
    return counts;
  }, [projectsEnriched]);

  // Count vinculacao
  const vincCounts = useMemo(() => {
    const counts = { sem: 0, todas: 0, faturados: 0 };
    projectsEnriched.forEach(p => {
      if (p.total_parcelas > 0 && p.parcelas_sem_vinculacao > 0) counts.sem++;
      if (p.total_parcelas > 0 && p.parcelas_sem_vinculacao === 0) counts.todas++;
      if (p.total_parcelas > 0 && (p.parcelas_faturadas || p.parcelas_recebidas || 0) === p.total_parcelas) counts.faturados++;
    });
    return counts;
  }, [projectsEnriched]);

  // Count prazo buckets from proximo_pagamento
  const prazoCounts = useMemo(() => {
    const counts = { atrasado: 0, esse_mes: 0, esse_quarter: 0, futuro: 0, sem_data: 0 };
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const qEnd = new Date(qStart.getFullYear(), qStart.getMonth() + 3, 0);
    projectsEnriched.forEach(p => {
      if (!p.proximo_pagamento) { counts.sem_data++; return; }
      const d = new Date(p.proximo_pagamento);
      if (d < today) counts.atrasado++;
      else if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) counts.esse_mes++;
      else if (d <= qEnd) counts.esse_quarter++;
      else counts.futuro++;
    });
    return counts;
  }, [projectsEnriched]);

  // Sort handler
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <span className="pagamentos-lider-sort-icon">▲</span>;
    return <span className="pagamentos-lider-sort-icon active">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
  };

  const filteredProjects = useMemo(() => {
    const anyStatusActive = Object.values(filterStatus).some(Boolean);
    const anyVincActive = filterVinculacao.sem || filterVinculacao.todas;

    let result = projectsEnriched.filter(p => {
      // Status filter
      if (anyStatusActive) {
        const group = getStatusGroup(p.status);
        if (!filterStatus[group]) return false;
      }

      // Vinculacao filter
      if (anyVincActive) {
        const hasSem = p.total_parcelas > 0 && p.parcelas_sem_vinculacao > 0;
        const hasTodas = p.total_parcelas > 0 && p.parcelas_sem_vinculacao === 0;
        if (filterVinculacao.sem && !filterVinculacao.todas && !hasSem) return false;
        if (filterVinculacao.todas && !filterVinculacao.sem && !hasTodas) return false;
        if (filterVinculacao.sem && filterVinculacao.todas && !(hasSem || hasTodas)) return false;
      }

      // Leader filter
      if (filterLider) {
        const liderName = p.gerente_name || p.gerente_email || '';
        if (liderName !== filterLider) return false;
      }

      // Text search
      if (filterBusca) {
        const search = filterBusca.toLowerCase();
        const matches = (p.project_code || '').toLowerCase().includes(search)
          || (p.project_name || '').toLowerCase().includes(search)
          || (p.company_name || '').toLowerCase().includes(search);
        if (!matches) return false;
      }
      return true;
    });

    // Sort
    if (sortConfig.key) {
      result = [...result].sort((a, b) => {
        let aVal, bVal;
        switch (sortConfig.key) {
          case 'projeto':
            aVal = (a.project_code || '').toLowerCase();
            bVal = (b.project_code || '').toLowerCase();
            break;
          case 'status':
            aVal = (a.status || '').toLowerCase();
            bVal = (b.status || '').toLowerCase();
            break;
          case 'cliente':
            aVal = (a.company_name || '').toLowerCase();
            bVal = (b.company_name || '').toLowerCase();
            break;
          case 'parcelas':
            aVal = a.total_parcelas || 0;
            bVal = b.total_parcelas || 0;
            break;
          case 'vinculacao':
            aVal = a.total_parcelas > 0 ? a.vinculadas / a.total_parcelas : 0;
            bVal = b.total_parcelas > 0 ? b.vinculadas / b.total_parcelas : 0;
            break;
          case 'valor':
            aVal = a.valor_total || 0;
            bVal = b.valor_total || 0;
            break;
          case 'proxPagamento':
            aVal = a.proximo_pagamento ? new Date(a.proximo_pagamento).getTime() : Infinity;
            bVal = b.proximo_pagamento ? new Date(b.proximo_pagamento).getTime() : Infinity;
            break;
          default:
            return 0;
        }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [projectsEnriched, filterStatus, filterVinculacao, filterBusca, filterLider, sortConfig]);

  const toggleExpand = (code) => {
    setExpandedProject(prev => prev === code ? null : code);
  };

  const hasActiveFilters = Object.values(filterStatus).some(Boolean) || filterBusca || filterVinculacao.sem || filterVinculacao.todas || ocultarFaturados || filterLider || Object.values(filterPrazo).some(Boolean);

  if (loading) {
    return (
      <div className="pagamentos-lider-container">
        <div className="pagamentos-lider-loading">Carregando pagamentos...</div>
      </div>
    );
  }

  return (
    <div className="pagamentos-lider-container">
      {/* Header */}
      <div className="pagamentos-lider-header">
        <h2>Pagamentos SPOTs</h2>
        <button
          className="pagamentos-lider-refresh"
          onClick={() => fetchData(true)}
          disabled={refreshing}
        >
          <span className={`pagamentos-lider-refresh-icon${refreshing ? ' spinning' : ''}`}>↻</span>
          Atualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="pagamentos-fin-tabs">
        <button
          className={`pagamentos-fin-tab ${activeTab === 'projetos' ? 'pagamentos-fin-tab-active' : ''}`}
          onClick={() => setActiveTab('projetos')}
        >
          Projetos
        </button>
        <button
          className={`pagamentos-fin-tab ${activeTab === 'cronograma' ? 'pagamentos-fin-tab-active' : ''}`}
          onClick={() => setActiveTab('cronograma')}
        >
          Cronograma
        </button>
      </div>

      {activeTab === 'projetos' ? (
        <>
          {/* KPI Cards */}
          <div className="pagamentos-fin-kpis">
            <div className="pagamentos-fin-kpi">
              <span className="pagamentos-fin-kpi-label">Total Projetos</span>
              <span className="pagamentos-fin-kpi-value">{kpis.totalProjetos}</span>
              <span className="pagamentos-fin-kpi-context">com parcelas</span>
            </div>
            <div className="pagamentos-fin-kpi pagamentos-fin-kpi-primary">
              <span className="pagamentos-fin-kpi-label">Valor Total</span>
              <span className="pagamentos-fin-kpi-value pagamentos-fin-kpi-value-currency">{formatCurrency(kpis.valorTotal)}</span>
            </div>
            <div className={`pagamentos-fin-kpi${kpis.parcelasSemVinc > 0 ? ' pagamentos-fin-kpi-warning' : ''}`}>
              <span className="pagamentos-fin-kpi-label">Sem Vinculação</span>
              <span className="pagamentos-fin-kpi-value">{kpis.parcelasSemVinc}</span>
              <span className="pagamentos-fin-kpi-context">parcelas pendentes</span>
            </div>
            <div className="pagamentos-fin-kpi">
              <span className="pagamentos-fin-kpi-label">Próximos 30 dias</span>
              <span className="pagamentos-fin-kpi-value">{kpis.prox30Dias}</span>
              <span className="pagamentos-fin-kpi-context">pagamentos</span>
            </div>
          </div>

          {/* Filters */}
          <div className="pagamentos-lider-filters">
            {/* Row 1: STATUS + busca */}
            <div className="pagamentos-lider-filters-row">
              <span className="pagamentos-lider-filters-label">STATUS</span>
              <div className="pagamentos-lider-filter-group__toggles">
                {['Finalizados', 'Pausados', 'A Iniciar', 'Ativos'].map(s => (
                  <label key={s} className="pagamentos-lider-toggle">
                    <input type="checkbox" checked={filterStatus[s] || false}
                      onChange={e => setFilterStatus(prev => ({ ...prev, [s]: e.target.checked }))} />
                    <span className="pagamentos-lider-toggle-slider"></span>
                    <span className="pagamentos-lider-toggle-label">{s} <span className="pagamentos-lider-toggle-count">{statusCounts[s] || 0}</span></span>
                  </label>
                ))}
              </div>
              <div className="pagamentos-lider-filter-search">
                <input
                  type="text"
                  className="pagamentos-lider-filter-input"
                  placeholder="Buscar projeto..."
                  value={filterBusca}
                  onChange={e => setFilterBusca(e.target.value)}
                />
              </div>
            </div>

            {/* Row 2: VINCULACAO + Leader filter */}
            <div className="pagamentos-lider-filters-row">
              <span className="pagamentos-lider-filters-label">VINCULAÇÃO</span>
              <div className="pagamentos-lider-filter-group__toggles">
                <label className="pagamentos-lider-toggle">
                  <input type="checkbox" checked={filterVinculacao.sem}
                    onChange={e => setFilterVinculacao(prev => ({ ...prev, sem: e.target.checked }))} />
                  <span className="pagamentos-lider-toggle-slider"></span>
                  <span className="pagamentos-lider-toggle-label">Sem Vincular <span className="pagamentos-lider-toggle-count">{vincCounts.sem}</span></span>
                </label>
                <label className="pagamentos-lider-toggle">
                  <input type="checkbox" checked={filterVinculacao.todas}
                    onChange={e => setFilterVinculacao(prev => ({ ...prev, todas: e.target.checked }))} />
                  <span className="pagamentos-lider-toggle-slider"></span>
                  <span className="pagamentos-lider-toggle-label">Todas Vinculadas <span className="pagamentos-lider-toggle-count">{vincCounts.todas}</span></span>
                </label>
                <label className="pagamentos-lider-toggle">
                  <input type="checkbox" checked={ocultarFaturados}
                    onChange={e => setOcultarFaturados(e.target.checked)} />
                  <span className="pagamentos-lider-toggle-slider"></span>
                  <span className="pagamentos-lider-toggle-label">Ocultar Faturados <span className="pagamentos-lider-toggle-count">{vincCounts.faturados}</span></span>
                </label>
              </div>
              {showLiderFilter && (
                <select
                  className="pagamentos-fin-filter-select"
                  value={filterLider}
                  onChange={e => setFilterLider(e.target.value)}
                  style={{ marginLeft: 'auto' }}
                >
                  <option value="">Todos os lideres</option>
                  {leaders.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              )}
            </div>

            {/* Row 3: PRAZO */}
            <div className="pagamentos-lider-filters-row">
              <span className="pagamentos-lider-filters-label">PRAZO</span>
              <div className="pagamentos-lider-filter-group__toggles">
                {[
                  { key: 'atrasado', label: 'Atrasado' },
                  { key: 'esse_mes', label: 'Esse Mês' },
                  { key: 'esse_quarter', label: 'Esse Quarter' },
                  { key: 'futuro', label: 'Futuro' },
                  { key: 'sem_data', label: 'Sem Data' },
                ].map(({ key, label }) => (
                  <label key={key} className="pagamentos-lider-toggle">
                    <input type="checkbox" checked={filterPrazo[key]}
                      onChange={e => setFilterPrazo(prev => ({ ...prev, [key]: e.target.checked }))} />
                    <span className="pagamentos-lider-toggle-slider"></span>
                    <span className="pagamentos-lider-toggle-label">{label} <span className="pagamentos-lider-toggle-count">{prazoCounts[key]}</span></span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Projects Table */}
          <div className="pagamentos-fin-table-section">
            <div className="pagamentos-fin-table-header">
              <h3>Projetos</h3>
              <span className="pagamentos-fin-table-count">
                {filteredProjects.length} projeto{filteredProjects.length !== 1 ? 's' : ''}
              </span>
            </div>
            {filteredProjects.length === 0 ? (
              <div className="pagamentos-lider-empty-state">
                <div className="pagamentos-lider-empty-icon">
                  {hasActiveFilters ? '🔍' : '📋'}
                </div>
                <p className="pagamentos-lider-empty-title">
                  {hasActiveFilters ? 'Nenhum projeto encontrado' : 'Nenhum projeto com parcelas'}
                </p>
                <p className="pagamentos-lider-empty-subtitle">
                  {hasActiveFilters
                    ? 'Tente ajustar os filtros para ver mais resultados'
                    : 'Cadastre parcelas nos projetos para visualizar aqui'}
                </p>
              </div>
            ) : (
              <div className="pagamentos-fin-table-container">
                <table className="pagamentos-fin-table">
                  <thead>
                    <tr>
                      <th className="pagamentos-lider-th-sortable" onClick={() => handleSort('projeto')}>
                        Projeto {getSortIcon('projeto')}
                      </th>
                      <th>Tipo</th>
                      <th className="pagamentos-lider-th-sortable" onClick={() => handleSort('status')}>
                        Status {getSortIcon('status')}
                      </th>
                      <th className="pagamentos-lider-th-sortable" onClick={() => handleSort('cliente')}>
                        Cliente {getSortIcon('cliente')}
                      </th>
                      <th className="pagamentos-lider-th-sortable" onClick={() => handleSort('parcelas')}>
                        Parcelas {getSortIcon('parcelas')}
                      </th>
                      <th className="pagamentos-lider-th-sortable" onClick={() => handleSort('vinculacao')}>
                        Vinculação {getSortIcon('vinculacao')}
                      </th>
                      <th className="pagamentos-lider-th-sortable" onClick={() => handleSort('valor')}>
                        Valor Total {getSortIcon('valor')}
                      </th>
                      <th className="pagamentos-lider-th-sortable" onClick={() => handleSort('proxPagamento')}>
                        Próx. Pagamento {getSortIcon('proxPagamento')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map(p => {
                      const faturadas = p.parcelas_faturadas ?? p.parcelas_recebidas ?? 0;
                      const isExpanded = expandedProject === p.project_code;
                      const vincPercent = p.total_parcelas > 0 ? (p.vinculadas / p.total_parcelas) * 100 : 0;
                      return (
                      <React.Fragment key={p.project_code}>
                        <tr
                          className={`${isExpanded ? 'row-expanded' : ''} ${p.parcelas_sem_vinculacao > 0 ? 'row-warning' : ''}`}
                          onClick={() => toggleExpand(p.project_code)}
                        >
                          <td>
                            <span className="pagamentos-lider-chevron">{isExpanded ? '▾' : '▸'}</span>
                            <strong>{p.project_code}</strong>
                            {p.project_name && <span className="pagamentos-fin-project-name">{p.project_name}</span>}
                          </td>
                          <td>
                            <span className={`pagamentos-fin-badge ${(p.tipo_pagamento || 'spot') === 'mrr' ? 'pagamentos-fin-badge-mrr' : 'pagamentos-fin-badge-spot'}`}>
                              {(p.tipo_pagamento || 'spot').toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <span className={`pagamentos-fin-badge ${getStatusBadgeClass(p.status)}`}>
                              {p.status || '-'}
                            </span>
                          </td>
                          <td>{p.company_name || '-'}</td>
                          <td>{p.total_parcelas} ({faturadas} faturados)</td>
                          <td>
                            <div className="pagamentos-lider-vinc-cell">
                              <div className="pagamentos-lider-vinc-bar">
                                <div
                                  className={`pagamentos-lider-vinc-fill ${getVincColor(p.vinculadas, p.total_parcelas)}`}
                                  style={{ width: `${vincPercent}%` }}
                                />
                              </div>
                              <span className={getVincClass(p.vinculadas, p.total_parcelas)}>
                                {p.total_parcelas > 0 ? `${p.vinculadas}/${p.total_parcelas}` : '-'}
                              </span>
                            </div>
                          </td>
                          <td className="pagamentos-fin-valor-cell">{formatCurrency(p.valor_total)}</td>
                          <td>{formatDate(p.proximo_pagamento)}</td>
                        </tr>
                        {isExpanded && (
                          <tr className="pagamentos-fin-expand-row">
                            <td colSpan="8">
                              <div className="pagamentos-fin-expand-content">
                                <ParcelasProjetoPanel
                                  projectCode={p.project_code}
                                  companyId={p.company_name}
                                  projectName={p.project_name}
                                  mode="lider"
                                  tipoPagamento={p.tipo_pagamento}
                                  ocultarFaturados={ocultarFaturados}
                                  filterPrazo={filterPrazo}
                                  highlightSince={highlightSince}
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <CronogramaFisicoFinanceiroPanel
          leaders={leaders}
          showLiderFilter={showLiderFilter}
        />
      )}
    </div>
  );
}
