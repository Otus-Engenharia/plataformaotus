import React from 'react';
import './TodoCard.css';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDueDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr + 'T00:00:00');
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

export default function TodoCard({ todo, onComplete, onSelect, onEdit }) {
  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    if (onComplete) onComplete(todo.id);
  };

  const handleCardClick = () => {
    if (onSelect) onSelect(todo);
  };

  const cardClass = [
    'todo-card',
    todo.is_closed ? 'todo-card--closed' : '',
  ].filter(Boolean).join(' ');

  const nameClass = [
    'todo-card__name',
    todo.is_closed ? 'todo-card__name--closed' : '',
  ].filter(Boolean).join(' ');

  const checkboxClass = [
    'todo-card__checkbox',
    todo.is_closed ? 'todo-card__checkbox--checked' : '',
  ].filter(Boolean).join(' ');

  const dueClass = [
    'todo-card__due',
    todo.is_overdue ? 'todo-card__due--overdue' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cardClass}
      style={{ borderLeftColor: todo.priority_color || '#e4e4e7' }}
      onClick={handleCardClick}
    >
      <div className="todo-card__header">
        <span className={nameClass}>{todo.name}</span>
        <button
          className={checkboxClass}
          onClick={handleCheckboxClick}
          title={todo.is_closed ? 'Reabrir tarefa' : 'Concluir tarefa'}
          aria-label={todo.is_closed ? 'Reabrir tarefa' : 'Concluir tarefa'}
        >
          {todo.is_closed && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5L4.5 7.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>

      <div className="todo-card__meta">
        {todo.due_date && (
          <span className={dueClass}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.5 1a.5.5 0 0 1 .5.5V2h6v-.5a.5.5 0 0 1 1 0V2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h1v-.5a.5.5 0 0 1 .5-.5zM3 3a1 1 0 0 0-1 1v1h12V4a1 1 0 0 0-1-1H3zm-1 3v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6H2z"/>
            </svg>
            {formatDueDate(todo.due_date)}
          </span>
        )}

        {todo.assignee_name && (
          <span className="todo-card__assignee" title={todo.assignee_name}>
            {getInitials(todo.assignee_name)}
          </span>
        )}

        {todo.project_name && (
          <span className="todo-card__project" title={todo.project_name}>
            {todo.project_name}
          </span>
        )}
      </div>
    </div>
  );
}
