import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  format,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import WeeklyCalendar from '../../components/agenda/WeeklyCalendar';
import DaySummary from '../../components/agenda/DaySummary';
import AgendaCreateModal from '../../components/agenda/AgendaCreateModal';
import AgendaDetailModal from '../../components/agenda/AgendaDetailModal';
import './AgendaView.css';

function getWeekDays(referenceDate) {
  const start = startOfWeek(referenceDate, { weekStartsOn: 0 }); // domingo
  const end = endOfWeek(referenceDate, { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end });
}

function AgendaView() {
  const { effectiveUser: user } = useAuth();

  // Contém o scroll para dentro da grade horária.
  // A cadeia precisa ser fixada em todos os níveis:
  // html → body → #root → .app-shell → ... → .weekly-calendar__body (único scroll).
  // O problema central é .app { min-height: 100vh } que permite crescer além do viewport.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const appShell = document.querySelector('.app-shell');

    const prev = {
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
      rootOverflow: root?.style.overflow ?? '',
      rootHeight: root?.style.height ?? '',
      appHeight: appShell?.style.height ?? '',
      appMinHeight: appShell?.style.minHeight ?? '',
      appOverflow: appShell?.style.overflow ?? '',
    };

    html.style.overflow = 'hidden';
    html.style.height = '100%';
    body.style.overflow = 'hidden';
    body.style.height = '100%';
    if (root) {
      root.style.overflow = 'hidden';
      root.style.height = '100%';
    }
    // Substituir min-height: 100vh por height: 100% para fixar a altura do app
    if (appShell) {
      appShell.style.height = '100%';
      appShell.style.minHeight = '0';
      appShell.style.overflow = 'hidden';
    }

    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.height = prev.htmlHeight;
      body.style.overflow = prev.bodyOverflow;
      body.style.height = prev.bodyHeight;
      if (root) {
        root.style.overflow = prev.rootOverflow;
        root.style.height = prev.rootHeight;
      }
      if (appShell) {
        appShell.style.height = prev.appHeight;
        appShell.style.minHeight = prev.appMinHeight;
        appShell.style.overflow = prev.appOverflow;
      }
    };
  }, []);

  const [currentWeekRef, setCurrentWeekRef] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scopeMode, setScopeMode] = useState('minha'); // 'minha' | 'equipe'
  const [viewMode, setViewMode] = useState('business'); // 'business' | 'full'
  const [createModal, setCreateModal] = useState({ isOpen: false, date: null });
  const [detailModal, setDetailModal] = useState({ isOpen: false, task: null });
  const [pendingScopeAction, setPendingScopeAction] = useState(null);
  const [todosRefreshKey, setTodosRefreshKey] = useState(0);
  const dropHighlightRef = useRef(null);

  const weekDays = getWeekDays(currentWeekRef);

  const loadTasks = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const startDate = format(weekDays[0], "yyyy-MM-dd'T'00:00:00.000'Z'");
      const endDate = format(weekDays[6], "yyyy-MM-dd'T'23:59:59.999'Z'");

      const res = await axios.get('/api/agenda/tasks', {
        params: { startDate, endDate, userId: user.id },
        withCredentials: true,
      });

      if (res.data.success) {
        setTasks(res.data.data);
      }
    } catch (err) {
      console.error('Erro ao carregar agenda:', err);
      setError('Não foi possível carregar as atividades.');
    } finally {
      setIsLoading(false);
    }
  }, [currentWeekRef, user?.id]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleEventUpdate = useCallback(async (taskId, updatePayload) => {
    // Para tarefas recorrentes com reschedule/resize, pedir escopo
    const task = tasks.find(t => t.id === taskId);
    const isRecurring = task?.recurrence && task.recurrence !== 'nunca';
    const isDragOrResize = updatePayload.reschedule || updatePayload.resize;

    if (isRecurring && isDragOrResize) {
      setPendingScopeAction({ taskId, payload: updatePayload });
      return;
    }

    try {
      const res = await axios.put(`/api/agenda/tasks/${taskId}`, updatePayload, {
        withCredentials: true,
      });

      if (res.data.success) {
        setTasks(prev =>
          prev.map(t => (t.id === taskId ? res.data.data : t))
        );
      }
    } catch (err) {
      console.error('Erro ao atualizar tarefa:', err);
    }
  }, [tasks]);

  const handleScopeConfirm = useCallback(async (scope) => {
    if (!pendingScopeAction) return;

    const { taskId, payload } = pendingScopeAction;
    setPendingScopeAction(null);

    try {
      const res = await axios.put(`/api/agenda/tasks/${taskId}`, {
        ...payload,
        recurrence_scope: scope,
      }, { withCredentials: true });

      if (res.data.success) {
        // Recarregar toda a semana para pegar instâncias atualizadas
        loadTasks();
      }
    } catch (err) {
      console.error('Erro ao atualizar tarefa recorrente:', err);
    }
  }, [pendingScopeAction, loadTasks]);

  const handleTodoLinked = useCallback((todoId, agendaTaskId) => {
    // Recarregar tasks da agenda e lista de desvinculados
    loadTasks();
    setTodosRefreshKey(k => k + 1);
  }, [loadTasks]);

  // ===== Drag & Drop de ToDo's para event cards no calendário =====

  const handleBodyDragOver = useCallback((e) => {
    // Permitir drop em qualquer lugar do body (necessário para o browser aceitar o drop)
    const eventCard = e.target.closest('[data-task-id]');
    if (eventCard) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      // Visual feedback: highlight no event card
      if (dropHighlightRef.current && dropHighlightRef.current !== eventCard) {
        dropHighlightRef.current.classList.remove('is-todo-drop-target');
      }
      eventCard.classList.add('is-todo-drop-target');
      dropHighlightRef.current = eventCard;
    } else {
      // Limpa highlight quando sai de um event card
      if (dropHighlightRef.current) {
        dropHighlightRef.current.classList.remove('is-todo-drop-target');
        dropHighlightRef.current = null;
      }
    }
  }, []);

  const handleBodyDragLeave = useCallback((e) => {
    // Limpa highlight se sair do body
    if (!e.currentTarget.contains(e.relatedTarget) && dropHighlightRef.current) {
      dropHighlightRef.current.classList.remove('is-todo-drop-target');
      dropHighlightRef.current = null;
    }
  }, []);

  const handleBodyDrop = useCallback(async (e) => {
    // Limpa highlight
    if (dropHighlightRef.current) {
      dropHighlightRef.current.classList.remove('is-todo-drop-target');
      dropHighlightRef.current = null;
    }

    const eventCard = e.target.closest('[data-task-id]');
    if (!eventCard) return;

    e.preventDefault();
    const agendaTaskId = eventCard.dataset.taskId;
    const todoId = e.dataTransfer.getData('text/plain');

    if (!todoId || !agendaTaskId) return;

    try {
      const res = await axios.put(`/api/todos/${todoId}`, {
        agenda_task_id: agendaTaskId,
      }, { withCredentials: true });

      if (res.data.success) {
        loadTasks();
        setTodosRefreshKey(k => k + 1);
      }
    } catch (err) {
      console.error('Erro ao vincular ToDo à agenda:', err);
    }
  }, [loadTasks]);

  const handleSlotClick = useCallback((date) => {
    setCreateModal({ isOpen: true, date });
  }, []);

  const handleEventClick = useCallback((task) => {
    setDetailModal({ isOpen: true, task });
  }, []);

  const goToPreviousWeek = () => setCurrentWeekRef(prev => subWeeks(prev, 1));
  const goToNextWeek = () => setCurrentWeekRef(prev => addWeeks(prev, 1));
  const goToToday = () => {
    setCurrentWeekRef(new Date());
    setSelectedDay(new Date());
  };

  const weekLabel = `${format(weekDays[0], "d MMM", { locale: ptBR })} – ${format(weekDays[6], "d MMM yyyy", { locale: ptBR })}`;

  return (
    <div className="agenda-view">
      <div
        className="agenda-view__body"
        onDragOver={handleBodyDragOver}
        onDragLeave={handleBodyDragLeave}
        onDrop={handleBodyDrop}
      >
        {isLoading ? (
          <div className="agenda-view__loading">
            <div className="agenda-view__loading-spinner" />
            Carregando atividades...
          </div>
        ) : error ? (
          <div className="agenda-view__error">{error}</div>
        ) : (
          <>
            {/* Coluna do calendário — toolbar própria apenas acima da grade */}
            <div className="agenda-view__calendar-col">
              <div className="agenda-view__toolbar">
                <span className="agenda-view__title">Agenda</span>

                <div className="agenda-view__nav">
                  <button className="agenda-view__nav-btn" onClick={goToPreviousWeek} title="Semana anterior">
                    ‹
                  </button>
                  <button className="agenda-view__nav-btn" onClick={goToNextWeek} title="Próxima semana">
                    ›
                  </button>
                </div>

                <span className="agenda-view__week-label">{weekLabel}</span>

                <button className="agenda-view__today-btn" onClick={goToToday}>
                  Hoje
                </button>

                <div className="agenda-view__view-toggle">
                  <button
                    className={`agenda-view__view-btn${viewMode === 'business' ? ' is-active' : ''}`}
                    onClick={() => setViewMode('business')}
                  >
                    Horas úteis
                  </button>
                  <button
                    className={`agenda-view__view-btn${viewMode === 'full' ? ' is-active' : ''}`}
                    onClick={() => setViewMode('full')}
                  >
                    Completa
                  </button>
                </div>

                <div className="agenda-view__spacer" />

                <div className="agenda-view__scope-toggle">
                  <button
                    className={`agenda-view__scope-btn${scopeMode === 'minha' ? ' is-active' : ''}`}
                    onClick={() => setScopeMode('minha')}
                  >
                    Minha agenda
                  </button>
                  <button
                    className={`agenda-view__scope-btn${scopeMode === 'equipe' ? ' is-active' : ''}`}
                    onClick={() => setScopeMode('equipe')}
                  >
                    Equipe
                  </button>
                </div>
              </div>

              <WeeklyCalendar
                weekDays={weekDays}
                tasks={tasks}
                selectedDay={selectedDay}
                onDaySelect={setSelectedDay}
                onSlotClick={handleSlotClick}
                onEventUpdate={handleEventUpdate}
                onEventClick={handleEventClick}
                viewMode={viewMode}
              />
            </div>

            {/* Painel lateral do dia selecionado — sem toolbar acima */}
            <DaySummary
              selectedDay={selectedDay}
              tasks={tasks}
              onEventClick={handleEventClick}
              onTodoLinked={handleTodoLinked}
              userId={user?.id}
              refreshKey={todosRefreshKey}
            />
          </>
        )}
      </div>

      <AgendaCreateModal
        isOpen={createModal.isOpen}
        selectedDate={createModal.date}
        onClose={() => setCreateModal({ isOpen: false, date: null })}
        onTaskCreated={() => {
          loadTasks();
          setCreateModal({ isOpen: false, date: null });
        }}
      />

      <AgendaDetailModal
        isOpen={detailModal.isOpen}
        task={detailModal.task}
        onClose={() => setDetailModal({ isOpen: false, task: null })}
        onTaskUpdate={(updatedTask) => {
          setTasks(prev => {
            const exists = prev.some(t => t.id === updatedTask.id);
            if (exists) {
              return prev.map(t => t.id === updatedTask.id ? updatedTask : t);
            }
            // Tarefa nova (ex: duplicação) — recarregar lista completa
            loadTasks();
            return prev;
          });
          setDetailModal(prev => ({ ...prev, task: updatedTask }));
        }}
        onTaskDelete={() => {
          loadTasks();
        }}
      />

      {/* Dialog de escopo para drag & drop em tarefas recorrentes */}
      {pendingScopeAction && (
        <div className="agenda-view__scope-overlay" onClick={() => setPendingScopeAction(null)}>
          <div className="agenda-view__scope-dialog" onClick={(e) => e.stopPropagation()}>
            <h4 className="agenda-view__scope-title">Editar atividade recorrente</h4>
            <p className="agenda-view__scope-desc">
              Esta atividade faz parte de um grupo recorrente. Como deseja aplicar a alteração?
            </p>
            <div className="agenda-view__scope-options">
              <button className="agenda-view__scope-btn" onClick={() => handleScopeConfirm('this')}>
                Apenas esta atividade
              </button>
              <button className="agenda-view__scope-btn" onClick={() => handleScopeConfirm('future')}>
                Esta e as seguintes
              </button>
              <button className="agenda-view__scope-btn" onClick={() => handleScopeConfirm('all')}>
                Todas as atividades do grupo
              </button>
            </div>
            <button className="agenda-view__scope-cancel" onClick={() => setPendingScopeAction(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AgendaView;
