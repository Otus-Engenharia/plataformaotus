import React, { useState, useRef, useCallback } from 'react';
import DueDatePicker from '../../pages/todos/components/DueDatePicker';
import {
  PRIORITY_COLORS, STATUS_COLORS, STATUS_LABELS,
  PriorityFlagIcon, getNextPriority, getNextStatus
} from '../../pages/todos/constants/todoColors';
import { format } from 'date-fns';
import './TodoItemSidebar.css';

const SHORT_MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function formatDueShort(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length !== 3) return null;
  const [, m, d] = parts.map(Number);
  if (isNaN(m) || isNaN(d)) return null;
  return `${String(d).padStart(2, '0')}/${SHORT_MONTHS[m - 1]}`;
}

export default function TodoItemSidebar({
  todo,
  isLinked,
  isDone,
  isOverdue,
  onToggleComplete,
  onUpdate,
  draggable,
  onDragStart,
  onDragEnd,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(todo.name);
  const dateRef = useRef(null);

  const handleRowClick = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleComplete = useCallback((e) => {
    e.stopPropagation();
    onToggleComplete(todo.id);
  }, [todo.id, onToggleComplete]);

  const handlePriorityClick = useCallback((e) => {
    e.stopPropagation();
    onUpdate(todo.id, { priority: getNextPriority(todo.priority) });
  }, [todo.id, todo.priority, onUpdate]);

  const handleStatusClick = useCallback((e) => {
    e.stopPropagation();
    onUpdate(todo.id, { status: getNextStatus(todo.status) });
  }, [todo.id, todo.status, onUpdate]);

  const handleDateChange = useCallback((newDate) => {
    onUpdate(todo.id, { due_date: newDate });
    setShowDatePicker(false);
  }, [todo.id, onUpdate]);

  const handleNameSave = useCallback(() => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== todo.name) {
      onUpdate(todo.id, { name: trimmed });
    }
    setEditingName(false);
  }, [nameValue, todo.id, todo.name, onUpdate]);

  const priorityKey = (todo.priority || 'baixa').toLowerCase();
  const statusKey = (todo.status || 'backlog').toLowerCase();

  const rootClass = [
    'sidebar-todo',
    isDone && 'sidebar-todo--done',
    isOverdue && 'sidebar-todo--overdue',
    isExpanded && 'sidebar-todo--expanded',
    draggable && !isExpanded && !isDone && 'sidebar-todo--draggable',
    isLinked && 'sidebar-todo--linked',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={rootClass}
      draggable={draggable && !isExpanded && !isDone}
      onDragStart={draggable && !isExpanded ? onDragStart : undefined}
      onDragEnd={draggable && !isExpanded ? onDragEnd : undefined}
    >
      {/* Main row */}
      <div className="sidebar-todo__row" onClick={handleRowClick}>
        <button
          className={`sidebar-todo__checkbox${isDone ? ' sidebar-todo__checkbox--checked' : ''}`}
          onClick={handleComplete}
          title={isDone ? 'Reabrir' : 'Finalizar'}
        >
          {isDone && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5L4.5 7.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <div className="sidebar-todo__content">
          <span className={`sidebar-todo__name${isDone ? ' sidebar-todo__name--done' : ''}`}>
            {todo.name}
          </span>
          <div className="sidebar-todo__meta">
            <button
              className="sidebar-todo__priority-btn"
              onClick={handlePriorityClick}
              title={`Prioridade: ${todo.priority || 'baixa'} - clique para alterar`}
            >
              <PriorityFlagIcon
                color={PRIORITY_COLORS[priorityKey] || '#246fe0'}
                size={10}
              />
            </button>

            {todo.due_date && (
              <span className={`sidebar-todo__date${isOverdue ? ' sidebar-todo__date--overdue' : ''}`}>
                {formatDueShort(todo.due_date)}
              </span>
            )}

            {todo.project_name && (
              <span className="sidebar-todo__project">{todo.project_name}</span>
            )}

            <button
              className="sidebar-todo__status-badge"
              style={{
                color: STATUS_COLORS[statusKey] || '#64748b',
                borderColor: STATUS_COLORS[statusKey] || '#64748b',
              }}
              onClick={handleStatusClick}
              title={`Status: ${STATUS_LABELS[statusKey] || todo.status} - clique para alterar`}
            >
              {STATUS_LABELS[statusKey] || 'Backlog'}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded inline edit panel */}
      {isExpanded && (
        <div className="sidebar-todo__edit-panel">
          {/* Name edit */}
          {editingName ? (
            <input
              className="sidebar-todo__name-input"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.target.blur();
                if (e.key === 'Escape') {
                  setNameValue(todo.name);
                  setEditingName(false);
                }
              }}
              autoFocus
            />
          ) : (
            <div
              className="sidebar-todo__edit-row"
              onClick={() => {
                setNameValue(todo.name);
                setEditingName(true);
              }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175l-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
              </svg>
              <span className="sidebar-todo__edit-label">{todo.name}</span>
            </div>
          )}

          {/* Date edit */}
          <div
            className="sidebar-todo__edit-row"
            ref={dateRef}
            onClick={() => setShowDatePicker(true)}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.5 1a.5.5 0 0 1 .5.5V2h6v-.5a.5.5 0 0 1 1 0V2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h1v-.5a.5.5 0 0 1 .5-.5zM3 3a1 1 0 0 0-1 1v1h12V4a1 1 0 0 0-1-1H3zm-1 3v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6H2z"/>
            </svg>
            <span className="sidebar-todo__edit-label">
              {todo.due_date ? format(new Date(todo.due_date + 'T12:00:00'), 'dd/MM/yyyy') : 'Sem data'}
            </span>
          </div>
          {showDatePicker && (
            <DueDatePicker
              currentDate={todo.due_date}
              onDateChange={handleDateChange}
              triggerRef={dateRef}
              onClose={() => setShowDatePicker(false)}
            />
          )}

          {/* Priority row */}
          <div className="sidebar-todo__edit-row" onClick={handlePriorityClick}>
            <PriorityFlagIcon
              color={PRIORITY_COLORS[priorityKey] || '#246fe0'}
              size={12}
            />
            <span className="sidebar-todo__edit-label">
              Prioridade: {(todo.priority || 'baixa').charAt(0).toUpperCase() + (todo.priority || 'baixa').slice(1)}
            </span>
          </div>

          {/* Status row */}
          <div className="sidebar-todo__edit-row" onClick={handleStatusClick}>
            <span
              className="sidebar-todo__edit-dot"
              style={{ background: STATUS_COLORS[statusKey] || '#64748b' }}
            />
            <span className="sidebar-todo__edit-label">
              Status: {STATUS_LABELS[statusKey] || 'Backlog'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
