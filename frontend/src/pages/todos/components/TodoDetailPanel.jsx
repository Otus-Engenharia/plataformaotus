import React, { useState, useEffect, useCallback } from 'react';
import './TodoDetailPanel.css';

const API_URL = import.meta.env.VITE_API_URL || '';

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

export default function TodoDetailPanel({ todo, onClose, onEdit, onComplete, onDelete, onLinkAgenda }) {
  const [agendaTasks, setAgendaTasks] = useState([]);
  const [loadingAgenda, setLoadingAgenda] = useState(false);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Busca atividades da agenda para o dia do due_date do responsavel
  useEffect(() => {
    if (!todo?.due_date || !todo?.assignee) {
      setAgendaTasks([]);
      return;
    }

    const fetchAgendaTasks = async () => {
      setLoadingAgenda(true);
      try {
        const dayStr = todo.due_date.split('T')[0];
        const startDate = `${dayStr}T00:00:00.000Z`;
        const endDate = `${dayStr}T23:59:59.999Z`;

        const params = new URLSearchParams({
          userId: todo.assignee,
          startDate,
          endDate,
        });

        const res = await fetch(`${API_URL}/api/agenda/tasks?${params}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Erro ao buscar atividades');
        const json = await res.json();
        setAgendaTasks(json.data ?? []);
      } catch (err) {
        console.error('Erro ao buscar atividades de agenda:', err);
        setAgendaTasks([]);
      } finally {
        setLoadingAgenda(false);
      }
    };

    fetchAgendaTasks();
  }, [todo?.due_date, todo?.assignee]);

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

            <div className="todo-detail__field todo-detail__field--agenda">
              <span className="todo-detail__field-label">Atividade de Agenda</span>
              {todo.due_date && todo.assignee ? (
                <select
                  className="todo-detail__agenda-select"
                  value={todo.agenda_task_id || ''}
                  onChange={(e) => {
                    const value = e.target.value ? parseInt(e.target.value, 10) : null;
                    onLinkAgenda(todo.id, value);
                  }}
                  disabled={loadingAgenda}
                >
                  <option value="">Sem vinculo</option>
                  {agendaTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.name}
                      {task.start_date
                        ? ` (${new Date(task.start_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`
                        : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="todo-detail__agenda-hint">
                  Defina data limite e responsavel para vincular
                </span>
              )}
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
