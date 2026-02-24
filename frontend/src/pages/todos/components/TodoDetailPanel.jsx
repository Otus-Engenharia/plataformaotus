import React, { useEffect, useCallback } from 'react';
import './TodoDetailPanel.css';

function formatDate(isoString) {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function isOverdue(dateString) {
  if (!dateString) return false;
  const due = new Date(dateString);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return due < now;
}

const STATUS_CONFIG = {
  'backlog': { label: 'Backlog', color: '#a1a1aa', bg: '#f4f4f5' },
  'a fazer': { label: 'A Fazer', color: '#3b82f6', bg: '#eff6ff' },
  'em progresso': { label: 'Em Progresso', color: '#f59e0b', bg: '#fffbeb' },
  'finalizado': { label: 'Finalizado', color: '#22c55e', bg: '#f0fdf4' },
  'validação': { label: 'Validação', color: '#8b5cf6', bg: '#f5f3ff' },
  'cancelado': { label: 'Cancelado', color: '#ef4444', bg: '#fef2f2' }
};

const PRIORITY_CONFIG = {
  'baixa': { label: 'Baixa', color: '#22c55e' },
  'média': { label: 'Média', color: '#f59e0b' },
  'alta': { label: 'Alta', color: '#ef4444' }
};

export default function TodoDetailPanel({ todo, onClose, onEdit, onComplete, onDelete }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!todo) return null;

  const status = STATUS_CONFIG[todo.status] || { label: todo.status, color: '#a1a1aa', bg: '#f4f4f5' };
  const priority = PRIORITY_CONFIG[todo.priority] || { label: todo.priority, color: '#a1a1aa' };
  const overdue = !todo.is_closed && isOverdue(todo.due_date);

  return (
    <>
      <div className="todo-detail-overlay" onClick={onClose} />
      <div className="todo-detail-panel">
        <div className="todo-detail__header">
          <h2 className="todo-detail__title">{todo.name}</h2>
          <button className="todo-detail__close" onClick={onClose} title="Fechar">
            &times;
          </button>
        </div>

        <div className="todo-detail__badges">
          <span
            className="todo-detail__badge"
            style={{ color: status.color, backgroundColor: status.bg }}
          >
            {status.label}
          </span>
          {todo.priority && (
            <span
              className="todo-detail__badge"
              style={{ color: priority.color, backgroundColor: `${priority.color}15` }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: priority.color,
                  marginRight: 6
                }}
              />
              {priority.label}
            </span>
          )}
        </div>

        <div className="todo-detail__body">
          <div className="todo-detail__section">
            <div className="todo-detail__section-title">Descricao</div>
            <p className="todo-detail__description">
              {todo.description || 'Sem descricao'}
            </p>
          </div>

          <div className="todo-detail__section">
            <div className="todo-detail__section-title">Detalhes</div>

            <div className="todo-detail__field">
              <span className="todo-detail__field-label">Data inicio</span>
              <span className="todo-detail__field-value">
                {formatDate(todo.start_date)}
              </span>
            </div>

            <div className="todo-detail__field">
              <span className="todo-detail__field-label">Data limite</span>
              <span className={`todo-detail__field-value${overdue ? ' todo-detail__field-value--overdue' : ''}`}>
                {formatDate(todo.due_date)}
                {overdue && ' (atrasado)'}
              </span>
            </div>

            <div className="todo-detail__field">
              <span className="todo-detail__field-label">Responsavel</span>
              <span className="todo-detail__field-value">
                {todo.assignee_name || 'Nao atribuido'}
              </span>
            </div>

            <div className="todo-detail__field">
              <span className="todo-detail__field-label">Projeto</span>
              <span className="todo-detail__field-value">
                {todo.project_name || 'Sem projeto'}
              </span>
            </div>

            <div className="todo-detail__field">
              <span className="todo-detail__field-label">Criado por</span>
              <span className="todo-detail__field-value">
                {todo.created_by_name || '-'}
              </span>
            </div>

            <div className="todo-detail__field">
              <span className="todo-detail__field-label">Criado em</span>
              <span className="todo-detail__field-value">
                {formatDate(todo.created_at)}
              </span>
            </div>

            <div className="todo-detail__field">
              <span className="todo-detail__field-label">Finalizado em</span>
              <span className="todo-detail__field-value">
                {formatDate(todo.closed_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="todo-detail__footer">
          <button
            className="todo-detail__btn todo-detail__btn--edit"
            onClick={() => onEdit(todo)}
          >
            Editar
          </button>
          <button
            className={`todo-detail__btn ${todo.is_closed ? 'todo-detail__btn--reopen' : 'todo-detail__btn--complete'}`}
            onClick={() => onComplete(todo.id)}
          >
            {todo.is_closed ? 'Reabrir' : 'Completar'}
          </button>
          <button
            className="todo-detail__btn todo-detail__btn--delete"
            onClick={() => onDelete(todo.id)}
          >
            Excluir
          </button>
        </div>
      </div>
    </>
  );
}
