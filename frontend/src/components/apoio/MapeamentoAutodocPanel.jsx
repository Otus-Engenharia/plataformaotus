/**
 * Painel de Mapeamento Autodoc
 *
 * Permite vincular projetos Autodoc aos project_codes do portfolio.
 * Inclui descoberta automatica, sugestoes por similaridade e vinculacao manual.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { autodocEntregasApi } from '../../api/autodocEntregas';
import { useAuth } from '../../contexts/AuthContext';
import './MapeamentoAutodocPanel.css';

export default function MapeamentoAutodocPanel() {
  const { isPrivileged } = useAuth();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [toast, setToast] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('');
  const [portfolioCodes, setPortfolioCodes] = useState([]);
  const [selectedCodes, setSelectedCodes] = useState({});
  const [saving, setSaving] = useState({});
  const [existingMappings, setExistingMappings] = useState([]);
  const [mappingsLoading, setMappingsLoading] = useState(true);
  // Cobertura Portfolio
  const [portfolioProjects, setPortfolioProjects] = useState([]);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [plataformaFilters, setPlataformaFilters] = useState(new Set(['autodoc']));
  const [statusMappingFilter, setStatusMappingFilter] = useState('all');
  const [coverageLinkSelection, setCoverageLinkSelection] = useState({});
  const [coverageLinkSaving, setCoverageLinkSaving] = useState({});
  const [portfolioSearch, setPortfolioSearch] = useState('');
  const [coverageAutodocSearch, setCoverageAutodocSearch] = useState('');
  const [discoveryPortfolioSearch, setDiscoveryPortfolioSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [statusProjectFilter, setStatusProjectFilter] = useState('active');

  // Carregar project_codes do portfolio (todos, sem filtragem por role)
  const fetchPortfolioCodes = useCallback(async () => {
    try {
      const res = await fetch('/api/portfolio/project-codes', { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.data?.codes) {
        setPortfolioCodes(data.data.codes.sort());
      }
    } catch (err) {
      console.error('Erro ao buscar project codes:', err);
    }
  }, []);

  const fetchMappings = useCallback(async () => {
    setMappingsLoading(true);
    try {
      const res = await autodocEntregasApi.getMappings();
      if (res.data?.success) {
        setExistingMappings(res.data.data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar mapeamentos:', err);
    } finally {
      setMappingsLoading(false);
    }
  }, []);

  const fetchPortfolioSummary = useCallback(async () => {
    setPortfolioLoading(true);
    try {
      const res = await fetch('/api/portfolio/summary', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setPortfolioProjects(data.data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar portfolio summary:', err);
    } finally {
      setPortfolioLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPortfolioCodes();
    fetchMappings();
    fetchPortfolioSummary();
  }, [fetchPortfolioCodes, fetchMappings, fetchPortfolioSummary]);

  const handleDiscover = async () => {
    if (discovering) return;
    setDiscovering(true);
    setToast(null);
    try {
      const res = await autodocEntregasApi.discoverProjects(portfolioCodes);
      if (res.data?.success) {
        setProjects(res.data.data || []);
        // Pre-selecionar sugestoes
        const preSelected = {};
        for (const p of (res.data.data || [])) {
          const key = `${p.customerId}::${p.projectFolderId}`;
          if (p.suggestedMatch) {
            preSelected[key] = p.suggestedMatch.projectCode;
          } else if (p.mappedProjectCode) {
            preSelected[key] = p.mappedProjectCode;
          }
        }
        setSelectedCodes(preSelected);
        setToast({ type: 'success', message: `${(res.data.data || []).length} projetos descobertos` });
      }
    } catch (err) {
      console.error('Erro ao descobrir projetos:', err);
      setToast({ type: 'error', message: err.response?.data?.error || err.message });
    } finally {
      setDiscovering(false);
    }
  };

  const handleLink = async (project) => {
    const key = `${project.customerId}::${project.projectFolderId}`;
    const code = selectedCodes[key];
    if (!code) return;

    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      await autodocEntregasApi.createMapping({
        portfolioProjectCode: code,
        autodocCustomerId: project.customerId,
        autodocCustomerName: project.customerName,
        autodocProjectFolderId: project.projectFolderId,
        autodocProjectName: project.projectName,
      });

      // Atualizar estado local
      setProjects(prev => prev.map(p => {
        if (p.customerId === project.customerId && p.projectFolderId === project.projectFolderId) {
          return { ...p, alreadyMapped: true, mappedProjectCode: code };
        }
        return p;
      }));

      setToast({ type: 'success', message: `${project.projectName} vinculado a ${code}` });
      fetchMappings();
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.error || err.message });
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleDismiss = async (project) => {
    const key = `${project.customerId}::${project.projectFolderId}`;
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      await autodocEntregasApi.createMapping({
        portfolioProjectCode: '__DISMISSED__',
        autodocCustomerId: project.customerId,
        autodocCustomerName: project.customerName,
        autodocProjectFolderId: project.projectFolderId,
        autodocProjectName: project.projectName,
      });

      setProjects(prev => prev.map(p => {
        if (p.customerId === project.customerId && p.projectFolderId === project.projectFolderId) {
          return { ...p, alreadyMapped: true, mappedProjectCode: '__DISMISSED__' };
        }
        return p;
      }));

      setToast({ type: 'success', message: `${project.projectName} marcado como "Nao e Otus"` });
      fetchMappings();
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.error || err.message });
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleUnlink = async (project) => {
    const key = `${project.customerId}::${project.projectFolderId}`;
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      // Buscar mapping ID
      const mappingsRes = await autodocEntregasApi.getMappings();
      const mapping = (mappingsRes.data?.data || []).find(
        m => m.autodoc_customer_id === project.customerId && m.autodoc_project_folder_id === project.projectFolderId
      );
      if (mapping) {
        await autodocEntregasApi.deleteMapping(mapping.id);
      }

      setProjects(prev => prev.map(p => {
        if (p.customerId === project.customerId && p.projectFolderId === project.projectFolderId) {
          return { ...p, alreadyMapped: false, mappedProjectCode: null };
        }
        return p;
      }));

      setToast({ type: 'success', message: `${project.projectName} desvinculado` });
      fetchMappings();
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.error || err.message });
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleConfirmAllSuggestions = async () => {
    const toConfirm = projects.filter(p =>
      !p.alreadyMapped && p.suggestedMatch && p.suggestedMatch.confidence >= 80
    );

    if (toConfirm.length === 0) {
      setToast({ type: 'info', message: 'Nenhuma sugestao com confianca >= 80% para confirmar' });
      return;
    }

    setLoading(true);
    let confirmed = 0;
    for (const project of toConfirm) {
      try {
        await autodocEntregasApi.createMapping({
          portfolioProjectCode: project.suggestedMatch.projectCode,
          autodocCustomerId: project.customerId,
          autodocCustomerName: project.customerName,
          autodocProjectFolderId: project.projectFolderId,
          autodocProjectName: project.projectName,
        });
        confirmed++;
      } catch (err) {
        console.error(`Erro ao vincular ${project.projectName}:`, err);
      }
    }

    // Refresh
    setProjects(prev => prev.map(p => {
      if (!p.alreadyMapped && p.suggestedMatch && p.suggestedMatch.confidence >= 80) {
        return { ...p, alreadyMapped: true, mappedProjectCode: p.suggestedMatch.projectCode };
      }
      return p;
    }));

    setToast({ type: 'success', message: `${confirmed} projetos vinculados automaticamente` });
    setLoading(false);
    fetchMappings();
  };

  // Desvincular direto da tabela de cobertura
  const handleCoverageUnlink = async (projectCode) => {
    const mappingsToDelete = existingMappings.filter(m => m.portfolio_project_code === projectCode);
    if (mappingsToDelete.length === 0) return;

    setCoverageLinkSaving(prev => ({ ...prev, [projectCode]: true }));
    try {
      for (const mapping of mappingsToDelete) {
        await autodocEntregasApi.deleteMapping(mapping.id);
      }
      setToast({ type: 'success', message: `Mapeamento de ${projectCode} removido` });
      fetchMappings();
      // Atualizar lista de descoberta se estiver visivel
      setProjects(prev => prev.map(p => {
        const isMatch = mappingsToDelete.some(
          m => m.autodoc_customer_id === p.customerId && m.autodoc_project_folder_id === p.projectFolderId
        );
        if (isMatch) return { ...p, alreadyMapped: false, mappedProjectCode: null };
        return p;
      }));
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.error || err.message });
    } finally {
      setCoverageLinkSaving(prev => ({ ...prev, [projectCode]: false }));
    }
  };

  // Vincular direto da tabela de cobertura
  const handleCoverageLink = async (portfolioCode) => {
    const selValue = coverageLinkSelection[portfolioCode];
    if (!selValue) return;

    const [customerId, projectFolderId] = selValue.split('::');
    const autodocProject = projects.find(
      p => String(p.customerId) === customerId && String(p.projectFolderId) === projectFolderId
    );
    if (!autodocProject) return;

    setCoverageLinkSaving(prev => ({ ...prev, [portfolioCode]: true }));
    try {
      await autodocEntregasApi.createMapping({
        portfolioProjectCode: portfolioCode,
        autodocCustomerId: autodocProject.customerId,
        autodocCustomerName: autodocProject.customerName,
        autodocProjectFolderId: autodocProject.projectFolderId,
        autodocProjectName: autodocProject.projectName,
      });

      setProjects(prev => prev.map(p => {
        if (p.customerId === autodocProject.customerId && p.projectFolderId === autodocProject.projectFolderId) {
          return { ...p, alreadyMapped: true, mappedProjectCode: portfolioCode };
        }
        return p;
      }));

      setCoverageLinkSelection(prev => { const n = { ...prev }; delete n[portfolioCode]; return n; });
      setToast({ type: 'success', message: `${autodocProject.projectName} vinculado a ${portfolioCode}` });
      fetchMappings();
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.error || err.message });
    } finally {
      setCoverageLinkSaving(prev => ({ ...prev, [portfolioCode]: false }));
    }
  };

  // Projetos Autodoc nao mapeados (para dropdown na cobertura)
  const unmappedAutodocProjects = useMemo(() => {
    return projects.filter(p => !p.alreadyMapped);
  }, [projects]);

  // Cobertura Portfolio - join com mapeamentos
  const portfolioCoverage = useMemo(() => {
    // Map de portfolio_project_code → nomes de projetos Autodoc
    const mappingsByCode = new Map();
    for (const m of existingMappings) {
      const code = m.portfolio_project_code;
      if (!mappingsByCode.has(code)) mappingsByCode.set(code, []);
      mappingsByCode.get(code).push(m.autodoc_project_name);
    }

    // Plataformas unicas para dropdown
    const plataformas = [...new Set(
      portfolioProjects.map(p => p.plataforma_acd).filter(Boolean)
    )].sort();

    // Clientes unicos para dropdown
    const clients = [...new Set(
      portfolioProjects.map(p => p.client_name).filter(Boolean)
    )].sort();

    // Status do projeto
    const ACTIVE_STATUSES = ['planejamento', 'fase 01', 'fase 02', 'fase 03', 'fase 04'];
    const STARTING_STATUSES = ['a iniciar'];

    // Filtrar projetos
    const filtered = portfolioProjects.filter(p => {
      // Filtro de status do projeto
      const st = (p.status || '').toLowerCase();
      if (statusProjectFilter === 'active' && !ACTIVE_STATUSES.includes(st)) return false;
      if (statusProjectFilter === 'active+starting' && !ACTIVE_STATUSES.includes(st) && !STARTING_STATUSES.includes(st)) return false;
      // Multi-select: se o Set esta vazio, mostra todos (equivalente a "Todos")
      if (plataformaFilters.size > 0) {
        const val = p.plataforma_acd ? p.plataforma_acd.toLowerCase() : '__null__';
        if (!plataformaFilters.has(val)) return false;
      }
      if (clientFilter && (p.client_name || '') !== clientFilter) return false;
      const isMapped = mappingsByCode.has(p.project_code);
      if (statusMappingFilter === 'mapped' && !isMapped) return false;
      if (statusMappingFilter === 'unmapped' && isMapped) return false;
      if (portfolioSearch) {
        const q = portfolioSearch.toLowerCase();
        if (!(p.project_code || '').toLowerCase().includes(q) &&
            !(p.comercial_name || '').toLowerCase().includes(q) &&
            !(p.name || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });

    // Enriquecer
    const enriched = filtered.map(p => ({
      ...p,
      isMapped: mappingsByCode.has(p.project_code),
      autodocProjectNames: mappingsByCode.get(p.project_code) || [],
    }));

    const totalFiltered = enriched.length;
    const mappedCount = enriched.filter(p => p.isMapped).length;
    const unmappedCount = totalFiltered - mappedCount;

    return { enriched, plataformas, clients, totalFiltered, mappedCount, unmappedCount };
  }, [portfolioProjects, existingMappings, plataformaFilters, statusMappingFilter, portfolioSearch, clientFilter, statusProjectFilter]);

  // Lookup nome portfolio para dropdown Discovery
  const portfolioNameMap = useMemo(() => {
    const map = new Map();
    for (const p of portfolioProjects) {
      map.set(p.project_code, p.name || p.comercial_name || p.project_code);
    }
    return map;
  }, [portfolioProjects]);

  // Portfolio codes ordenados por nome (para dropdown Discovery)
  const sortedPortfolioCodes = useMemo(() => {
    return [...portfolioCodes].sort((a, b) => {
      const nameA = (portfolioNameMap.get(a) || a).toLowerCase();
      const nameB = (portfolioNameMap.get(b) || b).toLowerCase();
      return nameA.localeCompare(nameB, 'pt-BR');
    });
  }, [portfolioCodes, portfolioNameMap]);

  // Filtrar portfolio codes pelo texto de busca (para dropdown Discovery)
  const filteredPortfolioCodes = useMemo(() => {
    if (!discoveryPortfolioSearch) return sortedPortfolioCodes;
    const q = discoveryPortfolioSearch.toLowerCase();
    return sortedPortfolioCodes.filter(code => {
      const name = (portfolioNameMap.get(code) || '').toLowerCase();
      return name.includes(q) || code.toLowerCase().includes(q);
    });
  }, [sortedPortfolioCodes, portfolioNameMap, discoveryPortfolioSearch]);

  // Filtrar projetos Autodoc nao mapeados pelo texto de busca (para dropdown na cobertura)
  const filteredUnmappedAutodoc = useMemo(() => {
    if (!coverageAutodocSearch) return unmappedAutodocProjects;
    const q = coverageAutodocSearch.toLowerCase();
    return unmappedAutodocProjects.filter(ap =>
      (ap.customerName || '').toLowerCase().includes(q) ||
      (ap.projectName || '').toLowerCase().includes(q)
    );
  }, [unmappedAutodocProjects, coverageAutodocSearch]);

  // Filtros Discovery
  const customers = [...new Set(projects.map(p => p.customerName))].sort();

  const filteredProjects = projects.filter(p => {
    const isDismissed = p.alreadyMapped && p.mappedProjectCode === '__DISMISSED__';
    const isTrulyMapped = p.alreadyMapped && p.mappedProjectCode !== '__DISMISSED__';
    if (statusFilter === 'mapped' && !isTrulyMapped) return false;
    if (statusFilter === 'unmapped' && p.alreadyMapped) return false;
    if (statusFilter === 'dismissed' && !isDismissed) return false;
    if (customerFilter && p.customerName !== customerFilter) return false;
    return true;
  });

  const confidenceClass = (confidence) => {
    if (confidence >= 80) return 'adoc-map-confidence--high';
    if (confidence >= 50) return 'adoc-map-confidence--medium';
    return 'adoc-map-confidence--low';
  };

  if (!isPrivileged) {
    return (
      <div className="adoc-map-container">
        <div className="adoc-map-header">
          <h2 className="adoc-map-title">Mapeamento Autodoc</h2>
        </div>
        <div className="adoc-map-empty">
          <p className="adoc-map-empty-title">Acesso restrito</p>
          <p className="adoc-map-empty-hint">Apenas administradores podem gerenciar mapeamentos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="adoc-map-container">
      {/* Header */}
      <div className="adoc-map-header">
        <h2 className="adoc-map-title">Mapeamento Autodoc</h2>
        <div className="adoc-map-header-actions">
          <button
            className="adoc-map-batch-btn"
            onClick={handleConfirmAllSuggestions}
            disabled={loading || projects.length === 0}
          >
            Confirmar Sugestoes {'>'}80%
          </button>
          <button
            className="adoc-map-discover-btn"
            onClick={handleDiscover}
            disabled={discovering}
          >
            {discovering ? (
              <>
                <span className="adoc-spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} />
                Descobrindo...
              </>
            ) : (
              'Descobrir Projetos'
            )}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`adoc-map-toast adoc-map-toast--${toast.type}`}>
          {toast.message}
          <button className="adoc-map-toast-close" onClick={() => setToast(null)}>&times;</button>
        </div>
      )}

      {/* Cobertura Portfolio */}
      <div className="adoc-map-section">
        <h3 className="adoc-map-section-title">Cobertura Portfolio</h3>

        {portfolioLoading ? (
          <div className="adoc-map-loading" style={{ padding: '1.5rem' }}>
            <div className="adoc-map-spinner" />
            <p>Carregando projetos do portfolio...</p>
          </div>
        ) : (
          <>
            {/* Filtros */}
            <div className="adoc-map-filters">
              <div className="adoc-map-filter-group">
                <label>Status Projeto:</label>
                <select
                  value={statusProjectFilter}
                  onChange={(e) => setStatusProjectFilter(e.target.value)}
                  className="adoc-map-select"
                >
                  <option value="all">Todos</option>
                  <option value="active">Ativos</option>
                  <option value="active+starting">Ativos + A iniciar</option>
                </select>
              </div>
              <div className="adoc-map-filter-group">
                <label>Plataforma ACD:</label>
                <div className="adoc-map-chips">
                  <button
                    className={`adoc-map-chip ${plataformaFilters.size === 0 ? 'adoc-map-chip--active' : ''}`}
                    onClick={() => setPlataformaFilters(new Set())}
                  >
                    Todos
                  </button>
                  <button
                    className={`adoc-map-chip ${plataformaFilters.has('__null__') ? 'adoc-map-chip--active' : ''}`}
                    onClick={() => setPlataformaFilters(prev => {
                      const next = new Set(prev);
                      if (next.has('__null__')) next.delete('__null__'); else next.add('__null__');
                      return next;
                    })}
                  >
                    Nao definido
                  </button>
                  {portfolioCoverage.plataformas.map(p => (
                    <button
                      key={p}
                      className={`adoc-map-chip ${plataformaFilters.has(p.toLowerCase()) ? 'adoc-map-chip--active' : ''}`}
                      onClick={() => setPlataformaFilters(prev => {
                        const next = new Set(prev);
                        const val = p.toLowerCase();
                        if (next.has(val)) next.delete(val); else next.add(val);
                        return next;
                      })}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="adoc-map-filter-group">
                <label>Mapeamento:</label>
                <select
                  value={statusMappingFilter}
                  onChange={(e) => setStatusMappingFilter(e.target.value)}
                  className="adoc-map-select"
                >
                  <option value="all">Todos</option>
                  <option value="mapped">Vinculados</option>
                  <option value="unmapped">Nao vinculados</option>
                </select>
              </div>
              <div className="adoc-map-filter-group">
                <label>Cliente:</label>
                <select
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="adoc-map-select"
                >
                  <option value="">Todos</option>
                  {portfolioCoverage.clients.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="adoc-map-filter-group">
                <label>Buscar:</label>
                <input
                  type="text"
                  className="adoc-map-search-input"
                  placeholder="Buscar por codigo ou nome..."
                  value={portfolioSearch}
                  onChange={(e) => setPortfolioSearch(e.target.value)}
                />
              </div>
              <div className="adoc-map-coverage-stats">
                <span className="adoc-map-coverage-stat">
                  Total: <strong>{portfolioCoverage.totalFiltered}</strong>
                </span>
                <span className="adoc-map-coverage-stat adoc-map-coverage-stat--success">
                  Vinculados: <strong>{portfolioCoverage.mappedCount}</strong>
                </span>
                <span className="adoc-map-coverage-stat adoc-map-coverage-stat--danger">
                  Sem vinculo: <strong>{portfolioCoverage.unmappedCount}</strong>
                </span>
              </div>
            </div>

            {/* Tabela */}
            <div className="adoc-map-table-wrapper">
              <table className="adoc-map-table">
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Nome Comercial</th>
                    <th>Status</th>
                    <th>Plataforma ACD</th>
                    <th>Mapeamento Autodoc</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioCoverage.enriched.map((p) => (
                    <tr key={p.project_code}>
                      <td><strong>{p.project_code}</strong></td>
                      <td>{p.name || p.comercial_name}</td>
                      <td>
                        <span className={`adoc-map-status-badge ${
                          ['planejamento', 'fase 01', 'fase 02', 'fase 03', 'fase 04'].includes((p.status || '').toLowerCase())
                            ? 'adoc-map-status-badge--active'
                            : 'adoc-map-status-badge--inactive'
                        }`}>
                          {p.status || '-'}
                        </span>
                      </td>
                      <td>{p.plataforma_acd || (<span style={{ color: '#9ca3af' }}>-</span>)}</td>
                      <td>
                        {p.isMapped ? (
                          <div className="adoc-map-coverage-link-row">
                            <div>
                              {p.autodocProjectNames.map((name, i) => (
                                <span key={i} className="adoc-map-mapped-badge" style={{ marginRight: 4, marginBottom: 2 }}>
                                  {name}
                                </span>
                              ))}
                            </div>
                            <button
                              className="adoc-map-action-btn adoc-map-action-btn--danger"
                              onClick={() => handleCoverageUnlink(p.project_code)}
                              disabled={coverageLinkSaving[p.project_code]}
                            >
                              {coverageLinkSaving[p.project_code] ? '...' : 'Desvincular'}
                            </button>
                          </div>
                        ) : unmappedAutodocProjects.length > 0 ? (
                          <div className="adoc-map-coverage-link-row">
                            <input
                              type="text"
                              className="adoc-map-search-input"
                              placeholder="Filtrar Autodoc..."
                              value={coverageAutodocSearch}
                              onChange={(e) => setCoverageAutodocSearch(e.target.value)}
                              style={{ minWidth: 120, maxWidth: 150 }}
                            />
                            <select
                              className="adoc-map-portfolio-select"
                              value={coverageLinkSelection[p.project_code] || ''}
                              onChange={(e) => setCoverageLinkSelection(prev => ({ ...prev, [p.project_code]: e.target.value }))}
                            >
                              <option value="">Selecionar Autodoc...</option>
                              {filteredUnmappedAutodoc.map(ap => (
                                <option
                                  key={`${ap.customerId}::${ap.projectFolderId}`}
                                  value={`${ap.customerId}::${ap.projectFolderId}`}
                                >
                                  {ap.customerName} / {ap.projectName}
                                </option>
                              ))}
                            </select>
                            <button
                              className="adoc-map-action-btn adoc-map-action-btn--primary"
                              onClick={() => handleCoverageLink(p.project_code)}
                              disabled={coverageLinkSaving[p.project_code] || !coverageLinkSelection[p.project_code]}
                            >
                              {coverageLinkSaving[p.project_code] ? '...' : 'Vincular'}
                            </button>
                          </div>
                        ) : (
                          <span className="adoc-map-coverage-unmapped">
                            Nao vinculado
                            <span className="adoc-map-coverage-hint"> (execute Descoberta)</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {portfolioCoverage.enriched.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: '#9ca3af', padding: '1.5rem' }}>
                        Nenhum projeto encontrado com os filtros selecionados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Descoberta de Projetos */}
      <div className="adoc-map-section">
        <h3 className="adoc-map-section-title">Descoberta de Projetos</h3>
      </div>

      {/* Filters */}
      {projects.length > 0 && (
        <div className="adoc-map-filters">
          <div className="adoc-map-filter-group">
            <label>Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="adoc-map-select"
            >
              <option value="all">Todos</option>
              <option value="mapped">Mapeados</option>
              <option value="unmapped">Nao mapeados</option>
              <option value="dismissed">Descartados</option>
            </select>
          </div>
          <div className="adoc-map-filter-group">
            <label>Conta:</label>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="adoc-map-select"
            >
              <option value="">Todas</option>
              {customers.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="adoc-map-filter-count">
            <strong>{filteredProjects.length}</strong> projeto{filteredProjects.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Content */}
      {discovering ? (
        <div className="adoc-map-loading">
          <div className="adoc-map-spinner" />
          <p>Descobrindo projetos nas 26 contas Autodoc...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="adoc-map-empty">
          <p className="adoc-map-empty-title">Nenhum projeto descoberto</p>
          <p className="adoc-map-empty-hint">Clique em "Descobrir Projetos" para listar os projetos Autodoc</p>
        </div>
      ) : (
        <div className="adoc-map-table-wrapper">
          <table className="adoc-map-table">
            <thead>
              <tr>
                <th>Conta Autodoc</th>
                <th>Projeto Autodoc</th>
                <th>Sugestao / Vinculado</th>
                <th style={{ width: 200 }}>Portfolio</th>
                <th style={{ width: 180 }}>Acao</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => {
                const key = `${project.customerId}::${project.projectFolderId}`;
                const isSaving = saving[key];

                const isDismissed = project.alreadyMapped && project.mappedProjectCode === '__DISMISSED__';
                const isTrulyMapped = project.alreadyMapped && !isDismissed;

                return (
                  <tr key={key} className={isTrulyMapped ? 'adoc-map-row--mapped' : ''}>
                    <td className="adoc-map-customer">{project.customerName}</td>
                    <td className="adoc-map-project">{project.projectName}</td>
                    <td>
                      {isTrulyMapped ? (
                        <span className="adoc-map-mapped-badge">{project.mappedProjectCode}</span>
                      ) : isDismissed ? (
                        <span className="adoc-map-dismissed-badge">Nao e Otus</span>
                      ) : project.suggestedMatch ? (
                        <span className={`adoc-map-confidence ${confidenceClass(project.suggestedMatch.confidence)}`}>
                          {project.suggestedMatch.projectCode} ({project.suggestedMatch.confidence}%)
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Sem sugestao</span>
                      )}
                    </td>
                    <td>
                      {!project.alreadyMapped && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <input
                            type="text"
                            className="adoc-map-search-input"
                            placeholder="Buscar projeto..."
                            value={discoveryPortfolioSearch}
                            onChange={(e) => setDiscoveryPortfolioSearch(e.target.value)}
                            style={{ minWidth: 140, padding: '3px 6px', fontSize: '0.75rem' }}
                          />
                          <select
                            className="adoc-map-portfolio-select"
                            value={selectedCodes[key] || ''}
                            onChange={(e) => setSelectedCodes(prev => ({ ...prev, [key]: e.target.value }))}
                          >
                            <option value="">Selecionar...</option>
                            {filteredPortfolioCodes.map(code => (
                              <option key={code} value={code}>{portfolioNameMap.get(code) || code} ({code})</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="adoc-map-actions">
                        {isTrulyMapped ? (
                          <button
                            className="adoc-map-action-btn adoc-map-action-btn--danger"
                            onClick={() => handleUnlink(project)}
                            disabled={isSaving}
                          >
                            {isSaving ? '...' : 'Desvincular'}
                          </button>
                        ) : isDismissed ? (
                          <button
                            className="adoc-map-action-btn adoc-map-action-btn--muted"
                            onClick={() => handleUnlink(project)}
                            disabled={isSaving}
                          >
                            {isSaving ? '...' : 'Desfazer'}
                          </button>
                        ) : (
                          <>
                            <button
                              className="adoc-map-action-btn adoc-map-action-btn--primary"
                              onClick={() => handleLink(project)}
                              disabled={isSaving || !selectedCodes[key]}
                            >
                              {isSaving ? '...' : (project.suggestedMatch ? 'Confirmar' : 'Vincular')}
                            </button>
                            <button
                              className="adoc-map-action-btn adoc-map-action-btn--muted"
                              onClick={() => handleDismiss(project)}
                              disabled={isSaving}
                            >
                              {isSaving ? '...' : 'Nao e Otus'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
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
