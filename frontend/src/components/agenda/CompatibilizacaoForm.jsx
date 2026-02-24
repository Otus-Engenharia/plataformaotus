import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import axios from 'axios';
import SearchableSelect from '../SearchableSelect';
import MultiSelectDropdown from '../formulario-passagem/MultiSelectDropdown';
import './CompatibilizacaoForm.css';

const VERIFICACAO_STANDARD_AGENDA_TASK_ID = 18;

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

function CompatibilizacaoForm({ selectedDate, onSubmit, submitting }) {
  const [grupoAtividadeId, setGrupoAtividadeId] = useState('');
  const [projetoIds, setProjetoIds] = useState([]);
  const [nomeTarefa, setNomeTarefa] = useState('');
  const [horaTermino, setHoraTermino] = useState('');
  const [showFavorites, setShowFavorites] = useState(true);
  const [recurrence, setRecurrence] = useState('nunca');
  const [endType, setEndType] = useState('never');
  const [recurrenceUntil, setRecurrenceUntil] = useState('');
  const [recurrenceCount, setRecurrenceCount] = useState(10);
  const [copyProjects, setCopyProjects] = useState(false);

  const [standardAgendaTasks, setStandardAgendaTasks] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [favoriteProjects, setFavoriteProjects] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    async function fetchFormData() {
      setLoadingData(true);
      try {
        const [tasksRes, projRes, favRes] = await Promise.all([
          axios.get('/api/agenda/tasks/form/standard-agenda-tasks', {
            params: { position: 'compatibilização' },
            withCredentials: true,
          }),
          axios.get('/api/agenda/tasks/form/projects', { withCredentials: true }),
          axios.get('/api/agenda/tasks/form/favorite-projects', { withCredentials: true }),
        ]);

        if (tasksRes.data.success) {
          // Remover "Verificação" (id 18) — tem formulário próprio
          const filtered = (tasksRes.data.data || []).filter(
            (t) => t.id !== VERIFICACAO_STANDARD_AGENDA_TASK_ID
          );
          setStandardAgendaTasks(filtered);
        }
        if (projRes.data.success) {
          setAllProjects(projRes.data.data || []);
        }
        if (favRes.data.success) {
          setFavoriteProjects(favRes.data.data || []);
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

  const activeProjects = showFavorites ? favoriteProjects : allProjects;

  const projectOptions = useMemo(() => {
    return activeProjects
      .slice()
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'))
      .map((p) => ({
        value: String(p.id),
        label: p.comercial_name ? `${p.name} (${p.comercial_name})` : p.name,
      }));
  }, [activeProjects]);

  const handleToggleSource = useCallback(() => {
    setShowFavorites((prev) => !prev);
    setProjetoIds([]);
  }, []);

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
      taskName = grupo ? grupo.label : 'Compatibilização';
    }

    onSubmit({
      name: taskName,
      start_date: selectedDate?.toISOString() || null,
      due_date: dueDate?.toISOString() || null,
      standard_agenda_task: grupoAtividadeId ? Number(grupoAtividadeId) : null,
      project_ids: projetoIds.map(Number),
      selected_standard_tasks: [],
      recurrence,
      recurrence_until: recurrence !== 'nunca' && endType === 'date' ? recurrenceUntil : null,
      recurrence_count: recurrence !== 'nunca' && endType === 'count' ? Number(recurrenceCount) : null,
      recurrence_copy_projects: recurrence !== 'nunca' ? copyProjects : false,
    });
  };

  if (loadingData) {
    return (
      <div className="compat-form__loading">
        <div className="compat-form__loading-spinner" />
        Carregando dados...
      </div>
    );
  }

  return (
    <div className="compat-form">
      <div className="compat-form__fields">
        <div className="compat-form__field">
          <label className="compat-form__label">Grupo de atividades padrão</label>
          <SearchableSelect
            id="grupo-atividade-compat"
            value={grupoAtividadeId}
            onChange={(e) => setGrupoAtividadeId(e.target.value)}
            options={grupoOptions}
            placeholder="Selecione o grupo"
          />
        </div>

        <div className="compat-form__field">
          <label className="compat-form__label">
            Nome da Tarefa <span className="compat-form__optional">(opcional)</span>
          </label>
          <input
            type="text"
            className="compat-form__input"
            value={nomeTarefa}
            onChange={(e) => setNomeTarefa(e.target.value)}
            placeholder="Ex: Compatibilização estrutural"
          />
        </div>

        <div className="compat-form__field">
          <div className="compat-form__project-header">
            <label className="compat-form__label">Projetos</label>
            <div className="compat-form__project-actions">
              {showFavorites && favoriteProjects.length > 0 && (
                <button
                  type="button"
                  className="compat-form__select-all-btn"
                  onClick={() => {
                    const allFavIds = favoriteProjects.map((p) => String(p.id));
                    const allSelected = allFavIds.length === projetoIds.length && allFavIds.every((id) => projetoIds.includes(id));
                    setProjetoIds(allSelected ? [] : allFavIds);
                  }}
                >
                  {favoriteProjects.length === projetoIds.length && favoriteProjects.every((p) => projetoIds.includes(String(p.id)))
                    ? 'Desmarcar todos'
                    : 'Selecionar todos'}
                </button>
              )}
              <div className="compat-form__toggle">
                <button
                  type="button"
                  className={`compat-form__toggle-btn${showFavorites ? ' is-active' : ''}`}
                  onClick={() => { if (!showFavorites) handleToggleSource(); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={showFavorites ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  Favoritos
                </button>
                <button
                  type="button"
                  className={`compat-form__toggle-btn${!showFavorites ? ' is-active' : ''}`}
                  onClick={() => { if (showFavorites) handleToggleSource(); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  Todos
                </button>
              </div>
            </div>
          </div>
          <MultiSelectDropdown
            options={projectOptions}
            selectedValues={projetoIds}
            onChange={setProjetoIds}
            placeholder={showFavorites ? 'Selecione entre seus favoritos' : 'Selecione os projetos'}
            emptyMessage={showFavorites ? 'Nenhum projeto favoritado' : 'Nenhum projeto disponível'}
          />
        </div>

        <div className="compat-form__dates">
          <div className="compat-form__field compat-form__field--half">
            <label className="compat-form__label">Data de início</label>
            <div className="compat-form__readonly">
              <span className="compat-form__readonly-date">{startDateLabel}</span>
              <span className="compat-form__readonly-time">{startTimeLabel}</span>
            </div>
          </div>

          <div className="compat-form__field compat-form__field--half">
            <label className="compat-form__label">Término</label>
            <SearchableSelect
              id="hora-termino-compat"
              value={horaTermino}
              onChange={(e) => setHoraTermino(e.target.value)}
              options={endTimeOptions}
              placeholder="Horário"
            />
          </div>
        </div>

        <div className="compat-form__field">
          <label className="compat-form__label">Repetir</label>
          <SearchableSelect
            id="recurrence-compat"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value)}
            options={RECURRENCE_OPTIONS}
            placeholder="Nunca"
          />
        </div>

        {recurrence !== 'nunca' && (
          <div className="compat-form__recurrence-options">
            <div className="compat-form__field">
              <label className="compat-form__label">Termina</label>
              <SearchableSelect
                id="end-type-compat"
                value={endType}
                onChange={(e) => setEndType(e.target.value)}
                options={END_TYPE_OPTIONS}
                placeholder="Selecione"
              />
            </div>

            {endType === 'date' && (
              <div className="compat-form__field">
                <label className="compat-form__label">Data limite</label>
                <input
                  type="date"
                  className="compat-form__input"
                  value={recurrenceUntil}
                  onChange={(e) => setRecurrenceUntil(e.target.value)}
                />
              </div>
            )}

            {endType === 'count' && (
              <div className="compat-form__field">
                <label className="compat-form__label">Número de repetições</label>
                <input
                  type="number"
                  className="compat-form__input"
                  min="1"
                  max="365"
                  value={recurrenceCount}
                  onChange={(e) => setRecurrenceCount(e.target.value)}
                />
              </div>
            )}

            <label className="compat-form__checkbox-label">
              <input
                type="checkbox"
                checked={copyProjects}
                onChange={(e) => setCopyProjects(e.target.checked)}
              />
              <span>Manter projetos nas repetições</span>
            </label>
          </div>
        )}

        <button
          type="button"
          className="compat-form__submit-btn"
          onClick={handleSubmit}
          disabled={submitting || !grupoAtividadeId}
        >
          {submitting ? 'Criando...' : 'Criar atividade'}
        </button>
      </div>
    </div>
  );
}

export default CompatibilizacaoForm;
