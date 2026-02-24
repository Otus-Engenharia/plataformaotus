import React, { useMemo } from 'react';
import TodoRow from './TodoRow';
import './TodoListView.css';
import './TodoRow.css';

const STATUS_COLORS = {
  'backlog': '#64748b',
  'a fazer': '#f59e0b',
  'em progresso': '#3b82f6',
  'validação': '#8b5cf6',
  'finalizado': '#22c55e',
  'cancelado': '#6b7280'
};

const PRIORITY_COLORS = {
  'baixa': '#22c55e',
  'media': '#f59e0b',
  'média': '#f59e0b',
  'alta': '#ef4444'
};

const STATUS_ORDER = ['backlog', 'a fazer', 'em progresso', 'validação', 'finalizado', 'cancelado'];
const PRIORITY_ORDER = ['alta', 'média', 'baixa'];

function groupTodos(todos, groupBy) {
  if (groupBy === 'none' || !groupBy) {
    return [{ key: '__all__', label: null, color: null, items: todos }];
  }

  const groups = {};

  todos.forEach((todo) => {
    let key, label, color;

    switch (groupBy) {
      case 'status': {
        key = todo.status || 'backlog';
        label = todo.status_label || key;
        color = STATUS_COLORS[key.toLowerCase()] || '#94a3b8';
        break;
      }
      case 'priority': {
        key = todo.priority || 'baixa';
        label = todo.priority_label || key;
        color = PRIORITY_COLORS[key.toLowerCase()] || PRIORITY_COLORS[label?.toLowerCase()] || '#94a3b8';
        break;
      }
      case 'project': {
        key = todo.project_id || '__none__';
        label = todo.project_name || 'Sem Projeto';
        color = null;
        break;
      }
      default:
        key = '__all__';
        label = null;
        color = null;
    }

    if (!groups[key]) {
      groups[key] = { key, label, color, items: [] };
    }
    groups[key].items.push(todo);
  });

  const entries = Object.values(groups);

  if (groupBy === 'status') {
    entries.sort((a, b) => {
      const ai = STATUS_ORDER.indexOf(a.key.toLowerCase());
      const bi = STATUS_ORDER.indexOf(b.key.toLowerCase());
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  } else if (groupBy === 'priority') {
    entries.sort((a, b) => {
      const ai = PRIORITY_ORDER.indexOf(a.key.toLowerCase());
      const bi = PRIORITY_ORDER.indexOf(b.key.toLowerCase());
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  } else {
    entries.sort((a, b) => {
      if (a.key === '__none__') return 1;
      if (b.key === '__none__') return -1;
      return (a.label || '').localeCompare(b.label || '', 'pt-BR');
    });
  }

  return entries;
}

function SkeletonRow() {
  return (
    <div className="todo-row todo-row--skeleton">
      <div className="todo-row__checkbox" style={{ borderColor: '#e2e8f0' }} />
      <span className="todo-row__priority" style={{ backgroundColor: '#e2e8f0' }} />
      <div className="skeleton-block skeleton-block--name" />
      <span className="todo-row__due-date"><div className="skeleton-block skeleton-block--date" /></span>
      <span className="todo-row__assignee-col"><div className="skeleton-block skeleton-block--avatar" /></span>
      <span className="todo-row__project-col"><div className="skeleton-block skeleton-block--pill" /></span>
      <div className="todo-row__actions" />
    </div>
  );
}

function ListHeader() {
  return (
    <div className="todo-list-header">
      <span className="todo-list-header__spacer-checkbox" />
      <span className="todo-list-header__spacer-priority" />
      <span className="todo-list-header__col todo-list-header__col--name">Tarefa</span>
      <span className="todo-list-header__col todo-list-header__col--date">Data</span>
      <span className="todo-list-header__col todo-list-header__col--assignee" title="Responsável">Resp.</span>
      <span className="todo-list-header__col todo-list-header__col--project">Projeto</span>
      <span className="todo-list-header__col todo-list-header__col--actions" />
    </div>
  );
}

function TodoListView({ todos = [], groupBy = 'status', onComplete, onSelect, onEdit, onDelete, loading }) {
  const groups = useMemo(() => groupTodos(todos, groupBy), [todos, groupBy]);

  if (loading) {
    return (
      <div className="todo-list-view">
        <ListHeader />
        <div className="todo-list-view__group">
          <div className="todo-list-view__skeleton-header">
            <div className="skeleton-block" style={{ width: 80, height: 14, borderRadius: 4 }} />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!todos || todos.length === 0) {
    return (
      <div className="todo-list-view__empty">
        <svg className="todo-list-view__empty-icon" width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="10" width="32" height="28" rx="4" stroke="#cbd5e1" strokeWidth="2" />
          <path d="M16 20h16M16 26h10" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
          <circle cx="37" cy="37" r="8" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="2" />
          <path d="M35 37h4M37 35v4" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p className="todo-list-view__empty-text">Nenhuma tarefa encontrada</p>
      </div>
    );
  }

  return (
    <div className="todo-list-view">
      <ListHeader />
      {groups.map((group) => (
        <div key={group.key} className="todo-list-view__group">
          {group.label && (
            <div className="todo-list-view__group-header">
              {group.color && (
                <span
                  className="todo-list-view__group-dot"
                  style={{ backgroundColor: group.color }}
                />
              )}
              <span className="todo-list-view__group-name">{group.label}</span>
              <span className="todo-list-view__group-count">{group.items.length}</span>
            </div>
          )}
          <div className="todo-list-view__group-items">
            {group.items.map((todo) => (
              <TodoRow
                key={todo.id}
                todo={todo}
                onComplete={onComplete}
                onSelect={onSelect}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default TodoListView;
