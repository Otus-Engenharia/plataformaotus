import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format, isSameDay } from 'date-fns';
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

  // Buscar ToDo's desvinculados para o dia selecionado (apenas do usuário)
  useEffect(() => {
    if (!userId) {
      setUnlinkedTodos([]);
      return;
    }

    const dateStr = format(selectedDay, 'yyyy-MM-dd');
    let cancelled = false;

    async function fetchUnlinked() {
      setLoadingUnlinked(true);
      try {
        const res = await axios.get('/api/todos', {
          params: { due_date: dateStr, standalone_only: 'true', assignee: userId },
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
  }, [selectedDay, userId, refreshKey]);

  // ========== Drag & drop (event delegation no container raiz) ==========

  const handleDragStart = useCallback((e, todoId) => {
    e.dataTransfer.setData('text/plain', String(todoId));
    e.dataTransfer.effectAllowed = 'move';
    isDraggingRef.current = true;
  }, []);

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    setDragOverTaskId(null);
  }, []);

  // onDragOver no container raiz — garante que o browser permita drop
  const handleRootDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Identifica qual activity row está sob o cursor via data attribute
    const activityRow = e.target.closest('[data-task-id]');
    const taskIdStr = activityRow ? activityRow.dataset.taskId : null;
    setDragOverTaskId(taskIdStr);
  }, []);

  const handleRootDragLeave = useCallback((e) => {
    // Só limpa se saiu do container inteiro
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverTaskId(null);
    }
  }, []);

  // onDrop no container raiz — procura a activity row mais próxima do ponto de drop
  const handleRootDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation(); // Impede que o drop buble para AgendaView
    setDragOverTaskId(null);
    isDraggingRef.current = false;

    const activityRow = e.target.closest('[data-task-id]');
    if (!activityRow) return;

    const agendaTaskIdStr = activityRow.dataset.taskId;

    // Encontra a task original para manter o tipo nativo do ID
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
      }, { withCredentials: true });

      if (res.data.success) {
        // Remover da lista de desvinculados
        setUnlinkedTodos(prev => prev.filter(t => t.id !== todo.id));

        // Adicionar aos todos da atividade alvo
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

        // Expandir a atividade para mostrar o todo recém-vinculado
        setExpandedIds(prev => {
          const next = new Set(prev);
          next.add(agendaTaskId);
          return next;
        });

        // Notificar o pai
        if (onTodoLinked) onTodoLinked(todo.id, agendaTaskId);
      }
    } catch (err) {
      console.error('Erro ao vincular ToDo à agenda:', err);
    }
  }, [unlinkedTodos, onTodoLinked, dayTasks]);

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

      {/* Metade superior: Atividades do dia */}
      <div className="day-summary__half">
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

      {/* Metade inferior: ToDo's sem vínculo */}
      <div className="day-summary__half day-summary__half--unlinked">
        <div className="day-summary__section">
          <div className="day-summary__section-title">
            ToDo's sem vínculo ({unlinkedTodos.length})
          </div>
        </div>

        <div className="day-summary__unlinked-list">
          {loadingUnlinked ? (
            <div className="day-summary__empty">Carregando...</div>
          ) : unlinkedTodos.length === 0 ? (
            <div className="day-summary__empty">
              Nenhum ToDo sem vínculo para este dia
            </div>
          ) : (
            unlinkedTodos.map(todo => (
              <div
                key={todo.id}
                className="day-summary__unlinked-item"
                draggable
                onDragStart={(e) => handleDragStart(e, todo.id)}
                onDragEnd={handleDragEnd}
              >
                <div
                  className="day-summary__unlinked-priority"
                  style={{ background: PRIORITY_COLORS[todo.priority] || '#94a3b8' }}
                  title={todo.priority}
                />
                <div className="day-summary__unlinked-info">
                  <span className="day-summary__unlinked-name">{todo.name}</span>
                  {todo.project_name && (
                    <span className="day-summary__unlinked-project">{todo.project_name}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default DaySummary;
