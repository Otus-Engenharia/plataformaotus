import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format, isSameDay, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import axios from 'axios';
import TodoItemSidebar from './TodoItemSidebar';
import './DaySummary.css';

// Color coding por tipo de atividade (position)
const POSITION_BORDER_COLORS = {
  'compatibilização': '#8b5cf6',
  'coordenação':      '#3b82f6',
  'verificação':      '#10b981',
  'digital':          '#f59e0b',
  'time bim':         '#ec4899',
  'otus':             '#eab308',
};

function formatTime(dateStr) {
  if (!dateStr) return '';
  return format(new Date(dateStr), 'HH:mm');
}

function DaySummary({ selectedDay, tasks, onEventClick, onTodoLinked, userId, refreshKey }) {
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [todosByTask, setTodosByTask] = useState({});
  const [unlinkedTodos, setUnlinkedTodos] = useState([]);
  const [loadingUnlinked, setLoadingUnlinked] = useState(false);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const isDraggingRef = useRef(false);

  const dayTasks = useMemo(() =>
    tasks
      .filter(t => t.start_date && isSameDay(new Date(t.start_date), selectedDay))
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date)),
    [tasks, selectedDay]
  );

  const totalMinutes = dayTasks.reduce((acc, t) => {
    if (t.duration_minutes) return acc + t.duration_minutes;
    return acc;
  }, 0);

  const totalHours = (totalMinutes / 60).toFixed(1);

  const dayTaskIdsKey = useMemo(() => dayTasks.map(t => t.id).join(','), [dayTasks]);

  useEffect(() => {
    if (!dayTaskIdsKey) {
      setTodosByTask({});
      return;
    }

    let cancelled = false;

    async function fetchTodos() {
      try {
        const res = await axios.get('/api/agenda/tasks/todos', {
          params: { agendaTaskIds: dayTaskIdsKey },
          withCredentials: true,
        });

        if (!cancelled && res.data.success) {
          const grouped = {};
          for (const todo of res.data.data) {
            if (!grouped[todo.agenda_task_id]) {
              grouped[todo.agenda_task_id] = [];
            }
            grouped[todo.agenda_task_id].push(todo);
          }
          setTodosByTask(grouped);
        }
      } catch (err) {
        console.error('Erro ao buscar ToDos:', err);
      }
    }

    fetchTodos();
    return () => { cancelled = true; };
  }, [dayTaskIdsKey]);

  const filteredAndSortedTodos = useMemo(() => {
    const weekStart = startOfWeek(selectedDay, { weekStartsOn: 1 });
    const weekEnd   = endOfWeek(selectedDay,   { weekStartsOn: 1 });

    const inWeek = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return isWithinInterval(d, { start: weekStart, end: weekEnd });
    };

    const PRIORITY_ORDER = { alta: 0, média: 1, baixa: 2 };
    const priorityOf = (t) => PRIORITY_ORDER[t.priority] ?? 1;

    const isOverdue = (todo) => {
      if (!todo.due_date) return false;
      const d = new Date(todo.due_date);
      return d < weekStart && todo.status !== 'finalizado';
    };

    const visible = unlinkedTodos.filter(todo => {
      if (todo.status === 'cancelado') return false;
      const isDone = todo.status === 'finalizado';
      if (isDone) return inWeek(todo.due_date);
      if (isOverdue(todo)) return true;
      return !todo.due_date || inWeek(todo.due_date);
    });

    const groupOrder = (t) => {
      if (t.status === 'finalizado') return 2;
      if (isOverdue(t)) return 0;
      return 1;
    };

    return visible.sort((a, b) => {
      const gA = groupOrder(a), gB = groupOrder(b);
      if (gA !== gB) return gA - gB;
      return priorityOf(a) - priorityOf(b);
    });
  }, [unlinkedTodos, selectedDay]);

  useEffect(() => {
    if (!userId) {
      setUnlinkedTodos([]);
      return;
    }

    let cancelled = false;

    async function fetchUnlinked() {
      setLoadingUnlinked(true);
      try {
        const res = await axios.get('/api/todos', {
          params: { standalone_only: 'true', assignee: userId },
          withCredentials: true,
        });

        if (!cancelled && res.data.success) {
          setUnlinkedTodos(res.data.data || []);
        }
      } catch (err) {
        console.error('Erro ao buscar ToDos desvinculados:', err);
      } finally {
        if (!cancelled) setLoadingUnlinked(false);
      }
    }

    fetchUnlinked();
    return () => { cancelled = true; };
  }, [userId, refreshKey]);

  // ========== Drag & drop ==========

  const handleDragStart = useCallback((e, todoId) => {
    e.dataTransfer.setData('text/plain', String(todoId));
    e.dataTransfer.effectAllowed = 'move';
    isDraggingRef.current = true;
  }, []);

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    setDragOverTaskId(null);
  }, []);

  const handleRootDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const activityRow = e.target.closest('[data-task-id]');
    const taskIdStr = activityRow ? activityRow.dataset.taskId : null;
    setDragOverTaskId(taskIdStr);
  }, []);

  const handleRootDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverTaskId(null);
    }
  }, []);

  const handleRootDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTaskId(null);
    isDraggingRef.current = false;

    const activityRow = e.target.closest('[data-task-id]');
    if (!activityRow) return;

    const agendaTaskIdStr = activityRow.dataset.taskId;
    const targetTask = dayTasks.find(t => String(t.id) === agendaTaskIdStr);
    if (!targetTask) return;

    const agendaTaskId = targetTask.id;
    const todoIdRaw = e.dataTransfer.getData('text/plain');
    if (!todoIdRaw) return;

    const todo = unlinkedTodos.find(t => String(t.id) === todoIdRaw);
    if (!todo) return;

    try {
      const res = await axios.put(`/api/todos/${todo.id}`, {
        agenda_task_id: agendaTaskId,
        due_date: format(selectedDay, 'yyyy-MM-dd'),
      }, { withCredentials: true });

      if (res.data.success) {
        setUnlinkedTodos(prev => prev.filter(t => t.id !== todo.id));

        const linkedTodo = {
          id: todo.id,
          name: todo.name,
          status: todo.status,
          priority: todo.priority,
          agenda_task_id: agendaTaskId,
          project_name: todo.project_name || null,
        };

        setTodosByTask(prev => ({
          ...prev,
          [agendaTaskId]: [...(prev[agendaTaskId] || []), linkedTodo],
        }));

        setExpandedIds(prev => {
          const next = new Set(prev);
          next.add(agendaTaskId);
          return next;
        });

        if (onTodoLinked) onTodoLinked(todo.id, agendaTaskId);
      }
    } catch (err) {
      console.error('Erro ao vincular ToDo à agenda:', err);
    }
  }, [unlinkedTodos, onTodoLinked, dayTasks, selectedDay]);

  const toggleExpand = useCallback((taskId) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const handleCompleteTodo = useCallback(async (todoId) => {
    try {
      const res = await axios.patch(
        `/api/todos/${todoId}/complete`,
        {},
        { withCredentials: true }
      );

      if (res.data.success) {
        const updated = res.data.data;
        setTodosByTask(prev => {
          const newState = { ...prev };
          for (const taskId of Object.keys(newState)) {
            newState[taskId] = newState[taskId].map(t =>
              t.id === todoId ? { ...t, status: updated.status, is_closed: updated.is_closed } : t
            );
          }
          return newState;
        });
        setUnlinkedTodos(prev =>
          prev.map(t => t.id === todoId
            ? { ...t, status: updated.status, is_closed: updated.is_closed }
            : t
          )
        );
      }
    } catch (err) {
      console.error('Erro ao completar ToDo:', err);
    }
  }, []);

  const handleUpdateTodo = useCallback(async (todoId, updates) => {
    try {
      const res = await axios.put(
        `/api/todos/${todoId}`,
        updates,
        { withCredentials: true }
      );

      if (res.data.success) {
        const updated = res.data.data;
        setTodosByTask(prev => {
          const newState = { ...prev };
          for (const taskId of Object.keys(newState)) {
            newState[taskId] = newState[taskId].map(t =>
              t.id === todoId ? { ...t, ...updated } : t
            );
          }
          return newState;
        });
        setUnlinkedTodos(prev =>
          prev.map(t => t.id === todoId ? { ...t, ...updated } : t)
        );
      }
    } catch (err) {
      console.error('Erro ao atualizar ToDo:', err);
    }
  }, []);

  return (
    <div
      className="day-summary"
      onDragOver={handleRootDragOver}
      onDragLeave={handleRootDragLeave}
      onDrop={handleRootDrop}
    >
      {/* Header */}
      <div className="day-summary__header">
        <div className="day-summary__date-label">
          {format(selectedDay, 'EEEE', { locale: ptBR })}
        </div>
        <div className="day-summary__date">
          {format(selectedDay, "d 'de' MMMM", { locale: ptBR })}
        </div>
        {dayTasks.length > 0 && (
          <div className="day-summary__hours-total">
            <span>{totalHours}h</span> agendadas
          </div>
        )}
      </div>

      {/* Conteúdo único scrollável: atividades + todos */}
      <div className="day-summary__scroll">

        {/* Seção: Atividades */}
        <div className="day-summary__section-header">
          Atividades ({dayTasks.length})
        </div>

        {dayTasks.length === 0 ? (
          <div className="day-summary__empty">
            Nenhuma atividade agendada
          </div>
        ) : (
          dayTasks.map(task => {
            const todos = todosByTask[task.id] || [];
            const hasTodos = todos.length > 0;
            const isExpanded = expandedIds.has(task.id);
            const doneCount = todos.filter(t => t.status === 'finalizado').length;

            return (
              <div key={task.id} className="day-summary__activity">
                <div
                  data-task-id={task.id}
                  className={`day-summary__activity-row${hasTodos ? ' has-todos' : ''}${dragOverTaskId === String(task.id) ? ' is-drag-over' : ''}`}
                  style={{ borderLeftColor: POSITION_BORDER_COLORS[task.position] || 'transparent' }}
                  onClick={() => hasTodos ? toggleExpand(task.id) : (onEventClick && onEventClick(task))}
                >
                  <div className="day-summary__event-time">
                    {formatTime(task.start_date)}
                  </div>

                  <div className="day-summary__event-info">
                    <div className="day-summary__event-name">{task.name}</div>
                    {hasTodos && (
                      <span className="day-summary__todo-count">
                        {doneCount}/{todos.length} tarefas
                      </span>
                    )}
                  </div>

                  {hasTodos && (
                    <svg
                      className={`day-summary__chevron${isExpanded ? ' is-open' : ''}`}
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  )}
                </div>

                {isExpanded && (
                  <div className="day-summary__todo-list">
                    {todos.map(todo => (
                      <TodoItemSidebar
                        key={todo.id}
                        todo={todo}
                        isLinked={true}
                        isDone={todo.status === 'finalizado'}
                        isOverdue={false}
                        onToggleComplete={handleCompleteTodo}
                        onUpdate={handleUpdateTodo}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Divisor */}
        <div className="day-summary__section-divider" />

        {/* Seção: ToDo's */}
        <div className="day-summary__section-header">
          ToDo's ({filteredAndSortedTodos.length})
        </div>

        {loadingUnlinked ? (
          <div className="day-summary__empty">Carregando...</div>
        ) : filteredAndSortedTodos.length === 0 ? (
          <div className="day-summary__empty">
            Nenhum ToDo sem vínculo
          </div>
        ) : (
          filteredAndSortedTodos.map(todo => {
            const isDone = todo.status === 'finalizado';
            const isOverdue = (() => {
              if (!todo.due_date) return false;
              const d = new Date(todo.due_date);
              return d < startOfWeek(selectedDay, { weekStartsOn: 1 }) && !isDone;
            })();
            return (
              <TodoItemSidebar
                key={todo.id}
                todo={todo}
                isLinked={false}
                isDone={isDone}
                isOverdue={isOverdue}
                onToggleComplete={handleCompleteTodo}
                onUpdate={handleUpdateTodo}
                draggable={!isDone}
                onDragStart={(e) => handleDragStart(e, todo.id)}
                onDragEnd={handleDragEnd}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

export default DaySummary;
