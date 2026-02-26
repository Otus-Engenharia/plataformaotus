import React, { useState, useEffect, useCallback, useMemo } from 'react';
import SearchableSelect from '../../components/SearchableSelect';
import './ConfiguracoesUsuarioView.css';

const API_BASE = '/api/user-preferences';

function ConfiguracoesUsuarioView() {
  const [favoriteProjects, setFavoriteProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [addingTeam, setAddingTeam] = useState(false);

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

  // Projetos ainda nao favoritados, para o SearchableSelect
  const availableOptions = useMemo(() => {
    const favIds = new Set(favoriteProjects.map(p => p.id));
    return allProjects
      .filter(p => !favIds.has(p.id))
      .map(p => ({
        value: p.id,
        label: p.comercial_name ? `${p.name} (${p.comercial_name})` : p.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allProjects, favoriteProjects]);

  // Agrupar favoritos por team_id
  const groupedFavorites = useMemo(() => {
    const teamsMap = new Map(teams.map(t => [t.id, t]));
    const groups = {};

    for (const proj of favoriteProjects) {
      const teamId = proj.team_id || '__none__';
      if (!groups[teamId]) {
        const team = teamsMap.get(proj.team_id);
        groups[teamId] = {
          teamName: team ? `Time ${team.team_number} — ${team.team_name}` : 'Sem time',
          teamNumber: team ? team.team_number : 9999,
          projects: [],
        };
      }
      groups[teamId].projects.push(proj);
    }

    // Ordenar grupos por team_number, projetos por comercial_name
    return Object.values(groups)
      .sort((a, b) => a.teamNumber - b.teamNumber)
      .map(g => ({
        ...g,
        projects: g.projects.sort((a, b) =>
          (a.name || '').localeCompare(b.name || '')
        ),
      }));
  }, [favoriteProjects, teams]);

  const handleAddProject = useCallback(async (e) => {
    const projectId = e.target.value;
    if (!projectId) return;

    try {
      const res = await fetch(`${API_BASE}/favorite-projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ project_id: projectId }),
      });
      const data = await res.json();
      if (data.success) {
        setFavoriteProjects(prev => [...prev, data.data]);
      }
    } catch (err) {
      console.error('Erro ao adicionar favorito:', err);
    }
    setSelectedProject('');
  }, []);

  const handleAddTeam = useCallback(async () => {
    if (!selectedTeam || addingTeam) return;

    setAddingTeam(true);
    try {
      const res = await fetch(`${API_BASE}/favorite-projects/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ team_id: selectedTeam }),
      });
      const data = await res.json();
      if (data.success) {
        // Refetch para pegar a lista completa atualizada
        const favRes = await fetch(`${API_BASE}/favorite-projects`, { credentials: 'include' });
        const favData = await favRes.json();
        if (favData.success) setFavoriteProjects(favData.data);
      }
    } catch (err) {
      console.error('Erro ao adicionar favoritos do time:', err);
    } finally {
      setAddingTeam(false);
      setSelectedTeam('');
    }
  }, [selectedTeam, addingTeam]);

  const handleRemoveProject = useCallback(async (projectId) => {
    try {
      const res = await fetch(`${API_BASE}/favorite-projects/${projectId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setFavoriteProjects(prev => prev.filter(p => p.id !== projectId));
      }
    } catch (err) {
      console.error('Erro ao remover favorito:', err);
    }
  }, []);

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

      <div className="config-usuario__section">
        <h2 className="config-usuario__section-title">
          Projetos Favoritos
          <span className="count-badge">{favoriteProjects.length}</span>
        </h2>

        <div className="config-usuario__add-controls">
          {/* Adicionar projeto individual */}
          <div className="config-usuario__add-row">
            <span className="config-usuario__label">Adicionar projeto:</span>
            <SearchableSelect
              id="add-favorite-project"
              value={selectedProject}
              onChange={handleAddProject}
              options={availableOptions}
              placeholder="Buscar projeto..."
            />
          </div>

          {/* Adicionar por time */}
          <div className="config-usuario__add-row">
            <span className="config-usuario__label">Adicionar por time:</span>
            <select
              value={selectedTeam}
              onChange={e => setSelectedTeam(e.target.value)}
            >
              <option value="">Selecione um time...</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>
                  Time {t.team_number} — {t.team_name}
                </option>
              ))}
            </select>
            <button
              className="config-usuario__btn-team"
              onClick={handleAddTeam}
              disabled={!selectedTeam || addingTeam}
            >
              {addingTeam ? 'Adicionando...' : 'Adicionar todos do time'}
            </button>
          </div>
        </div>

        {/* Lista de favoritos agrupados por time */}
        {favoriteProjects.length === 0 ? (
          <div className="config-usuario__empty">
            Nenhum projeto favoritado ainda. Use os controles acima para adicionar.
          </div>
        ) : (
          groupedFavorites.map(group => (
            <div key={group.teamName} className="config-usuario__group">
              <h3 className="config-usuario__group-header">{group.teamName}</h3>
              {group.projects.map(proj => (
                <div key={proj.id} className="config-usuario__favorite-item">
                  <div className="config-usuario__favorite-info">
                    <span className="config-usuario__favorite-name">
                      {proj.name}
                      {proj.comercial_name && (
                        <span className="config-usuario__favorite-comercial">
                          ({proj.comercial_name})
                        </span>
                      )}
                    </span>
                  </div>
                  <button
                    className="config-usuario__btn-remove"
                    onClick={() => handleRemoveProject(proj.id)}
                    title="Remover dos favoritos"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ConfiguracoesUsuarioView;
