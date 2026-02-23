import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import axios from 'axios';
import SearchableSelect from '../SearchableSelect';
import MultiSelectDropdown from '../formulario-passagem/MultiSelectDropdown';
import './ApoioProjetosForm.css';

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

function ApoioProjetosForm({ selectedDate, onSubmit, submitting }) {
  const [grupoAtividadeId, setGrupoAtividadeId] = useState('');
  const [projetoIds, setProjetoIds] = useState([]);
  const [nomeTarefa, setNomeTarefa] = useState('');
  const [horaTermino, setHoraTermino] = useState('');
  const [showFavorites, setShowFavorites] = useState(true);

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
            params: { position: 'time bim' },
            withCredentials: true,
          }),
          axios.get('/api/agenda/tasks/form/projects', { withCredentials: true }),
          axios.get('/api/agenda/tasks/form/favorite-projects', { withCredentials: true }),
        ]);

        if (tasksRes.data.success) {
          setStandardAgendaTasks(tasksRes.data.data || []);
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
      taskName = grupo ? grupo.label : 'Apoio Projetos';
    }

    onSubmit({
      name: taskName,
      start_date: selectedDate?.toISOString() || null,
      due_date: dueDate?.toISOString() || null,
      standard_agenda_task: grupoAtividadeId ? Number(grupoAtividadeId) : null,
      project_ids: projetoIds.map(Number),
      selected_standard_tasks: [],
    });
  };

  if (loadingData) {
    return (
      <div className="apoio-form__loading">
        <div className="apoio-form__loading-spinner" />
        Carregando dados...
      </div>
    );
  }

  return (
    <div className="apoio-form">
      <div className="apoio-form__fields">
        <div className="apoio-form__field">
          <label className="apoio-form__label">Grupo de atividades padrão</label>
          <SearchableSelect
            id="grupo-atividade-apoio"
            value={grupoAtividadeId}
            onChange={(e) => setGrupoAtividadeId(e.target.value)}
            options={grupoOptions}
            placeholder="Selecione o grupo"
          />
        </div>

        <div className="apoio-form__field">
          <label className="apoio-form__label">
            Nome da Tarefa <span className="apoio-form__optional">(opcional)</span>
          </label>
          <input
            type="text"
            className="apoio-form__input"
            value={nomeTarefa}
            onChange={(e) => setNomeTarefa(e.target.value)}
            placeholder="Ex: Setup de projeto BIM"
          />
        </div>

        <div className="apoio-form__field">
          <div className="apoio-form__project-header">
            <label className="apoio-form__label">Projetos</label>
            <div className="apoio-form__project-actions">
              {showFavorites && favoriteProjects.length > 0 && (
                <button
                  type="button"
                  className="apoio-form__select-all-btn"
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
              <div className="apoio-form__toggle">
                <button
                  type="button"
                  className={`apoio-form__toggle-btn${showFavorites ? ' is-active' : ''}`}
                  onClick={() => { if (!showFavorites) handleToggleSource(); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={showFavorites ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  Favoritos
                </button>
                <button
                  type="button"
                  className={`apoio-form__toggle-btn${!showFavorites ? ' is-active' : ''}`}
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

        <div className="apoio-form__dates">
          <div className="apoio-form__field apoio-form__field--half">
            <label className="apoio-form__label">Data de início</label>
            <div className="apoio-form__readonly">
              <span className="apoio-form__readonly-date">{startDateLabel}</span>
              <span className="apoio-form__readonly-time">{startTimeLabel}</span>
            </div>
          </div>

          <div className="apoio-form__field apoio-form__field--half">
            <label className="apoio-form__label">Término</label>
            <SearchableSelect
              id="hora-termino-apoio"
              value={horaTermino}
              onChange={(e) => setHoraTermino(e.target.value)}
              options={endTimeOptions}
              placeholder="Horário"
            />
          </div>
        </div>

        <button
          type="button"
          className="apoio-form__submit-btn"
          onClick={handleSubmit}
          disabled={submitting || !grupoAtividadeId}
        >
          {submitting ? 'Criando...' : 'Criar atividade'}
        </button>
      </div>
    </div>
  );
}

export default ApoioProjetosForm;
