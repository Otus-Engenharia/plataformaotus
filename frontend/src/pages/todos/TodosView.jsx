import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { startOfWeek, addWeeks, subWeeks, addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';
import TodoToolbar from './components/TodoToolbar';
import TodoListView from './components/TodoListView';
import TodoKanbanView from './components/TodoKanbanView';
import TodoCreateDialog from './components/TodoCreateDialog';
import TodoDetailPanel from './components/TodoDetailPanel';
import './TodosView.css';

const API_URL = import.meta.env.VITE_API_URL || '';

const INITIAL_FILTERS = {
  status: '',
  priority: '',
  projectId: '',
  assignee: '',
  teamId: '',
  search: '',
};

const INITIAL_SORT = {
  field: 'created_at',
  direction: 'desc',
};

export default function TodosView() {
  const { effectiveUser: user } = useAuth();

  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list');
  const [filters, setFilters] = useState(() => ({
    ...INITIAL_FILTERS,
    assignee: user?.userId || '',
  }));
  const [sort, setSort] = useState(INITIAL_SORT);
  const [groupBy, setGroupBy] = useState('status');
  const [weekRef, setWeekRef] = useState(new Date());
  const [showClosedInDate, setShowClosedInDate] = useState(false);

  const goToPreviousWeek = useCallback(() => setWeekRef(prev => subWeeks(prev, 1)), []);
  const goToNextWeek = useCallback(() => setWeekRef(prev => addWeeks(prev, 1)), []);
  const goToToday = useCallback(() => setWeekRef(new Date()), []);

  const filteredTodos = useMemo(() => {
    if (showClosedInDate) return todos;
    return todos.filter(t => t.status !== 'finalizado' && t.status !== 'cancelado');
  }, [todos, showClosedInDate]);

  const weekLabel = useMemo(() => {
    const start = startOfWeek(weekRef, { weekStartsOn: 1 });
    const end = addDays(start, 4);
    return `${format(start, "d MMM", { locale: ptBR })} – ${format(end, "d MMM yyyy", { locale: ptBR })}`;
  }, [weekRef]);

  const [projects, setProjects] = useState([]);
  const [favoriteProjects, setFavoriteProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTodo, setEditingTodo] = useState(null);
  const [selectedTodo, setSelectedTodo] = useState(null);

  // --- Data fetching ---

  const fetchTodos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.priority) params.set('priority', filters.priority);
      if (filters.projectId) params.set('project_id', filters.projectId);
      if (filters.assignee) params.set('assignee', filters.assignee);
      if (filters.teamId) params.set('team_id', filters.teamId);
      if (filters.search) params.set('search', filters.search);
      params.set('sort_field', sort.field);
      params.set('sort_dir', sort.direction);

      const qs = params.toString();
      const res = await fetch(`${API_URL}/api/todos${qs ? `?${qs}` : ''}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erro ao buscar todos');
      const json = await res.json();
      setTodos(json.data ?? []);
    } catch (err) {
      console.error('[TodosView] fetchTodos:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, sort]);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/todos/projects`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const json = await res.json();
      setProjects(json.data ?? []);
    } catch (err) {
      console.error('[TodosView] fetchProjects:', err);
    }
  }, []);

  const fetchFavoriteProjects = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/todos/favorite-projects`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const json = await res.json();
      setFavoriteProjects(json.data ?? []);
    } catch (err) {
      console.error('[TodosView] fetchFavoriteProjects:', err);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/todos/users`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const json = await res.json();
      setUsers(json.data ?? []);
    } catch (err) {
      console.error('[TodosView] fetchUsers:', err);
    }
  }, []);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/todos/teams`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const json = await res.json();
      setTeams(json.data ?? []);
    } catch (err) {
      console.error('[TodosView] fetchTeams:', err);
    }
  }, []);

  // Load on mount + when filters/sort change
  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  useEffect(() => {
    fetchProjects();
    fetchFavoriteProjects();
    fetchUsers();
    fetchTeams();
  }, [fetchProjects, fetchFavoriteProjects, fetchUsers, fetchTeams]);

  // --- Mutation handlers ---

  const handleCreate = useCallback(
    async (data) => {
      try {
        const res = await fetch(`${API_URL}/api/todos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Erro ao criar todo');
        setShowCreateDialog(false);
        setEditingTodo(null);
        await fetchTodos();
      } catch (err) {
        console.error('[TodosView] handleCreate:', err);
      }
    },
    [fetchTodos],
  );

  const handleUpdate = useCallback(
    async (id, data) => {
      try {
        const res = await fetch(`${API_URL}/api/todos/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Erro ao atualizar todo');
        const json = await res.json();

        // Atualiza o todo selecionado no painel de detalhe
        if (selectedTodo?.id === id && json.data) {
          setSelectedTodo(json.data);
        }

        setShowCreateDialog(false);
        setEditingTodo(null);
        await fetchTodos();
      } catch (err) {
        console.error('[TodosView] handleUpdate:', err);
      }
    },
    [fetchTodos, selectedTodo],
  );

  const handleLinkAgenda = useCallback(
    async (id, agendaTaskId) => {
      await handleUpdate(id, { agenda_task_id: agendaTaskId });
    },
    [handleUpdate],
  );

  const handleComplete = useCallback(
    async (id) => {
      try {
        const res = await fetch(`${API_URL}/api/todos/${id}/complete`, {
          method: 'PATCH',
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Erro ao completar todo');
        await fetchTodos();
      } catch (err) {
        console.error('[TodosView] handleComplete:', err);
      }
    },
    [fetchTodos],
  );

  const handleDelete = useCallback(
    async (id) => {
      try {
        const res = await fetch(`${API_URL}/api/todos/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Erro ao deletar todo');
        setSelectedTodo(null);
        await fetchTodos();
      } catch (err) {
        console.error('[TodosView] handleDelete:', err);
      }
    },
    [fetchTodos],
  );

  const handleKanbanDrop = useCallback(
    (todoId, columnKey) => {
      if (groupBy === 'status') {
        handleUpdate(todoId, { status: columnKey });
      } else if (groupBy === 'due_date') {
        if (columnKey === 'overdue') return;
        handleUpdate(todoId, { due_date: columnKey });
      }
    },
    [groupBy, handleUpdate],
  );

  // --- Stat badges ---

  const statBadges = useMemo(() => {
    const counts = {};
    todos.forEach((t) => {
      const s = t.status || 'backlog';
      counts[s] = (counts[s] || 0) + 1;
    });
    return [
      { key: 'backlog', label: 'Backlog', count: counts.backlog ?? 0 },
      { key: 'a-fazer', label: 'A Fazer', count: counts['a fazer'] ?? 0 },
      { key: 'em-progresso', label: 'Em Progresso', count: counts['em progresso'] ?? 0 },
      { key: 'validacao', label: 'Validação', count: counts['validação'] ?? 0 },
      { key: 'finalizado', label: 'Finalizado', count: counts.finalizado ?? 0 },
      { key: 'cancelado', label: 'Cancelado', count: counts.cancelado ?? 0 },
    ];
  }, [todos]);

  // --- Render ---

  return (
    <div className="todos-view">
      <div className="todos-view__header">
        <h1>ToDo's</h1>
        <div className="todos-view__stats">
          {statBadges.map((b) => (
            <span
              key={b.key}
              className={`stat-badge stat-badge--${b.key}`}
              title={b.label}
            >
              {b.label}: <strong>{b.count}</strong>
            </span>
          ))}
        </div>
      </div>

      <TodoToolbar
        filters={filters}
        onFiltersChange={setFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        onCreateClick={() => setShowCreateDialog(true)}
        projects={projects}
        users={users}
        teams={teams}
        weekLabel={weekLabel}
        onWeekPrev={goToPreviousWeek}
        onWeekNext={goToNextWeek}
        onWeekToday={goToToday}
        showClosedInDate={showClosedInDate}
        onShowClosedInDateChange={setShowClosedInDate}
        sort={sort}
        onSortChange={setSort}
      />

      <div className="todos-view__content">
        {loading && (
          <div className="todos-view__loading">
            <div className="todos-view__spinner" />
          </div>
        )}

        {!loading && viewMode === 'list' && (
          <TodoListView
            todos={filteredTodos}
            groupBy={groupBy}
            onComplete={handleComplete}
            onSelect={setSelectedTodo}
            onEdit={(todo) => {
              setEditingTodo(todo);
              setShowCreateDialog(true);
            }}
            onDelete={handleDelete}
            loading={loading}
          />
        )}

        {!loading && viewMode === 'kanban' && (
          <TodoKanbanView
            todos={filteredTodos}
            groupBy={groupBy}
            weekRef={weekRef}
            onComplete={handleComplete}
            onSelect={setSelectedTodo}
            onEdit={(todo) => {
              setEditingTodo(todo);
              setShowCreateDialog(true);
            }}
            onStatusChange={(id, status) => handleUpdate(id, { status })}
            onDrop={handleKanbanDrop}
            loading={loading}
          />
        )}
      </div>

      {showCreateDialog && (
        <TodoCreateDialog
          todo={editingTodo}
          projects={projects}
          favoriteProjects={favoriteProjects}
          users={users}
          onSave={
            editingTodo
              ? (data) => handleUpdate(editingTodo.id, data)
              : handleCreate
          }
          onClose={() => {
            setShowCreateDialog(false);
            setEditingTodo(null);
          }}
        />
      )}

      {selectedTodo && (
        <TodoDetailPanel
          todo={selectedTodo}
          onClose={() => setSelectedTodo(null)}
          onEdit={(todo) => {
            setEditingTodo(todo);
            setShowCreateDialog(true);
            setSelectedTodo(null);
          }}
          onComplete={handleComplete}
          onDelete={handleDelete}
          onLinkAgenda={handleLinkAgenda}
        />
      )}
    </div>
  );
}
