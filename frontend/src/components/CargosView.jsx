/**
 * Componente: Vista de Cargos
 *
 * Gerencia as permissões de acesso padrão por cargo.
 * Mostra cargos agrupados por setor com suas vistas permitidas.
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import '../styles/CargosView.css';

// Ícones inline
const Icons = {
  Users: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Building: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M12 6h.01" />
      <path d="M12 10h.01" />
      <path d="M12 14h.01" />
      <path d="M16 10h.01" />
      <path d="M16 14h.01" />
      <path d="M8 10h.01" />
      <path d="M8 14h.01" />
    </svg>
  ),
  Edit: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Refresh: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  Star: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  Eye: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
};

function CargosView() {
  const [positions, setPositions] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [views, setViews] = useState([]);
  const [accessRules, setAccessRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [selectedViews, setSelectedViews] = useState([]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [positionsRes, sectorsRes, viewsRes, rulesRes] = await Promise.all([
        axios.get(`${API_URL}/api/ind/positions`, { withCredentials: true }),
        axios.get(`${API_URL}/api/ind/sectors`, { withCredentials: true }),
        axios.get(`${API_URL}/api/admin/views`, { withCredentials: true }),
        axios.get(`${API_URL}/api/admin/access-defaults`, { withCredentials: true }),
      ]);

      if (positionsRes.data?.success) setPositions(positionsRes.data.data || []);
      if (sectorsRes.data?.success) setSectors(sectorsRes.data.data || []);
      if (viewsRes.data?.success) setViews(viewsRes.data.data || []);
      if (rulesRes.data?.success) setAccessRules(rulesRes.data.data || []);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Agrupar cargos por setor
  const positionsBySector = positions.reduce((acc, pos) => {
    const sectorId = pos.sector_id || 'sem-setor';
    if (!acc[sectorId]) acc[sectorId] = [];
    acc[sectorId].push(pos);
    return acc;
  }, {});

  // Contar vistas por cargo
  const getViewsForPosition = (positionId) => {
    return accessRules.filter(r => r.position_id === positionId && r.has_access);
  };

  // Abrir modal de edição
  const openEditModal = (position) => {
    setSelectedPosition(position);
    const currentViews = getViewsForPosition(position.id).map(r => r.view_id);
    setSelectedViews(currentViews);
    setEditModalOpen(true);
  };

  // Toggle view selection
  const toggleView = (viewId) => {
    setSelectedViews(prev =>
      prev.includes(viewId) ? prev.filter(v => v !== viewId) : [...prev, viewId]
    );
  };

  // Salvar alterações
  const saveChanges = async () => {
    if (!selectedPosition) return;

    try {
      setSaving(true);

      // Regras atuais do cargo
      const currentRules = accessRules.filter(r => r.position_id === selectedPosition.id);
      const currentViewIds = currentRules.map(r => r.view_id);

      // Views a adicionar
      const toAdd = selectedViews.filter(v => !currentViewIds.includes(v));
      // Views a remover
      const toRemove = currentRules.filter(r => !selectedViews.includes(r.view_id));

      // Adicionar novas regras
      for (const viewId of toAdd) {
        await axios.post(
          `${API_URL}/api/admin/access-defaults`,
          {
            view_id: viewId,
            position_id: selectedPosition.id,
            has_access: true,
          },
          { withCredentials: true }
        );
      }

      // Remover regras antigas
      for (const rule of toRemove) {
        await axios.delete(`${API_URL}/api/admin/access-defaults/${rule.id}`, {
          withCredentials: true,
        });
      }

      // Recarregar dados
      await fetchData();
      setEditModalOpen(false);
      setSelectedPosition(null);
    } catch (err) {
      console.error('Erro ao salvar alterações:', err);
      alert('Erro ao salvar alterações. Verifique o console.');
    } finally {
      setSaving(false);
    }
  };

  // Agrupar views por área para o modal
  const viewsByArea = views.reduce((acc, view) => {
    const area = view.area || 'outros';
    if (!acc[area]) acc[area] = [];
    acc[area].push(view);
    return acc;
  }, {});

  const areaLabels = {
    home: 'Home',
    projetos: 'Projetos',
    indicadores: 'Indicadores',
    okrs: 'OKRs',
    configuracoes: 'Configurações',
    outros: 'Outros',
  };

  if (loading) {
    return (
      <div className="cargos-container">
        <div className="cargos-loading">Carregando cargos...</div>
      </div>
    );
  }

  return (
    <div className="cargos-container">
      {/* Header */}
      <div className="cargos-header">
        <div className="cargos-title-section">
          <h2>Permissões por Cargo</h2>
          <p className="cargos-subtitle">
            Configure quais vistas cada cargo pode acessar por padrão
          </p>
        </div>
        <button className="btn-refresh" onClick={fetchData}>
          <Icons.Refresh />
          Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="cargos-stats">
        <div className="stat-card">
          <div className="stat-icon">
            <Icons.Building />
          </div>
          <div className="stat-info">
            <span className="stat-value">{sectors.length}</span>
            <span className="stat-label">Setores</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <Icons.Users />
          </div>
          <div className="stat-info">
            <span className="stat-value">{positions.length}</span>
            <span className="stat-label">Cargos</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <Icons.Eye />
          </div>
          <div className="stat-info">
            <span className="stat-value">{views.length}</span>
            <span className="stat-label">Vistas</span>
          </div>
        </div>
        <div className="stat-card highlight-yellow">
          <div className="stat-icon">
            <Icons.Check />
          </div>
          <div className="stat-info">
            <span className="stat-value">{accessRules.filter(r => r.position_id).length}</span>
            <span className="stat-label">Regras Ativas</span>
          </div>
        </div>
      </div>

      {/* Sectors and Positions */}
      <div className="sectors-grid">
        {sectors.map(sector => {
          const sectorPositions = positionsBySector[sector.id] || [];
          if (sectorPositions.length === 0) return null;

          return (
            <div key={sector.id} className="sector-card">
              <div className="sector-header">
                <Icons.Building />
                <h3>{sector.name}</h3>
                <span className="sector-count">{sectorPositions.length} cargos</span>
              </div>
              <div className="positions-list">
                {sectorPositions
                  .sort((a, b) => (b.is_leadership ? 1 : 0) - (a.is_leadership ? 1 : 0))
                  .map(position => {
                    const posViews = getViewsForPosition(position.id);
                    return (
                      <div key={position.id} className="position-item">
                        <div className="position-info">
                          <span className="position-name">
                            {position.is_leadership && (
                              <span className="leadership-badge" title="Cargo de liderança">
                                <Icons.Star />
                              </span>
                            )}
                            {position.name}
                          </span>
                          <span className="position-views-count">
                            {posViews.length} {posViews.length === 1 ? 'vista' : 'vistas'}
                          </span>
                        </div>
                        <button
                          className="btn-edit-position"
                          onClick={() => openEditModal(position)}
                          title="Editar vistas do cargo"
                        >
                          <Icons.Edit />
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}

        {/* Cargos sem setor */}
        {positionsBySector['sem-setor']?.length > 0 && (
          <div className="sector-card">
            <div className="sector-header">
              <Icons.Building />
              <h3>Sem Setor Definido</h3>
              <span className="sector-count">
                {positionsBySector['sem-setor'].length} cargos
              </span>
            </div>
            <div className="positions-list">
              {positionsBySector['sem-setor'].map(position => {
                const posViews = getViewsForPosition(position.id);
                return (
                  <div key={position.id} className="position-item">
                    <div className="position-info">
                      <span className="position-name">{position.name}</span>
                      <span className="position-views-count">
                        {posViews.length} {posViews.length === 1 ? 'vista' : 'vistas'}
                      </span>
                    </div>
                    <button
                      className="btn-edit-position"
                      onClick={() => openEditModal(position)}
                    >
                      <Icons.Edit />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Edição */}
      {editModalOpen && selectedPosition && (
        <div className="modal-overlay" onClick={() => setEditModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Editar Vistas - {selectedPosition.name}</h3>
              <button className="modal-close" onClick={() => setEditModalOpen(false)}>
                <Icons.X />
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-description">
                Selecione as vistas que este cargo pode acessar por padrão.
              </p>

              {Object.entries(viewsByArea).map(([area, areaViews]) => (
                <div key={area} className="views-area-section">
                  <h4 className="area-title">{areaLabels[area] || area}</h4>
                  <div className="views-grid">
                    {areaViews.map(view => (
                      <label key={view.id} className="view-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedViews.includes(view.id)}
                          onChange={() => toggleView(view.id)}
                        />
                        <span className="checkmark">
                          <Icons.Check />
                        </span>
                        <span className="view-name">{view.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-footer">
              <button
                className="btn-cancel"
                onClick={() => setEditModalOpen(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button className="btn-save" onClick={saveChanges} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CargosView;
