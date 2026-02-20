import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import axios from 'axios';
import './DaySummary.css';

function formatTime(dateStr) {
  if (!dateStr) return '';
  return format(new Date(dateStr), 'HH:mm');
}

function DaySummary({ selectedDay, tasks, onEventClick }) {
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [todosByTask, setTodosByTask] = useState({});

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

  // Chave estável para o efeito
  const dayTaskIdsKey = useMemo(() => dayTasks.map(t => t.id).join(','), [dayTasks]);

  // Buscar todos quando as tasks do dia mudam
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
    <div className="day-summary">
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

      {/* Lista de atividades */}
      <div className="day-summary__section">
        <div className="day-summary__section-title">
          Atividades ({dayTasks.length})
        </div>
      </div>

      <div className="day-summary__events">
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
                  className={`day-summary__activity-row${hasTodos ? ' has-todos' : ''}`}
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

                {/* Lista de ToDo's expandida */}
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
      </div>
    </div>
  );
}

export default DaySummary;
