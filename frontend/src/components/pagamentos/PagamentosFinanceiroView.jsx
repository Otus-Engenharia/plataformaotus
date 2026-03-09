import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import ParcelasProjetoPanel from './ParcelasProjetoPanel';
import ParcelaFormDialog from './ParcelaFormDialog';
import CalendarioPagamentosView from './CalendarioPagamentosView';
import { useNavigate } from 'react-router-dom';
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
  'A iniciar': ['a iniciar'],
  'Pausados': ['pausado - f01', 'pausado - f02', 'pausado - f04'],
  'Fechados': ['close', 'obra finalizada', 'churn pelo cliente', 'termo de encerramento'],
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
    case 'A iniciar': return 'pagamentos-fin-badge-iniciar';
    case 'Pausados': return 'pagamentos-fin-badge-pausado';
    case 'Fechados': return 'pagamentos-fin-badge-fechado';
    default: return 'pagamentos-fin-badge-outro';
  }
}

function getVincClass(count, total) {
  if (total === 0) return '';
  if (count === total) return 'pagamentos-fin-vinc-full';
  if (count > 0) return 'pagamentos-fin-vinc-partial';
  return 'pagamentos-fin-vinc-none';
}

export default function PagamentosFinanceiroView() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedProject, setExpandedProject] = useState(null);
  const [activeTab, setActiveTab] = useState('projetos');

  // Filters
  const [filterLider, setFilterLider] = useState('');
  const [filterCliente, setFilterCliente] = useState('');
  const [filterBusca, setFilterBusca] = useState('');
  const [filterStatus, setFilterStatus] = useState(new Set(['Ativos']));
  const [filterParcelas, setFilterParcelas] = useState('todas'); // 'todas' | 'com' | 'sem'
  const [filterTipo, setFilterTipo] = useState('todos'); // 'todos' | 'mrr' | 'spot'

  // Aditivo quick dialog
  const [aditivoDialogOpen, setAditivoDialogOpen] = useState(false);
  const [aditivoStep, setAditivoStep] = useState(1);
  const [aditivoProjectCode, setAditivoProjectCode] = useState('');
  const [aditivoCompanyId, setAditivoCompanyId] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiRes, projRes] = await Promise.all([
        axios.get('/api/pagamentos/dashboard-kpis'),
        axios.get('/api/pagamentos/all-projects'),
      ]);
      if (kpiRes.data.success) setKpis(kpiRes.data.data);
      if (projRes.data.success) setProjects(projRes.data.data);
    } catch (err) {
      console.error('Erro ao carregar dados financeiro:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleStatus = (status) => {
    setFilterStatus(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  // Extract unique leaders and clients for dropdown filters
  const leaders = useMemo(() => {
    const set = new Set(projects.map(p => p.gerente_name || p.gerente_email).filter(Boolean));
    return [...set].sort();
  }, [projects]);

  const clients = useMemo(() => {
    const set = new Set(projects.map(p => p.company_name).filter(Boolean));
    return [...set].sort();
  }, [projects]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      // MRR sem parcelas não aparece (exceto quando filtro "Sem parcelas" ativo)
      if ((p.tipo_pagamento || 'spot') === 'mrr' && p.total_parcelas === 0 && filterParcelas !== 'sem') return false;
      if (filterLider && (p.gerente_name || p.gerente_email) !== filterLider) return false;
      if (filterCliente && p.company_name !== filterCliente) return false;
      if (filterStatus.size > 0) {
        const group = getStatusGroup(p.status);
        if (!filterStatus.has(group)) return false;
      }
      if (filterTipo !== 'todos' && (p.tipo_pagamento || 'spot') !== filterTipo) return false;
      if (filterParcelas === 'com' && p.total_parcelas === 0) return false;
      if (filterParcelas === 'sem' && p.total_parcelas > 0) return false;
      if (filterBusca) {
        const search = filterBusca.toLowerCase();
        const matches = (p.project_code || '').toLowerCase().includes(search)
          || (p.project_name || '').toLowerCase().includes(search)
          || (p.company_name || '').toLowerCase().includes(search)
          || (p.gerente_email || '').toLowerCase().includes(search)
          || (p.gerente_name || '').toLowerCase().includes(search);
        if (!matches) return false;
      }
      return true;
    });
  }, [projects, filterLider, filterCliente, filterBusca, filterStatus, filterParcelas, filterTipo]);

  const mrrProjects = useMemo(() =>
    projects.filter(p => (p.tipo_pagamento || 'spot') === 'mrr'),
    [projects]
  );

  const handleOpenAditivoDialog = () => {
    setAditivoStep(1);
    setAditivoProjectCode('');
    setAditivoCompanyId('');
    setAditivoDialogOpen(true);
  };

  const handleSelectAditivoProject = (code) => {
    const proj = mrrProjects.find(p => p.project_code === code);
    if (proj) {
      setAditivoProjectCode(code);
      setAditivoCompanyId(proj.company_name || '');
      setAditivoStep(2);
    }
  };

  const handleCreateAditivo = async (formData) => {
    await axios.post('/api/pagamentos/parcelas', formData);
    setAditivoDialogOpen(false);
    fetchData();
  };

  const toggleExpand = (code) => {
    setExpandedProject(prev => prev === code ? null : code);
  };

  if (loading) {
    return (
      <div className="pagamentos-fin-container">
        <div className="pagamentos-fin-loading">Carregando dados de pagamentos...</div>
      </div>
    );
  }

  return (
    <div className="pagamentos-fin-container">
      {/* Header */}
      <div className="pagamentos-fin-header">
        <h2>Controle de Pagamentos</h2>
        <div className="pagamentos-fin-header-actions">
          <button className="pagamentos-fin-btn-aditivo" onClick={handleOpenAditivoDialog}>
            + Novo Aditivo
          </button>
          <button className="pagamentos-fin-refresh" onClick={fetchData}>
            ATUALIZAR
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="pagamentos-fin-kpis">
          <div className={`pagamentos-fin-kpi tooltip-wrapper ${kpis.projetos_ativos_sem_parcelas > 0 ? 'pagamentos-fin-kpi-warning' : ''}`} data-tooltip="Projetos ativos (SPOT) que ainda nao tem parcelas cadastradas">
            <span className="pagamentos-fin-kpi-label">Projetos sem Parcelas</span>
            <span className="pagamentos-fin-kpi-value">{kpis.projetos_ativos_sem_parcelas}</span>
            <span className="pagamentos-fin-kpi-context">SPOTS ativos</span>
          </div>
          <div className={`pagamentos-fin-kpi tooltip-wrapper ${kpis.parcelas_sem_vinculacao > 0 ? 'pagamentos-fin-kpi-warning' : ''}`} data-tooltip="Parcelas que precisam ser vinculadas pelo lider a uma tarefa">
            <span className="pagamentos-fin-kpi-label">Sem Vinculacao</span>
            <span className="pagamentos-fin-kpi-value">{kpis.parcelas_sem_vinculacao}</span>
            <span className="pagamentos-fin-kpi-context">parcelas pendentes</span>
          </div>
          <div className="pagamentos-fin-kpi">
            <span className="pagamentos-fin-kpi-label">Valor Pendente</span>
            <span className="pagamentos-fin-kpi-value pagamentos-fin-kpi-value-currency">{formatCurrency(kpis.valor_pendente)}</span>
          </div>
          <div className="pagamentos-fin-kpi pagamentos-fin-kpi-primary">
            <span className="pagamentos-fin-kpi-label">Valor Recebido</span>
            <span className="pagamentos-fin-kpi-value pagamentos-fin-kpi-value-currency">{formatCurrency(kpis.valor_recebido)}</span>
          </div>
          <div className="pagamentos-fin-kpi">
            <span className="pagamentos-fin-kpi-label">Proximos 30 dias</span>
            <span className="pagamentos-fin-kpi-value">{kpis.proximos_30_dias}</span>
            <span className="pagamentos-fin-kpi-context">de {kpis.total_parcelas} parcelas</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="pagamentos-fin-tabs">
        <button
          className={`pagamentos-fin-tab ${activeTab === 'projetos' ? 'pagamentos-fin-tab-active' : ''}`}
          onClick={() => setActiveTab('projetos')}
        >
          Projetos
        </button>
        <button
          className={`pagamentos-fin-tab ${activeTab === 'calendario' ? 'pagamentos-fin-tab-active' : ''}`}
          onClick={() => setActiveTab('calendario')}
        >
          Calendario
        </button>
      </div>

      {activeTab === 'projetos' ? (
        <>
          {/* Filters */}
          <div className="pagamentos-fin-filters">
            <div className="pagamentos-fin-filters-row">
              <span className="pagamentos-fin-filters-label">Status</span>
              <div className="pagamentos-fin-toggle-group">
                {['Ativos', 'A iniciar', 'Pausados', 'Fechados'].map(s => (
                  <button
                    key={s}
                    className={`pagamentos-fin-toggle-btn ${filterStatus.has(s) ? 'active' : ''}`}
                    onClick={() => toggleStatus(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <span className="pagamentos-fin-filters-label" style={{ marginLeft: '1rem' }}>Tipo</span>
              <div className="pagamentos-fin-toggle-group">
                {['todos', 'spot', 'mrr'].map(t => (
                  <button
                    key={t}
                    className={`pagamentos-fin-toggle-btn ${filterTipo === t ? 'active' : ''}`}
                    onClick={() => setFilterTipo(t)}
                  >
                    {t === 'todos' ? 'Todos' : t.toUpperCase()}
                  </button>
                ))}
              </div>
              <span className="pagamentos-fin-filters-label" style={{ marginLeft: '1rem' }}>Parcelas</span>
              <div className="pagamentos-fin-toggle-group">
                <button
                  className={`pagamentos-fin-toggle-btn ${filterParcelas === 'com' ? 'active' : ''}`}
                  onClick={() => setFilterParcelas(prev => prev === 'com' ? 'todas' : 'com')}
                >
                  Com parcelas
                </button>
                <button
                  className={`pagamentos-fin-toggle-btn pagamentos-fin-toggle-btn-danger ${filterParcelas === 'sem' ? 'active' : ''}`}
                  onClick={() => setFilterParcelas(prev => prev === 'sem' ? 'todas' : 'sem')}
                >
                  Sem parcelas
                </button>
              </div>
            </div>
            <div className="pagamentos-fin-filters-row" style={{ marginTop: '0.5rem' }}>
              <select
                className="pagamentos-fin-filter-select"
                value={filterLider}
                onChange={e => setFilterLider(e.target.value)}
              >
                <option value="">Todos os lideres</option>
                {leaders.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <select
                className="pagamentos-fin-filter-select"
                value={filterCliente}
                onChange={e => setFilterCliente(e.target.value)}
              >
                <option value="">Todos os clientes</option>
                {clients.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                className="pagamentos-fin-filter-input"
                type="text"
                placeholder="Buscar projeto, cliente, lider..."
                value={filterBusca}
                onChange={e => setFilterBusca(e.target.value)}
              />
            </div>
          </div>

          {/* Projects Table */}
          <div className="pagamentos-fin-table-section">
            <div className="pagamentos-fin-table-header">
              <h3>Projetos</h3>
              <span className="pagamentos-fin-table-count">
                {filteredProjects.length} projeto{filteredProjects.length !== 1 ? 's' : ''}
                {kpis && ` | ${kpis.total_parcelas} parcelas`}
              </span>
            </div>
            {filteredProjects.length === 0 ? (
              <div className="pagamentos-fin-empty">Nenhum projeto encontrado</div>
            ) : (
              <div className="pagamentos-fin-table-container">
                <table className="pagamentos-fin-table">
                  <thead>
                    <tr>
                      <th>Projeto</th>
                      <th>Tipo</th>
                      <th>Status</th>
                      <th>Cliente</th>
                      <th>Lider</th>
                      <th>Parcelas</th>
                      <th>Vinculacao</th>
                      <th>Recebidas</th>
                      <th>Valor Total</th>
                      <th>Prox. Pagamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map(p => (
                      <React.Fragment key={p.project_code}>
                        <tr
                          className={`${expandedProject === p.project_code ? 'row-expanded' : ''} ${p.total_parcelas === 0 ? 'row-no-parcelas' : ''} ${p.parcelas_sem_vinculacao > 0 ? 'row-warning' : ''}`}
                          onClick={() => toggleExpand(p.project_code)}
                        >
                          <td>
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
                          <td>
                            {p.company_name || '-'}
                            {p.company_name && !p.has_regra_cliente && (
                              <span
                                className="tooltip-wrapper pagamentos-fin-regra-warning"
                                data-tooltip="Cliente sem regras de pagamento cadastradas. Cadastre em Regras de Pagamento."
                                onClick={(e) => { e.stopPropagation(); navigate('/admin-financeiro/regras-pagamento'); }}
                              >
                                &#9888;
                              </span>
                            )}
                          </td>
                          <td>{p.gerente_name || (p.gerente_email ? p.gerente_email.split('@')[0] : '-')}</td>
                          <td>{p.total_parcelas}</td>
                          <td>
                            {(() => {
                              const vinculadas = p.total_parcelas - (p.parcelas_sem_vinculacao || 0);
                              return p.total_parcelas > 0
                                ? <span className={getVincClass(vinculadas, p.total_parcelas)}>{vinculadas}/{p.total_parcelas}</span>
                                : '-';
                            })()}
                          </td>
                          <td>
                            {p.total_parcelas > 0
                              ? <span className={getVincClass(p.parcelas_recebidas, p.total_parcelas)}>{p.parcelas_recebidas}/{p.total_parcelas}</span>
                              : '-'}
                          </td>
                          <td className="pagamentos-fin-valor-cell">{formatCurrency(p.valor_total)}</td>
                          <td>{formatDate(p.proximo_pagamento)}</td>
                        </tr>
                        {expandedProject === p.project_code && (
                          <tr className="pagamentos-fin-expand-row">
                            <td colSpan="10">
                              <div className="pagamentos-fin-expand-content">
                                <ParcelasProjetoPanel
                                  projectCode={p.project_code}
                                  companyId={p.company_name}
                                  mode="financeiro"
                                  tipoPagamento={p.tipo_pagamento}
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <CalendarioPagamentosView />
      )}

      {/* Aditivo Quick Dialog */}
      {aditivoDialogOpen && aditivoStep === 1 && (
        <div className="parcela-dialog-overlay" onClick={() => setAditivoDialogOpen(false)}>
          <div className="pagamentos-fin-aditivo-dialog" onClick={e => e.stopPropagation()}>
            <div className="parcela-dialog-header">
              <h3>Novo Aditivo - Selecionar Projeto MRR</h3>
              <button className="parcela-dialog-close" onClick={() => setAditivoDialogOpen(false)}>&times;</button>
            </div>
            <div className="pagamentos-fin-aditivo-dialog-body">
              <label className="pagamentos-fin-aditivo-label">Projeto MRR</label>
              <select
                className="pagamentos-fin-aditivo-select"
                value={aditivoProjectCode}
                onChange={e => handleSelectAditivoProject(e.target.value)}
              >
                <option value="">Selecione um projeto...</option>
                {mrrProjects.map(p => (
                  <option key={p.project_code} value={p.project_code}>
                    {p.project_code} - {p.project_name || p.company_name || ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <ParcelaFormDialog
        open={aditivoDialogOpen && aditivoStep === 2}
        onClose={() => setAditivoDialogOpen(false)}
        onSave={handleCreateAditivo}
        parcela={null}
        projectCode={aditivoProjectCode}
        companyId={aditivoCompanyId}
        isAditivo={true}
      />
    </div>
  );
}
