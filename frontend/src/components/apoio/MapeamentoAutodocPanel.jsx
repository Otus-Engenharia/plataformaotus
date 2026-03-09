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
  const [manualForm, setManualForm] = useState({
    customerId: '', customerName: '', projectFolderId: '', projectName: '', portfolioCode: ''
  });
  const [manualSaving, setManualSaving] = useState(false);

  // Cobertura Portfolio
  const [portfolioProjects, setPortfolioProjects] = useState([]);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [plataformaFilter, setPlataformaFilter] = useState('autodoc');
  const [statusMappingFilter, setStatusMappingFilter] = useState('all');

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

  const handleUnlinkMapping = async (mapping) => {
    const key = `mapping-${mapping.id}`;
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      await autodocEntregasApi.deleteMapping(mapping.id);
      setToast({ type: 'success', message: `${mapping.autodoc_project_name} desvinculado` });
      fetchMappings();
      // Atualizar lista de descoberta se estiver visivel
      setProjects(prev => prev.map(p => {
        if (p.customerId === mapping.autodoc_customer_id && p.projectFolderId === mapping.autodoc_project_folder_id) {
          return { ...p, alreadyMapped: false, mappedProjectCode: null };
        }
        return p;
      }));
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.error || err.message });
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleManualLink = async () => {
    const { customerId, customerName, projectFolderId, projectName, portfolioCode } = manualForm;
    if (!customerId || !customerName || !projectFolderId || !projectName || !portfolioCode) {
      setToast({ type: 'error', message: 'Preencha todos os campos para vincular manualmente' });
      return;
    }
    setManualSaving(true);
    try {
      await autodocEntregasApi.createMapping({
        portfolioProjectCode: portfolioCode,
        autodocCustomerId: customerId,
        autodocCustomerName: customerName,
        autodocProjectFolderId: projectFolderId,
        autodocProjectName: projectName,
      });
      setToast({ type: 'success', message: `${projectName} vinculado a ${portfolioCode}` });
      setManualForm({ customerId: '', customerName: '', projectFolderId: '', projectName: '', portfolioCode: '' });
      fetchMappings();
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.error || err.message });
    } finally {
      setManualSaving(false);
    }
  };

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

    // Filtrar projetos
    const filtered = portfolioProjects.filter(p => {
      if (plataformaFilter === '__null__') {
        if (p.plataforma_acd) return false;
      } else if (plataformaFilter && plataformaFilter !== 'all') {
        if ((p.plataforma_acd || '').toLowerCase() !== plataformaFilter.toLowerCase()) return false;
      }
      const isMapped = mappingsByCode.has(p.project_code);
      if (statusMappingFilter === 'mapped' && !isMapped) return false;
      if (statusMappingFilter === 'unmapped' && isMapped) return false;
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

    return { enriched, plataformas, totalFiltered, mappedCount, unmappedCount };
  }, [portfolioProjects, existingMappings, plataformaFilter, statusMappingFilter]);

  // Filtros Discovery
  const customers = [...new Set(projects.map(p => p.customerName))].sort();

  const filteredProjects = projects.filter(p => {
    if (statusFilter === 'mapped' && !p.alreadyMapped) return false;
    if (statusFilter === 'unmapped' && p.alreadyMapped) return false;
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
                <label>Plataforma ACD:</label>
                <select
                  value={plataformaFilter}
                  onChange={(e) => setPlataformaFilter(e.target.value)}
                  className="adoc-map-select"
                >
                  <option value="all">Todos</option>
                  <option value="__null__">Nao definido</option>
                  {portfolioCoverage.plataformas.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
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
                      <td>{p.comercial_name || p.name}</td>
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
                          p.autodocProjectNames.map((name, i) => (
                            <span key={i} className="adoc-map-mapped-badge" style={{ marginRight: 4, marginBottom: 2 }}>
                              {name}
                            </span>
                          ))
                        ) : (
                          <span className="adoc-map-coverage-unmapped">Nao vinculado</span>
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

      {/* Mapeamentos Existentes */}
      <div className="adoc-map-section">
        <h3 className="adoc-map-section-title">Mapeamentos Atuais</h3>
        {mappingsLoading ? (
          <div className="adoc-map-loading" style={{ padding: '1.5rem' }}>
            <div className="adoc-map-spinner" />
            <p>Carregando mapeamentos...</p>
          </div>
        ) : (
          <div className="adoc-map-table-wrapper">
            <table className="adoc-map-table">
              <thead>
                <tr>
                  <th>Conta Autodoc</th>
                  <th>Projeto Autodoc</th>
                  <th>Codigo Portfolio</th>
                  <th style={{ width: 100 }}>Status</th>
                  <th style={{ width: 120 }}>Acao</th>
                </tr>
              </thead>
              <tbody>
                {existingMappings.map((mapping) => {
                  const key = `mapping-${mapping.id}`;
                  return (
                    <tr key={mapping.id}>
                      <td className="adoc-map-customer">{mapping.autodoc_customer_name}</td>
                      <td className="adoc-map-project">{mapping.autodoc_project_name}</td>
                      <td>
                        <span className="adoc-map-mapped-badge">{mapping.portfolio_project_code}</span>
                      </td>
                      <td>
                        <span className={`adoc-map-status-badge ${mapping.is_active !== false ? 'adoc-map-status-badge--active' : 'adoc-map-status-badge--inactive'}`}>
                          {mapping.is_active !== false ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="adoc-map-action-btn adoc-map-action-btn--danger"
                          onClick={() => handleUnlinkMapping(mapping)}
                          disabled={saving[key]}
                        >
                          {saving[key] ? '...' : 'Desvincular'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {/* Linha de vinculacao manual */}
                <tr className="adoc-map-row--manual">
                  <td>
                    <div className="adoc-map-manual-inputs">
                      <input
                        type="text"
                        className="adoc-map-manual-input"
                        placeholder="Customer ID"
                        value={manualForm.customerId}
                        onChange={(e) => setManualForm(prev => ({ ...prev, customerId: e.target.value }))}
                      />
                      <input
                        type="text"
                        className="adoc-map-manual-input"
                        placeholder="Customer Name"
                        value={manualForm.customerName}
                        onChange={(e) => setManualForm(prev => ({ ...prev, customerName: e.target.value }))}
                      />
                    </div>
                  </td>
                  <td>
                    <div className="adoc-map-manual-inputs">
                      <input
                        type="text"
                        className="adoc-map-manual-input"
                        placeholder="Folder ID"
                        value={manualForm.projectFolderId}
                        onChange={(e) => setManualForm(prev => ({ ...prev, projectFolderId: e.target.value }))}
                      />
                      <input
                        type="text"
                        className="adoc-map-manual-input"
                        placeholder="Project Name"
                        value={manualForm.projectName}
                        onChange={(e) => setManualForm(prev => ({ ...prev, projectName: e.target.value }))}
                      />
                    </div>
                  </td>
                  <td>
                    <select
                      className="adoc-map-portfolio-select"
                      value={manualForm.portfolioCode}
                      onChange={(e) => setManualForm(prev => ({ ...prev, portfolioCode: e.target.value }))}
                    >
                      <option value="">Selecionar portfolio...</option>
                      {portfolioCodes.map(code => (
                        <option key={code} value={code}>{code}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Manual</span>
                  </td>
                  <td>
                    <button
                      className="adoc-map-action-btn adoc-map-action-btn--primary"
                      onClick={handleManualLink}
                      disabled={manualSaving}
                    >
                      {manualSaving ? '...' : 'Vincular'}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
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

                return (
                  <tr key={key} className={project.alreadyMapped ? 'adoc-map-row--mapped' : ''}>
                    <td className="adoc-map-customer">{project.customerName}</td>
                    <td className="adoc-map-project">{project.projectName}</td>
                    <td>
                      {project.alreadyMapped ? (
                        <span className="adoc-map-mapped-badge">{project.mappedProjectCode}</span>
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
                        <select
                          className="adoc-map-portfolio-select"
                          value={selectedCodes[key] || ''}
                          onChange={(e) => setSelectedCodes(prev => ({ ...prev, [key]: e.target.value }))}
                        >
                          <option value="">Selecionar...</option>
                          {portfolioCodes.map(code => (
                            <option key={code} value={code}>{code}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      <div className="adoc-map-actions">
                        {project.alreadyMapped ? (
                          <button
                            className="adoc-map-action-btn adoc-map-action-btn--danger"
                            onClick={() => handleUnlink(project)}
                            disabled={isSaving}
                          >
                            {isSaving ? '...' : 'Desvincular'}
                          </button>
                        ) : (
                          <button
                            className="adoc-map-action-btn adoc-map-action-btn--primary"
                            onClick={() => handleLink(project)}
                            disabled={isSaving || !selectedCodes[key]}
                          >
                            {isSaving ? '...' : (project.suggestedMatch ? 'Confirmar' : 'Vincular')}
                          </button>
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
