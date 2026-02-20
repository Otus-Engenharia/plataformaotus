import React, { useState, useEffect, useRef, useMemo } from 'react';
import { format, isSameDay, isToday, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AgendaEventCard from './AgendaEventCard';
import './WeeklyCalendar.css';

const SLOT_HEIGHT = 36;     // px por slot de 30 min
const SLOTS_PER_HOUR = 2;
const TOTAL_HOURS = 24;
const TOTAL_SLOTS = TOTAL_HOURS * SLOTS_PER_HOUR; // 48

function minutesFromMidnight(dateStr) {
  const d = new Date(dateStr);
  return d.getHours() * 60 + d.getMinutes();
}

function getNowTop() {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  return (mins / 30) * SLOT_HEIGHT;
}

function WeeklyCalendar({ weekDays, tasks, selectedDay, onDaySelect, onSlotClick, onEventUpdate, onEventClick }) {
  const [nowTop, setNowTop] = useState(getNowTop);
  const colRefs = useRef({});

  // Atualizar linha de hora atual a cada minuto
  useEffect(() => {
    const timer = setInterval(() => setNowTop(getNowTop()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Scroll automático para o horário atual ao montar
  const bodyRef = useRef(null);
  useEffect(() => {
    if (bodyRef.current) {
      const scrollTo = Math.max(0, nowTop - 200);
      bodyRef.current.scrollTop = scrollTo;
    }
  }, []);

  // Agrupa tarefas por dia
  const tasksByDay = useMemo(() => {
    const map = {};
    for (const day of weekDays) {
      const key = format(day, 'yyyy-MM-dd');
      map[key] = tasks.filter(t => t.start_date && isSameDay(new Date(t.start_date), day));
    }
    return map;
  }, [tasks, weekDays]);

  const handleSlotClick = (day, slotIndex) => {
    const date = new Date(day);
    const hour = Math.floor(slotIndex / 2);
    const minute = (slotIndex % 2) * 30;
    date.setHours(hour, minute, 0, 0);
    if (onSlotClick) onSlotClick(date);
  };

  const isNowInWeek = weekDays.some(d => isToday(d));

  return (
    <div className="weekly-calendar">
      {/* Header com dias da semana */}
      <div className="weekly-calendar__header">
        <div className="weekly-calendar__header-gutter" />
        {weekDays.map((day, i) => {
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          return (
            <div
              key={i}
              className={`weekly-calendar__day-header${isToday(day) ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}`}
              onClick={() => onDaySelect && onDaySelect(day)}
            >
              <div className="weekly-calendar__day-name">
                {format(day, 'EEE', { locale: ptBR })}
              </div>
              <div className="weekly-calendar__day-number">
                {format(day, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Corpo com scroll */}
      <div className="weekly-calendar__body" ref={bodyRef}>
        <div className="weekly-calendar__grid">
          {/* Coluna de horas */}
          <div className="weekly-calendar__hour-gutter">
            {Array.from({ length: TOTAL_HOURS }).map((_, hour) => (
              <div key={hour} className="weekly-calendar__hour-label">
                {hour === 0 ? '' : `${String(hour).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {/* Colunas de dias */}
          {weekDays.map((day, colIdx) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayTasks = tasksByDay[key] || [];
            const isCurrentDay = isToday(day);

            return (
              <div
                key={key}
                ref={el => { colRefs.current[key] = el; }}
                className={`weekly-calendar__day-col${isCurrentDay ? ' is-today' : ''}`}
              >
                {/* Slots de 30 min */}
                {Array.from({ length: TOTAL_SLOTS }).map((_, slotIdx) => (
                  <div
                    key={slotIdx}
                    className="weekly-calendar__slot"
                    onClick={() => handleSlotClick(day, slotIdx)}
                  />
                ))}

                {/* Linha de hora atual (apenas na coluna do dia atual) */}
                {isCurrentDay && isNowInWeek && (
                  <div
                    className="weekly-calendar__now-line"
                    style={{ top: nowTop }}
                  />
                )}

                {/* Eventos posicionados absolutamente */}
                {dayTasks.map(task => {
                  const startMins = minutesFromMidnight(task.start_date);
                  const endMins = minutesFromMidnight(task.due_date);
                  const topPx = (startMins / 30) * SLOT_HEIGHT;
                  const durationMins = endMins - startMins;
                  const heightPx = Math.max(SLOT_HEIGHT, (durationMins / 30) * SLOT_HEIGHT);

                  return (
                    <AgendaEventCard
                      key={task.id}
                      task={task}
                      topPx={topPx}
                      heightPx={heightPx}
                      columnRef={{ current: colRefs.current[key] }}
                      onEventUpdate={onEventUpdate}
                      onEventClick={onEventClick}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default WeeklyCalendar;
