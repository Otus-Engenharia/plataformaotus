import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getCurrentCycle, getCurrentYear } from '../../utils/indicator-utils';
import UnifiedEditIndicatorDialog from '../../components/indicadores/dialogs/UnifiedEditIndicatorDialog';
import './AdminPages.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function AdminCargos() {
  const { isPrivileged, user } = useAuth();
  const [positions, setPositions] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSector, setFilterSector] = useState('');
  const [showAllSectors, setShowAllSectors] = useState(false);
  const [userSectorId, setUserSectorId] = useState(null);
  const [expandedPositions, setExpandedPositions] = useState({});
  const [syncing, setSyncing] = useState({});

  // Modal states
  const [showPositionForm, setShowPositionForm] = useState(false);
  const [showUnifiedEdit, setShowUnifiedEdit] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [editingIndicator, setEditingIndicator] = useState(null);
  const [selectedPositionId, setSelectedPositionId] = useState(null);

  const [positionForm, setPositionForm] = useState({
    name: '', description: '', is_leadership: false, sector_id: ''
  });

  // Sector color palette for left-border accent coding
  const SECTOR_COLORS = [
    '#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626',
    '#0891B2', '#BE185D', '#4F46E5', '#15803D', '#B45309',
  ];
  const getSectorColor = (sectorId) => {
    if (!sectorId) return '#48484A';
    let hash = 0;
    for (let i = 0; i < sectorId.length; i++) {
      hash = sectorId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return SECTOR_COLORS[Math.abs(hash) % SECTOR_COLORS.length];
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [posRes, secRes, userRes] = await Promise.all([
        fetch(`${API_URL}/api/ind/positions`, { credentials: 'include' }),
        fetch(`${API_URL}/api/ind/sectors`, { credentials: 'include' }),
        fetch(`${API_URL}/api/user/me`, { credentials: 'include' })
      ]);

      if (posRes.ok) {
        const posData = await posRes.json();
        const positionsData = posData.data || [];

        // Fetch indicators for each position
        const positionsWithIndicators = await Promise.all(
          positionsData.map(async (pos) => {
            try {
              const indRes = await fetch(`${API_URL}/api/ind/positions/${pos.id}/indicators`, { credentials: 'include' });
              if (indRes.ok) {
                const indData = await indRes.json();
                return { ...pos, indicators: indData.data || [] };
              }
            } catch (err) {
              console.error(`Error fetching indicators for position ${pos.id}:`, err);
            }
            return { ...pos, indicators: [] };
          })
        );

        setPositions(positionsWithIndicators);
      }
      if (secRes.ok) {
        const secData = await secRes.json();
        setSectors(secData.data || []);
      }
      // Buscar setor do usuario e definir como filtro padrao
      if (userRes.ok) {
        const userData = await userRes.json();
        if (userData.data?.setor_id) {
          setUserSectorId(userData.data.setor_id);
          setFilterSector(userData.data.setor_id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const togglePosition = (positionId) => {
    setExpandedPositions(prev => ({
      ...prev,
      [positionId]: !prev[positionId]
    }));
  };

  // Filter positions by search term and sector
  const filteredPositions = positions.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSector = !filterSector || p.sector_id === filterSector;
    return matchesSearch && matchesSector;
  });

  // Position CRUD
  const handlePositionSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingPosition
        ? `${API_URL}/api/ind/positions/${editingPosition.id}`
        : `${API_URL}/api/ind/positions`;

      const res = await fetch(url, {
        method: editingPosition ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(positionForm)
      });

      if (!res.ok) throw new Error('Erro ao salvar cargo');

      setShowPositionForm(false);
      setEditingPosition(null);
      setPositionForm({ name: '', description: '', is_leadership: false, sector_id: '' });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeletePosition = async (position) => {
    if (!confirm(`Deseja excluir o cargo "${position.name}"?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/ind/positions/${position.id}`, {
        method: 'DELETE', credentials: 'include'
      });
      if (!res.ok) throw new Error('Erro ao excluir cargo');
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Sincronizar indicadores do cargo com usuarios
  const handleSyncIndicators = async (position) => {
    if (!confirm(`Sincronizar indicadores do cargo "${position.name}" com os usuários?\n\nIsso criará os indicadores faltantes e atualizará os já existentes (preservando check-ins realizados).`)) return;

    setSyncing(prev => ({ ...prev, [position.id]: true }));
    try {
      const ciclo = getCurrentCycle();
      const ano = getCurrentYear();

      const res = await fetch(`${API_URL}/api/ind/positions/${position.id}/sync-indicators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ciclo, ano })
      });

      if (!res.ok) throw new Error('Erro ao sincronizar');

      const data = await res.json();
      if (data.success) {
        const r = data.data;
        const createdNames = r.details?.filter(d => d.action !== 'updated').map(d => `  ✓ ${d.user} → ${d.indicator}`).join('\n') || '';
        const updatedNames = r.details?.filter(d => d.action === 'updated').map(d => `  🔄 ${d.user} → ${d.indicator}`).join('\n') || '';
        const errorLines = r.errors?.length
          ? `\n\n❌ Erros (${r.errors.length}):\n${r.errors.slice(0, 5).map(e => `  ✗ ${e.user} → ${e.indicator}: ${e.error}`).join('\n')}${r.errors.length > 5 ? `\n  ... e mais ${r.errors.length - 5} erros` : ''}`
          : '';
        alert(
          `Sincronização concluída!\n\n` +
          `👥 ${r.usersProcessed} usuários encontrados com este cargo\n` +
          `📊 ${r.created} indicadores criados\n` +
          `🔄 ${r.updated || 0} indicadores atualizados\n` +
          (createdNames ? `\nCriados:\n${createdNames}` : '') +
          (updatedNames ? `\nAtualizados:\n${updatedNames}` : '') +
          errorLines +
          (r.usersProcessed === 0 ? '\n\n⚠️ Nenhum usuário encontrado! Verifique se os membros da equipe têm este cargo atribuído em Admin > Usuários.' : '')
        );
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSyncing(prev => ({ ...prev, [position.id]: false }));
    }
  };

  // Toggle mostrar todos os setores
  const handleToggleAllSectors = () => {
    if (showAllSectors) {
      // Voltar para o setor do usuario
      setFilterSector(userSectorId || '');
    } else {
      // Mostrar todos
      setFilterSector('');
    }
    setShowAllSectors(!showAllSectors);
  };

  // Indicator CRUD
  const openNewIndicatorForm = (positionId) => {
    setSelectedPositionId(positionId);
    setEditingIndicator(null);
    setShowUnifiedEdit(true);
  };

  const handleEditIndicator = (positionId, indicator) => {
    setSelectedPositionId(positionId);
    setEditingIndicator(indicator);
    setShowUnifiedEdit(true);
  };

  const handleUnifiedSubmit = async (data) => {
    const url = editingIndicator
      ? `${API_URL}/api/ind/positions/${selectedPositionId}/indicators/${editingIndicator.id}`
      : `${API_URL}/api/ind/positions/${selectedPositionId}/indicators`;

    const res = await fetch(url, {
      method: editingIndicator ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error || 'Erro ao salvar indicador');
    }

    setShowUnifiedEdit(false);
    setEditingIndicator(null);
    setSelectedPositionId(null);
    fetchData();
  };

  const handleDeleteIndicator = async (positionId, indicator) => {
    if (!confirm(`Deseja remover o indicador "${indicator.title}"?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/ind/positions/${positionId}/indicators/${indicator.id}`, {
        method: 'DELETE', credentials: 'include'
      });
      if (!res.ok) throw new Error('Erro ao remover indicador');
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  if (!isPrivileged) {
    return (
      <div className="admin-page">
        <div className="access-denied-card glass-card">
          <svg viewBox="0 0 24 24" width="48" height="48" className="access-denied-icon">
            <path fill="currentColor" d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/>
          </svg>
          <h3>Acesso restrito</h3>
          <p>Apenas administradores podem gerenciar cargos.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="admin-page loading-state">
        <div className="loading-spinner"></div>
        <p>Carregando cargos...</p>
      </div>
    );
  }

  return (
    <div className="admin-page admin-cargos">
      {/* Header */}
      <header className="admin-header">
        <div>
          <h1>Cargos</h1>
          <p className="admin-subtitle">Gerencie cargos e seus indicadores padrão</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditingPosition(null); setPositionForm({ name: '', description: '', is_leadership: false, sector_id: '' }); setShowPositionForm(true); }}>
          + Novo Cargo
        </button>
      </header>

      {/* Search and Filter */}
      <div className="admin-filters-row">
        <div className="admin-search-container">
          <div className="search-input-wrapper">
            <svg viewBox="0 0 24 24" width="18" height="18" className="search-icon">
              <path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar cargos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
        <div className="admin-filter-container">
          {userSectorId && (
            <span className="current-sector-badge">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
              </svg>
              {sectors.find(s => s.id === userSectorId)?.name || 'Meu Setor'}
            </span>
          )}
          <button
            className={`btn-toggle ${showAllSectors ? 'active' : ''}`}
            onClick={handleToggleAllSectors}
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
            {showAllSectors ? 'Mostrar meu setor' : 'Mostrar todos os setores'}
          </button>
        </div>
      </div>

      {/* Positions Accordion */}
      <div className="positions-accordion">
        {filteredPositions.length === 0 ? (
          <div className="empty-state glass-card">
            <svg viewBox="0 0 24 24" width="48" height="48">
              <path fill="currentColor" d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/>
            </svg>
            <h3>{searchTerm ? 'Nenhum cargo encontrado' : 'Nenhum cargo cadastrado'}</h3>
            <p>{searchTerm ? 'Tente outro termo de busca.' : 'Clique em "Novo Cargo" para adicionar.'}</p>
          </div>
        ) : (
          filteredPositions.map((position, index) => {
            const sector = sectors.find(s => s.id === position.sector_id);
            const isExpanded = expandedPositions[position.id];
            const totalWeight = position.indicators?.reduce((sum, ind) => sum + (ind.default_weight || 0), 0) || 0;
            const sectorColor = getSectorColor(position.sector_id);
            const weightStatus = totalWeight > 100 ? 'exceeded' : totalWeight === 100 ? 'complete' : '';

            return (
              <div key={position.id} className={`accordion-item glass-card ${isExpanded ? 'expanded' : ''}`} style={{ '--i': index, '--sector-color': sectorColor }}>
                {/* Accordion Header */}
                <button
                  className="accordion-trigger"
                  onClick={() => togglePosition(position.id)}
                >
                  <div className="accordion-trigger-content">
                    <div className="position-icon">
                      <svg viewBox="0 0 24 24" width="16" height="16">
                        <path fill="currentColor" d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/>
                      </svg>
                    </div>
                    <div className="position-info">
                      <div className="position-name-row">
                        <span className="position-name">{position.name}</span>
                        {position.is_leadership && <span className="badge badge-gold">Liderança</span>}
                      </div>
                      <div className="position-meta">
                        {sector ? (
                          <span className="position-sector">
                            <svg viewBox="0 0 24 24" width="12" height="12">
                              <path fill="currentColor" d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
                            </svg>
                            {sector.name}
                          </span>
                        ) : (
                          <span className="position-sector">Global</span>
                        )}
                        <span className="separator">•</span>
                        <span>{position.indicators?.length || 0} indicadores</span>
                      </div>
                    </div>
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    className={`accordion-chevron ${isExpanded ? 'rotated' : ''}`}
                  >
                    <path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                  </svg>
                </button>

                {/* Accordion Content */}
                {isExpanded && (
                  <div className="accordion-content">
                    {position.description && (
                      <p className="position-description">{position.description}</p>
                    )}

                    {/* Indicators Section */}
                    <div className="indicators-section">
                      <div className="indicators-header">
                        <h4>Indicadores Padrão</h4>
                        <div className="indicators-header-actions">
                          <button
                            className="btn-small btn-outline"
                            onClick={() => openNewIndicatorForm(position.id)}
                          >
                            + Adicionar
                          </button>
                          {position.indicators?.length > 0 && (
                            <button
                              className="btn-small btn-primary"
                              onClick={() => handleSyncIndicators(position)}
                              disabled={syncing[position.id]}
                              title="Sincroniza indicadores faltantes com usuarios deste cargo"
                            >
                              {syncing[position.id] ? (
                                <>
                                  <svg className="spin" viewBox="0 0 24 24" width="14" height="14">
                                    <path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                                  </svg>
                                  Sincronizando...
                                </>
                              ) : (
                                <>
                                  <svg viewBox="0 0 24 24" width="14" height="14">
                                    <path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                                  </svg>
                                  Sincronizar
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {position.indicators && position.indicators.length > 0 ? (
                        <div className="indicators-list">
                          {position.indicators.map(indicator => (
                            <div key={indicator.id} className={`indicator-row ${indicator.default_weight === 0 ? 'indicator-row--inactive' : ''}`}>
                              <div className="indicator-info">
                                <span className="indicator-title">{indicator.title}</span>
                                <span className="indicator-meta">
                                  Meta: {indicator.default_target}
                                  {indicator.is_inverse && ' \u2022 Inverso'}
                                  {' \u2022 '}
                                  {indicator.auto_calculate === false ? 'Manual' : 'Auto'}
                                </span>
                              </div>
                              <span className={`indicator-weight-chip ${indicator.default_weight === 0 ? 'indicator-weight-chip--inactive' : ''}`}>
                                {indicator.default_weight === 0 ? 'Desativado' : `${indicator.default_weight}%`}
                              </span>
                              <div className="indicator-actions">
                                <button
                                  className="btn-ghost"
                                  onClick={() => handleEditIndicator(position.id, indicator)}
                                >
                                  <svg viewBox="0 0 24 24" width="14" height="14">
                                    <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/>
                                  </svg>
                                  Editar
                                </button>
                                <button
                                  className="btn-ghost btn-danger-text"
                                  onClick={() => handleDeleteIndicator(position.id, indicator)}
                                >
                                  Remover
                                </button>
                              </div>
                            </div>
                          ))}
                          <div className="weight-progress-container">
                            <div className="weight-progress-bar-track">
                              <div
                                className={`weight-progress-bar-fill ${weightStatus}`}
                                style={{ width: `${Math.min(totalWeight, 100)}%` }}
                              />
                            </div>
                            <span className={`weight-progress-label ${weightStatus}`}>
                              {totalWeight}/100
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="empty-indicators">Nenhum indicador padrão configurado</p>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="accordion-footer">
                      <button
                        className="btn-edit-position"
                        onClick={() => {
                          setEditingPosition(position);
                          setPositionForm({
                            name: position.name,
                            description: position.description || '',
                            is_leadership: position.is_leadership || false,
                            sector_id: position.sector_id || ''
                          });
                          setShowPositionForm(true);
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14">
                          <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/>
                        </svg>
                        Editar Cargo
                      </button>
                      <button
                        className="btn-danger-outline"
                        onClick={() => handleDeletePosition(position)}
                      >
                        Excluir Cargo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Novo/Editar Cargo */}
      {showPositionForm && (
        <div className="modal-overlay">
          <div className="modal-content glass-card">
            <div className="modal-header">
              <div>
                <h2>{editingPosition ? 'Editar Cargo' : 'Criar Cargo'}</h2>
                <p className="modal-description">
                  {editingPosition ? 'Altere as informações do cargo' : 'Adicione um novo cargo à organização'}
                </p>
              </div>
              <button className="modal-close" onClick={() => setShowPositionForm(false)}>&times;</button>
            </div>
            <form onSubmit={handlePositionSubmit} className="modal-form">
              <div className="form-group">
                <label>Nome *</label>
                <input
                  type="text"
                  value={positionForm.name}
                  onChange={e => setPositionForm({...positionForm, name: e.target.value})}
                  placeholder="Ex: Analista de Dados"
                  required
                />
              </div>
              <div className="form-group">
                <label>Descrição</label>
                <textarea
                  value={positionForm.description}
                  onChange={e => setPositionForm({...positionForm, description: e.target.value})}
                  placeholder="Descrição das responsabilidades..."
                  rows={2}
                />
              </div>
              <div className="form-group">
                <label>Setor</label>
                <select
                  value={positionForm.sector_id}
                  onChange={e => setPositionForm({...positionForm, sector_id: e.target.value})}
                >
                  <option value="">Nenhum (Global)</option>
                  {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group form-switch-group">
                <div>
                  <label>Cargo de Liderança</label>
                  <p className="form-hint">Líderes podem gerenciar indicadores</p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={positionForm.is_leadership}
                    onChange={e => setPositionForm({...positionForm, is_leadership: e.target.checked})}
                  />
                  <span className="slider"></span>
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowPositionForm(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">{editingPosition ? 'Salvar' : 'Criar Cargo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar/Novo Indicador (Unificado com Metas Mensais) */}
      {showUnifiedEdit && (
        <UnifiedEditIndicatorDialog
          indicador={editingIndicator}
          onSubmit={handleUnifiedSubmit}
          onClose={() => {
            setShowUnifiedEdit(false);
            setEditingIndicator(null);
            setSelectedPositionId(null);
          }}
          isTemplate={true}
          sectors={sectors}
        />
      )}
    </div>
  );
}
