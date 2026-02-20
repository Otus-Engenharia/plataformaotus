import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import axios from 'axios';
import SearchableSelect from '../SearchableSelect';
import MultiSelectDropdown from '../formulario-passagem/MultiSelectDropdown';
import './VerificacaoForm.css';

const TIPO_OPTIONS = [
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

const VERIFICACAO_STANDARD_AGENDA_TASK_ID = 18;

function generateEndTimeOptions(startDate) {
  if (!startDate || !(startDate instanceof Date) || isNaN(startDate.getTime())) {
    return [];
  }

  const options = [];
  const startH = startDate.getHours();
  const startM = startDate.getMinutes();

  let h = startM < 30 ? startH : startH + 1;
  let m = startM < 30 ? 30 : 0;

  while (h < 24) {
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    options.push({ value: timeStr, label: timeStr });
    m += 30;
    if (m >= 60) {
      m = 0;
      h += 1;
    }
  }

  return options;
}

function VerificacaoForm({ selectedDate, onSubmit, submitting }) {
  const [tipoVerificacao, setTipoVerificacao] = useState('lancamento');
  const [fase, setFase] = useState('');
  const [disciplinaId, setDisciplinaId] = useState('');
  const [projetoIds, setProjetoIds] = useState([]);
  const [nomeTarefa, setNomeTarefa] = useState('');
  const [horaTermino, setHoraTermino] = useState('');

  const [disciplines, setDisciplines] = useState([]);
  const [projects, setProjects] = useState([]);
  const [standardTasks, setStandardTasks] = useState([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Carrega disciplinas, projetos e tarefas padrão ao montar
  useEffect(() => {
    async function fetchFormData() {
      setLoadingData(true);
      try {
        const [discRes, projRes, tasksRes] = await Promise.all([
          axios.get('/api/agenda/tasks/form/disciplines', { withCredentials: true }),
          axios.get('/api/agenda/tasks/form/projects', { withCredentials: true }),
          axios.get('/api/agenda/tasks/form/standard-tasks', {
            params: { standardAgendaTaskId: VERIFICACAO_STANDARD_AGENDA_TASK_ID },
            withCredentials: true,
          }),
        ]);

        if (discRes.data.success) {
          setDisciplines(discRes.data.data || []);
        }
        if (projRes.data.success) {
          setProjects(projRes.data.data || []);
        }
        if (tasksRes.data.success) {
          const tasks = tasksRes.data.data || [];
          setStandardTasks(tasks);
          // Selecionar todos por padrão
          setSelectedTaskIds(tasks.map(t => t.id));
        }
      } catch (err) {
        console.error('Erro ao carregar dados do formulário:', err);
      } finally {
        setLoadingData(false);
      }
    }

    fetchFormData();
  }, []);

  // Opções de disciplina
  const disciplineOptions = useMemo(() => {
    const opts = [{ value: 'geral', label: 'Geral' }];
    disciplines.forEach((d) => {
      opts.push({
        value: String(d.id),
        label: d.discipline_name,
      });
    });
    return opts;
  }, [disciplines]);

  // Opções de projeto
  const projectOptions = useMemo(() => {
    return projects.map((p) => ({
      value: String(p.id),
      label: p.comercial_name ? `${p.name} (${p.comercial_name})` : p.name,
    }));
  }, [projects]);

  // Opções de horário de término
  const endTimeOptions = useMemo(() => {
    if (!selectedDate) return [];
    return generateEndTimeOptions(selectedDate);
  }, [selectedDate]);

  // Define horário de término padrão (+30min)
  useEffect(() => {
    if (endTimeOptions.length > 0 && !horaTermino) {
      setHoraTermino(endTimeOptions[0].value);
    }
  }, [endTimeOptions]);

  const startDateLabel = selectedDate
    ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR })
    : '';
  const startTimeLabel = selectedDate
    ? format(selectedDate, 'HH:mm')
    : '';

  // Seleção de tasks
  const allSelected = standardTasks.length > 0 && selectedTaskIds.length === standardTasks.length;

  const toggleTask = useCallback((taskId) => {
    setSelectedTaskIds(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  }, []);

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(standardTasks.map(t => t.id));
    }
  }, [allSelected, standardTasks]);

  const handleSubmit = () => {
    if (!onSubmit) return;

    let dueDate = null;
    if (selectedDate && horaTermino) {
      const [h, m] = horaTermino.split(':').map(Number);
      dueDate = new Date(selectedDate);
      dueDate.setHours(h, m, 0, 0);
    }

    const selectedTasks = standardTasks.filter(t => selectedTaskIds.includes(t.id));

    // Gerar nome automático: "Verificação [Disciplina]"
    let taskName = nomeTarefa.trim();
    if (!taskName) {
      const discOption = disciplineOptions.find(d => d.value === disciplinaId);
      const discLabel = discOption ? discOption.label : '';
      taskName = discLabel ? `Verificação ${discLabel}` : 'Verificação';
    }

    onSubmit({
      name: taskName,
      start_date: selectedDate?.toISOString() || null,
      due_date: dueDate?.toISOString() || null,
      coompat_task_kind: tipoVerificacao || null,
      phase: fase || null,
      related_discipline_id: disciplinaId === 'geral' ? null : (disciplinaId ? Number(disciplinaId) : null),
      standard_agenda_task: VERIFICACAO_STANDARD_AGENDA_TASK_ID,
      project_ids: projetoIds.map(Number),
      selected_standard_tasks: selectedTasks.map(t => ({ id: t.id, name: t.name })),
    });
  };

  if (loadingData) {
    return (
      <div className="verificacao-form__loading">
        <div className="verificacao-form__loading-spinner" />
        Carregando dados...
      </div>
    );
  }

  return (
    <div className="verificacao-form">
      {/* Coluna esquerda — campos do formulário */}
      <div className="verificacao-form__left">
        <div className="verificacao-form__field">
          <label className="verificacao-form__label">Tipo de verificação</label>
          <SearchableSelect
            id="tipo-verificacao"
            value={tipoVerificacao}
            onChange={(e) => setTipoVerificacao(e.target.value)}
            options={TIPO_OPTIONS}
            placeholder="Selecione o tipo"
          />
        </div>

        <div className="verificacao-form__field">
          <label className="verificacao-form__label">Fase</label>
          <SearchableSelect
            id="fase"
            value={fase}
            onChange={(e) => setFase(e.target.value)}
            options={FASE_OPTIONS}
            placeholder="Selecione a fase"
          />
        </div>

        <div className="verificacao-form__field">
          <label className="verificacao-form__label">Disciplina</label>
          <SearchableSelect
            id="disciplina"
            value={disciplinaId}
            onChange={(e) => setDisciplinaId(e.target.value)}
            options={disciplineOptions}
            placeholder="Selecione a disciplina"
          />
        </div>

        <div className="verificacao-form__field">
          <label className="verificacao-form__label">Projeto</label>
          <MultiSelectDropdown
            options={projectOptions}
            selectedValues={projetoIds}
            onChange={setProjetoIds}
            placeholder="Selecione os projetos"
            emptyMessage="Nenhum projeto disponível"
          />
        </div>

        <div className="verificacao-form__field">
          <label className="verificacao-form__label">
            Nome da Tarefa <span className="verificacao-form__optional">(opcional)</span>
          </label>
          <input
            type="text"
            className="verificacao-form__input"
            value={nomeTarefa}
            onChange={(e) => setNomeTarefa(e.target.value)}
            placeholder="Ex: Verificação - ARQ - Projeto Alpha"
          />
        </div>

        <div className="verificacao-form__dates">
          <div className="verificacao-form__field verificacao-form__field--half">
            <label className="verificacao-form__label">Data de início</label>
            <div className="verificacao-form__readonly">
              <span className="verificacao-form__readonly-date">{startDateLabel}</span>
              <span className="verificacao-form__readonly-time">{startTimeLabel}</span>
            </div>
          </div>

          <div className="verificacao-form__field verificacao-form__field--half">
            <label className="verificacao-form__label">Data de Término</label>
            <SearchableSelect
              id="hora-termino"
              value={horaTermino}
              onChange={(e) => setHoraTermino(e.target.value)}
              options={endTimeOptions}
              placeholder="Horário"
            />
          </div>
        </div>
      </div>

      {/* Coluna direita — lista de tarefas padrão */}
      <div className="verificacao-form__right">
        <div className="verificacao-form__tasks-header">
          <h4 className="verificacao-form__tasks-title">Adicionar tarefas</h4>
          <label className="verificacao-form__tasks-toggle">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
            />
            <span>Selecionar todos</span>
          </label>
        </div>

        <ul className="verificacao-form__tasks-list">
          {standardTasks.map((task, index) => (
            <li key={task.id} className="verificacao-form__task-item">
              <label className="verificacao-form__task-label">
                <input
                  type="checkbox"
                  checked={selectedTaskIds.includes(task.id)}
                  onChange={() => toggleTask(task.id)}
                />
                <span className="verificacao-form__task-index">{index + 1}.</span>
                <span className="verificacao-form__task-name">{task.name}</span>
              </label>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="verificacao-form__submit-btn"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Criando...' : 'Adicionar grupo'}
        </button>
      </div>
    </div>
  );
}

export default VerificacaoForm;
