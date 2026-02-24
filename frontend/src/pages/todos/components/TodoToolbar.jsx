import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import SearchableSelect from '../../../components/SearchableSelect';
import './TodoToolbar.css';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'a fazer', label: 'A fazer' },
  { value: 'em progresso', label: 'Em progresso' },
  { value: 'finalizado', label: 'Finalizado' },
  { value: 'validação', label: 'Validação' },
  { value: 'cancelado', label: 'Cancelado' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'baixa', label: 'Baixa' },
  { value: 'média', label: 'Média' },
  { value: 'alta', label: 'Alta' },
];

const LIST_GROUP_BY_OPTIONS = [
  { value: 'none', label: 'Sem agrupamento' },
  { value: 'status', label: 'Por Status' },
  { value: 'priority', label: 'Por Prioridade' },
  { value: 'project', label: 'Por Projeto' },
];

const KANBAN_GROUP_BY_OPTIONS = [
  { value: 'status', label: 'Por Status' },
  { value: 'project', label: 'Por Projeto' },
  { value: 'due_date', label: 'Por Data' },
];

const SORT_FIELD_OPTIONS = [
  { value: 'created_at', label: 'Data de criação' },
  { value: 'due_date', label: 'Data limite' },
  { value: 'priority', label: 'Prioridade' },
  { value: 'status', label: 'Status' },
  { value: 'name', label: 'Nome' },
];

const SORT_DIR_OPTIONS = [
  { value: 'asc', label: 'Crescente' },
  { value: 'desc', label: 'Decrescente' },
];

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const KanbanIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="5" height="18" rx="1" />
    <rect x="10" y="3" width="5" height="12" rx="1" />
    <rect x="17" y="3" width="5" height="15" rx="1" />
  </svg>
);

const SlidersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);

export default function TodoToolbar({
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
  groupBy,
  onGroupByChange,
  onCreateClick,
  projects = [],
  users = [],
  teams = [],
  weekLabel = '',
  onWeekPrev,
  onWeekNext,
  onWeekToday,
  showClosedInDate = false,
  onShowClosedInDateChange,
  sort = { field: 'created_at', direction: 'desc' },
  onSortChange,
}) {
  const debounceRef = useRef(null);
  const panelRef = useRef(null);
  const triggerRef = useRef(null);

  const [showPanel, setShowPanel] = useState(false);
  const [expandClassificar, setExpandClassificar] = useState(true);
  const [expandFiltro, setExpandFiltro] = useState(true);

  // Click outside to close
  useEffect(() => {
    if (!showPanel) return;
    const handleClickOutside = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        setShowPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPanel]);

  // Escape to close
  useEffect(() => {
    if (!showPanel) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowPanel(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showPanel]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status) count++;
    if (filters.priority) count++;
    if (filters.projectId) count++;
    if (filters.teamId) count++;
    if (filters.assignee) count++;
    return count;
  }, [filters]);

  const projectOptions = useMemo(() => {
    const sorted = projects
      .slice()
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
    return [
      { value: '', label: 'Todos' },
      ...sorted.map((p) => ({
        value: String(p.id),
        label: p.comercial_name ? `${p.name} (${p.comercial_name})` : p.name,
      })),
    ];
  }, [projects]);

  const handleSearchChange = useCallback(
    (e) => {
      const value = e.target.value;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onFiltersChange({ ...filters, search: value });
      }, 300);
    },
    [filters, onFiltersChange],
  );

  const handleFilterChange = useCallback(
    (field) => (e) => {
      onFiltersChange({ ...filters, [field]: e.target.value });
    },
    [filters, onFiltersChange],
  );

  return (
    <div className="todo-toolbar">
      {/* Search */}
      <div className="todo-toolbar__search">
        <span className="todo-toolbar__search-icon">
          <SearchIcon />
        </span>
        <input
          type="text"
          className="todo-toolbar__search-input"
          placeholder="Buscar tarefas..."
          defaultValue={filters.search || ''}
          onChange={handleSearchChange}
        />
      </div>

      {/* Week navigation (kanban + due_date only) */}
      {viewMode === 'kanban' && groupBy === 'due_date' && (
        <div className="todo-toolbar__week-nav">
          <button type="button" className="todo-toolbar__week-btn" onClick={onWeekPrev} title="Semana anterior">&#8249;</button>
          <span className="todo-toolbar__week-label">{weekLabel}</span>
          <button type="button" className="todo-toolbar__week-btn" onClick={onWeekNext} title="Próxima semana">&#8250;</button>
          <button type="button" className="todo-toolbar__week-today" onClick={onWeekToday}>Hoje</button>
        </div>
      )}

      {/* Actions (right) */}
      <div className="todo-toolbar__actions">
        {/* Mostrar button + panel */}
        <div className="todo-toolbar__mostrar-wrapper">
          <button
            ref={triggerRef}
            type="button"
            className={`todo-toolbar__mostrar-btn${showPanel ? ' todo-toolbar__mostrar-btn--active' : ''}`}
            onClick={() => setShowPanel((prev) => !prev)}
          >
            <SlidersIcon />
            Mostrar
            {activeFilterCount > 0 && (
              <span className="todo-toolbar__mostrar-badge">{activeFilterCount}</span>
            )}
          </button>

          {showPanel && (
            <div ref={panelRef} className="todo-toolbar__panel">
              {/* Layout */}
              <div className="todo-toolbar__panel-section">
                <div className="todo-toolbar__panel-section-title">Layout</div>
                <div className="todo-toolbar__panel-layout">
                  <button
                    type="button"
                    className={`todo-toolbar__layout-btn${viewMode === 'list' ? ' todo-toolbar__layout-btn--active' : ''}`}
                    onClick={() => onViewModeChange('list')}
                  >
                    <ListIcon />
                    Lista
                  </button>
                  <button
                    type="button"
                    className={`todo-toolbar__layout-btn${viewMode === 'kanban' ? ' todo-toolbar__layout-btn--active' : ''}`}
                    onClick={() => onViewModeChange('kanban')}
                  >
                    <KanbanIcon />
                    Kanban
                  </button>
                </div>
              </div>

              {/* Tarefas concluídas toggle */}
              <div className="todo-toolbar__panel-section">
                <div className="todo-toolbar__toggle-row">
                  <span className="todo-toolbar__toggle-label">Tarefas concluídas</span>
                  <label className="todo-toolbar__toggle-switch">
                    <input
                      type="checkbox"
                      checked={showClosedInDate}
                      onChange={(e) => onShowClosedInDateChange && onShowClosedInDateChange(e.target.checked)}
                    />
                    <span className="todo-toolbar__toggle-slider" />
                  </label>
                </div>
              </div>

              {/* Classificar (collapsible) */}
              <div className="todo-toolbar__panel-section">
                <button
                  type="button"
                  className="todo-toolbar__panel-section-header"
                  onClick={() => setExpandClassificar((prev) => !prev)}
                >
                  <span>Classificar</span>
                  <span className={`todo-toolbar__panel-chevron${expandClassificar ? ' todo-toolbar__panel-chevron--expanded' : ''}`}>
                    &#9662;
                  </span>
                </button>
                {expandClassificar && (
                  <div className="todo-toolbar__panel-section-body">
                    <div className="todo-toolbar__panel-field">
                      <label>Agrupar</label>
                      <select
                        value={groupBy || 'none'}
                        onChange={(e) => onGroupByChange(e.target.value)}
                      >
                        {(viewMode === 'kanban' ? KANBAN_GROUP_BY_OPTIONS : LIST_GROUP_BY_OPTIONS).map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="todo-toolbar__panel-field">
                      <label>Classificar</label>
                      <select
                        value={sort.field}
                        onChange={(e) => onSortChange && onSortChange({ ...sort, field: e.target.value })}
                      >
                        {SORT_FIELD_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="todo-toolbar__panel-field">
                      <label>Ordem</label>
                      <select
                        value={sort.direction}
                        onChange={(e) => onSortChange && onSortChange({ ...sort, direction: e.target.value })}
                      >
                        {SORT_DIR_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Filtro (collapsible) */}
              <div className="todo-toolbar__panel-section">
                <button
                  type="button"
                  className="todo-toolbar__panel-section-header"
                  onClick={() => setExpandFiltro((prev) => !prev)}
                >
                  <span>Filtro</span>
                  <span className={`todo-toolbar__panel-chevron${expandFiltro ? ' todo-toolbar__panel-chevron--expanded' : ''}`}>
                    &#9662;
                  </span>
                </button>
                {expandFiltro && (
                  <div className="todo-toolbar__panel-section-body">
                    <div className="todo-toolbar__panel-field">
                      <label>Status</label>
                      <select
                        value={filters.status || ''}
                        onChange={handleFilterChange('status')}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="todo-toolbar__panel-field">
                      <label>Prioridade</label>
                      <select
                        value={filters.priority || ''}
                        onChange={handleFilterChange('priority')}
                      >
                        {PRIORITY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="todo-toolbar__panel-field">
                      <label>Projeto</label>
                      <SearchableSelect
                        id="todo-filter-project"
                        value={filters.projectId || ''}
                        onChange={handleFilterChange('projectId')}
                        options={projectOptions}
                        placeholder="Todos"
                      />
                    </div>

                    <div className="todo-toolbar__panel-field">
                      <label>Time</label>
                      <select
                        value={filters.teamId || ''}
                        onChange={handleFilterChange('teamId')}
                      >
                        <option value="">Todos</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.team_number} - {team.team_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="todo-toolbar__panel-field">
                      <label>Responsável</label>
                      <select
                        value={filters.assignee || ''}
                        onChange={handleFilterChange('assignee')}
                      >
                        <option value="">Todos</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="todo-toolbar__create-btn"
          onClick={onCreateClick}
        >
          + Nova Tarefa
        </button>
      </div>
    </div>
  );
}
