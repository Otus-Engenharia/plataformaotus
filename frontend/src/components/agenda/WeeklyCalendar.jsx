import React, { useState, useEffect, useRef, useMemo } from 'react';
import { format, isSameDay, isToday, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AgendaEventCard from './AgendaEventCard';
import './WeeklyCalendar.css';

const SLOT_HEIGHT = 36;     // px por slot de 30 min
const SLOTS_PER_HOUR = 2;

function minutesFromMidnight(dateStr) {
  const d = new Date(dateStr);
  return d.getHours() * 60 + d.getMinutes();
}

function getNowTop(offsetMins = 0) {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  return ((mins - offsetMins) / 30) * SLOT_HEIGHT;
}

function WeeklyCalendar({ weekDays, tasks, selectedDay, onDaySelect, onSlotClick, onEventUpdate, onEventClick, viewMode = 'business' }) {
  const isBusiness = viewMode === 'business';

  // Dias e horas visíveis conforme o modo
  const displayDays = useMemo(() => {
    if (!isBusiness) return weekDays;
    return weekDays.filter(d => { const dow = d.getDay(); return dow >= 1 && dow <= 5; });
  }, [weekDays, isBusiness]);

  const START_HOUR = isBusiness ? 7 : 0;
  const END_HOUR = isBusiness ? 21 : 24;
  const DISPLAY_HOURS = END_HOUR - START_HOUR;
  const DISPLAY_SLOTS = DISPLAY_HOURS * SLOTS_PER_HOUR;
  const OFFSET_MINS = START_HOUR * 60;

  const [nowTop, setNowTop] = useState(() => getNowTop(OFFSET_MINS));
  const colRefs = useRef({});

  // Atualizar linha de hora atual a cada minuto e quando viewMode muda
  useEffect(() => {
    setNowTop(getNowTop(OFFSET_MINS));
    const timer = setInterval(() => setNowTop(getNowTop(OFFSET_MINS)), 60_000);
    return () => clearInterval(timer);
  }, [OFFSET_MINS]);

  // Scroll automático para o horário atual
  const bodyRef = useRef(null);
  useEffect(() => {
    if (bodyRef.current) {
      const currentNowTop = getNowTop(OFFSET_MINS);
      const scrollTo = Math.max(0, currentNowTop - 200);
      bodyRef.current.scrollTop = scrollTo;
    }
  }, [OFFSET_MINS]);

  // Agrupa tarefas por dia
  const tasksByDay = useMemo(() => {
    const map = {};
    for (const day of displayDays) {
      const key = format(day, 'yyyy-MM-dd');
      map[key] = tasks.filter(t => t.start_date && isSameDay(new Date(t.start_date), day));
    }
    return map;
  }, [tasks, displayDays]);

  const handleSlotClick = (day, slotIndex) => {
    const date = new Date(day);
    const actualSlot = slotIndex + START_HOUR * SLOTS_PER_HOUR;
    const hour = Math.floor(actualSlot / 2);
    const minute = (actualSlot % 2) * 30;
    date.setHours(hour, minute, 0, 0);
    if (onSlotClick) onSlotClick(date);
  };

  const isNowInWeek = displayDays.some(d => isToday(d));
  const isNowInRange = (() => {
    const h = new Date().getHours();
    return h >= START_HOUR && h < END_HOUR;
  })();

  return (
    <div className="weekly-calendar">
      {/* Header com dias da semana */}
      <div className="weekly-calendar__header" style={{ '--day-count': displayDays.length }}>
        <div className="weekly-calendar__header-gutter" />
        {displayDays.map((day, i) => {
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
        <div className="weekly-calendar__grid" style={{ '--day-count': displayDays.length }}>
          {/* Coluna de horas */}
          <div className="weekly-calendar__hour-gutter">
            {Array.from({ length: DISPLAY_HOURS }).map((_, i) => {
              const hour = START_HOUR + i;
              return (
                <div key={hour} className="weekly-calendar__hour-label">
                  {`${String(hour).padStart(2, '0')}:00`}
                </div>
              );
            })}
          </div>

          {/* Colunas de dias */}
          {displayDays.map((day, colIdx) => {
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
                {Array.from({ length: DISPLAY_SLOTS }).map((_, slotIdx) => (
                  <div
                    key={slotIdx}
                    className="weekly-calendar__slot"
                    onClick={() => handleSlotClick(day, slotIdx)}
                  />
                ))}

                {/* Linha de hora atual (apenas na coluna do dia atual e dentro do range visível) */}
                {isCurrentDay && isNowInWeek && isNowInRange && (
                  <div
                    className="weekly-calendar__now-line"
                    style={{ top: nowTop }}
                  />
                )}

                {/* Eventos posicionados absolutamente */}
                {dayTasks
                  .filter(t => {
                    if (!isBusiness) return true;
                    const sm = minutesFromMidnight(t.start_date);
                    return sm >= OFFSET_MINS && sm < END_HOUR * 60;
                  })
                  .map(task => {
                  const startMins = minutesFromMidnight(task.start_date);
                  const endMins = minutesFromMidnight(task.due_date);
                  const topPx = ((startMins - OFFSET_MINS) / 30) * SLOT_HEIGHT;
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
