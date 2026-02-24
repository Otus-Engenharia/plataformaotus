import React, { useRef, useCallback } from 'react';

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

const GROUP_BY_OPTIONS = [
  { value: 'none', label: 'Sem agrupamento' },
  { value: 'status', label: 'Por Status' },
  { value: 'priority', label: 'Por Prioridade' },
  { value: 'project', label: 'Por Projeto' },
];

const styles = {
  toolbar: {
    display: 'flex',
    flexDirection: 'row',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap',
    padding: '12px 0',
    borderBottom: '1px solid #e4e4e7',
  },
  searchWrapper: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    background: '#fff',
    border: '1px solid #d4d4d8',
    borderRadius: '6px',
    padding: '6px 12px',
    width: '220px',
  },
  searchIcon: {
    marginRight: '8px',
    color: '#a1a1aa',
    flexShrink: 0,
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    flex: 1,
    fontSize: '13px',
    color: '#18181b',
    background: 'transparent',
    width: '100%',
  },
  select: {
    border: '1px solid #d4d4d8',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '13px',
    color: '#18181b',
    background: '#fff',
    cursor: 'pointer',
    outline: 'none',
  },
  viewToggle: {
    display: 'flex',
    flexDirection: 'row',
    gap: '4px',
    marginLeft: 'auto',
  },
  viewBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    border: '1px solid #d4d4d8',
    borderRadius: '6px',
    background: '#fff',
    cursor: 'pointer',
    color: '#71717a',
    padding: 0,
  },
  viewBtnActive: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    border: '1px solid #18181b',
    borderRadius: '6px',
    background: '#18181b',
    cursor: 'pointer',
    color: '#fff',
    padding: 0,
  },
  createBtn: {
    background: '#ffdd00',
    color: '#18181b',
    fontWeight: 600,
    borderRadius: '6px',
    padding: '8px 16px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    whiteSpace: 'nowrap',
  },
};

const SearchIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const ListIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const KanbanIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="5" height="18" rx="1" />
    <rect x="10" y="3" width="5" height="12" rx="1" />
    <rect x="17" y="3" width="5" height="15" rx="1" />
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
}) {
  const debounceRef = useRef(null);

  const handleSearchChange = useCallback(
    (e) => {
      const value = e.target.value;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onFiltersChange({ ...filters, search: value });
      }, 300);
    },
    [filters, onFiltersChange]
  );

  const handleFilterChange = useCallback(
    (field) => (e) => {
      onFiltersChange({ ...filters, [field]: e.target.value });
    },
    [filters, onFiltersChange]
  );

  return (
    <div className="todo-toolbar" style={styles.toolbar}>
      {/* Search */}
      <div className="todo-toolbar__search" style={styles.searchWrapper}>
        <span style={styles.searchIcon}>
          <SearchIcon />
        </span>
        <input
          type="text"
          placeholder="Buscar tarefas..."
          defaultValue={filters.search || ''}
          onChange={handleSearchChange}
          style={styles.searchInput}
        />
      </div>

      {/* Status filter */}
      <div className="todo-toolbar__filter">
        <select
          value={filters.status || ''}
          onChange={handleFilterChange('status')}
          style={styles.select}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Priority filter */}
      <div className="todo-toolbar__filter">
        <select
          value={filters.priority || ''}
          onChange={handleFilterChange('priority')}
          style={styles.select}
        >
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Project filter */}
      <div className="todo-toolbar__filter">
        <select
          value={filters.projectId || ''}
          onChange={handleFilterChange('projectId')}
          style={styles.select}
        >
          <option value="">Todos</option>
          {projects.map((proj) => (
            <option key={proj.id} value={proj.id}>
              {proj.name}
            </option>
          ))}
        </select>
      </div>

      {/* Assignee filter */}
      <div className="todo-toolbar__filter">
        <select
          value={filters.assignee || ''}
          onChange={handleFilterChange('assignee')}
          style={styles.select}
        >
          <option value="">Todos</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </div>

      {/* Group By (only in list mode) */}
      {viewMode === 'list' && (
        <div className="todo-toolbar__filter">
          <select
            value={groupBy || 'none'}
            onChange={(e) => onGroupByChange(e.target.value)}
            style={styles.select}
          >
            {GROUP_BY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* View toggle + Create button */}
      <div className="todo-toolbar__view-toggle" style={styles.viewToggle}>
        <button
          type="button"
          title="Visualizar em lista"
          onClick={() => onViewModeChange('list')}
          style={viewMode === 'list' ? styles.viewBtnActive : styles.viewBtn}
        >
          <ListIcon />
        </button>
        <button
          type="button"
          title="Visualizar em kanban"
          onClick={() => onViewModeChange('kanban')}
          style={viewMode === 'kanban' ? styles.viewBtnActive : styles.viewBtn}
        >
          <KanbanIcon />
        </button>
      </div>

      <button
        type="button"
        className="todo-toolbar__create-btn"
        style={styles.createBtn}
        onClick={onCreateClick}
      >
        + Nova Tarefa
      </button>
    </div>
  );
}
