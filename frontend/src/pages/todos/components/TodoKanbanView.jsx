import React, { useMemo, useState, useCallback } from 'react';
import { startOfWeek, startOfDay, addDays, eachDayOfInterval, format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TodoCard from './TodoCard';
import './TodoKanbanView.css';

const STATUS_COLUMNS = [
  { status: 'backlog', label: 'Backlog', color: '#64748b' },
  { status: 'a fazer', label: 'A Fazer', color: '#f59e0b' },
  { status: 'em progresso', label: 'Em Progresso', color: '#3b82f6' },
  { status: 'validação', label: 'Validação', color: '#8b5cf6' },
  { status: 'finalizado', label: 'Finalizado', color: '#22c55e' },
  { status: 'cancelado', label: 'Cancelado', color: '#6b7280' },
];

function buildColumns(todos, groupBy, weekRef) {
  if (groupBy === 'project') {
    const projectMap = {};
    todos.forEach((todo) => {
      const key = todo.project_id ? String(todo.project_id) : '__none__';
      if (!projectMap[key]) {
        projectMap[key] = {
          key,
          label: todo.project_name || 'Sem Projeto',
          color: key === '__none__' ? '#94a3b8' : '#3b82f6',
          items: [],
        };
      }
      projectMap[key].items.push(todo);
    });
    const cols = Object.values(projectMap);
    cols.sort((a, b) => {
      if (a.key === '__none__') return 1;
      if (b.key === '__none__') return -1;
      return a.label.localeCompare(b.label, 'pt-BR');
    });
    return cols;
  }

  if (groupBy === 'due_date') {
    const start = startOfWeek(weekRef, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start, end: addDays(start, 4) });
    const today = startOfDay(new Date());

    const columns = [
      { key: 'overdue', label: 'Atrasadas', color: '#ef4444', isOverdue: true, items: [] },
      ...weekDays.map((day) => ({
        key: format(day, 'yyyy-MM-dd'),
        label: format(day, "EEE d/MM", { locale: ptBR }),
        color: isSameDay(day, today) ? '#3b82f6' : null,
        isToday: isSameDay(day, today),
        items: [],
      })),
    ];

    const startKey = format(start, 'yyyy-MM-dd');

    todos.forEach((todo) => {
      const rawDue = todo.due_date
        ? (typeof todo.due_date === 'string' ? todo.due_date.split('T')[0] : todo.due_date)
        : null;
      const dueDate = rawDue ? startOfDay(new Date(rawDue + 'T00:00:00')) : null;

      if (!dueDate) {
        columns[0].items.push(todo);
        return;
      }

      const dueKey = format(dueDate, 'yyyy-MM-dd');

      if (dueKey < startKey && dueDate < today) {
        columns[0].items.push(todo);
        return;
      }

      const dayCol = columns.find((c) => c.key === dueKey);
      if (dayCol) {
        dayCol.items.push(todo);
      }
    });

    return columns;
  }

  // Default: status
  return STATUS_COLUMNS.map((col) => ({
    key: col.status,
    label: col.label,
    color: col.color,
    items: todos.filter((t) => (t.status || 'backlog') === col.status),
  }));
}

export default function TodoKanbanView({
  todos = [],
  groupBy = 'status',
  weekRef,
  onComplete,
  onSelect,
  onEdit,
  onStatusChange,
  onDrop,
  loading,
}) {
  const columns = useMemo(
    () => buildColumns(todos, groupBy, weekRef || new Date()),
    [todos, groupBy, weekRef],
  );

  const isDraggable = groupBy !== 'project';
  const [dragOverKey, setDragOverKey] = useState(null);

  const handleDragStart = useCallback((e, todoId) => {
    e.dataTransfer.setData('text/plain', String(todoId));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e, colKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverKey(colKey);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverKey(null);
  }, []);

  const handleDrop = useCallback((e, colKey) => {
    e.preventDefault();
    setDragOverKey(null);
    const todoId = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (todoId && onDrop) onDrop(todoId, colKey);
  }, [onDrop]);

  if (loading) {
    return (
      <div className="todo-kanban todo-kanban--loading">
        {(groupBy === 'status' ? STATUS_COLUMNS : [{ status: '1' }, { status: '2' }, { status: '3' }]).map((col, i) => (
          <div key={col.status || i} className="todo-kanban__column">
            <div className="todo-kanban__column-header">
              <span className="todo-kanban__column-title">Carregando...</span>
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

  return (
    <div className="todo-kanban">
      {columns.map((col) => {
        const colClasses = [
          'todo-kanban__column',
          col.isToday && 'todo-kanban__column--today',
          col.isOverdue && 'todo-kanban__column--overdue',
          isDraggable && dragOverKey === col.key && 'todo-kanban__column--drag-over',
        ].filter(Boolean).join(' ');

        return (
          <div
            key={col.key}
            className={colClasses}
            onDragOver={isDraggable ? (e) => handleDragOver(e, col.key) : undefined}
            onDragLeave={isDraggable ? handleDragLeave : undefined}
            onDrop={isDraggable ? (e) => handleDrop(e, col.key) : undefined}
          >
            <div
              className="todo-kanban__column-header"
              style={{ borderTopColor: col.color || '#e4e4e7' }}
            >
              <span className="todo-kanban__column-title">{col.label}</span>
              <span className="todo-kanban__column-count">{col.items.length}</span>
            </div>
            <div className="todo-kanban__column-body">
              {col.items.length === 0 ? (
                <div className="todo-kanban__empty">Sem tarefas</div>
              ) : (
                col.items.map((todo) => (
                  <TodoCard
                    key={todo.id}
                    todo={todo}
                    onComplete={onComplete}
                    onSelect={onSelect}
                    onEdit={onEdit}
                    draggable={isDraggable}
                    onDragStart={isDraggable ? (e) => handleDragStart(e, todo.id) : undefined}
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
