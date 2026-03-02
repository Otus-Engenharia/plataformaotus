import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  startOfDay, addDays, format, isSameDay, isSameMonth, isToday,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  addMonths, subMonths, nextSaturday, nextMonday, getDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import './DueDatePicker.css';

function parseDate(dateStr) {
  if (!dateStr) return null;
  const raw = typeof dateStr === 'string' ? dateStr.split('T')[0] : dateStr;
  const d = new Date(raw + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function getWeekendDate(today) {
  const dow = getDay(today); // 0=Sun, 6=Sat
  if (dow === 6) return today;
  if (dow === 0) return addDays(today, -1);
  return nextSaturday(today);
}

const WEEKDAY_LABELS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

export default function DueDatePicker({ currentDate, onDateChange, triggerRef, onClose }) {
  const popoverRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const selectedDate = useMemo(() => parseDate(currentDate), [currentDate]);

  const [viewMonth, setViewMonth] = useState(() =>
    selectedDate ? startOfMonth(selectedDate) : startOfMonth(new Date())
  );

  // Position calculation
  useEffect(() => {
    if (!triggerRef?.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popH = 420;
    const popW = 280;

    let top = rect.bottom + 6;
    let left = rect.left;

    if (top + popH > window.innerHeight) {
      top = rect.top - popH - 6;
    }
    if (left + popW > window.innerWidth) {
      left = window.innerWidth - popW - 12;
    }
    if (left < 8) left = 8;
    if (top < 8) top = 8;

    setPosition({ top, left });
  }, [triggerRef]);

  // Click outside
  useEffect(() => {
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const today = startOfDay(new Date());

  const quickOptions = useMemo(() => {
    const weekend = getWeekendDate(today);
    const monday = nextMonday(today);

    return [
      {
        label: 'Hoje',
        date: format(today, 'yyyy-MM-dd'),
        color: '#22c55e',
        subtitle: format(today, 'EEE', { locale: ptBR }),
        icon: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.5 1a.5.5 0 0 1 .5.5V2h6v-.5a.5.5 0 0 1 1 0V2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h1v-.5a.5.5 0 0 1 .5-.5zM3 3a1 1 0 0 0-1 1v1h12V4a1 1 0 0 0-1-1H3zm-1 3v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6H2z" />
          </svg>
        ),
      },
      {
        label: 'Amanhã',
        date: format(addDays(today, 1), 'yyyy-MM-dd'),
        color: '#f59e0b',
        subtitle: format(addDays(today, 1), 'EEE', { locale: ptBR }),
        icon: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 1zm3.182 1.818a.5.5 0 0 1 0 .707l-1.414 1.414a.5.5 0 1 1-.708-.707l1.414-1.414a.5.5 0 0 1 .708 0zM15 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 15 8zM8 15a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 1 1 0v2A.5.5 0 0 1 8 15zm-3.182-1.818a.5.5 0 0 1 0-.707l1.414-1.414a.5.5 0 0 1 .708.707l-1.414 1.414a.5.5 0 0 1-.708 0zM1 8a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2A.5.5 0 0 1 1 8zm1.818-3.182a.5.5 0 0 1 .707 0l1.414 1.414a.5.5 0 1 1-.707.708L2.818 5.525a.5.5 0 0 1 0-.707zM8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
          </svg>
        ),
      },
      {
        label: 'Este fim de semana',
        date: format(weekend, 'yyyy-MM-dd'),
        color: '#3b82f6',
        subtitle: format(weekend, 'EEE', { locale: ptBR }),
        icon: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H3zm0-1h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
            <path d="M5 6.5A.5.5 0 0 1 5.5 6h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 3A.5.5 0 0 1 5.5 9h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z" />
          </svg>
        ),
      },
      {
        label: 'Próxima semana',
        date: format(monday, 'yyyy-MM-dd'),
        color: '#8b5cf6',
        subtitle: format(monday, "EEE d MMM", { locale: ptBR }),
        icon: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z" />
          </svg>
        ),
      },
    ];
  }, [today]);

  // Calendar grid
  const calDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [viewMonth]);

  const handleQuickSelect = (dateStr) => {
    onDateChange(dateStr);
  };

  const handleDayClick = (day) => {
    onDateChange(format(day, 'yyyy-MM-dd'));
  };

  const handleClearDate = () => {
    onDateChange(null);
  };

  return ReactDOM.createPortal(
    <div
      ref={popoverRef}
      className="due-date-picker"
      style={{ position: 'fixed', top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Quick Options */}
      <div className="due-date-picker__quick">
        {quickOptions.map((opt) => (
          <button
            key={opt.label}
            className="due-date-picker__quick-item"
            onClick={() => handleQuickSelect(opt.date)}
          >
            <span className="due-date-picker__quick-icon" style={{ color: opt.color }}>
              {opt.icon}
            </span>
            <span className="due-date-picker__quick-label">{opt.label}</span>
            <span className="due-date-picker__quick-day">{opt.subtitle}</span>
          </button>
        ))}
        {currentDate && (
          <button
            className="due-date-picker__quick-item due-date-picker__quick-item--remove"
            onClick={handleClearDate}
          >
            <span className="due-date-picker__quick-icon" style={{ color: '#a1a1aa' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0-1A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
              </svg>
            </span>
            <span className="due-date-picker__quick-label">Sem vencimento</span>
          </button>
        )}
      </div>

      <div className="due-date-picker__divider" />

      {/* Calendar */}
      <div className="due-date-picker__calendar">
        <div className="due-date-picker__cal-header">
          <div className="due-date-picker__cal-nav">
            <button onClick={() => setViewMonth((prev) => subMonths(prev, 1))}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <span>{format(viewMonth, 'MMMM yyyy', { locale: ptBR })}</span>
          <div className="due-date-picker__cal-nav">
            <button onClick={() => setViewMonth((prev) => addMonths(prev, 1))}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="due-date-picker__cal-weekdays">
          {WEEKDAY_LABELS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>

        <div className="due-date-picker__cal-grid">
          {calDays.map((day) => {
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isTodayDay = isToday(day);
            const isOutside = !isSameMonth(day, viewMonth);

            const cls = [
              'due-date-picker__cal-day',
              isSelected && 'due-date-picker__cal-day--selected',
              isTodayDay && 'due-date-picker__cal-day--today',
              isOutside && 'due-date-picker__cal-day--outside',
            ].filter(Boolean).join(' ');

            return (
              <button key={day.toISOString()} className={cls} onClick={() => handleDayClick(day)}>
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
