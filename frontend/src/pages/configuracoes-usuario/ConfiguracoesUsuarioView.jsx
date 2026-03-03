import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import SearchableDropdown from '../../components/SearchableDropdown';
import './ConfiguracoesUsuarioView.css';

const CLOSED_PAUSED_STATUSES = [
  'obra finalizada',
  'churn pelo cliente',
  'close',
  'pausado',
  'termo de encerramento',
];

const API_BASE = '/api/user-preferences';

function ConfiguracoesUsuarioView() {
  const { user } = useAuth();
  const myTeamId = user?.team_id;
  const myTeamName = user?.team_name;
  const isOperacao = user?.setor_name === 'Operação';

  const [favoriteProjects, setFavoriteProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selecao (checkboxes)
  const [selectedAvailable, setSelectedAvailable] = useState(new Set());
  const [selectedFavorites, setSelectedFavorites] = useState(new Set());

  // Filtros
  const [searchAvailable, setSearchAvailable] = useState('');
  const [searchFavorites, setSearchFavorites] = useState('');
  const [showMyTeamOnly, setShowMyTeamOnly] = useState(!!myTeamId);
  const [showClosedPaused, setShowClosedPaused] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('');

  // Loading
  const [transferring, setTransferring] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [favRes, projRes, teamRes] = await Promise.all([
        fetch(`${API_BASE}/favorite-projects`, { credentials: 'include' }),
        fetch(`${API_BASE}/projects`, { credentials: 'include' }),
        fetch(`${API_BASE}/teams`, { credentials: 'include' }),
      ]);

      const [favData, projData, teamData] = await Promise.all([
        favRes.json(),
        projRes.json(),
        teamRes.json(),
      ]);

      if (favData.success) setFavoriteProjects(favData.data);
      if (projData.success) setAllProjects(projData.data);
      if (teamData.success) setTeams(teamData.data);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Projetos disponiveis (nao favoritados), com filtros aplicados
  const filteredAvailable = useMemo(() => {
    const favIds = new Set(favoriteProjects.map(p => p.id));
    let list = allProjects.filter(p => !favIds.has(p.id) && (!isOperacao || p.sector === 'Projetos'));

    // Filtro de status (fechados/pausados)
    if (!showClosedPaused) {
      list = list.filter(p => !CLOSED_PAUSED_STATUSES.includes((p.status || '').toLowerCase()));
    }

    // Filtro de time
    if (showMyTeamOnly && myTeamId) {
      list = list.filter(p => p.team_id === myTeamId);
    } else if (selectedTeamId) {
      list = list.filter(p => p.team_id === selectedTeamId);
    }

    // Filtro de busca
    if (searchAvailable.trim()) {
      const q = searchAvailable.toLowerCase();
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.comercial_name || '').toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [allProjects, favoriteProjects, showClosedPaused, showMyTeamOnly, myTeamId, selectedTeamId, searchAvailable]);

  // Favoritos filtrados por busca
  const filteredFavorites = useMemo(() => {
    let list = [...favoriteProjects];

    if (searchFavorites.trim()) {
      const q = searchFavorites.toLowerCase();
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.comercial_name || '').toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [favoriteProjects, searchFavorites]);

  // Toggle helpers para checkboxes (DRY)
  const makeToggle = useCallback((setter) => (projectId) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }, []);

  const toggleAvailable = useMemo(() => makeToggle(setSelectedAvailable), [makeToggle]);
  const toggleFavorite = useMemo(() => makeToggle(setSelectedFavorites), [makeToggle]);

  const makeToggleAll = useCallback((filteredList, selectedSet, setter) => () => {
    const visibleIds = filteredList.map(p => p.id);
    const allSelected = visibleIds.every(id => selectedSet.has(id));
    setter(allSelected ? new Set() : new Set(visibleIds));
  }, []);

  const toggleAllAvailable = useMemo(
    () => makeToggleAll(filteredAvailable, selectedAvailable, setSelectedAvailable),
    [makeToggleAll, filteredAvailable, selectedAvailable]
  );
  const toggleAllFavorites = useMemo(
    () => makeToggleAll(filteredFavorites, selectedFavorites, setSelectedFavorites),
    [makeToggleAll, filteredFavorites, selectedFavorites]
  );

  // Transferir disponiveis → favoritos
  const handleAddSelected = useCallback(async () => {
    if (selectedAvailable.size === 0 || transferring) return;
    setTransferring(true);
    try {
      const ids = [...selectedAvailable];
      const res = await fetch(`${API_BASE}/favorite-projects/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ project_ids: ids }),
      });
      const data = await res.json();
      if (data.success) {
        const addedProjects = allProjects.filter(p => selectedAvailable.has(p.id));
        setFavoriteProjects(prev => [...prev, ...addedProjects]);
        setSelectedAvailable(new Set());
      }
    } catch (err) {
      console.error('Erro ao adicionar favoritos:', err);
    } finally {
      setTransferring(false);
    }
  }, [selectedAvailable, transferring, allProjects]);

  // Transferir favoritos → disponiveis (remover)
  const handleRemoveSelected = useCallback(async () => {
    if (selectedFavorites.size === 0 || transferring) return;
    setTransferring(true);
    try {
      const ids = [...selectedFavorites];
      const res = await fetch(`${API_BASE}/favorite-projects/batch-remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ project_ids: ids }),
      });
      const data = await res.json();
      if (data.success) {
        setFavoriteProjects(prev => prev.filter(p => !selectedFavorites.has(p.id)));
        setSelectedFavorites(new Set());
      }
    } catch (err) {
      console.error('Erro ao remover favoritos:', err);
    } finally {
      setTransferring(false);
    }
  }, [selectedFavorites, transferring]);

  const allAvailableSelected = useMemo(() =>
    filteredAvailable.length > 0 && filteredAvailable.every(p => selectedAvailable.has(p.id)),
    [filteredAvailable, selectedAvailable]
  );
  const allFavoritesSelected = useMemo(() =>
    filteredFavorites.length > 0 && filteredFavorites.every(p => selectedFavorites.has(p.id)),
    [filteredFavorites, selectedFavorites]
  );

  if (loading) {
    return (
      <div className="config-usuario">
        <div className="config-usuario__loading">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="config-usuario">
      <div className="config-usuario__header">
        <h1>Configurações</h1>
        <p>Gerencie suas preferências na plataforma</p>
      </div>

      <div className="config-usuario__transfer">
        {/* ===== PAINEL ESQUERDO: Projetos Disponíveis ===== */}
        <div className="config-usuario__panel">
          <div className="config-usuario__panel-header">
            <h2 className="config-usuario__panel-title">
              Projetos
              <span className="count-badge">{filteredAvailable.length}</span>
            </h2>
          </div>

          <div className="config-usuario__panel-search">
            <input
              type="text"
              className="config-usuario__search-input"
              placeholder="Buscar projeto..."
              value={searchAvailable}
              onChange={e => setSearchAvailable(e.target.value)}
            />
          </div>

          <div className="config-usuario__panel-filters">
            {/* Toggle Fechados/Pausados */}
            <div className="config-usuario__toggle-row">
              <label className="config-usuario__toggle">
                <input
                  type="checkbox"
                  checked={showClosedPaused}
                  onChange={() => setShowClosedPaused(prev => !prev)}
                />
                <span className="config-usuario__toggle-slider"></span>
              </label>
              <span className="config-usuario__toggle-label">
                Fechados / Pausados
              </span>
            </div>

            {/* Toggle Meu Time */}
            {myTeamId && (
              <div className="config-usuario__toggle-row">
                <label className="config-usuario__toggle">
                  <input
                    type="checkbox"
                    checked={showMyTeamOnly}
                    onChange={() => setShowMyTeamOnly(prev => !prev)}
                  />
                  <span className="config-usuario__toggle-slider"></span>
                </label>
                <span className="config-usuario__toggle-label">
                  {myTeamName || 'Meu Time'}
                </span>
              </div>
            )}

            {/* Dropdown de times (quando Meu Time OFF) */}
            {!showMyTeamOnly && (
              <div className="config-usuario__team-dropdown">
                <SearchableDropdown
                  value={selectedTeamId}
                  onChange={(val) => setSelectedTeamId(val)}
                  options={teams.map(t => ({
                    value: t.id,
                    label: `Time ${t.team_number} — ${t.team_name}`
                  }))}
                  placeholder="Filtrar por time..."
                />
              </div>
            )}
          </div>

          {/* Select all */}
          {filteredAvailable.length > 0 && (
            <div className="config-usuario__select-all" onClick={toggleAllAvailable}>
              <span className={`config-usuario__checkbox ${allAvailableSelected ? '' : ''}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
              <span className="config-usuario__select-all-label">
                {allAvailableSelected ? 'Desmarcar todos' : 'Selecionar todos'}
              </span>
            </div>
          )}

          {/* Lista de projetos */}
          <div className="config-usuario__panel-list">
            {filteredAvailable.length === 0 ? (
              <div className="config-usuario__panel-empty">
                Nenhum projeto disponível
              </div>
            ) : (
              filteredAvailable.map(proj => {
                const isChecked = selectedAvailable.has(proj.id);
                return (
                  <div
                    key={proj.id}
                    className={`config-usuario__item ${isChecked ? 'config-usuario__item--checked' : ''}`}
                    onClick={() => toggleAvailable(proj.id)}
                  >
                    <span className="config-usuario__checkbox">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </span>
                    <span className="config-usuario__item-name">
                      {proj.name}
                      {proj.comercial_name && (
                        <span className="config-usuario__item-comercial">
                          ({proj.comercial_name})
                        </span>
                      )}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ===== BOTOES DE TRANSFERENCIA ===== */}
        <div className="config-usuario__transfer-actions">
          <button
            type="button"
            className="config-usuario__transfer-btn"
            onClick={handleAddSelected}
            disabled={selectedAvailable.size === 0 || transferring}
            title="Adicionar selecionados aos favoritos"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            type="button"
            className="config-usuario__transfer-btn"
            onClick={handleRemoveSelected}
            disabled={selectedFavorites.size === 0 || transferring}
            title="Remover selecionados dos favoritos"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* ===== PAINEL DIREITO: Favoritos ===== */}
        <div className="config-usuario__panel">
          <div className="config-usuario__panel-header">
            <h2 className="config-usuario__panel-title">
              Projetos Favoritos
              <span className="count-badge">{favoriteProjects.length}</span>
            </h2>
          </div>

          <div className="config-usuario__panel-search">
            <input
              type="text"
              className="config-usuario__search-input"
              placeholder="Buscar favorito..."
              value={searchFavorites}
              onChange={e => setSearchFavorites(e.target.value)}
            />
          </div>

          {/* Select all */}
          {filteredFavorites.length > 0 && (
            <div className="config-usuario__select-all" onClick={toggleAllFavorites}>
              <span className="config-usuario__checkbox">
                <svg viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
              <span className="config-usuario__select-all-label">
                {allFavoritesSelected ? 'Desmarcar todos' : 'Selecionar todos'}
              </span>
            </div>
          )}

          {/* Lista de favoritos */}
          <div className="config-usuario__panel-list">
            {filteredFavorites.length === 0 ? (
              <div className="config-usuario__panel-empty">
                {favoriteProjects.length === 0
                  ? 'Nenhum projeto favoritado'
                  : 'Nenhum resultado'
                }
              </div>
            ) : (
              filteredFavorites.map(proj => {
                const isChecked = selectedFavorites.has(proj.id);
                return (
                  <div
                    key={proj.id}
                    className={`config-usuario__item ${isChecked ? 'config-usuario__item--checked' : ''}`}
                    onClick={() => toggleFavorite(proj.id)}
                  >
                    <span className="config-usuario__checkbox">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </span>
                    <span className="config-usuario__item-name">
                      {proj.name}
                      {proj.comercial_name && (
                        <span className="config-usuario__item-comercial">
                          ({proj.comercial_name})
                        </span>
                      )}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfiguracoesUsuarioView;
