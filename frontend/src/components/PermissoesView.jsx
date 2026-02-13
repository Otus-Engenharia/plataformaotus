/**
 * Componente: Vista de Permissões Unificada
 *
 * Gerencia permissões de módulos com visualização em matriz.
 * Substitui: OperacaoView, CargosView, HomeModulesView
 *
 * Seções:
 * 1. Matriz de Acesso - Grid visual módulos × níveis
 * 2. Módulos - Lista editável
 * 3. Exceções - Overrides por usuário/cargo
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/PermissoesView.css';

// Labels das áreas
const AREA_LABELS = {
  home: 'Home',
  projetos: 'Projetos',
  indicadores: 'Indicadores',
  okrs: 'OKRs',
  configuracoes: 'Configurações',
};

// Ícones inline
const Icons = {
  Grid: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  List: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  Users: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Refresh: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Home: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  Edit: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Plus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  ChevronDown: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  ChevronRight: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
};

function PermissoesView() {
  const { isDev } = useAuth();
  const [activeSection, setActiveSection] = useState('matrix');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [matrixData, setMatrixData] = useState(null);
  const [overrides, setOverrides] = useState([]);
  const [expandedAreas, setExpandedAreas] = useState({});
  const [sectors, setSectors] = useState([]);

  // Modal states
  const [editingModule, setEditingModule] = useState(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [newOverride, setNewOverride] = useState({ module_id: '', user_email: '', sector_id: '', grant_access: true });

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [matrixRes, overridesRes, sectorsRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/modules/access-matrix`, { withCredentials: true }),
        axios.get(`${API_URL}/api/admin/module-overrides`, { withCredentials: true }),
        axios.get(`${API_URL}/api/ind/sectors`, { withCredentials: true }),
      ]);

      if (matrixRes.data?.success) {
        setMatrixData(matrixRes.data.data);
        // Expandir todas as áreas por padrão
        const areas = Object.keys(matrixRes.data.data.matrix || {});
        const expanded = {};
        areas.forEach(a => expanded[a] = true);
        setExpandedAreas(expanded);
      }
      if (overridesRes.data?.success) {
        setOverrides(overridesRes.data.data || []);
      }
      if (sectorsRes.data?.success) {
        setSectors(sectorsRes.data.data || []);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toggle área expandida
  const toggleArea = (area) => {
    setExpandedAreas(prev => ({ ...prev, [area]: !prev[area] }));
  };

  // Atualizar nível de acesso de um módulo
  const updateModuleAccess = async (moduleId, newLevel) => {
    try {
      setSaving(true);
      await axios.put(
        `${API_URL}/api/admin/modules/${moduleId}`,
        { min_access_level: newLevel },
        { withCredentials: true }
      );
      await fetchData();
    } catch (err) {
      console.error('Erro ao atualizar módulo:', err);
      alert('Erro ao atualizar módulo');
    } finally {
      setSaving(false);
    }
  };

  // Salvar edição de módulo
  const saveModule = async () => {
    if (!editingModule) return;
    try {
      setSaving(true);
      await axios.put(
        `${API_URL}/api/admin/modules/${editingModule.id}`,
        editingModule,
        { withCredentials: true }
      );
      setEditingModule(null);
      await fetchData();
    } catch (err) {
      console.error('Erro ao salvar módulo:', err);
      alert('Erro ao salvar módulo');
    } finally {
      setSaving(false);
    }
  };

  // Criar override
  const createOverride = async () => {
    if (!newOverride.module_id || (!newOverride.user_email && !newOverride.sector_id)) {
      alert('Preencha módulo e email ou setor');
      return;
    }
    try {
      setSaving(true);
      // Preparar dados - enviar apenas os campos preenchidos
      const overrideData = {
        module_id: newOverride.module_id,
        grant_access: newOverride.grant_access,
      };
      if (newOverride.user_email) overrideData.user_email = newOverride.user_email;
      if (newOverride.sector_id) overrideData.sector_id = newOverride.sector_id;

      await axios.post(
        `${API_URL}/api/admin/module-overrides`,
        overrideData,
        { withCredentials: true }
      );
      setShowOverrideModal(false);
      setNewOverride({ module_id: '', user_email: '', sector_id: '', grant_access: true });
      await fetchData();
    } catch (err) {
      console.error('Erro ao criar exceção:', err);
      alert('Erro ao criar exceção');
    } finally {
      setSaving(false);
    }
  };

  // Helper para obter nome do setor
  const getSectorName = (sectorId) => {
    const sector = sectors.find(s => s.id === sectorId);
    return sector ? sector.name : sectorId;
  };

  // Deletar override
  const deleteOverride = async (id) => {
    if (!confirm('Remover esta exceção?')) return;
    try {
      await axios.delete(`${API_URL}/api/admin/module-overrides/${id}`, { withCredentials: true });
      await fetchData();
    } catch (err) {
      console.error('Erro ao remover exceção:', err);
    }
  };

  // Stats
  const stats = useMemo(() => {
    if (!matrixData?.matrix) return { total: 0, home: 0, overrides: 0 };
    let total = 0;
    let home = 0;
    Object.values(matrixData.matrix).forEach(modules => {
      total += modules.length;
      home += modules.filter(m => m.show_on_home).length;
    });
    return { total, home, overrides: overrides.length };
  }, [matrixData, overrides]);

  // All modules flat list
  const allModules = useMemo(() => {
    if (!matrixData?.matrix) return [];
    const modules = [];
    Object.entries(matrixData.matrix).forEach(([area, areaModules]) => {
      areaModules.forEach(m => modules.push({ ...m, area }));
    });
    return modules;
  }, [matrixData]);

  // Mapa de overrides por setor: { moduleId: { sectorId: grant_access } }
  const sectorOverridesMap = useMemo(() => {
    const map = {};
    overrides.forEach(o => {
      if (o.sector_id && !o.user_email) {
        if (!map[o.module_id]) map[o.module_id] = {};
        map[o.module_id][o.sector_id] = { grant_access: o.grant_access, id: o.id };
      }
    });
    return map;
  }, [overrides]);

  // Toggle acesso à plataforma para um setor
  const toggleSectorPlatformAccess = async (sectorId, currentAccess) => {
    try {
      setSaving(true);
      await axios.put(
        `${API_URL}/api/ind/sectors/${sectorId}/platform-access`,
        { has_platform_access: !currentAccess },
        { withCredentials: true }
      );
      await fetchData();
    } catch (err) {
      console.error('Erro ao alterar acesso do setor:', err);
      alert('Erro ao alterar acesso à plataforma');
    } finally {
      setSaving(false);
    }
  };

  // Toggle acesso de setor para módulo
  const toggleSectorAccess = async (moduleId, sectorId) => {
    try {
      setSaving(true);
      const existingOverride = sectorOverridesMap[moduleId]?.[sectorId];

      if (existingOverride) {
        // Se já existe, remove o override
        await axios.delete(`${API_URL}/api/admin/module-overrides/${existingOverride.id}`, { withCredentials: true });
      } else {
        // Se não existe, cria um override de acesso
        await axios.post(
          `${API_URL}/api/admin/module-overrides`,
          { module_id: moduleId, sector_id: sectorId, grant_access: true },
          { withCredentials: true }
        );
      }
      await fetchData();
    } catch (err) {
      console.error('Erro ao alterar acesso do setor:', err);
      alert('Erro ao alterar acesso');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="permissoes-container">
        <div className="permissoes-loading">Carregando...</div>
      </div>
    );
  }

  const levels = matrixData?.levels || {};
  const labels = matrixData?.labels || {};
  const colors = matrixData?.colors || {};

  return (
    <div className="permissoes-container">
      {/* Header */}
      <div className="permissoes-header">
        <div className="permissoes-title-section">
          <h2>Gerenciamento de Permissões</h2>
          <p className="permissoes-subtitle">Configure quem pode acessar cada módulo do sistema</p>
        </div>
        <button className="btn-refresh" onClick={fetchData} disabled={loading}>
          <Icons.Refresh />
          Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="permissoes-stats">
        <div className="stat-card">
          <div className="stat-icon"><Icons.Grid /></div>
          <div className="stat-info">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Módulos</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Icons.Home /></div>
          <div className="stat-info">
            <span className="stat-value">{stats.home}</span>
            <span className="stat-label">Na Home</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Icons.Users /></div>
          <div className="stat-info">
            <span className="stat-value">{stats.overrides}</span>
            <span className="stat-label">Exceções</span>
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="permissoes-tabs">
        <button
          className={`tab-btn ${activeSection === 'platform' ? 'active' : ''}`}
          onClick={() => setActiveSection('platform')}
        >
          <Icons.Check />
          Acesso à Plataforma
        </button>
        <button
          className={`tab-btn ${activeSection === 'matrix' ? 'active' : ''}`}
          onClick={() => setActiveSection('matrix')}
        >
          <Icons.Grid />
          Matriz de Acesso
        </button>
        <button
          className={`tab-btn ${activeSection === 'sectors' ? 'active' : ''}`}
          onClick={() => setActiveSection('sectors')}
        >
          <Icons.Users />
          Matriz por Setor
        </button>
        <button
          className={`tab-btn ${activeSection === 'modules' ? 'active' : ''}`}
          onClick={() => setActiveSection('modules')}
        >
          <Icons.List />
          Módulos
        </button>
        <button
          className={`tab-btn ${activeSection === 'overrides' ? 'active' : ''}`}
          onClick={() => setActiveSection('overrides')}
        >
          <Icons.Users />
          Exceções
        </button>
      </div>

      {/* Section Content */}
      <div className="permissoes-content">
        {/* === ACESSO À PLATAFORMA === */}
        {activeSection === 'platform' && (
          <div className="platform-access-section">
            <div className="platform-access-header">
              <h3>Controle de Acesso por Setor</h3>
              <p>Libere ou bloqueie o acesso à plataforma para cada setor. Líderes e admins sempre têm acesso.</p>
            </div>
            <div className="platform-access-grid">
              {sectors.map(sector => (
                <div
                  key={sector.id}
                  className={`platform-access-card ${sector.has_platform_access ? 'enabled' : 'disabled'}`}
                >
                  <div className="platform-access-card-info">
                    <span className="platform-access-card-name">{sector.name}</span>
                    <span className={`platform-access-status ${sector.has_platform_access ? 'enabled' : 'disabled'}`}>
                      {sector.has_platform_access ? 'Liberado' : 'Bloqueado'}
                    </span>
                  </div>
                  <button
                    className={`platform-access-toggle ${sector.has_platform_access ? 'enabled' : ''}`}
                    onClick={() => toggleSectorPlatformAccess(sector.id, sector.has_platform_access)}
                    disabled={saving}
                    title={sector.has_platform_access ? 'Clique para bloquear' : 'Clique para liberar'}
                  >
                    <span className="toggle-track">
                      <span className="toggle-thumb"></span>
                    </span>
                  </button>
                </div>
              ))}
            </div>
            <div className="platform-access-help">
              <p><strong>Nota:</strong> Quando um setor está bloqueado, apenas líderes, admins e diretores desse setor conseguem acessar a plataforma.</p>
              <p>Usuários comuns verão uma mensagem informando que o setor ainda não foi liberado.</p>
            </div>
          </div>
        )}

        {/* === MATRIZ DE ACESSO === */}
        {activeSection === 'matrix' && matrixData?.matrix && (
          <div className="matrix-section">
            <div className="matrix-legend">
              <span className="legend-item granted">
                <span className="legend-dot granted"></span>
                Tem acesso
              </span>
              <span className="legend-item denied">
                <span className="legend-dot denied"></span>
                Sem acesso
              </span>
              <span className="legend-item home">
                <Icons.Home />
                Exibido na Home
              </span>
            </div>

            <div className="matrix-table-wrapper">
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th className="col-module">Módulo</th>
                    {Object.entries(labels).map(([level, label]) => (
                      <th key={level} style={{ color: colors[level] }}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(matrixData.matrix).map(([area, areaModules]) => (
                    <React.Fragment key={area}>
                      <tr className="area-row" onClick={() => toggleArea(area)}>
                        <td colSpan={Object.keys(labels).length + 1}>
                          <span className="area-toggle">
                            {expandedAreas[area] ? <Icons.ChevronDown /> : <Icons.ChevronRight />}
                          </span>
                          <span className="area-name">{AREA_LABELS[area] || area}</span>
                          <span className="area-count">{areaModules.length}</span>
                        </td>
                      </tr>
                      {expandedAreas[area] && areaModules.map(module => (
                        <tr key={module.id} className="module-row">
                          <td className="col-module">
                            <div className="module-cell">
                              {module.show_on_home && (
                                <span className="home-badge" title="Exibido na Home">
                                  <Icons.Home />
                                </span>
                              )}
                              <span className="module-name">{module.name}</span>
                              <span className="module-path">{module.path}</span>
                            </div>
                          </td>
                          {Object.entries(levels).map(([role, level]) => {
                            const hasAccess = level <= module.min_access_level;
                            const isCurrentLevel = level === module.min_access_level;
                            return (
                              <td
                                key={role}
                                className={`access-cell ${hasAccess ? 'granted' : 'denied'} ${isCurrentLevel ? 'current' : ''}`}
                                onClick={() => updateModuleAccess(module.id, level)}
                                title={`Clique para definir nível mínimo: ${labels[level]}`}
                              >
                                <span className={`access-dot ${hasAccess ? 'granted' : 'denied'}`}>
                                  {hasAccess ? <Icons.Check /> : <Icons.X />}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="matrix-help">
              <p><strong>Como usar:</strong> Clique em uma célula para definir o nível mínimo de acesso para aquele módulo.</p>
              <p>Exemplo: Clicar em "Admin" faz o módulo ser visível para Admin, Diretor e Dev.</p>
            </div>
          </div>
        )}

        {/* === MATRIZ POR SETOR === */}
        {activeSection === 'sectors' && matrixData?.matrix && (
          <div className="matrix-section">
            <div className="matrix-legend">
              <span className="legend-item granted">
                <span className="legend-dot granted"></span>
                Setor tem acesso especial
              </span>
              <span className="legend-item denied">
                <span className="legend-dot denied"></span>
                Sem override (usa permissão padrão)
              </span>
            </div>

            {sectors.length === 0 ? (
              <div className="empty-state">
                <Icons.Users />
                <p>Nenhum setor cadastrado</p>
              </div>
            ) : (
              <div className="matrix-table-wrapper">
                <table className="matrix-table sector-matrix">
                  <thead>
                    <tr>
                      <th className="col-module">Módulo</th>
                      {sectors.map(sector => (
                        <th key={sector.id} title={sector.description || sector.name}>
                          {sector.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(matrixData.matrix).map(([area, areaModules]) => (
                      <React.Fragment key={area}>
                        <tr className="area-row" onClick={() => toggleArea(area)}>
                          <td colSpan={sectors.length + 1}>
                            <span className="area-toggle">
                              {expandedAreas[area] ? <Icons.ChevronDown /> : <Icons.ChevronRight />}
                            </span>
                            <span className="area-name">{AREA_LABELS[area] || area}</span>
                            <span className="area-count">{areaModules.length}</span>
                          </td>
                        </tr>
                        {expandedAreas[area] && areaModules.map(module => (
                          <tr key={module.id} className="module-row">
                            <td className="col-module">
                              <div className="module-cell">
                                {module.show_on_home && (
                                  <span className="home-badge" title="Exibido na Home">
                                    <Icons.Home />
                                  </span>
                                )}
                                <span className="module-name">{module.name}</span>
                                <span className="module-path">{module.path}</span>
                              </div>
                            </td>
                            {sectors.map(sector => {
                              const override = sectorOverridesMap[module.id]?.[sector.id];
                              const hasOverride = !!override;
                              return (
                                <td
                                  key={sector.id}
                                  className={`access-cell ${hasOverride ? 'granted current' : 'denied'}`}
                                  onClick={() => toggleSectorAccess(module.id, sector.id)}
                                  title={hasOverride
                                    ? `${sector.name} tem acesso especial. Clique para remover.`
                                    : `Clique para dar acesso especial ao setor ${sector.name}`}
                                >
                                  <span className={`access-dot ${hasOverride ? 'granted' : 'denied'}`}>
                                    {hasOverride ? <Icons.Check /> : <Icons.X />}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="matrix-help">
              <p><strong>Como usar:</strong> Clique em uma célula para conceder acesso especial ao setor para aquele módulo.</p>
              <p>Isso cria uma exceção que permite o acesso independente do papel do usuário (desde que ele pertença ao setor).</p>
            </div>
          </div>
        )}

        {/* === LISTA DE MÓDULOS === */}
        {activeSection === 'modules' && (
          <div className="modules-section">
            <table className="modules-table">
              <thead>
                <tr>
                  <th>Módulo</th>
                  <th>Área</th>
                  <th>Rota</th>
                  <th>Nível Mínimo</th>
                  <th>Home</th>
                  <th>Visível</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {allModules.map(module => (
                  <tr key={module.id}>
                    <td>
                      <div className="module-info">
                        <span className="color-dot" style={{ backgroundColor: module.color }}></span>
                        <strong>{module.name}</strong>
                      </div>
                    </td>
                    <td>{AREA_LABELS[module.area] || module.area}</td>
                    <td><code>{module.path}</code></td>
                    <td>
                      <select
                        value={module.min_access_level}
                        onChange={(e) => updateModuleAccess(module.id, parseInt(e.target.value))}
                        className="level-select"
                        style={{ borderColor: colors[module.min_access_level] }}
                      >
                        {Object.entries(labels).map(([level, label]) => (
                          <option key={level} value={level}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={`badge ${module.show_on_home ? 'yes' : 'no'}`}>
                        {module.show_on_home ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${module.visible ? 'yes' : 'no'}`}>
                        {module.visible ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-icon"
                        onClick={() => setEditingModule({ ...module })}
                        title="Editar módulo"
                      >
                        <Icons.Edit />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* === EXCEÇÕES === */}
        {activeSection === 'overrides' && (
          <div className="overrides-section">
            <div className="overrides-header">
              <p>Exceções permitem conceder ou negar acesso a módulos específicos para usuários ou setores.</p>
              <button className="btn-primary" onClick={() => setShowOverrideModal(true)}>
                <Icons.Plus />
                Nova Exceção
              </button>
            </div>

            {overrides.length === 0 ? (
              <div className="empty-state">
                <Icons.Users />
                <p>Nenhuma exceção configurada</p>
              </div>
            ) : (
              <table className="overrides-table">
                <thead>
                  <tr>
                    <th>Módulo</th>
                    <th>Aplicado a</th>
                    <th>Tipo</th>
                    <th>Criado em</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {overrides.map(override => (
                    <tr key={override.id}>
                      <td>{override.module_id}</td>
                      <td>
                        {override.user_email
                          ? `Usuário: ${override.user_email}`
                          : override.sector_id
                            ? `Setor: ${getSectorName(override.sector_id)}`
                            : override.position_id
                              ? `Cargo: ${override.position_id}`
                              : '-'}
                      </td>
                      <td>
                        <span className={`badge ${override.grant_access ? 'yes' : 'no'}`}>
                          {override.grant_access ? 'Conceder' : 'Negar'}
                        </span>
                      </td>
                      <td>{new Date(override.created_at).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <button
                          className="btn-icon danger"
                          onClick={() => deleteOverride(override.id)}
                          title="Remover exceção"
                        >
                          <Icons.Trash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Modal: Editar Módulo */}
      {editingModule && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Editar Módulo</h3>
            <div className="form-group">
              <label>Nome</label>
              <input
                type="text"
                value={editingModule.name}
                onChange={e => setEditingModule({ ...editingModule, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Rota</label>
              <input
                type="text"
                value={editingModule.path}
                onChange={e => setEditingModule({ ...editingModule, path: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Cor</label>
              <input
                type="color"
                value={editingModule.color}
                onChange={e => setEditingModule({ ...editingModule, color: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={editingModule.show_on_home}
                  onChange={e => setEditingModule({ ...editingModule, show_on_home: e.target.checked })}
                />
                Exibir na Home
              </label>
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={editingModule.visible}
                  onChange={e => setEditingModule({ ...editingModule, visible: e.target.checked })}
                />
                Visível
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setEditingModule(null)}>Cancelar</button>
              <button className="btn-primary" onClick={saveModule} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nova Exceção */}
      {showOverrideModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Nova Exceção</h3>
            <div className="form-group">
              <label>Módulo</label>
              <select
                value={newOverride.module_id}
                onChange={e => setNewOverride({ ...newOverride, module_id: e.target.value })}
              >
                <option value="">Selecione...</option>
                {allModules.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Email do Usuário (opcional se setor preenchido)</label>
              <input
                type="email"
                value={newOverride.user_email}
                onChange={e => setNewOverride({ ...newOverride, user_email: e.target.value })}
                placeholder="usuario@otusengenharia.com"
              />
            </div>
            <div className="form-group">
              <label>Setor (opcional se email preenchido)</label>
              <select
                value={newOverride.sector_id}
                onChange={e => setNewOverride({ ...newOverride, sector_id: e.target.value })}
              >
                <option value="">Nenhum setor</option>
                {sectors.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <small style={{ color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>
                Preencha email para exceção individual ou setor para exceção por setor
              </small>
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select
                value={newOverride.grant_access}
                onChange={e => setNewOverride({ ...newOverride, grant_access: e.target.value === 'true' })}
              >
                <option value="true">Conceder acesso</option>
                <option value="false">Negar acesso</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowOverrideModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={createOverride} disabled={saving}>
                {saving ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PermissoesView;
