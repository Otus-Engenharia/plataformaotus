import React, { useState, useEffect, useCallback } from 'react';
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
  { value: 'baixa', label: 'Baixa', color: '#22c55e' },
  { value: 'média', label: 'Média', color: '#f59e0b' },
  { value: 'alta', label: 'Alta', color: '#ef4444' },
];

export default function TodoCreateDialog({ todo, projects, users, onSave, onClose }) {
  const isEdit = !!todo;

  const [formData, setFormData] = useState({
    name: todo?.name || '',
    description: todo?.description || '',
    priority: todo?.priority || 'média',
    status: todo?.status || 'backlog',
    start_date: todo?.start_date ? todo.start_date.split('T')[0] : '',
    due_date: todo?.due_date ? todo.due_date.split('T')[0] : '',
    assignee: todo?.assignee || '',
    project_id: todo?.project_id || '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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

  return (
    <div className="todo-dialog-overlay" onClick={handleOverlayClick}>
      <form className="todo-dialog" onSubmit={handleSubmit}>
        <h2 className="todo-dialog__title">
          {isEdit ? 'Editar Tarefa' : 'Nova Tarefa'}
        </h2>

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
                <span
                  className="todo-dialog__priority-dot"
                  style={{ backgroundColor: opt.color }}
                />
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

        {/* Datas lado a lado */}
        <div className="todo-dialog__row">
          <div className="todo-dialog__field" style={{ flex: 1 }}>
            <label htmlFor="todo-start-date">Data inicio</label>
            <input
              id="todo-start-date"
              type="date"
              value={formData.start_date}
              onChange={(e) => handleChange('start_date', e.target.value)}
            />
          </div>
          <div className="todo-dialog__field" style={{ flex: 1 }}>
            <label htmlFor="todo-due-date">Data limite</label>
            <input
              id="todo-due-date"
              type="date"
              value={formData.due_date}
              onChange={(e) => handleChange('due_date', e.target.value)}
            />
          </div>
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

        {/* Projeto */}
        <div className="todo-dialog__field">
          <label htmlFor="todo-project">Projeto</label>
          <select
            id="todo-project"
            value={formData.project_id}
            onChange={(e) => handleChange('project_id', e.target.value)}
          >
            <option value="">Selecione um projeto</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
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
