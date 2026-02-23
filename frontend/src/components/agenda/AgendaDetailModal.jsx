import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import axios from 'axios';
import SearchableSelect from '../SearchableSelect';
import './AgendaDetailModal.css';

const STATUS_OPTIONS = [
  { value: 'a fazer', label: 'A fazer', color: '#1a73e8' },
  { value: 'feito', label: 'Feito', color: '#34a853' },
];

// Opções de horário em intervalos de 30 min
const TIME_OPTIONS = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  return format(new Date(dateStr), 'HH:mm');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
}

function formatDuration(minutes) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function AgendaDetailModal({ task, isOpen, onClose, onTaskUpdate, onTaskDelete }) {
  const [todos, setTodos] = useState([]);
  const [loadingTodos, setLoadingTodos] = useState(false);
  const [standardTaskName, setStandardTaskName] = useState(null);
  const [projects, setProjects] = useState([]);
  const [allAvailableProjects, setAllAvailableProjects] = useState([]);
  const [showAddProject, setShowAddProject] = useState(false);
  const [addingProjectId, setAddingProjectId] = useState('');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [editingTime, setEditingTime] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const dateInputRef = useRef(null);

  // Fetch ToDo's e detalhes quando a task muda
  useEffect(() => {
    if (!isOpen || !task?.id) {
      setTodos([]);
      setStandardTaskName(null);
      setProjects([]);
      setAllAvailableProjects([]);
      setShowAddProject(false);
      setAddingProjectId('');
      return;
    }

    let cancelled = false;

    async function fetchData() {
      setLoadingTodos(true);
      try {
        const [todosRes, detailsRes, projRes] = await Promise.all([
          axios.get('/api/agenda/tasks/todos', {
            params: { agendaTaskIds: String(task.id) },
            withCredentials: true,
          }),
          axios.get(`/api/agenda/tasks/${task.id}/details`, {
            withCredentials: true,
          }),
          axios.get('/api/agenda/tasks/form/projects', { withCredentials: true }),
        ]);

        if (!cancelled) {
          if (todosRes.data.success) {
            setTodos(todosRes.data.data || []);
          }
          if (detailsRes.data.success) {
            setStandardTaskName(detailsRes.data.data.standard_agenda_task_name);
            setProjects(detailsRes.data.data.projects || []);
          }
          if (projRes.data.success) {
            setAllAvailableProjects(projRes.data.data || []);
          }
        }
      } catch (err) {
        console.error('Erro ao buscar dados:', err);
      } finally {
        if (!cancelled) setLoadingTodos(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [isOpen, task?.id]);

  // Reset confirmDelete ao abrir/fechar
  useEffect(() => {
    if (isOpen) {
      setConfirmDelete(false);
      setShowStatusMenu(false);
      setEditingTime(false);
      setShowAddProject(false);
      setAddingProjectId('');
    }
  }, [isOpen]);

  const handleStatusChange = useCallback(async (newStatus) => {
    setShowStatusMenu(false);
    if (!task || newStatus === task.status) return;

    try {
      const res = await axios.put(`/api/agenda/tasks/${task.id}`, { status: newStatus }, {
        withCredentials: true,
      });
      if (res.data.success) {
        onTaskUpdate?.(res.data.data);
      }
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    }
  }, [task, onTaskUpdate]);

  const handleDateChange = useCallback(async (e) => {
    const newDateStr = e.target.value;
    if (!newDateStr || !task?.start_date || !task?.due_date) return;

    const [year, month, day] = newDateStr.split('-').map(Number);

    const newStart = new Date(task.start_date);
    newStart.setFullYear(year, month - 1, day);

    const newEnd = new Date(task.due_date);
    newEnd.setFullYear(year, month - 1, day);

    try {
      const res = await axios.put(`/api/agenda/tasks/${task.id}`, {
        start_date: newStart.toISOString(),
        due_date: newEnd.toISOString(),
      }, { withCredentials: true });

      if (res.data.success) {
        onTaskUpdate?.(res.data.data);
      }
    } catch (err) {
      console.error('Erro ao atualizar data:', err);
    }
  }, [task, onTaskUpdate]);

  const handleStartTimeChange = useCallback(async (e) => {
    const newTime = e.target.value;
    if (!task?.start_date || !task?.due_date) return;

    const [hours, minutes] = newTime.split(':').map(Number);
    const newStart = new Date(task.start_date);
    newStart.setHours(hours, minutes, 0, 0);

    try {
      const res = await axios.put(`/api/agenda/tasks/${task.id}`, {
        start_date: newStart.toISOString(),
      }, { withCredentials: true });

      if (res.data.success) {
        onTaskUpdate?.(res.data.data);
      }
    } catch (err) {
      console.error('Erro ao atualizar horário:', err);
    }
  }, [task, onTaskUpdate]);

  const handleEndTimeChange = useCallback(async (e) => {
    const newTime = e.target.value;
    if (!task?.start_date || !task?.due_date) return;

    const [hours, minutes] = newTime.split(':').map(Number);
    const newEnd = new Date(task.due_date);
    newEnd.setHours(hours, minutes, 0, 0);

    try {
      const res = await axios.put(`/api/agenda/tasks/${task.id}`, {
        due_date: newEnd.toISOString(),
      }, { withCredentials: true });

      if (res.data.success) {
        onTaskUpdate?.(res.data.data);
      }
    } catch (err) {
      console.error('Erro ao atualizar horário:', err);
    }
  }, [task, onTaskUpdate]);

  const handleToggleTodoStatus = useCallback(async (todo) => {
    const newStatus = todo.status === 'finalizado' ? 'backlog' : 'finalizado';
    try {
      const res = await axios.patch(
        `/api/agenda/tasks/todos/${todo.id}`,
        { status: newStatus },
        { withCredentials: true }
      );

      if (res.data.success) {
        setTodos(prev => prev.map(t =>
          t.id === todo.id ? { ...t, status: newStatus } : t
        ));
      }
    } catch (err) {
      console.error('Erro ao atualizar ToDo:', err);
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    try {
      const res = await axios.delete(`/api/agenda/tasks/${task.id}`, {
        withCredentials: true,
      });
      if (res.data.success) {
        onTaskDelete?.(task.id);
        onClose();
      }
    } catch (err) {
      console.error('Erro ao deletar tarefa:', err);
    } finally {
      setDeleting(false);
    }
  }, [task, confirmDelete, onTaskDelete, onClose]);

  // IDs de projetos que possuem ToDo's (não podem ser removidos)
  const projectIdsWithTodos = useMemo(() => {
    const ids = new Set();
    todos.forEach(t => { if (t.project_id) ids.add(t.project_id); });
    return ids;
  }, [todos]);

  // Opções de projeto disponíveis para adicionar (não já vinculados)
  const addProjectOptions = useMemo(() => {
    const linkedIds = new Set(projects.map(p => p.id));
    return allAvailableProjects
      .filter(p => !linkedIds.has(p.id))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'))
      .map(p => ({
        value: String(p.id),
        label: p.comercial_name ? `${p.name} (${p.comercial_name})` : p.name,
      }));
  }, [allAvailableProjects, projects]);

  const handleAddProject = useCallback(async () => {
    if (!addingProjectId || !task) return;

    try {
      const res = await axios.post(
        `/api/agenda/tasks/${task.id}/projects`,
        { project_ids: [Number(addingProjectId)] },
        { withCredentials: true }
      );

      if (res.data.success) {
        setProjects(res.data.data);
        setAddingProjectId('');
        setShowAddProject(false);
      }
    } catch (err) {
      console.error('Erro ao adicionar projeto:', err);
    }
  }, [task, addingProjectId]);

  const handleRemoveProject = useCallback(async (projectId) => {
    if (!task) return;

    try {
      const res = await axios.delete(
        `/api/agenda/tasks/${task.id}/projects/${projectId}`,
        { withCredentials: true }
      );

      if (res.data.success) {
        setProjects(prev => prev.filter(p => p.id !== projectId));
      }
    } catch (err) {
      console.error('Erro ao remover projeto:', err);
    }
  }, [task]);

  // Contadores de ToDo's
  const doneCount = useMemo(() => todos.filter(t => t.status === 'finalizado').length, [todos]);
  const totalCount = todos.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  if (!isOpen || !task) return null;

  const currentStatus = STATUS_OPTIONS.find(s => s.value === task.status) || STATUS_OPTIONS[0];

  return (
    <div className="detail-modal__overlay" onClick={onClose}>
      <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="detail-modal__header">
          <h2 className="detail-modal__title">{task.name}</h2>
          <button className="detail-modal__close-btn" onClick={onClose} title="Fechar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="detail-modal__content">
          {/* Coluna principal */}
          <div className="detail-modal__main">
            {/* Metadados em grid */}
            <div className="detail-modal__meta-grid">
              {/* Status */}
              <div className="detail-modal__meta-item">
                <div className="detail-modal__meta-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <span className="detail-modal__meta-label">Status</span>
                <div className="detail-modal__status-wrapper">
                  <button
                    className="detail-modal__status-badge"
                    style={{ '--status-color': currentStatus.color }}
                    onClick={() => setShowStatusMenu(prev => !prev)}
                  >
                    {currentStatus.label}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {showStatusMenu && (
                    <div className="detail-modal__status-menu">
                      {STATUS_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          className={`detail-modal__status-option${opt.value === task.status ? ' is-active' : ''}`}
                          style={{ '--opt-color': opt.color }}
                          onClick={() => handleStatusChange(opt.value)}
                        >
                          <span className="detail-modal__status-dot" />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Data */}
              <div className="detail-modal__meta-item">
                <div className="detail-modal__meta-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <span className="detail-modal__meta-label">Data</span>
                <div
                  className="detail-modal__meta-value detail-modal__meta-value--editable"
                  onClick={() => dateInputRef.current?.showPicker?.()}
                >
                  {formatDate(task.start_date)}
                  <svg className="detail-modal__edit-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  {task.start_date && (
                    <input
                      ref={dateInputRef}
                      type="date"
                      className="detail-modal__date-input"
                      value={format(new Date(task.start_date), 'yyyy-MM-dd')}
                      onChange={handleDateChange}
                    />
                  )}
                </div>
              </div>

              {/* Horário */}
              <div className="detail-modal__meta-item">
                <div className="detail-modal__meta-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <span className="detail-modal__meta-label">Horário</span>
                {editingTime && task.start_date && task.due_date ? (
                  <div className="detail-modal__time-edit">
                    <select
                      className="detail-modal__time-select"
                      value={formatTime(task.start_date)}
                      onChange={handleStartTimeChange}
                    >
                      {TIME_OPTIONS.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <span className="detail-modal__time-sep">–</span>
                    <select
                      className="detail-modal__time-select"
                      value={formatTime(task.due_date)}
                      onChange={handleEndTimeChange}
                    >
                      {TIME_OPTIONS.filter(t => t > formatTime(task.start_date)).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span
                    className="detail-modal__meta-value detail-modal__meta-value--editable"
                    onClick={() => setEditingTime(true)}
                  >
                    {formatTime(task.start_date)} – {formatTime(task.due_date)}
                    <svg className="detail-modal__edit-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </span>
                )}
              </div>

              {/* Duração */}
              <div className="detail-modal__meta-item">
                <div className="detail-modal__meta-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <span className="detail-modal__meta-label">Duração</span>
                <span className="detail-modal__meta-value">{formatDuration(task.duration_minutes)}</span>
              </div>

              {/* Recorrência */}
              <div className="detail-modal__meta-item">
                <div className="detail-modal__meta-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                </div>
                <span className="detail-modal__meta-label">Recorrência</span>
                <span className="detail-modal__meta-value">{task.recurrence_label || task.recurrence || 'Nunca'}</span>
              </div>

              {/* Grupo padrão */}
              {standardTaskName && (
                <div className="detail-modal__meta-item">
                  <div className="detail-modal__meta-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                  </div>
                  <span className="detail-modal__meta-label">Grupo</span>
                  <span className="detail-modal__meta-value">{standardTaskName}</span>
                </div>
              )}
            </div>

            {/* Seção: Projetos */}
            <div className="detail-modal__section">
              <div className="detail-modal__section-header">
                <h3 className="detail-modal__section-title">
                  Projetos
                  {projects.length > 0 && (
                    <span className="detail-modal__todo-counter">{projects.length}</span>
                  )}
                </h3>
                <button
                  className="detail-modal__add-btn"
                  onClick={() => setShowAddProject(prev => !prev)}
                  title="Adicionar projeto"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>

              {showAddProject && (
                <div className="detail-modal__add-project-row">
                  <div className="detail-modal__add-project-select">
                    <SearchableSelect
                      id="add-project-detail"
                      value={addingProjectId}
                      onChange={(e) => setAddingProjectId(e.target.value)}
                      options={addProjectOptions}
                      placeholder="Selecione o projeto"
                    />
                  </div>
                  <button
                    className="detail-modal__add-project-confirm"
                    onClick={handleAddProject}
                    disabled={!addingProjectId}
                  >
                    Adicionar
                  </button>
                </div>
              )}

              {projects.length === 0 && !showAddProject ? (
                <div className="detail-modal__todo-empty">Nenhum projeto vinculado</div>
              ) : (
                <ul className="detail-modal__project-list">
                  {projects.map(p => {
                    const hasTodos = projectIdsWithTodos.has(p.id);
                    return (
                      <li key={p.id} className="detail-modal__project-item">
                        <div className="detail-modal__project-dot" />
                        <span className="detail-modal__project-name">
                          {p.comercial_name ? `${p.name} (${p.comercial_name})` : p.name}
                        </span>
                        {!hasTodos && (
                          <button
                            className="detail-modal__project-remove"
                            onClick={() => handleRemoveProject(p.id)}
                            title="Remover projeto"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Seção: ToDo's da tarefa */}
            <div className="detail-modal__section">
              <div className="detail-modal__section-header">
                <h3 className="detail-modal__section-title">
                  ToDo's da tarefa
                  {totalCount > 0 && (
                    <span className="detail-modal__todo-counter">{doneCount}/{totalCount}</span>
                  )}
                </h3>
              </div>

              {totalCount > 0 && (
                <div className="detail-modal__progress-bar">
                  <div
                    className="detail-modal__progress-fill"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              )}

              {loadingTodos ? (
                <div className="detail-modal__todo-loading">Carregando...</div>
              ) : totalCount === 0 ? (
                <div className="detail-modal__todo-empty">Nenhum ToDo associado</div>
              ) : (
                <ul className="detail-modal__todo-list">
                  {todos.map(todo => {
                    const isDone = todo.status === 'finalizado';
                    return (
                      <li key={todo.id} className={`detail-modal__todo-item${isDone ? ' is-done' : ''}`}>
                        <button
                          className={`detail-modal__todo-check${isDone ? ' is-checked' : ''}`}
                          onClick={() => handleToggleTodoStatus(todo)}
                          title={isDone ? 'Reabrir' : 'Finalizar'}
                        >
                          {isDone ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <div className="detail-modal__todo-check-empty" />
                          )}
                        </button>
                        <div className="detail-modal__todo-info">
                          <span className="detail-modal__todo-name">{todo.name}</span>
                          {todo.project_name && (
                            <span className="detail-modal__todo-project">{todo.project_name}</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="detail-modal__footer">
          <button
            className={`detail-modal__delete-btn${confirmDelete ? ' is-confirm' : ''}`}
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deletando...' : confirmDelete ? 'Confirmar exclusão' : 'Deletar'}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default AgendaDetailModal;
