import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PRIORITY_COLORS, PriorityFlagIcon } from '../constants/todoColors';
import './TodoCreateDialog.css';

const STATUS_OPTIONS = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'a fazer', label: 'A fazer' },
  { value: 'em progresso', label: 'Em progresso' },
  { value: 'finalizado', label: 'Finalizado' },
  { value: 'validação', label: 'Validação' },
  { value: 'cancelado', label: 'Cancelado' },
];

const PRIORITY_OPTIONS = [
  { value: 'baixa', label: 'Baixa', color: PRIORITY_COLORS['baixa'] },
  { value: 'média', label: 'Média', color: PRIORITY_COLORS['média'] },
  { value: 'alta', label: 'Alta', color: PRIORITY_COLORS['alta'] },
];

export default function TodoCreateDialog({ todo, projects, favoriteProjects = [], users, onSave, onClose, defaultAssignee }) {
  const isEdit = !!todo;

  const [formData, setFormData] = useState({
    name: todo?.name || '',
    description: todo?.description || '',
    priority: todo?.priority || 'média',
    status: todo?.status || 'backlog',
    due_date: todo?.due_date ? (() => { const d = new Date(todo.due_date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })() : '',
    assignee: todo?.assignee || defaultAssignee || '',
    project_id: todo?.project_id || '',
  });

  const [projectsTab, setProjectsTab] = useState(isEdit && todo?.project_id ? 'selected' : 'add');
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const selectedProject = useMemo(() => {
    if (!formData.project_id) return null;
    const id = parseInt(formData.project_id);
    return projects.find(p => p.id === id) ||
           favoriteProjects.find(p => p.id === id) || null;
  }, [formData.project_id, projects, favoriteProjects]);

  const filteredProjects = useMemo(() => {
    const source = showFavoritesOnly ? favoriteProjects : projects;
    let list = source.slice();
    if (formData.project_id) {
      list = list.filter(p => p.id !== parseInt(formData.project_id));
    }
    if (projectSearchQuery.trim()) {
      const q = projectSearchQuery.toLowerCase();
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.comercial_name || '').toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
  }, [projects, favoriteProjects, showFavoritesOnly, projectSearchQuery, formData.project_id]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectProject = (projectId) => {
    handleChange('project_id', projectId);
    setProjectsTab('selected');
  };

  const handleRemoveProject = () => {
    handleChange('project_id', '');
    setProjectsTab('add');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSave(formData);
  };

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const formatProjectName = (p) =>
    p.comercial_name ? `${p.name} (${p.comercial_name})` : p.name;

  return (
    <div className="todo-dialog-overlay" onClick={handleOverlayClick}>
      <form className="todo-dialog" onSubmit={handleSubmit}>
        <h2 className="todo-dialog__title">
          {isEdit ? 'Editar Tarefa' : 'Nova Tarefa'}
        </h2>

        <div className="todo-dialog__body">
          {/* LEFT PANEL: Projetos */}
          <aside className="todo-dialog__left-panel">
            <div className="todo-dialog__panel-tabs">
              <button
                type="button"
                className={`todo-dialog__panel-tab${projectsTab === 'selected' ? ' todo-dialog__panel-tab--active' : ''}`}
                onClick={() => setProjectsTab('selected')}
              >
                Selecionados
                <span className="todo-dialog__panel-tab-badge">{selectedProject ? 1 : 0}</span>
              </button>
              <button
                type="button"
                className={`todo-dialog__panel-tab${projectsTab === 'add' ? ' todo-dialog__panel-tab--active' : ''}`}
                onClick={() => { setProjectsTab('add'); setProjectSearchQuery(''); }}
              >
                Adicionar
              </button>
            </div>

            <div className="todo-dialog__left-panel-scroll">
              {projectsTab === 'selected' ? (
                <>
                  {!selectedProject ? (
                    <div className="todo-dialog__project-empty">
                      Nenhum projeto selecionado
                      <span className="todo-dialog__project-default-hint">(Padrao: Otus)</span>
                    </div>
                  ) : (
                    <ul className="todo-dialog__project-list">
                      <li className="todo-dialog__project-item">
                        <div className="todo-dialog__project-dot" />
                        <span className="todo-dialog__project-name">
                          {formatProjectName(selectedProject)}
                        </span>
                        <button
                          type="button"
                          className="todo-dialog__project-remove"
                          onClick={handleRemoveProject}
                          title="Remover projeto"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </li>
                    </ul>
                  )}
                </>
              ) : (
                <>
                  <div className="todo-dialog__project-search">
                    <div className="todo-dialog__project-search-wrapper">
                      <svg className="todo-dialog__project-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <input
                        className="todo-dialog__project-search-input"
                        type="text"
                        placeholder="Buscar projeto..."
                        value={projectSearchQuery}
                        onChange={(e) => setProjectSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="todo-dialog__favorites-toggle">
                    <button
                      type="button"
                      className={`todo-dialog__favorites-toggle-btn${showFavoritesOnly ? ' is-active' : ''}`}
                      onClick={() => setShowFavoritesOnly(prev => !prev)}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill={showFavoritesOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      Favoritos
                    </button>
                  </div>
                  <div className="todo-dialog__add-project-list">
                    {filteredProjects.length === 0 ? (
                      <div className="todo-dialog__project-empty">
                        {projectSearchQuery ? 'Nenhum projeto encontrado' : showFavoritesOnly ? 'Nenhum projeto favoritado' : 'Nenhum projeto disponivel'}
                      </div>
                    ) : (
                      filteredProjects.slice(0, 50).map(p => (
                        <button
                          key={p.id}
                          type="button"
                          className="todo-dialog__add-project-option"
                          onClick={() => handleSelectProject(p.id)}
                        >
                          <div className="todo-dialog__add-project-option-icon">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                          </div>
                          {formatProjectName(p)}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </aside>

          {/* RIGHT PANEL: Form */}
          <div className="todo-dialog__form-panel">
            {/* Nome */}
            <div className="todo-dialog__field">
              <label htmlFor="todo-name">Nome</label>
              <input
                id="todo-name"
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Nome da tarefa"
                required
                autoFocus
              />
            </div>

            {/* Descricao */}
            <div className="todo-dialog__field">
              <label htmlFor="todo-description">Descricao</label>
              <textarea
                id="todo-description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Descricao opcional"
                rows={3}
              />
            </div>

            {/* Prioridade */}
            <div className="todo-dialog__field">
              <label>Prioridade</label>
              <div className="todo-dialog__priority-group">
                {PRIORITY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`todo-dialog__priority-option ${
                      formData.priority === opt.value ? 'todo-dialog__priority-option--active' : ''
                    }`}
                    style={
                      formData.priority === opt.value
                        ? { borderColor: opt.color }
                        : undefined
                    }
                  >
                    <input
                      type="radio"
                      name="priority"
                      value={opt.value}
                      checked={formData.priority === opt.value}
                      onChange={() => handleChange('priority', opt.value)}
                      className="todo-dialog__priority-radio"
                    />
                    <PriorityFlagIcon color={opt.color} size={14} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Status (somente edicao) */}
            {isEdit && (
              <div className="todo-dialog__field">
                <label htmlFor="todo-status">Status</label>
                <select
                  id="todo-status"
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Data limite */}
            <div className="todo-dialog__field">
              <label htmlFor="todo-due-date">Data limite</label>
              <input
                id="todo-due-date"
                type="date"
                value={formData.due_date}
                onChange={(e) => handleChange('due_date', e.target.value)}
              />
            </div>

            {/* Responsavel */}
            <div className="todo-dialog__field">
              <label htmlFor="todo-assignee">Responsavel</label>
              <select
                id="todo-assignee"
                value={formData.assignee}
                onChange={(e) => handleChange('assignee', e.target.value)}
              >
                <option value="">Selecione um responsavel</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="todo-dialog__footer">
          <button
            type="button"
            className="todo-dialog__btn-cancel"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button type="submit" className="todo-dialog__btn-save">
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}
