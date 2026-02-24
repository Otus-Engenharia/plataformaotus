import React from 'react';
import TodoCard from './TodoCard';
import './TodoKanbanView.css';

const KANBAN_COLUMNS = [
  { id: 'backlog', title: 'Backlog', status: 'backlog', color: '#64748b' },
  { id: 'a_fazer', title: 'A Fazer', status: 'a fazer', color: '#f59e0b' },
  { id: 'em_progresso', title: 'Em Progresso', status: 'em progresso', color: '#3b82f6' },
  { id: 'validacao', title: 'Validação', status: 'validação', color: '#8b5cf6' },
  { id: 'finalizado', title: 'Finalizado', status: 'finalizado', color: '#22c55e' },
  { id: 'cancelado', title: 'Cancelado', status: 'cancelado', color: '#6b7280' },
];

export default function TodoKanbanView({ todos = [], onComplete, onSelect, onEdit, onStatusChange, loading }) {
  if (loading) {
    return (
      <div className="todo-kanban todo-kanban--loading">
        {KANBAN_COLUMNS.map((col) => (
          <div key={col.id} className="todo-kanban__column">
            <div
              className="todo-kanban__column-header"
              style={{ borderTopColor: col.color }}
            >
              <span className="todo-kanban__column-title">{col.title}</span>
              <span className="todo-kanban__column-count">-</span>
            </div>
            <div className="todo-kanban__column-body">
              <div className="todo-kanban__empty">Carregando...</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const grouped = {};
  KANBAN_COLUMNS.forEach((col) => {
    grouped[col.status] = [];
  });
  todos.forEach((todo) => {
    const status = todo.status || 'backlog';
    if (grouped[status]) {
      grouped[status].push(todo);
    } else {
      grouped['backlog'].push(todo);
    }
  });

  return (
    <div className="todo-kanban">
      {KANBAN_COLUMNS.map((col) => {
        const columnTodos = grouped[col.status] || [];
        return (
          <div key={col.id} className="todo-kanban__column">
            <div
              className="todo-kanban__column-header"
              style={{ borderTopColor: col.color }}
            >
              <span className="todo-kanban__column-title">{col.title}</span>
              <span className="todo-kanban__column-count">{columnTodos.length}</span>
            </div>
            <div className="todo-kanban__column-body">
              {columnTodos.length === 0 ? (
                <div className="todo-kanban__empty">Sem tarefas</div>
              ) : (
                columnTodos.map((todo) => (
                  <TodoCard
                    key={todo.id}
                    todo={todo}
                    onComplete={onComplete}
                    onSelect={onSelect}
                    onEdit={onEdit}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
