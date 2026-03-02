import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format, isSameDay, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import axios from 'axios';
import './DaySummary.css';

function formatTime(dateStr) {
  if (!dateStr) return '';
  return format(new Date(dateStr), 'HH:mm');
}

const PRIORITY_COLORS = {
  alta: '#ef4444',
  média: '#f59e0b',
  baixa: '#22c55e',
};

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

  const handleToggleTodoStatus = useCallback(async (todo) => {
    const newStatus = todo.status === 'finalizado' ? 'backlog' : 'finalizado';
    try {
      const res = await axios.patch(
        `/api/agenda/tasks/todos/${todo.id}`,
        { status: newStatus },
        { withCredentials: true }
      );

      if (res.data.success) {
        setTodosByTask(prev => {
          const taskTodos = prev[todo.agenda_task_id] || [];
          return {
            ...prev,
            [todo.agenda_task_id]: taskTodos.map(t =>
              t.id === todo.id ? { ...t, status: newStatus } : t
            ),
          };
        });
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
                  <ul className="day-summary__todo-list">
                    {todos.map(todo => {
                      const isDone = todo.status === 'finalizado';
                      return (
                        <li key={todo.id} className={`day-summary__todo-item${isDone ? ' is-done' : ''}`}>
                          <button
                            className={`day-summary__todo-check${isDone ? ' is-checked' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleTodoStatus(todo);
                            }}
                            title={isDone ? 'Reabrir' : 'Finalizar'}
                          >
                            {isDone ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <div className="day-summary__todo-check-empty" />
                            )}
                          </button>

                          <div className="day-summary__todo-text">
                            <span className="day-summary__todo-name">{todo.name}</span>
                            {todo.project_name && (
                              <span className="day-summary__todo-project">{todo.project_name}</span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
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
              <div
                key={todo.id}
                className={[
                  'day-summary__unlinked-item',
                  isDone ? 'day-summary__unlinked-item--done' : '',
                  isOverdue ? 'day-summary__unlinked-item--overdue' : '',
                ].filter(Boolean).join(' ')}
                draggable={!isDone}
                onDragStart={!isDone ? (e) => handleDragStart(e, todo.id) : undefined}
                onDragEnd={!isDone ? handleDragEnd : undefined}
              >
                <div
                  className="day-summary__unlinked-priority"
                  style={{ background: PRIORITY_COLORS[todo.priority] || '#94a3b8' }}
                  title={todo.priority}
                />
                <div className="day-summary__unlinked-info">
                  <span className="day-summary__unlinked-name">{todo.name}</span>
                  <span className="day-summary__unlinked-meta">
                    {todo.due_date && (
                      <span className="day-summary__unlinked-date">
                        {format(new Date(todo.due_date), 'dd/MM')}
                      </span>
                    )}
                    {todo.project_name && (
                      <span className="day-summary__unlinked-project">{todo.project_name}</span>
                    )}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default DaySummary;
