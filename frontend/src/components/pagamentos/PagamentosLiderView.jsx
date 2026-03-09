import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import ParcelasProjetoPanel from './ParcelasProjetoPanel';
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

export default function PagamentosLiderView() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedProject, setExpandedProject] = useState(null);
  const [filterBusca, setFilterBusca] = useState('');
  const [filterStatus, setFilterStatus] = useState({ Ativos: true, 'A Iniciar': false, Pausados: false, Finalizados: false });
  const [filterVinculacao, setFilterVinculacao] = useState({ sem: false, todas: false });
  const [ocultarPagos, setOcultarPagos] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/pagamentos/meus-projetos');
      if (data.success) setProjects(data.data);
    } catch (err) {
      console.error('Erro ao carregar meus pagamentos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Compute vinculadas per project
  const projectsEnriched = useMemo(() => {
    return projects
      .filter(p => p.total_parcelas > 0)
      .map(p => {
        const vinculadas = p.total_parcelas - p.parcelas_sem_vinculacao;
        return { ...p, vinculadas };
      });
  }, [projects]);

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
    const counts = { sem: 0, todas: 0, pagos: 0 };
    projectsEnriched.forEach(p => {
      if (p.total_parcelas > 0 && p.parcelas_sem_vinculacao > 0) counts.sem++;
      if (p.total_parcelas > 0 && p.parcelas_sem_vinculacao === 0) counts.todas++;
      if (p.total_parcelas > 0 && p.parcelas_recebidas === p.total_parcelas) counts.pagos++;
    });
    return counts;
  }, [projectsEnriched]);

  const filteredProjects = useMemo(() => {
    // If no status filter is active, show all
    const anyStatusActive = Object.values(filterStatus).some(Boolean);
    const anyVincActive = filterVinculacao.sem || filterVinculacao.todas;

    return projectsEnriched.filter(p => {
      // Status filter
      if (anyStatusActive) {
        const group = getStatusGroup(p.status);
        if (!filterStatus[group]) return false;
      }

      // Ocultar pagos
      if (ocultarPagos && p.total_parcelas > 0 && p.parcelas_recebidas === p.total_parcelas) return false;

      // Vinculacao filter
      if (anyVincActive) {
        const hasSem = p.total_parcelas > 0 && p.parcelas_sem_vinculacao > 0;
        const hasTodas = p.total_parcelas > 0 && p.parcelas_sem_vinculacao === 0;
        if (filterVinculacao.sem && !filterVinculacao.todas && !hasSem) return false;
        if (filterVinculacao.todas && !filterVinculacao.sem && !hasTodas) return false;
        if (filterVinculacao.sem && filterVinculacao.todas && !(hasSem || hasTodas)) return false;
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
  }, [projectsEnriched, filterStatus, filterVinculacao, filterBusca, ocultarPagos]);

  const toggleExpand = (code) => {
    setExpandedProject(prev => prev === code ? null : code);
  };

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
        <button className="pagamentos-lider-refresh" onClick={fetchData}>
          ATUALIZAR
        </button>
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

        {/* Row 2: VINCULACAO */}
        <div className="pagamentos-lider-filters-row" style={{ marginTop: '0.5rem' }}>
          <span className="pagamentos-lider-filters-label">VINCULACAO</span>
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
              <input type="checkbox" checked={ocultarPagos}
                onChange={e => setOcultarPagos(e.target.checked)} />
              <span className="pagamentos-lider-toggle-slider"></span>
              <span className="pagamentos-lider-toggle-label">Ocultar Pagos <span className="pagamentos-lider-toggle-count">{vincCounts.pagos}</span></span>
            </label>
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
          <div className="pagamentos-fin-empty">
            {Object.values(filterStatus).some(Boolean) || filterBusca || filterVinculacao.sem || filterVinculacao.todas || ocultarPagos
              ? 'Nenhum projeto com os filtros selecionados'
              : 'Nenhum projeto com parcelas cadastradas'}
          </div>
        ) : (
          <div className="pagamentos-fin-table-container">
            <table className="pagamentos-fin-table">
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Cliente</th>
                  <th>Parcelas</th>
                  <th>Vinculacao</th>
                  <th>Valor Total</th>
                  <th>Prox. Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map(p => (
                  <React.Fragment key={p.project_code}>
                    <tr
                      className={`${expandedProject === p.project_code ? 'row-expanded' : ''} ${p.parcelas_sem_vinculacao > 0 ? 'row-warning' : ''}`}
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
                      <td>{p.company_name || '-'}</td>
                      <td>{p.total_parcelas} ({p.parcelas_recebidas} pagos)</td>
                      <td>
                        <span className={getVincClass(p.vinculadas, p.total_parcelas)}>
                          {p.total_parcelas > 0 ? `${p.vinculadas}/${p.total_parcelas}` : '-'}
                        </span>
                      </td>
                      <td className="pagamentos-fin-valor-cell">{formatCurrency(p.valor_total)}</td>
                      <td>{formatDate(p.proximo_pagamento)}</td>
                    </tr>
                    {expandedProject === p.project_code && (
                      <tr className="pagamentos-fin-expand-row">
                        <td colSpan="8">
                          <div className="pagamentos-fin-expand-content">
                            <ParcelasProjetoPanel
                              projectCode={p.project_code}
                              companyId={p.company_name}
                              projectName={p.project_name}
                              mode="lider"
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
    </div>
  );
}
