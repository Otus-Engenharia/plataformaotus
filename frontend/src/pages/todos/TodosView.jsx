import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import TodoToolbar from './components/TodoToolbar';
import TodoListView from './components/TodoListView';
import TodoKanbanView from './components/TodoKanbanView';
import TodoCreateDialog from './components/TodoCreateDialog';
import TodoDetailPanel from './components/TodoDetailPanel';
import './TodosView.css';

const API_URL = import.meta.env.VITE_API_URL || '';

const STATUS_LABELS = {
  backlog: 'Backlog',
  'a fazer': 'A Fazer',
  'em progresso': 'Em Progresso',
  validacao: 'Validacao',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

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
  const { user } = useAuth();

  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list');
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [sort, setSort] = useState(INITIAL_SORT);
  const [groupBy, setGroupBy] = useState('status');

  const [stats, setStats] = useState({});
  const [projects, setProjects] = useState([]);
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
      if (filters.projectId) params.set('projectId', filters.projectId);
      if (filters.assignee) params.set('assignee', filters.assignee);
      if (filters.teamId) params.set('team_id', filters.teamId);
      if (filters.search) params.set('search', filters.search);
      params.set('sortField', sort.field);
      params.set('sortDirection', sort.direction);

      const qs = params.toString();
      const res = await fetch(`${API_URL}/api/todos${qs ? `?${qs}` : ''}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erro ao buscar todos');
      const data = await res.json();
      setTodos(Array.isArray(data) ? data : data.todos ?? []);
    } catch (err) {
      console.error('[TodosView] fetchTodos:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, sort]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/todos/stats`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('[TodosView] fetchStats:', err);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/agenda/tasks/form/projects`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : data.projects ?? []);
    } catch (err) {
      console.error('[TodosView] fetchProjects:', err);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : data.users ?? []);
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
    fetchStats();
    fetchProjects();
    fetchUsers();
    fetchTeams();
  }, [fetchStats, fetchProjects, fetchUsers, fetchTeams]);

  // Refresh stats whenever todos change
  useEffect(() => {
    fetchStats();
  }, [todos, fetchStats]);

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
        setShowCreateDialog(false);
        setEditingTodo(null);
        await fetchTodos();
      } catch (err) {
        console.error('[TodosView] handleUpdate:', err);
      }
    },
    [fetchTodos],
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

  // --- Stat badges ---

  const statBadges = [
    { key: 'backlog', label: 'Backlog', count: stats.backlog ?? 0 },
    { key: 'a-fazer', label: 'A Fazer', count: stats['a fazer'] ?? stats.aFazer ?? 0 },
    { key: 'em-progresso', label: 'Em Progresso', count: stats['em progresso'] ?? stats.emProgresso ?? 0 },
    { key: 'validacao', label: 'Validacao', count: stats.validacao ?? 0 },
    { key: 'finalizado', label: 'Finalizado', count: stats.finalizado ?? 0 },
    { key: 'cancelado', label: 'Cancelado', count: stats.cancelado ?? 0 },
  ];

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
      />

      <div className="todos-view__content">
        {loading && (
          <div className="todos-view__loading">
            <div className="todos-view__spinner" />
          </div>
        )}

        {!loading && viewMode === 'list' && (
          <TodoListView
            todos={todos}
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
            todos={todos}
            onComplete={handleComplete}
            onSelect={setSelectedTodo}
            onEdit={(todo) => {
              setEditingTodo(todo);
              setShowCreateDialog(true);
            }}
            onStatusChange={(id, status) => handleUpdate(id, { status })}
            loading={loading}
          />
        )}
      </div>

      {showCreateDialog && (
        <TodoCreateDialog
          todo={editingTodo}
          projects={projects}
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
        />
      )}
    </div>
  );
}
