/**
 * Componente: Vista de Operação
 * 
 * Gerencia acessos e permissões de vistas dos colaboradores
 */

import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import '../styles/OperacaoView.css';

const ACCESS_LABELS = {
  director: 'Diretoria',
  admin: 'Admin',
  leader: 'Lider',
  sem_acesso: 'Sem acesso',
};

// Lista de todas as vistas disponíveis na aplicação
const AVAILABLE_VIEWS = [
  { id: 'indicadores-lideranca', name: 'Indicadores Liderança', path: '/indicadores-lideranca' },
  { id: 'horas', name: 'Horas', path: '/horas' },
  { id: 'indicadores', name: 'Indicadores', path: '/indicadores' },
  { id: 'okrs', name: 'OKRs', path: '/okrs' },
  { id: 'projetos', name: 'Projetos', path: '/projetos' },
  { id: 'cs', name: 'CS', path: '/cs' },
  { id: 'estudo-de-custos', name: 'Estudo de Custos', path: '/estudo-de-custos' },
  { id: 'contatos', name: 'Contatos', path: '/contatos' },
  { id: 'formulario-passagem', name: 'Formulário de Passagem', path: '/formulario-passagem' },
  { id: 'feedbacks', name: 'Feedbacks', path: '/feedbacks' },
];

function OperacaoView() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [leaderFilter, setLeaderFilter] = useState('all');
  const [cargoFilter, setCargoFilter] = useState('all');
  const [editingViews, setEditingViews] = useState(null); // email do usuário sendo editado
  const [userViews, setUserViews] = useState({}); // { email: [viewIds] }
  const [saving, setSaving] = useState(false);

  const fetchAccessData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/api/admin/colaboradores`, {
        withCredentials: true,
      });

      if (response.data?.success) {
        setData(Array.isArray(response.data.data) ? response.data.data : []);
      } else {
        setError('Erro ao carregar dados de acessos');
      }
    } catch (err) {
      console.error('Erro ao buscar acessos:', err);
      setError(err.response?.data?.error || err.message || 'Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserViews = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/user-views`, {
        withCredentials: true,
      });
      if (response.data?.success) {
        const viewsMap = {};
        (response.data.data || []).forEach((item) => {
          if (!viewsMap[item.email]) {
            viewsMap[item.email] = [];
          }
          viewsMap[item.email].push(item.view_id);
        });
        setUserViews(viewsMap);
      }
    } catch (err) {
      console.error('Erro ao buscar permissões de vistas:', err);
    }
  };

  useEffect(() => {
    fetchAccessData();
    fetchUserViews();
  }, []);

  const uniqueTeams = useMemo(() => {
    const teams = new Set();
    data.forEach((row) => {
      if (row.time_nome) {
        teams.add(`${row.time_numero ?? ''}||${row.time_nome}`);
      }
    });
    return Array.from(teams)
      .map((item) => {
        const [num, nome] = item.split('||');
        return { num: num || null, nome };
      })
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
  }, [data]);

  const uniqueLeaders = useMemo(() => {
    const leaders = new Set();
    data.forEach((row) => {
      if (row.lider) leaders.add(row.lider);
    });
    return Array.from(leaders).sort();
  }, [data]);

  const uniqueCargos = useMemo(() => {
    const cargos = new Set();
    data.forEach((row) => {
      if (row.cargo) cargos.add(row.cargo);
    });
    return Array.from(cargos).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    let filtered = [...data];

    if (teamFilter !== 'all') {
      filtered = filtered.filter((row) => {
        const key = `${row.time_numero ?? ''}||${row.time_nome ?? ''}`;
        return key === teamFilter;
      });
    }

    if (leaderFilter !== 'all') {
      filtered = filtered.filter((row) => row.lider === leaderFilter);
    }

    if (cargoFilter !== 'all') {
      filtered = filtered.filter((row) => row.cargo === cargoFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((row) => {
        return [
          row.colaborador,
          row.email,
          row.telefone,
          row.cargo,
          row.lider,
          row.padrinho,
          row.time_nome,
          row.nivel_acesso,
          row.construflow_id,
          row.discord_id,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      });
    }

    return filtered;
  }, [data, teamFilter, leaderFilter, cargoFilter, searchTerm]);

  const handleEditViews = (email) => {
    setEditingViews(email);
    // Carrega as vistas atuais do usuário
    const currentViews = userViews[email] || [];
    setUserViews((prev) => ({
      ...prev,
      [email]: [...currentViews],
    }));
  };

  const handleToggleView = (email, viewId) => {
    setUserViews((prev) => {
      const current = prev[email] || [];
      const updated = current.includes(viewId)
        ? current.filter((id) => id !== viewId)
        : [...current, viewId];
      return {
        ...prev,
        [email]: updated,
      };
    });
  };

  const handleSaveViews = async (email) => {
    try {
      setSaving(true);
      const views = userViews[email] || [];
      const response = await axios.put(
        `${API_URL}/api/admin/user-views`,
        { email, views },
        { withCredentials: true }
      );

      if (response.data?.success) {
        setEditingViews(null);
        await fetchUserViews(); // Recarrega as permissões
        alert('Permissões de vistas atualizadas com sucesso!');
      } else {
        alert('Erro ao salvar permissões: ' + (response.data.error || 'Erro desconhecido'));
      }
    } catch (err) {
      console.error('Erro ao salvar permissões:', err);
      alert('Erro ao salvar permissões: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = (email) => {
    setEditingViews(null);
    // Restaura as vistas originais
    fetchUserViews();
  };

  const getUserViewsCount = (email) => {
    return userViews[email]?.length || 0;
  };

  if (loading) {
    return (
      <div className="operacao-container">
        <div className="loading">Carregando acessos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="operacao-container">
        <div className="error">
          <h2>Erro ao carregar dados</h2>
          <p>{error}</p>
          <button onClick={fetchAccessData} className="retry-button">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="operacao-container">
      <div className="header">
        <h2>Conferência de Acessos</h2>
        <div className="header-actions">
          <button onClick={fetchAccessData} className="refresh-button">
            Atualizar
          </button>
        </div>
      </div>

      <div className="access-filters">
        <div className="access-filter">
          <label htmlFor="team-filter">Time</label>
          <select
            id="team-filter"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
          >
            <option value="all">Todos</option>
            {uniqueTeams.map((team) => {
              const label = team.num ? `${team.num} - ${team.nome}` : team.nome;
              const value = `${team.num ?? ''}||${team.nome}`;
              return (
                <option key={value} value={value}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>

        <div className="access-filter">
          <label htmlFor="leader-filter">Lider</label>
          <select
            id="leader-filter"
            value={leaderFilter}
            onChange={(e) => setLeaderFilter(e.target.value)}
          >
            <option value="all">Todos</option>
            {uniqueLeaders.map((lider) => (
              <option key={lider} value={lider}>
                {lider}
              </option>
            ))}
          </select>
        </div>

        <div className="access-filter">
          <label htmlFor="cargo-filter">Cargo</label>
          <select
            id="cargo-filter"
            value={cargoFilter}
            onChange={(e) => setCargoFilter(e.target.value)}
          >
            <option value="all">Todos</option>
            {uniqueCargos.map((cargo) => (
              <option key={cargo} value={cargo}>
                {cargo}
              </option>
            ))}
          </select>
        </div>

        <div className="access-filter search">
          <label htmlFor="search-access">Busca</label>
          <input
            id="search-access"
            type="text"
            placeholder="Buscar por nome, email, time..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="access-results">
        Mostrando {filteredData.length} de {data.length} colaboradores
      </div>

      <div className="access-table-wrapper">
        <table className="access-table">
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Cargo</th>
              <th>Lider</th>
              <th>Padrinho</th>
              <th>Time</th>
              <th>Telefone</th>
              <th>Email</th>
              <th>Nivel de acesso</th>
              <th>Vistas</th>
              <th>Construflow</th>
              <th>Discord</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={11} className="empty-state">
                  Nenhum colaborador encontrado
                </td>
              </tr>
            ) : (
              filteredData.map((row) => {
                const timeLabel = row.time_nome
                  ? row.time_numero
                    ? `${row.time_numero} - ${row.time_nome}`
                    : row.time_nome
                  : '-';
                const accessLabel = ACCESS_LABELS[row.nivel_acesso] || row.nivel_acesso || '-';
                const isEditing = editingViews === row.email;
                const viewsCount = getUserViewsCount(row.email);
                const userViewsList = userViews[row.email] || [];

                return (
                  <tr key={row.colaborador_id}>
                    <td>{row.colaborador || '-'}</td>
                    <td>{row.cargo || '-'}</td>
                    <td>{row.lider || '-'}</td>
                    <td>{row.padrinho || '-'}</td>
                    <td>{timeLabel}</td>
                    <td>{row.telefone || '-'}</td>
                    <td>{row.email || '-'}</td>
                    <td>{accessLabel}</td>
                    <td className="views-cell">
                      {isEditing ? (
                        <div className="views-editor">
                          <div className="views-checkboxes">
                            {AVAILABLE_VIEWS.map((view) => (
                              <label key={view.id} className="view-checkbox">
                                <input
                                  type="checkbox"
                                  checked={userViewsList.includes(view.id)}
                                  onChange={() => handleToggleView(row.email, view.id)}
                                />
                                <span>{view.name}</span>
                              </label>
                            ))}
                          </div>
                          <div className="views-actions">
                            <button
                              onClick={() => handleSaveViews(row.email)}
                              disabled={saving}
                              className="btn-save-views"
                            >
                              {saving ? 'Salvando...' : 'Salvar'}
                            </button>
                            <button
                              onClick={() => handleCancelEdit(row.email)}
                              disabled={saving}
                              className="btn-cancel-views"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="views-display">
                          <span className="views-count">{viewsCount} vista(s)</span>
                          <button
                            onClick={() => handleEditViews(row.email)}
                            className="btn-edit-views"
                          >
                            Editar
                          </button>
                        </div>
                      )}
                    </td>
                    <td>{row.construflow_id || '-'}</td>
                    <td>{row.discord_id || '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default OperacaoView;
