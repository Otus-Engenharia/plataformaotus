/**
 * Componente: Vista de Apoio de Projetos
 *
 * Ferramentas e recursos para apoio aos projetos.
 * Inclui cronograma consolidado de próximas tarefas de todos os projetos.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import '../styles/ApoioProjetosView.css';

// Icons
const Icons = {
  Calendar: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Refresh: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
};

function ApoioProjetosView() {
  // Estado: Tab ativa
  const [activeTab, setActiveTab] = useState('cronograma');

  // Estado: Dados de tarefas
  const [tarefas, setTarefas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estado: Filtros
  const [weeksFilter, setWeeksFilter] = useState(2);
  const [projetoFilter, setProjetoFilter] = useState([]);
  const [disciplinaFilter, setDisciplinaFilter] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Estado: Dropdowns abertos
  const [projetoDropdownOpen, setProjetoDropdownOpen] = useState(false);
  const [disciplinaDropdownOpen, setDisciplinaDropdownOpen] = useState(false);

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.apoio-multi-select-wrapper')) {
        setProjetoDropdownOpen(false);
        setDisciplinaDropdownOpen(false);
      }
    };

    if (projetoDropdownOpen || disciplinaDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [projetoDropdownOpen, disciplinaDropdownOpen]);

  // Fetch de dados
  const fetchTarefas = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `${API_URL}/api/apoio-projetos/proximas-tarefas`,
        {
          params: { weeksAhead: weeksFilter },
          withCredentials: true,
        }
      );

      if (response.data?.success) {
        setTarefas(response.data.data || []);
      } else {
        setError(response.data?.error || 'Erro ao carregar tarefas');
      }
    } catch (err) {
      console.error('Erro ao buscar próximas tarefas:', err);
      setError(err.response?.data?.error || 'Erro ao carregar tarefas');
    } finally {
      setLoading(false);
    }
  }, [weeksFilter]);

  useEffect(() => {
    fetchTarefas();
  }, [fetchTarefas]);

  // Função para formatar data
  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';

    try {
      let date;
      if (typeof dateValue === 'string') {
        if (dateValue.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
          date = new Date(dateValue);
        } else if (/^\d{2}\/\d{2}\/\d{4}/.test(dateValue)) {
          const [day, month, year] = dateValue.split('/');
          date = new Date(`${year}-${month}-${day}`);
        } else {
          date = new Date(dateValue);
        }
      } else if (typeof dateValue === 'object' && dateValue !== null) {
        if (dateValue.value) {
          date = new Date(dateValue.value);
        } else if (dateValue.toISOString) {
          date = dateValue;
        } else {
          date = new Date(JSON.stringify(dateValue));
        }
      } else {
        date = new Date(dateValue);
      }

      if (isNaN(date.getTime())) {
        return 'N/A';
      }

      return date.toLocaleDateString('pt-BR');
    } catch {
      return 'N/A';
    }
  };

  // Parse de data para ordenação
  const parseDate = (dateValue) => {
    if (!dateValue) return null;

    try {
      let date;
      if (typeof dateValue === 'string') {
        if (dateValue.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
          date = new Date(dateValue);
        } else if (/^\d{2}\/\d{2}\/\d{4}/.test(dateValue)) {
          const [day, month, year] = dateValue.split('/');
          date = new Date(`${year}-${month}-${day}`);
        } else {
          date = new Date(dateValue);
        }
      } else if (typeof dateValue === 'object' && dateValue !== null) {
        if (dateValue.value) {
          date = new Date(dateValue.value);
        } else if (dateValue.toISOString) {
          date = dateValue;
        } else {
          date = new Date(JSON.stringify(dateValue));
        }
      } else {
        date = new Date(dateValue);
      }

      if (isNaN(date.getTime())) return null;
      date.setHours(0, 0, 0, 0);
      return date;
    } catch {
      return null;
    }
  };

  // Lista de projetos únicos
  const uniqueProjetos = useMemo(() => {
    if (!tarefas || tarefas.length === 0) return [];
    const projetos = new Set();
    tarefas.forEach((item) => {
      const projeto = String(item.projeto_nome || '').trim();
      if (projeto) {
        projetos.add(projeto);
      }
    });
    return Array.from(projetos).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [tarefas]);

  // Lista de disciplinas únicas
  const uniqueDisciplinas = useMemo(() => {
    if (!tarefas || tarefas.length === 0) return [];
    const disciplinas = new Set();
    tarefas.forEach((item) => {
      const disciplina = String(item.Disciplina || '').trim();
      if (disciplina) {
        disciplinas.add(disciplina);
      }
    });
    return Array.from(disciplinas).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [tarefas]);

  // Handlers para filtros
  const handleProjetoToggle = (projeto) => {
    setProjetoFilter((prev) => {
      if (prev.includes(projeto)) {
        return prev.filter((p) => p !== projeto);
      } else {
        return [...prev, projeto];
      }
    });
  };

  const handleDisciplinaToggle = (disciplina) => {
    setDisciplinaFilter((prev) => {
      if (prev.includes(disciplina)) {
        return prev.filter((d) => d !== disciplina);
      } else {
        return [...prev, disciplina];
      }
    });
  };

  const handleSelectAllProjetos = () => {
    if (projetoFilter.length === uniqueProjetos.length) {
      setProjetoFilter([]);
    } else {
      setProjetoFilter([...uniqueProjetos]);
    }
  };

  const handleSelectAllDisciplinas = () => {
    if (disciplinaFilter.length === uniqueDisciplinas.length) {
      setDisciplinaFilter([]);
    } else {
      setDisciplinaFilter([...uniqueDisciplinas]);
    }
  };

  // Tarefas filtradas
  const tarefasFiltradas = useMemo(() => {
    if (!tarefas || tarefas.length === 0) return [];

    return tarefas.filter((item) => {
      // Filtro por projeto
      if (projetoFilter.length > 0) {
        const projeto = String(item.projeto_nome || '').trim();
        if (!projetoFilter.includes(projeto)) return false;
      }

      // Filtro por disciplina
      if (disciplinaFilter.length > 0) {
        const disciplina = String(item.Disciplina || '').trim();
        if (!disciplinaFilter.includes(disciplina)) return false;
      }

      // Filtro por busca
      if (searchTerm.trim()) {
        const search = searchTerm.toLowerCase();
        const tarefa = String(item.NomeDaTarefa || '').toLowerCase();
        const projeto = String(item.projeto_nome || '').toLowerCase();
        const disciplina = String(item.Disciplina || '').toLowerCase();

        if (
          !tarefa.includes(search) &&
          !projeto.includes(search) &&
          !disciplina.includes(search)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [tarefas, projetoFilter, disciplinaFilter, searchTerm]);

  // Tarefas agrupadas por data de início
  const tarefasAgrupadas = useMemo(() => {
    if (!tarefasFiltradas || tarefasFiltradas.length === 0) return [];

    // Ordena por data de início
    const sorted = [...tarefasFiltradas].sort((a, b) => {
      const dateA = parseDate(a.DataDeInicio);
      const dateB = parseDate(b.DataDeInicio);

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      const dateDiff = dateA.getTime() - dateB.getTime();
      if (dateDiff !== 0) return dateDiff;

      // Se as datas forem iguais, ordena por projeto
      const projetoA = String(a.projeto_nome || '').trim().toLowerCase();
      const projetoB = String(b.projeto_nome || '').trim().toLowerCase();
      return projetoA.localeCompare(projetoB, 'pt-BR');
    });

    // Agrupa por data de início
    const grouped = {};
    sorted.forEach((item) => {
      const dateKey = formatDate(item.DataDeInicio);
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: dateKey,
          dateObj: parseDate(item.DataDeInicio),
          items: [],
        };
      }
      grouped[dateKey].items.push(item);
    });

    return Object.values(grouped).sort((a, b) => {
      if (!a.dateObj && !b.dateObj) return 0;
      if (!a.dateObj) return 1;
      if (!b.dateObj) return -1;
      return a.dateObj.getTime() - b.dateObj.getTime();
    });
  }, [tarefasFiltradas]);

  // Contagem de KPIs
  const kpiCounts = useMemo(() => {
    const counts = { vermelho: 0, azul: 0, total: tarefasFiltradas.length };
    tarefasFiltradas.forEach((item) => {
      const kpi = String(item.KPI || '').trim().toLowerCase();
      if (kpi === 'vermelho') counts.vermelho++;
      else if (kpi === 'azul') counts.azul++;
    });
    return counts;
  }, [tarefasFiltradas]);

  // Função para obter classe de badge KPI
  const getKpiBadgeClass = (kpi) => {
    const kpiLower = String(kpi || '').trim().toLowerCase();
    switch (kpiLower) {
      case 'vermelho':
        return 'apoio-kpi-badge-vermelho';
      case 'azul':
        return 'apoio-kpi-badge-azul';
      case 'verde':
        return 'apoio-kpi-badge-verde';
      case 'amarelo':
        return 'apoio-kpi-badge-amarelo';
      default:
        return 'apoio-kpi-badge-na';
    }
  };

  return (
    <div className="apoio-container">
      {/* Header */}
      <div className="apoio-header">
        <h2>Apoio de Projetos</h2>
        <button
          className="apoio-refresh-btn"
          onClick={fetchTarefas}
          disabled={loading}
        >
          <Icons.Refresh />
          Atualizar
        </button>
      </div>

      {/* Summary Cards */}
      <div className="apoio-summary">
        <div className="apoio-summary-card">
          <span className="apoio-summary-value">{kpiCounts.total}</span>
          <span className="apoio-summary-label">Tarefas nas próximas {weeksFilter} semanas</span>
        </div>
        <div className="apoio-summary-card apoio-summary-card-highlight">
          <span className="apoio-summary-value">{kpiCounts.vermelho}</span>
          <span className="apoio-summary-label">Atenção Coordenação (KPI Vermelho)</span>
        </div>
        <div className="apoio-summary-card">
          <span className="apoio-summary-value">{uniqueProjetos.length}</span>
          <span className="apoio-summary-label">Projetos com entregas</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="apoio-tabs-container">
        <div className="apoio-tabs">
          <button
            className={`apoio-tab ${activeTab === 'cronograma' ? 'apoio-tab-active' : ''}`}
            onClick={() => setActiveTab('cronograma')}
          >
            <Icons.Calendar />
            Cronograma de Tarefas
            <span className="apoio-tab-badge">{tarefas.length}</span>
          </button>
          {/* Futuras abas podem ser adicionadas aqui */}
        </div>
      </div>

      {/* Tab Content: Cronograma */}
      {activeTab === 'cronograma' && (
        <>
          {/* Filtros */}
          <div className="apoio-filters">
            {/* Filtro de semanas */}
            <div className="apoio-filter-group">
              <label className="apoio-filter-label">Semanas:</label>
              <select
                className="apoio-weeks-select"
                value={weeksFilter}
                onChange={(e) => setWeeksFilter(parseInt(e.target.value))}
              >
                <option value={1}>1 semana</option>
                <option value={2}>2 semanas</option>
                <option value={4}>4 semanas</option>
                <option value={8}>8 semanas</option>
                <option value={12}>12 semanas</option>
              </select>
            </div>

            {/* Filtro de projetos */}
            <div className="apoio-multi-select-wrapper">
              <button
                type="button"
                className="apoio-multi-select-button"
                onClick={() => setProjetoDropdownOpen(!projetoDropdownOpen)}
              >
                <span>
                  {projetoFilter.length === 0
                    ? 'Todos os Projetos'
                    : projetoFilter.length === 1
                      ? projetoFilter[0]
                      : `${projetoFilter.length} projetos`}
                </span>
                <span className="apoio-dropdown-arrow">
                  {projetoDropdownOpen ? '▲' : '▼'}
                </span>
              </button>
              {projetoDropdownOpen && (
                <div className="apoio-multi-select-dropdown">
                  <div className="apoio-multi-select-header">
                    <label className="apoio-select-all-checkbox">
                      <input
                        type="checkbox"
                        checked={projetoFilter.length === uniqueProjetos.length && uniqueProjetos.length > 0}
                        onChange={handleSelectAllProjetos}
                      />
                      <span>Selecionar Todos</span>
                    </label>
                  </div>
                  <div className="apoio-multi-select-options">
                    {uniqueProjetos.map((projeto) => (
                      <label key={projeto} className="apoio-multi-select-option">
                        <input
                          type="checkbox"
                          checked={projetoFilter.includes(projeto)}
                          onChange={() => handleProjetoToggle(projeto)}
                        />
                        <span>{projeto}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Filtro de disciplinas */}
            <div className="apoio-multi-select-wrapper">
              <button
                type="button"
                className="apoio-multi-select-button"
                onClick={() => setDisciplinaDropdownOpen(!disciplinaDropdownOpen)}
              >
                <span>
                  {disciplinaFilter.length === 0
                    ? 'Todas as Disciplinas'
                    : disciplinaFilter.length === 1
                      ? disciplinaFilter[0]
                      : `${disciplinaFilter.length} disciplinas`}
                </span>
                <span className="apoio-dropdown-arrow">
                  {disciplinaDropdownOpen ? '▲' : '▼'}
                </span>
              </button>
              {disciplinaDropdownOpen && (
                <div className="apoio-multi-select-dropdown">
                  <div className="apoio-multi-select-header">
                    <label className="apoio-select-all-checkbox">
                      <input
                        type="checkbox"
                        checked={disciplinaFilter.length === uniqueDisciplinas.length && uniqueDisciplinas.length > 0}
                        onChange={handleSelectAllDisciplinas}
                      />
                      <span>Selecionar Todas</span>
                    </label>
                  </div>
                  <div className="apoio-multi-select-options">
                    {uniqueDisciplinas.map((disciplina) => (
                      <label key={disciplina} className="apoio-multi-select-option">
                        <input
                          type="checkbox"
                          checked={disciplinaFilter.includes(disciplina)}
                          onChange={() => handleDisciplinaToggle(disciplina)}
                        />
                        <span>{disciplina}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Busca */}
            <input
              type="text"
              className="apoio-search-input"
              placeholder="Buscar tarefa, projeto ou disciplina..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Loading */}
          {loading && (
            <div className="apoio-loading">
              <div className="apoio-spinner"></div>
              <span>Carregando tarefas...</span>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="apoio-error">
              <p>{error}</p>
              <button onClick={fetchTarefas}>Tentar novamente</button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && tarefasFiltradas.length === 0 && (
            <div className="apoio-empty">
              <p className="apoio-empty-message">Nenhuma tarefa encontrada</p>
              <p className="apoio-empty-hint">
                {tarefas.length > 0
                  ? 'Tente ajustar os filtros para ver mais tarefas'
                  : `Não há tarefas previstas para as próximas ${weeksFilter} semanas`}
              </p>
            </div>
          )}

          {/* Tabela */}
          {!loading && !error && tarefasFiltradas.length > 0 && (
            <div className="apoio-table-wrapper">
              <table className="apoio-table apoio-table-grouped">
                <thead>
                  <tr>
                    <th>Data Início</th>
                    <th>Data Término</th>
                    <th>Projeto</th>
                    <th>Tarefa</th>
                    <th>Disciplina</th>
                    <th>KPI</th>
                    <th>Coordenador</th>
                  </tr>
                </thead>
                <tbody>
                  {tarefasAgrupadas.map((dateGroup, dateIndex) =>
                    dateGroup.items.map((tarefa, itemIndex) => (
                      <tr key={`${dateIndex}-${itemIndex}-${tarefa.rowId || itemIndex}`}>
                        {itemIndex === 0 && (
                          <td
                            rowSpan={dateGroup.items.length}
                            className="apoio-group-date"
                          >
                            {dateGroup.date}
                          </td>
                        )}
                        <td>{formatDate(tarefa.DataDeTermino)}</td>
                        <td className="apoio-projeto-nome" title={tarefa.projeto_nome}>
                          {tarefa.projeto_nome || 'N/A'}
                        </td>
                        <td className="apoio-tarefa-nome">
                          {tarefa.NomeDaTarefa || 'N/A'}
                        </td>
                        <td className="apoio-disciplina">
                          {tarefa.Disciplina || 'N/A'}
                        </td>
                        <td>
                          {tarefa.KPI && (
                            <span
                              className={`apoio-kpi-badge ${getKpiBadgeClass(tarefa.KPI)}`}
                            >
                              {tarefa.KPI}
                            </span>
                          )}
                        </td>
                        <td className="apoio-coordenador">
                          {tarefa.lider || 'N/A'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ApoioProjetosView;
