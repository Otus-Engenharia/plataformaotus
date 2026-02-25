import React, { useRef, useEffect } from 'react';
import { format } from 'date-fns';
import './AgendaEventCard.css';

const SLOT_HEIGHT = 36; // px por slot de 30 min

function formatTime(dateStr) {
  if (!dateStr) return '';
  return format(new Date(dateStr), 'HH:mm');
}

function AgendaEventCard({ task, topPx, heightPx, columnRef, onEventUpdate, onEventClick }) {
  const cardRef = useRef(null);
  const dragRef = useRef(null);

  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const didDragRef = useRef(false);

  const statusClass = task.status === 'feito' ? 'status-feito' : 'status-a-fazer';

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragRef.current) return;

      const { type, startY, startX, origStartDate, origDueDate, origHeightPx } = dragRef.current;

      // Marcar como drag real se moveu mais que 5px
      if (!didDragRef.current) {
        const dx = Math.abs(e.clientX - startX);
        const dy = Math.abs(e.clientY - startY);
        if (dx > 5 || dy > 5) {
          didDragRef.current = true;
        }
      }

      if (type === 'move') {
        const deltaY = e.clientY - startY;
        const deltaX = e.clientX - startX;

        const deltaSlots = Math.round(deltaY / SLOT_HEIGHT);
        const deltaMs = deltaSlots * 30 * 60 * 1000;

        // Snap visual durante o drag (sem chamar API)
        if (cardRef.current) {
          const newTop = topPx + deltaSlots * SLOT_HEIGHT;
          cardRef.current.style.transform = `translateY(${deltaSlots * SLOT_HEIGHT}px) translateX(${deltaX}px)`;
          cardRef.current.classList.add('is-dragging');
        }

        dragRef.current.deltaSlots = deltaSlots;
        dragRef.current.deltaX = deltaX;
      }

      if (type === 'resize') {
        const deltaY = e.clientY - startY;
        const durationMs = new Date(origDueDate) - new Date(origStartDate);
        const origSlots = durationMs / (30 * 60 * 1000);
        const newSlots = Math.max(1, origSlots + Math.round(deltaY / SLOT_HEIGHT));
        const newHeightPx = newSlots * SLOT_HEIGHT;

        if (cardRef.current) {
          cardRef.current.style.height = `${newHeightPx}px`;
          cardRef.current.classList.add('is-resizing');
        }

        dragRef.current.newSlots = newSlots;
      }
    };

    const handleMouseUp = (e) => {
      if (!dragRef.current) return;

      const { type, origStartDate, origDueDate } = dragRef.current;

      if (type === 'move' && dragRef.current.deltaSlots !== undefined) {
        const deltaSlots = dragRef.current.deltaSlots;
        const deltaMs = deltaSlots * 30 * 60 * 1000;

        // Calcular novo dia com base no deltaX (se arrastar para outra coluna)
        const newStart = new Date(new Date(origStartDate).getTime() + deltaMs);
        const newDue = new Date(new Date(origDueDate).getTime() + deltaMs);

        // Detectar mudança de coluna pelo deltaX
        if (columnRef?.current && dragRef.current.deltaX !== undefined) {
          const colWidth = columnRef.current.offsetWidth;
          const deltaColumns = Math.round(dragRef.current.deltaX / colWidth);
          if (deltaColumns !== 0) {
            newStart.setDate(newStart.getDate() + deltaColumns);
            newDue.setDate(newDue.getDate() + deltaColumns);
          }
        }

        if (deltaSlots !== 0 || (dragRef.current.deltaX && Math.round(dragRef.current.deltaX / (columnRef?.current?.offsetWidth || 120)) !== 0)) {
          onEventUpdate(task.id, {
            reschedule: {
              startDate: newStart.toISOString(),
              dueDate: newDue.toISOString(),
            },
          });
        }
      }

      if (type === 'resize' && dragRef.current.newSlots !== undefined) {
        const newSlots = dragRef.current.newSlots;
        const newDue = new Date(new Date(origStartDate).getTime() + newSlots * 30 * 60 * 1000);

        onEventUpdate(task.id, {
          resize: { dueDate: newDue.toISOString() },
        });
      }

      // Reset visual
      if (cardRef.current) {
        cardRef.current.style.transform = '';
        cardRef.current.classList.remove('is-dragging', 'is-resizing');
      }

      dragRef.current = null;
      isDraggingRef.current = false;
      isResizingRef.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [task, topPx, heightPx, onEventUpdate, columnRef]);

  const handleBodyMouseDown = (e) => {
    e.stopPropagation();
    // Não iniciar drag se clicou no resize handle
    if (e.target.closest('.agenda-event-card__resize-handle')) return;

    isDraggingRef.current = true;
    didDragRef.current = false;
    dragRef.current = {
      type: 'move',
      startY: e.clientY,
      startX: e.clientX,
      origStartDate: task.start_date,
      origDueDate: task.due_date,
      deltaSlots: 0,
      deltaX: 0,
    };
  };

  const handleResizeMouseDown = (e) => {
    e.stopPropagation();
    e.preventDefault();

    isResizingRef.current = true;
    didDragRef.current = false;
    dragRef.current = {
      type: 'resize',
      startY: e.clientY,
      origStartDate: task.start_date,
      origDueDate: task.due_date,
    };
  };

  const handleClick = (e) => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    if (onEventClick) onEventClick(task);
  };

  const handleMarkDone = (e) => {
    e.stopPropagation();
    onEventUpdate(task.id, { status: 'feito' });
  };

  const isFeito = task.status === 'feito';

  return (
    <div
      ref={cardRef}
      data-task-id={task.id}
      className={`agenda-event-card ${statusClass}`}
      style={{ top: topPx, height: heightPx }}
      onMouseDown={handleBodyMouseDown}
      onClick={handleClick}
      title={`${task.name}\n${formatTime(task.start_date)} – ${formatTime(task.due_date)}`}
    >
      {!isFeito && (
        <button
          type="button"
          className="agenda-event-card__check"
          onClick={handleMarkDone}
          onMouseDown={(e) => e.stopPropagation()}
          title="Marcar como feito"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      )}
      <div className="agenda-event-card__name">{task.name}</div>
      {task.recurrence && task.recurrence !== 'nunca' && (
        <div className="agenda-event-card__recurrence-icon" title={`Repete: ${task.recurrence}`}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </div>
      )}
      {heightPx >= 48 && (
        <div className="agenda-event-card__time">
          {formatTime(task.start_date)} – {formatTime(task.due_date)}
        </div>
      )}
      <div
        className="agenda-event-card__resize-handle"
        onMouseDown={handleResizeMouseDown}
      />
    </div>
  );
}

export default AgendaEventCard;
