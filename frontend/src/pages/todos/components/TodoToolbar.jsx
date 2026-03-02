import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom';
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
  currentUserId = '',
  currentUserTeamId = '',
  weekLabel = '',
  onWeekPrev,
  onWeekNext,
  onWeekToday,
  showFinalizados = false,
  onShowFinalizadosChange,
  showCancelados = false,
  onShowCanceladosChange,
  sort = { field: 'created_at', direction: 'desc' },
  onSortChange,
}) {
  const debounceRef = useRef(null);
  const panelRef = useRef(null);
  const triggerRef = useRef(null);

  const [showPanel, setShowPanel] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const assigneeDropdownRef = useRef(null);
  const assigneeAllBtnRef = useRef(null);
  const [expandClassificar, setExpandClassificar] = useState(true);
  const [expandFiltro, setExpandFiltro] = useState(true);

  // assigneeMode como estado local para evitar dependência de currentUserId/filtros
  const [assigneeMode, setAssigneeMode] = useState('all');

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

  // Click outside to close assignee dropdown (portal)
  useEffect(() => {
    if (!showAssigneeDropdown) return;
    const handleClickOutside = (e) => {
      if (
        assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(e.target) &&
        assigneeAllBtnRef.current && !assigneeAllBtnRef.current.contains(e.target)
      ) {
        setShowAssigneeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAssigneeDropdown]);

  // Escape to close assignee dropdown
  useEffect(() => {
    if (!showAssigneeDropdown) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowAssigneeDropdown(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showAssigneeDropdown]);

  const handleAssigneeModeChange = useCallback(
    (mode) => {
      if (mode === 'mine') {
        setAssigneeMode('mine');
        setShowAssigneeDropdown(false);
        if (currentUserId) {
          onFiltersChange({ ...filters, assignee: currentUserId, teamId: '', assignees: '' });
        } else {
          onFiltersChange({ ...filters, assignee: '', teamId: '', assignees: '' });
        }
      } else if (mode === 'team') {
        setAssigneeMode('team');
        setShowAssigneeDropdown(false);
        if (currentUserTeamId) {
          onFiltersChange({ ...filters, assignee: '', teamId: currentUserTeamId, assignees: '' });
        } else {
          onFiltersChange({ ...filters, assignee: '', teamId: '', assignees: '' });
        }
      } else {
        setAssigneeMode('all');
        onFiltersChange({ ...filters, assignee: '', teamId: '', assignees: '' });
        // Calcular posição do dropdown via portal
        if (!showAssigneeDropdown && assigneeAllBtnRef.current) {
          const rect = assigneeAllBtnRef.current.getBoundingClientRect();
          setDropdownPos({ top: rect.bottom + 6, left: rect.left });
        }
        setShowAssigneeDropdown((prev) => !prev);
      }
    },
    [filters, onFiltersChange, currentUserId, currentUserTeamId, showAssigneeDropdown],
  );

  // Multi-select: selectedUserIds derived from filters.assignees
  const selectedUserIds = useMemo(() => {
    if (!filters.assignees) return [];
    return filters.assignees.split(',').filter(Boolean);
  }, [filters.assignees]);

  const handleToggleUser = useCallback(
    (userId) => {
      const current = new Set(selectedUserIds);
      if (current.has(userId)) {
        current.delete(userId);
      } else {
        current.add(userId);
      }
      const newAssignees = Array.from(current).join(',');
      onFiltersChange({ ...filters, assignee: '', teamId: '', assignees: newAssignees });
    },
    [selectedUserIds, filters, onFiltersChange],
  );

  // Group users by team for multi-select dropdown
  const usersByTeam = useMemo(() => {
    const teamMap = new Map();
    teams.forEach((t) => teamMap.set(String(t.id), `${t.team_number} - ${t.team_name}`));

    const groups = {};
    users.forEach((u) => {
      const tid = u.team_id ? String(u.team_id) : '__none__';
      if (!groups[tid]) {
        groups[tid] = { label: teamMap.get(tid) || 'Sem time', users: [] };
      }
      groups[tid].users.push(u);
    });

    // Sort: named teams first, "Sem time" last
    return Object.entries(groups)
      .sort(([a], [b]) => {
        if (a === '__none__') return 1;
        if (b === '__none__') return -1;
        return (groups[a].label || '').localeCompare(groups[b].label || '', 'pt-BR');
      })
      .map(([, group]) => group);
  }, [users, teams]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status) count++;
    if (filters.priority) count++;
    if (filters.projectId) count++;
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

      {/* Assignee toggle */}
      <div className="todo-toolbar__assignee-toggle">
        {[
          { key: 'mine', label: 'Minhas' },
          { key: 'team', label: 'Meu time' },
          { key: 'all', label: 'Todos' },
        ].map((opt) => (
          <button
            key={opt.key}
            ref={opt.key === 'all' ? assigneeAllBtnRef : undefined}
            type="button"
            className={`todo-toolbar__assignee-toggle-btn${assigneeMode === opt.key ? ' todo-toolbar__assignee-toggle-btn--active' : ''}`}
            onClick={() => handleAssigneeModeChange(opt.key)}
          >
            {opt.label}
            {opt.key === 'all' && (
              <span className={`todo-toolbar__assignee-chevron${showAssigneeDropdown ? ' todo-toolbar__assignee-chevron--open' : ''}`}>&#9662;</span>
            )}
          </button>
        ))}
      </div>

      {/* Dropdown de usuários via portal */}
      {showAssigneeDropdown && ReactDOM.createPortal(
        <div
          ref={assigneeDropdownRef}
          className="todo-toolbar__assignee-dropdown"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          <div className="todo-toolbar__multiselect-hint">
            {selectedUserIds.length === 0
              ? 'Mostrando todas as tarefas'
              : `${selectedUserIds.length} pessoa${selectedUserIds.length > 1 ? 's' : ''} selecionada${selectedUserIds.length > 1 ? 's' : ''}`}
          </div>
          {usersByTeam.length === 0 ? (
            <div className="todo-toolbar__multiselect-empty">Nenhum usuário encontrado</div>
          ) : (
            <div className="todo-toolbar__multiselect-list">
              {usersByTeam.map((group) => (
                <div key={group.label} className="todo-toolbar__multiselect-group">
                  <div className="todo-toolbar__multiselect-group-label">{group.label}</div>
                  {group.users.map((u) => (
                    <label key={u.id} className="todo-toolbar__multiselect-item">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(u.id)}
                        onChange={() => handleToggleUser(u.id)}
                      />
                      <span className="todo-toolbar__multiselect-check" />
                      <span className="todo-toolbar__multiselect-name">{u.name}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Actions (right) */}
      <div className="todo-toolbar__actions">
        {/* Pill toggles: Finalizadas / Canceladas */}
        <button
          type="button"
          className={`todo-toolbar__status-pill${showFinalizados ? ' todo-toolbar__status-pill--finalizadas' : ''}`}
          onClick={() => onShowFinalizadosChange && onShowFinalizadosChange(!showFinalizados)}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Finalizadas
        </button>
        <button
          type="button"
          className={`todo-toolbar__status-pill${showCancelados ? ' todo-toolbar__status-pill--canceladas' : ''}`}
          onClick={() => onShowCanceladosChange && onShowCanceladosChange(!showCancelados)}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Canceladas
        </button>

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
