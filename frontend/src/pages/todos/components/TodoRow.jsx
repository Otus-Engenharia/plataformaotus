import React from 'react';
import './TodoRow.css';

const PRIORITY_COLORS = {
  'baixa': '#22c55e',
  'media': '#f59e0b',
  'média': '#f59e0b',
  'alta': '#ef4444'
};

function formatDueDate(dateStr) {
  if (!dateStr) return null;
  const raw = typeof dateStr === 'string' ? dateStr.split('T')[0] : dateStr;
  const date = new Date(raw + 'T00:00:00');
  if (isNaN(date.getTime())) return null;
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const day = date.getDate();
  const month = months[date.getMonth()];
  return `${day} ${month}`;
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0][0].toUpperCase();
}

function TodoRow({ todo, onComplete, onSelect, onEdit, onDelete }) {
  const priorityColor = PRIORITY_COLORS[todo.priority_label?.toLowerCase()] || PRIORITY_COLORS[todo.priority] || '#94a3b8';
  const isClosed = todo.is_closed;
  const dueDateStr = formatDueDate(todo.due_date);

  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    if (onComplete) onComplete(todo.id);
  };

  const handleEditClick = (e) => {
    e.stopPropagation();
    if (onEdit) onEdit(todo);
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (onDelete) onDelete(todo.id);
  };

  const handleRowClick = () => {
    if (onSelect) onSelect(todo);
  };

  const dueDateClass = [
    'todo-row__due-date',
    !dueDateStr && 'todo-row__due-date--empty',
    todo.is_overdue && 'todo-row__due-date--overdue',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={`todo-row ${isClosed ? 'todo-row--closed' : ''}`}
      onClick={handleRowClick}
    >
      <button
        className={`todo-row__checkbox ${isClosed ? 'todo-row__checkbox--checked' : ''}`}
        style={{ borderColor: isClosed ? '#22c55e' : priorityColor }}
        onClick={handleCheckboxClick}
        title={isClosed ? 'Reabrir tarefa' : 'Concluir tarefa'}
      >
        {isClosed && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <span
        className="todo-row__priority"
        style={{ backgroundColor: priorityColor }}
        title={todo.priority_label || todo.priority}
      />

      <span className={`todo-row__name ${isClosed ? 'todo-row__name--closed' : ''}`}>
        {todo.name}
      </span>

      <span className={dueDateClass}>
        {dueDateStr || '—'}
      </span>

      <span className="todo-row__assignee-col">
        {todo.assignee_name ? (
          <span className="todo-row__assignee" title={todo.assignee_name}>
            {getInitials(todo.assignee_name)}
          </span>
        ) : null}
      </span>

      <span className="todo-row__project-col">
        {todo.project_name ? (
          <span className="todo-row__project" title={todo.project_name}>
            {todo.project_name}
          </span>
        ) : null}
      </span>

      <div className="todo-row__actions">
        <button className="todo-row__action-btn" onClick={handleEditClick} title="Editar">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M10.08 1.92a1.5 1.5 0 0 1 2.12 2.12L4.95 11.29l-2.83.71.71-2.83L10.08 1.92z"
              stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="todo-row__action-btn todo-row__action-btn--delete" onClick={handleDeleteClick} title="Excluir">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 4h10M5 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M6 6.5v3M8 6.5v3M3 4l.5 7a1.5 1.5 0 0 0 1.5 1.5h4a1.5 1.5 0 0 0 1.5-1.5L11 4"
              stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default TodoRow;
