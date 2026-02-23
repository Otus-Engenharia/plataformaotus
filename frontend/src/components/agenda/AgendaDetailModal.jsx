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

const RECURRENCE_OPTIONS = [
  { value: 'nunca', label: 'Nunca' },
  { value: 'diária', label: 'Diária (todos os dias)' },
  { value: 'diária_útil', label: 'Diária (dias úteis)' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
];

const VERIFICACAO_ID = 18;

const TIPO_VERIFICACAO_OPTIONS = [
  { value: 'lancamento', label: 'Lançamento' },
  { value: 'ajuste', label: 'Ajuste' },
];

const FASE_OPTIONS = [
  { value: 'F01', label: 'F01' },
  { value: 'F02', label: 'F02' },
  { value: 'F03', label: 'F03' },
  { value: 'F04', label: 'F04' },
  { value: 'F05', label: 'F05' },
];

const GROUP_POSITIONS = [
  { value: 'coordenação', label: 'Coordenação' },
  { value: 'compatibilização', label: 'Compatibilização' },
  { value: 'digital', label: 'Tecnologia' },
  { value: 'time bim', label: 'Apoio Projetos' },
  { value: 'otus', label: 'Tarefas Otus' },
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
  const [showRecurrenceEditor, setShowRecurrenceEditor] = useState(false);
  const [recEditorType, setRecEditorType] = useState('nunca');
  const [recEditorEndType, setRecEditorEndType] = useState('never');
  const [recEditorUntil, setRecEditorUntil] = useState('');
  const [recEditorCount, setRecEditorCount] = useState(10);
  const [recEditorCopyProjects, setRecEditorCopyProjects] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [showGroupEditor, setShowGroupEditor] = useState(false);
  const [groupPosition, setGroupPosition] = useState('');
  const [groupOptions, setGroupOptions] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [disciplines, setDisciplines] = useState([]);
  const [disciplineName, setDisciplineName] = useState(null);
  const [editingVerifField, setEditingVerifField] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [showDuplicateEditor, setShowDuplicateEditor] = useState(false);
  const [dupDate, setDupDate] = useState('');
  const [dupStartTime, setDupStartTime] = useState('');
  const [dupEndTime, setDupEndTime] = useState('');
  const [dupCopyProjects, setDupCopyProjects] = useState(true);
  const [duplicating, setDuplicating] = useState(false);
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
            setCurrentPosition(detailsRes.data.data.standard_agenda_task_position);
            setDisciplineName(detailsRes.data.data.related_discipline_name);
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
      setShowRecurrenceEditor(false);
      setPendingAction(null);
      setShowGroupEditor(false);
      setGroupPosition('');
      setGroupOptions([]);
      setShowAddProject(false);
      setAddingProjectId('');
      setEditingVerifField(null);
      setDisciplineName(null);
      setEditingName(false);
      setShowDuplicateEditor(false);
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

  const isRecurring = task?.recurrence && task.recurrence !== 'nunca';
  const isVerificacao = task?.standard_agenda_task === VERIFICACAO_ID;

  const handleDateChange = useCallback(async (e) => {
    const newDateStr = e.target.value;
    if (!newDateStr || !task?.start_date || !task?.due_date) return;

    const [year, month, day] = newDateStr.split('-').map(Number);

    const newStart = new Date(task.start_date);
    newStart.setFullYear(year, month - 1, day);

    const newEnd = new Date(task.due_date);
    newEnd.setFullYear(year, month - 1, day);

    const payload = {
      start_date: newStart.toISOString(),
      due_date: newEnd.toISOString(),
    };

    // Se recorrente, perguntar escopo antes de salvar
    if (isRecurring) {
      setPendingAction({ type: 'edit', payload });
      return;
    }

    try {
      const res = await axios.put(`/api/agenda/tasks/${task.id}`, payload, { withCredentials: true });

      if (res.data.success) {
        onTaskUpdate?.(res.data.data);
      }
    } catch (err) {
      console.error('Erro ao atualizar data:', err);
    }
  }, [task, onTaskUpdate, isRecurring]);

  const handleStartTimeChange = useCallback(async (e) => {
    const newTime = e.target.value;
    if (!task?.start_date || !task?.due_date) return;

    const [hours, minutes] = newTime.split(':').map(Number);
    const newStart = new Date(task.start_date);
    newStart.setHours(hours, minutes, 0, 0);

    const payload = { start_date: newStart.toISOString() };

    if (isRecurring) {
      setPendingAction({ type: 'edit', payload });
      return;
    }

    try {
      const res = await axios.put(`/api/agenda/tasks/${task.id}`, payload, { withCredentials: true });
      if (res.data.success) {
        onTaskUpdate?.(res.data.data);
      }
    } catch (err) {
      console.error('Erro ao atualizar horário:', err);
    }
  }, [task, onTaskUpdate, isRecurring]);

  const handleEndTimeChange = useCallback(async (e) => {
    const newTime = e.target.value;
    if (!task?.start_date || !task?.due_date) return;

    const [hours, minutes] = newTime.split(':').map(Number);
    const newEnd = new Date(task.due_date);
    newEnd.setHours(hours, minutes, 0, 0);

    const payload = { due_date: newEnd.toISOString() };

    if (isRecurring) {
      setPendingAction({ type: 'edit', payload });
      return;
    }

    try {
      const res = await axios.put(`/api/agenda/tasks/${task.id}`, payload, { withCredentials: true });
      if (res.data.success) {
        onTaskUpdate?.(res.data.data);
      }
    } catch (err) {
      console.error('Erro ao atualizar horário:', err);
    }
  }, [task, onTaskUpdate, isRecurring]);

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
    // Se é recorrente, mostrar dialog de escopo
    if (isRecurring) {
      setPendingAction({ type: 'delete' });
      return;
    }

    // Não-recorrente: confirmação simples
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
  }, [task, confirmDelete, onTaskDelete, onClose, isRecurring]);

  // Handler: Abrir editor de recorrência com valores atuais
  const openRecurrenceEditor = useCallback(() => {
    if (!task) return;
    setRecEditorType(task.recurrence || 'nunca');
    if (task.recurrence_until) {
      setRecEditorEndType('date');
      // Converter ISO para yyyy-MM-dd
      const d = new Date(task.recurrence_until);
      setRecEditorUntil(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    } else if (task.recurrence_count) {
      setRecEditorEndType('count');
      setRecEditorCount(task.recurrence_count);
    } else {
      setRecEditorEndType('never');
      setRecEditorUntil('');
      setRecEditorCount(10);
    }
    setRecEditorCopyProjects(task.recurrence_copy_projects || false);
    setShowRecurrenceEditor(true);
  }, [task]);

  // Handler: Salvar recorrência
  const handleRecurrenceSave = useCallback(async () => {
    if (!task) return;
    setShowRecurrenceEditor(false);

    const payload = {
      recurrence: recEditorType,
      recurrence_until: recEditorType !== 'nunca' && recEditorEndType === 'date' ? recEditorUntil : null,
      recurrence_count: recEditorType !== 'nunca' && recEditorEndType === 'count' ? Number(recEditorCount) : null,
      recurrence_copy_projects: recEditorType !== 'nunca' ? recEditorCopyProjects : false,
    };

    try {
      const res = await axios.put(`/api/agenda/tasks/${task.id}`, payload, { withCredentials: true });

      if (res.data.success) {
        onTaskUpdate?.(res.data.data);
      }
    } catch (err) {
      console.error('Erro ao atualizar recorrência:', err);
    }
  }, [task, recEditorType, recEditorEndType, recEditorUntil, recEditorCount, recEditorCopyProjects, onTaskUpdate]);

  // Handler: Confirmar ação com escopo (dialog de 3 opções)
  const handleScopeSelect = useCallback(async (scope) => {
    if (!pendingAction || !task) return;

    const action = pendingAction;
    setPendingAction(null);

    if (action.type === 'delete') {
      setDeleting(true);
      try {
        const res = await axios.delete(`/api/agenda/tasks/${task.id}/recurring`, {
          params: { scope },
          withCredentials: true,
        });
        if (res.data.success) {
          onTaskDelete?.(task.id);
          onClose();
        }
      } catch (err) {
        console.error('Erro ao deletar tarefa recorrente:', err);
      } finally {
        setDeleting(false);
      }
    } else if (action.type === 'edit') {
      try {
        const res = await axios.put(`/api/agenda/tasks/${task.id}`, {
          ...action.payload,
          recurrence_scope: scope,
        }, { withCredentials: true });

        if (res.data.success) {
          onTaskUpdate?.(res.data.data);
        }
      } catch (err) {
        console.error('Erro ao atualizar tarefa recorrente:', err);
      }
    } else if (action.type === 'group_change') {
      try {
        const res = await axios.put(`/api/agenda/tasks/${task.id}`, {
          standard_agenda_task: action.payload.id,
          standard_agenda_task_name: action.payload.name,
          recurrence_scope: scope,
        }, { withCredentials: true });

        if (res.data.success) {
          setStandardTaskName(action.payload.name);
          setCurrentPosition(groupPosition);
          onTaskUpdate?.(res.data.data);
        }
      } catch (err) {
        console.error('Erro ao alterar grupo recorrente:', err);
      }
    }
  }, [pendingAction, task, onTaskUpdate, onTaskDelete, onClose, groupPosition]);

  const handleCancelAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  // Fetch standard_agenda_tasks quando position muda no editor de grupo
  useEffect(() => {
    if (!showGroupEditor || !groupPosition) {
      setGroupOptions([]);
      return;
    }
    let cancelled = false;
    const fetchGroups = async () => {
      setLoadingGroups(true);
      try {
        const res = await axios.get('/api/agenda/tasks/form/standard-agenda-tasks', {
          params: { position: groupPosition },
          withCredentials: true,
        });
        if (!cancelled) {
          setGroupOptions(res.data.data || []);
        }
      } catch (err) {
        console.error('Erro ao carregar grupos:', err);
      } finally {
        if (!cancelled) setLoadingGroups(false);
      }
    };
    fetchGroups();
    return () => { cancelled = true; };
  }, [showGroupEditor, groupPosition]);

  // Handler: selecionar nova atividade no editor de grupo
  const handleGroupSelect = useCallback(async (e) => {
    const newGroupId = e.target.value;
    if (!newGroupId) return;

    const selectedGroup = groupOptions.find(g => g.id === Number(newGroupId));
    if (!selectedGroup) return;

    setShowGroupEditor(false);

    // Se recorrente, mostrar scope dialog
    if (isRecurring) {
      setPendingAction({
        type: 'group_change',
        payload: { id: selectedGroup.id, name: selectedGroup.name },
      });
      return;
    }

    // Não-recorrente: aplicar direto
    try {
      const res = await axios.put(`/api/agenda/tasks/${task.id}`, {
        standard_agenda_task: selectedGroup.id,
        standard_agenda_task_name: selectedGroup.name,
      }, { withCredentials: true });

      if (res.data.success) {
        setStandardTaskName(selectedGroup.name);
        setCurrentPosition(groupPosition);
        onTaskUpdate?.(res.data.data);
      }
    } catch (err) {
      console.error('Erro ao alterar grupo:', err);
    }
  }, [task, groupOptions, groupPosition, isRecurring, onTaskUpdate]);

  // Fetch lazy de disciplinas (só quando abre o select de disciplina)
  useEffect(() => {
    if (editingVerifField !== 'discipline' || disciplines.length > 0) return;
    let cancelled = false;
    const fetchDisc = async () => {
      try {
        const res = await axios.get('/api/agenda/tasks/form/disciplines', { withCredentials: true });
        if (!cancelled) setDisciplines(res.data.data || []);
      } catch (err) {
        console.error('Erro ao carregar disciplinas:', err);
      }
    };
    fetchDisc();
    return () => { cancelled = true; };
  }, [editingVerifField, disciplines.length]);

  // Handler: salvar campo de verificação
  const handleVerifFieldChange = useCallback(async (field, value) => {
    if (!task) return;
    setEditingVerifField(null);

    const payload = { [field]: value || null };

    try {
      const res = await axios.put(`/api/agenda/tasks/${task.id}`, payload, { withCredentials: true });
      if (res.data.success) {
        if (field === 'related_discipline_id' && value) {
          const disc = disciplines.find(d => d.id === Number(value));
          setDisciplineName(disc?.discipline_name || null);
        } else if (field === 'related_discipline_id') {
          setDisciplineName(null);
        }
        onTaskUpdate?.(res.data.data);
      }
    } catch (err) {
      console.error('Erro ao atualizar campo de verificação:', err);
    }
  }, [task, disciplines, onTaskUpdate]);

  // Handler: salvar nome editado
  const handleNameSave = useCallback(async () => {
    setEditingName(false);
    const trimmed = nameValue.trim();
    if (!task || !trimmed || trimmed === task.name) return;

    try {
      const res = await axios.put(`/api/agenda/tasks/${task.id}`, { name: trimmed }, { withCredentials: true });
      if (res.data.success) {
        onTaskUpdate?.(res.data.data);
      }
    } catch (err) {
      console.error('Erro ao atualizar nome:', err);
    }
  }, [task, nameValue, onTaskUpdate]);

  // Handler: abrir overlay de duplicação com valores pré-preenchidos
  const openDuplicateEditor = useCallback(() => {
    if (!task?.start_date || !task?.due_date) return;
    const tomorrow = new Date(task.start_date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDupDate(format(tomorrow, 'yyyy-MM-dd'));
    setDupStartTime(formatTime(task.start_date));
    setDupEndTime(formatTime(task.due_date));
    setDupCopyProjects(true);
    setShowDuplicateEditor(true);
  }, [task]);

  // Handler: confirmar duplicação
  const handleDuplicate = useCallback(async () => {
    if (!task || !dupDate || !dupStartTime || !dupEndTime) return;
    setDuplicating(true);

    const [sh, sm] = dupStartTime.split(':').map(Number);
    const [eh, em] = dupEndTime.split(':').map(Number);
    const [y, mo, d] = dupDate.split('-').map(Number);

    const newStart = new Date(y, mo - 1, d, sh, sm, 0, 0);
    const newEnd = new Date(y, mo - 1, d, eh, em, 0, 0);

    try {
      const res = await axios.post(`/api/agenda/tasks/${task.id}/duplicate`, {
        start_date: newStart.toISOString(),
        due_date: newEnd.toISOString(),
        copy_projects: dupCopyProjects,
      }, { withCredentials: true });

      if (res.data.success) {
        setShowDuplicateEditor(false);
        onTaskUpdate?.(res.data.data);
        onClose();
      }
    } catch (err) {
      console.error('Erro ao duplicar tarefa:', err);
    } finally {
      setDuplicating(false);
    }
  }, [task, dupDate, dupStartTime, dupEndTime, dupCopyProjects, onTaskUpdate, onClose]);

  // Opções de horário de término filtradas (> dupStartTime)
  const dupEndTimeOptions = useMemo(() => {
    if (!dupStartTime) return TIME_OPTIONS;
    return TIME_OPTIONS.filter(t => t > dupStartTime);
  }, [dupStartTime]);

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
          {editingName ? (
            <input
              className="detail-modal__title-input"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSave();
                if (e.key === 'Escape') setEditingName(false);
              }}
              autoFocus
            />
          ) : (
            <h2
              className="detail-modal__title"
              onDoubleClick={() => {
                setNameValue(task.name);
                setEditingName(true);
              }}
              title="Duplo clique para editar"
            >
              {task.name}
            </h2>
          )}
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
                <span
                  className="detail-modal__meta-value detail-modal__meta-value--editable"
                  onClick={openRecurrenceEditor}
                >
                  {task.recurrence_label || task.recurrence || 'Nunca'}
                  <svg className="detail-modal__edit-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </span>
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
                  <span
                    className="detail-modal__meta-value detail-modal__meta-value--editable"
                    onClick={() => {
                      setGroupPosition(currentPosition || '');
                      setShowGroupEditor(true);
                    }}
                  >
                    {standardTaskName}
                    <svg className="detail-modal__edit-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </span>
                </div>
              )}

              {/* Campos de verificação — só quando standard_agenda_task === 18 */}
              {isVerificacao && (
                <>
                  {/* Tipo de verificação */}
                  <div className="detail-modal__meta-item">
                    <div className="detail-modal__meta-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    </div>
                    <span className="detail-modal__meta-label">Tipo</span>
                    {editingVerifField === 'kind' ? (
                      <select
                        className="detail-modal__verif-select"
                        value={task.coompat_task_kind || ''}
                        onChange={(e) => handleVerifFieldChange('coompat_task_kind', e.target.value)}
                        onBlur={() => setEditingVerifField(null)}
                        autoFocus
                      >
                        <option value="">—</option>
                        {TIPO_VERIFICACAO_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className="detail-modal__meta-value detail-modal__meta-value--editable"
                        onClick={() => setEditingVerifField('kind')}
                      >
                        {TIPO_VERIFICACAO_OPTIONS.find(o => o.value === task.coompat_task_kind)?.label || '—'}
                        <svg className="detail-modal__edit-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </span>
                    )}
                  </div>

                  {/* Disciplina */}
                  <div className="detail-modal__meta-item">
                    <div className="detail-modal__meta-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4" />
                        <path d="M12 8h.01" />
                      </svg>
                    </div>
                    <span className="detail-modal__meta-label">Disciplina</span>
                    {editingVerifField === 'discipline' ? (
                      <select
                        className="detail-modal__verif-select"
                        value={task.related_discipline_id || ''}
                        onChange={(e) => handleVerifFieldChange('related_discipline_id', e.target.value ? Number(e.target.value) : null)}
                        onBlur={() => setEditingVerifField(null)}
                        autoFocus
                      >
                        <option value="">Geral</option>
                        {disciplines.map(d => (
                          <option key={d.id} value={d.id}>{d.discipline_name}</option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className="detail-modal__meta-value detail-modal__meta-value--editable"
                        onClick={() => setEditingVerifField('discipline')}
                      >
                        {disciplineName || 'Geral'}
                        <svg className="detail-modal__edit-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </span>
                    )}
                  </div>

                  {/* Fase */}
                  <div className="detail-modal__meta-item">
                    <div className="detail-modal__meta-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                    </div>
                    <span className="detail-modal__meta-label">Fase</span>
                    {editingVerifField === 'phase' ? (
                      <select
                        className="detail-modal__verif-select"
                        value={task.phase || ''}
                        onChange={(e) => handleVerifFieldChange('phase', e.target.value)}
                        onBlur={() => setEditingVerifField(null)}
                        autoFocus
                      >
                        <option value="">—</option>
                        {FASE_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className="detail-modal__meta-value detail-modal__meta-value--editable"
                        onClick={() => setEditingVerifField('phase')}
                      >
                        {task.phase || '—'}
                        <svg className="detail-modal__edit-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </span>
                    )}
                  </div>
                </>
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
          {task.is_scheduled && (
            <button
              className="detail-modal__duplicate-btn"
              onClick={openDuplicateEditor}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Duplicar
            </button>
          )}
          <button
            className={`detail-modal__delete-btn${confirmDelete ? ' is-confirm' : ''}`}
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deletando...' : confirmDelete ? 'Confirmar exclusão' : 'Deletar'}
          </button>
        </footer>

        {/* Overlay de edição de recorrência */}
        {showRecurrenceEditor && (
          <div className="detail-modal__recurrence-editor-overlay" onClick={() => setShowRecurrenceEditor(false)}>
            <div className="detail-modal__recurrence-editor" onClick={(e) => e.stopPropagation()}>
              <h4 className="detail-modal__recurrence-editor-title">Configurar recorrência</h4>

              <label className="detail-modal__recurrence-editor-label">Repetir</label>
              <select
                className="detail-modal__recurrence-editor-select"
                value={recEditorType}
                onChange={(e) => setRecEditorType(e.target.value)}
              >
                {RECURRENCE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              {recEditorType !== 'nunca' && (
                <>
                  <label className="detail-modal__recurrence-editor-label">Termina</label>
                  <select
                    className="detail-modal__recurrence-editor-select"
                    value={recEditorEndType}
                    onChange={(e) => setRecEditorEndType(e.target.value)}
                  >
                    <option value="never">Nunca (contínuo)</option>
                    <option value="date">Em uma data</option>
                    <option value="count">Após N repetições</option>
                  </select>

                  {recEditorEndType === 'date' && (
                    <>
                      <label className="detail-modal__recurrence-editor-label">Data limite</label>
                      <input
                        type="date"
                        className="detail-modal__recurrence-editor-input"
                        value={recEditorUntil}
                        onChange={(e) => setRecEditorUntil(e.target.value)}
                      />
                    </>
                  )}

                  {recEditorEndType === 'count' && (
                    <>
                      <label className="detail-modal__recurrence-editor-label">Número de repetições</label>
                      <input
                        type="number"
                        className="detail-modal__recurrence-editor-input"
                        min="1"
                        max="365"
                        value={recEditorCount}
                        onChange={(e) => setRecEditorCount(e.target.value)}
                      />
                    </>
                  )}

                  <label className="detail-modal__recurrence-editor-checkbox">
                    <input
                      type="checkbox"
                      checked={recEditorCopyProjects}
                      onChange={(e) => setRecEditorCopyProjects(e.target.checked)}
                    />
                    <span>Manter projetos nas repetições</span>
                  </label>
                </>
              )}

              <div className="detail-modal__recurrence-editor-actions">
                <button
                  className="detail-modal__recurrence-editor-cancel"
                  onClick={() => setShowRecurrenceEditor(false)}
                >
                  Cancelar
                </button>
                <button
                  className="detail-modal__recurrence-editor-save"
                  onClick={handleRecurrenceSave}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Overlay de troca de grupo */}
        {showGroupEditor && (
          <div className="detail-modal__group-editor-overlay" onClick={() => setShowGroupEditor(false)}>
            <div className="detail-modal__group-editor" onClick={(e) => e.stopPropagation()}>
              <h4 className="detail-modal__group-editor-title">Alterar grupo de atividade</h4>

              <label className="detail-modal__group-editor-label">Tipo de grupo</label>
              <select
                className="detail-modal__group-editor-select"
                value={groupPosition}
                onChange={(e) => setGroupPosition(e.target.value)}
              >
                <option value="">Selecione...</option>
                {GROUP_POSITIONS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>

              <label className="detail-modal__group-editor-label">Atividade</label>
              <select
                className="detail-modal__group-editor-select"
                disabled={!groupPosition || loadingGroups}
                value=""
                onChange={handleGroupSelect}
              >
                <option value="">
                  {loadingGroups ? 'Carregando...' : 'Selecione a atividade'}
                </option>
                {groupOptions.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>

              <button
                className="detail-modal__group-editor-cancel"
                onClick={() => setShowGroupEditor(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Overlay de duplicação */}
        {showDuplicateEditor && (
          <div className="detail-modal__duplicate-overlay" onClick={() => setShowDuplicateEditor(false)}>
            <div className="detail-modal__duplicate-editor" onClick={(e) => e.stopPropagation()}>
              <h4 className="detail-modal__duplicate-editor-title">Duplicar atividade</h4>

              <label className="detail-modal__duplicate-editor-label">Data</label>
              <input
                type="date"
                className="detail-modal__duplicate-editor-input"
                value={dupDate}
                onChange={(e) => setDupDate(e.target.value)}
              />

              <label className="detail-modal__duplicate-editor-label">Horário de início</label>
              <select
                className="detail-modal__duplicate-editor-select"
                value={dupStartTime}
                onChange={(e) => {
                  setDupStartTime(e.target.value);
                  // Se o horário de término for menor ou igual ao novo início, ajustar
                  if (dupEndTime <= e.target.value) {
                    const nextIdx = TIME_OPTIONS.indexOf(e.target.value) + 1;
                    if (nextIdx < TIME_OPTIONS.length) {
                      setDupEndTime(TIME_OPTIONS[nextIdx]);
                    }
                  }
                }}
              >
                {TIME_OPTIONS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <label className="detail-modal__duplicate-editor-label">Horário de término</label>
              <select
                className="detail-modal__duplicate-editor-select"
                value={dupEndTime}
                onChange={(e) => setDupEndTime(e.target.value)}
              >
                {dupEndTimeOptions.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <label className="detail-modal__duplicate-editor-checkbox">
                <input
                  type="checkbox"
                  checked={dupCopyProjects}
                  onChange={(e) => setDupCopyProjects(e.target.checked)}
                />
                <span>Copiar projetos vinculados</span>
              </label>

              <div className="detail-modal__duplicate-editor-actions">
                <button
                  className="detail-modal__duplicate-editor-cancel"
                  onClick={() => setShowDuplicateEditor(false)}
                >
                  Cancelar
                </button>
                <button
                  className="detail-modal__duplicate-editor-save"
                  onClick={handleDuplicate}
                  disabled={duplicating || !dupDate || !dupStartTime || !dupEndTime}
                >
                  {duplicating ? 'Duplicando...' : 'Duplicar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dialog de escopo para ações em tarefas recorrentes */}
        {pendingAction && (
          <div className="detail-modal__scope-overlay" onClick={handleCancelAction}>
            <div className="detail-modal__scope-dialog" onClick={(e) => e.stopPropagation()}>
              <h4 className="detail-modal__scope-title">
                {pendingAction.type === 'delete'
                  ? 'Deletar atividade recorrente'
                  : pendingAction.type === 'group_change'
                    ? 'Alterar grupo da atividade recorrente'
                    : 'Editar atividade recorrente'}
              </h4>
              <p className="detail-modal__scope-desc">
                Esta atividade faz parte de um grupo recorrente. Como deseja aplicar a alteração?
              </p>
              <div className="detail-modal__scope-options">
                <button
                  className="detail-modal__scope-btn"
                  onClick={() => handleScopeSelect('this')}
                >
                  Apenas esta atividade
                </button>
                <button
                  className="detail-modal__scope-btn"
                  onClick={() => handleScopeSelect('future')}
                >
                  Esta e as seguintes
                </button>
                <button
                  className="detail-modal__scope-btn"
                  onClick={() => handleScopeSelect('all')}
                >
                  Todas as atividades do grupo
                </button>
              </div>
              <button
                className="detail-modal__scope-cancel"
                onClick={handleCancelAction}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AgendaDetailModal;
