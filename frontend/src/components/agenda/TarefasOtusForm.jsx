import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import axios from 'axios';
import SearchableSelect from '../SearchableSelect';
import './TarefasOtusForm.css';

const RECURRENCE_OPTIONS = [
  { value: 'nunca', label: 'Nunca' },
  { value: 'diária', label: 'Diária (todos os dias)' },
  { value: 'diária_útil', label: 'Diária (dias úteis)' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
];

const END_TYPE_OPTIONS = [
  { value: 'never', label: 'Nunca (contínuo)' },
  { value: 'date', label: 'Em uma data' },
  { value: 'count', label: 'Após N repetições' },
];

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

function TarefasOtusForm({ selectedDate, onSubmit, submitting }) {
  const [grupoAtividadeId, setGrupoAtividadeId] = useState('');
  const [nomeTarefa, setNomeTarefa] = useState('');
  const [horaTermino, setHoraTermino] = useState('');
  const [recurrence, setRecurrence] = useState('nunca');
  const [endType, setEndType] = useState('never');
  const [recurrenceUntil, setRecurrenceUntil] = useState('');
  const [recurrenceCount, setRecurrenceCount] = useState(10);

  const [standardAgendaTasks, setStandardAgendaTasks] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    async function fetchFormData() {
      setLoadingData(true);
      try {
        const tasksRes = await axios.get('/api/agenda/tasks/form/standard-agenda-tasks', {
          params: { position: 'otus' },
          withCredentials: true,
        });

        if (tasksRes.data.success) {
          setStandardAgendaTasks(tasksRes.data.data || []);
        }
      } catch (err) {
        console.error('Erro ao carregar dados do formulário:', err);
      } finally {
        setLoadingData(false);
      }
    }

    fetchFormData();
  }, []);

  const grupoOptions = useMemo(() => {
    return standardAgendaTasks.map((t) => ({
      value: String(t.id),
      label: t.name,
    }));
  }, [standardAgendaTasks]);

  const endTimeOptions = useMemo(() => {
    if (!selectedDate) return [];
    return generateEndTimeOptions(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    if (endTimeOptions.length > 0 && !horaTermino) {
      setHoraTermino(endTimeOptions[0].value);
    }
  }, [endTimeOptions]);

  const startDateLabel = selectedDate
    ? format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })
    : '';
  const startTimeLabel = selectedDate
    ? format(selectedDate, 'HH:mm')
    : '';

  const handleSubmit = () => {
    if (!onSubmit) return;

    let dueDate = null;
    if (selectedDate && horaTermino) {
      const [h, m] = horaTermino.split(':').map(Number);
      dueDate = new Date(selectedDate);
      dueDate.setHours(h, m, 0, 0);
    }

    let taskName = nomeTarefa.trim();
    if (!taskName) {
      const grupo = grupoOptions.find((g) => g.value === grupoAtividadeId);
      taskName = grupo ? grupo.label : 'Tarefas Otus';
    }

    onSubmit({
      name: taskName,
      start_date: selectedDate?.toISOString() || null,
      due_date: dueDate?.toISOString() || null,
      standard_agenda_task: grupoAtividadeId ? Number(grupoAtividadeId) : null,
      project_ids: [],
      selected_standard_tasks: [],
      recurrence,
      recurrence_until: recurrence !== 'nunca' && endType === 'date' ? recurrenceUntil : null,
      recurrence_count: recurrence !== 'nunca' && endType === 'count' ? Number(recurrenceCount) : null,
      recurrence_copy_projects: false,
    });
  };

  if (loadingData) {
    return (
      <div className="otus-form__loading">
        <div className="otus-form__loading-spinner" />
        Carregando dados...
      </div>
    );
  }

  return (
    <div className="otus-form">
      <div className="otus-form__fields">
        <div className="otus-form__field">
          <label className="otus-form__label">Grupo de atividades padrão</label>
          <SearchableSelect
            id="grupo-atividade-otus"
            value={grupoAtividadeId}
            onChange={(e) => setGrupoAtividadeId(e.target.value)}
            options={grupoOptions}
            placeholder="Selecione o grupo"
          />
        </div>

        <div className="otus-form__field">
          <label className="otus-form__label">
            Nome da Tarefa <span className="otus-form__optional">(opcional)</span>
          </label>
          <input
            type="text"
            className="otus-form__input"
            value={nomeTarefa}
            onChange={(e) => setNomeTarefa(e.target.value)}
            placeholder="Ex: Treinamento interno"
          />
        </div>

        <div className="otus-form__dates">
          <div className="otus-form__field otus-form__field--half">
            <label className="otus-form__label">Data de início</label>
            <div className="otus-form__readonly">
              <span className="otus-form__readonly-date">{startDateLabel}</span>
              <span className="otus-form__readonly-time">{startTimeLabel}</span>
            </div>
          </div>

          <div className="otus-form__field otus-form__field--half">
            <label className="otus-form__label">Término</label>
            <SearchableSelect
              id="hora-termino-otus"
              value={horaTermino}
              onChange={(e) => setHoraTermino(e.target.value)}
              options={endTimeOptions}
              placeholder="Horário"
            />
          </div>
        </div>

        <div className="otus-form__field">
          <label className="otus-form__label">Repetir</label>
          <SearchableSelect
            id="recurrence-otus"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value)}
            options={RECURRENCE_OPTIONS}
            placeholder="Nunca"
          />
        </div>

        {recurrence !== 'nunca' && (
          <div className="otus-form__recurrence-options">
            <div className="otus-form__field">
              <label className="otus-form__label">Termina</label>
              <SearchableSelect
                id="end-type-otus"
                value={endType}
                onChange={(e) => setEndType(e.target.value)}
                options={END_TYPE_OPTIONS}
                placeholder="Selecione"
              />
            </div>

            {endType === 'date' && (
              <div className="otus-form__field">
                <label className="otus-form__label">Data limite</label>
                <input
                  type="date"
                  className="otus-form__input"
                  value={recurrenceUntil}
                  onChange={(e) => setRecurrenceUntil(e.target.value)}
                />
              </div>
            )}

            {endType === 'count' && (
              <div className="otus-form__field">
                <label className="otus-form__label">Número de repetições</label>
                <input
                  type="number"
                  className="otus-form__input"
                  min="1"
                  max="365"
                  value={recurrenceCount}
                  onChange={(e) => setRecurrenceCount(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          className="otus-form__submit-btn"
          onClick={handleSubmit}
          disabled={submitting || !grupoAtividadeId}
        >
          {submitting ? 'Criando...' : 'Criar atividade'}
        </button>
      </div>
    </div>
  );
}

export default TarefasOtusForm;
