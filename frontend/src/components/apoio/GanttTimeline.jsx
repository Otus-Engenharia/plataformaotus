import React, { useMemo, useState } from 'react';
import './GanttTimeline.css';

const KPI_COLORS = {
  vermelho: '#ef4444',
  azul: '#3b82f6',
  verde: '#22c55e',
  amarelo: '#f59e0b',
};

const DISCIPLINE_COLORS = {
  modelagem: { bg: '#dbeafe', text: '#1e40af' },
  'modelagem otus': { bg: '#dbeafe', text: '#1e40af' },
  bim: { bg: '#ede9fe', text: '#6d28d9' },
  'arquitetura executiva (bim)': { bg: '#ede9fe', text: '#6d28d9' },
  compatibilização: { bg: '#ffedd5', text: '#c2410c' },
  compatibilizacao: { bg: '#ffedd5', text: '#c2410c' },
  modelo: { bg: '#d1fae5', text: '#065f46' },
};

function getDisciplineColor(discipline) {
  if (!discipline) return { bg: '#f1f5f9', text: '#475569' };
  const lower = discipline.toLowerCase().trim();
  for (const [key, colors] of Object.entries(DISCIPLINE_COLORS)) {
    if (lower.includes(key)) return colors;
  }
  return { bg: '#f1f5f9', text: '#475569' };
}

const MODELAGEM_DISCIPLINES = ['modelagem'];

function parseDate(dateValue) {
  if (!dateValue) return null;
  try {
    let date;
    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'string') {
      if (dateValue.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
        date = new Date(dateValue);
      } else if (/^\d{2}\/\d{2}\/\d{4}/.test(dateValue)) {
        const [day, month, year] = dateValue.split('/');
        date = new Date(`${year}-${month}-${day}`);
      } else {
        date = new Date(dateValue);
      }
    } else if (typeof dateValue === 'object' && dateValue.value) {
      date = new Date(dateValue.value);
    } else {
      date = new Date(dateValue);
    }
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function formatDateShort(date) {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatWeekLabel(date) {
  const endOfWeek = new Date(date);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  return `${formatDateShort(date)} - ${formatDateShort(endOfWeek)}`;
}

function getDaysBetween(start, end) {
  const diffTime = end.getTime() - start.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isModelagemDiscipline(discipline) {
  if (!discipline) return false;
  const lower = discipline.toLowerCase().trim();
  return MODELAGEM_DISCIPLINES.some(d => lower.includes(d));
}

function formatDisplayDate(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// Number of left-panel columns
const LEFT_COLS = 5;

export default function GanttTimeline({ tarefas = [], weeksAhead = 4, skipInternalFilter = false }) {
  const [hoveredTask, setHoveredTask] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [hoveredRow, setHoveredRow] = useState(null);

  // Filter and sort tasks — when skipInternalFilter, parent already filtered by discipline
  const modelagemTarefas = useMemo(() => {
    return tarefas
      .filter(t => {
        const hasDates = parseDate(t.DataDeInicio || t.data_inicio)
          && parseDate(t.DataDeTermino || t.data_termino);
        if (!hasDates) return false;
        if (skipInternalFilter) return true;
        return isModelagemDiscipline(t.Disciplina || t.disciplina);
      })
      .sort((a, b) => {
        const da = parseDate(a.DataDeInicio || a.data_inicio);
        const db = parseDate(b.DataDeInicio || b.data_inicio);
        if (!da) return 1;
        if (!db) return -1;
        return da - db;
      });
  }, [tarefas, skipInternalFilter]);

  // Timeline calculation
  const { timelineStart, totalDays, dateColumns, isWeekMode, todayCol } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = getWeekStart(today);
    const end = new Date(start);
    end.setDate(end.getDate() + weeksAhead * 7);

    const days = getDaysBetween(start, end);
    const weekMode = weeksAhead > 4;

    const columns = [];
    let todayColumn = null;

    if (weekMode) {
      const current = new Date(start);
      let colIdx = 0;
      while (current < end) {
        const isCurrentWeek = getDaysBetween(current, today) >= 0 && getDaysBetween(current, today) < 7;
        if (isCurrentWeek) todayColumn = colIdx;
        columns.push({
          date: new Date(current),
          label: formatWeekLabel(current),
          isToday: isCurrentWeek,
        });
        current.setDate(current.getDate() + 7);
        colIdx++;
      }
    } else {
      const current = new Date(start);
      let colIdx = 0;
      while (current < end) {
        const isToday = current.toDateString() === today.toDateString();
        const isWeekend = current.getDay() === 0 || current.getDay() === 6;
        if (isToday) todayColumn = colIdx;
        columns.push({
          date: new Date(current),
          label: current.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
          isToday,
          isWeekend,
        });
        current.setDate(current.getDate() + 1);
        colIdx++;
      }
    }

    return {
      timelineStart: start,
      timelineEnd: end,
      totalDays: days,
      dateColumns: columns,
      isWeekMode: weekMode,
      todayCol: todayColumn,
    };
  }, [weeksAhead]);

  const getBarPosition = (task) => {
    const startDate = parseDate(task.DataDeInicio || task.data_inicio);
    const endDate = parseDate(task.DataDeTermino || task.data_termino);
    if (!startDate || !endDate) return null;

    const startOffset = getDaysBetween(timelineStart, startDate);
    const endOffset = getDaysBetween(timelineStart, endDate);

    if (isWeekMode) {
      const startCol = Math.max(0, Math.floor(startOffset / 7));
      const endCol = Math.min(dateColumns.length, Math.ceil((endOffset + 1) / 7));
      if (endCol <= 0 || startCol >= dateColumns.length) return null;
      return { start: Math.max(0, startCol) + LEFT_COLS + 1, end: endCol + LEFT_COLS + 1 };
    } else {
      if (endOffset < 0 || startOffset >= totalDays) return null;
      const clampedStart = Math.max(0, startOffset);
      const clampedEnd = Math.min(totalDays, endOffset + 1);
      return { start: clampedStart + LEFT_COLS + 1, end: clampedEnd + LEFT_COLS + 1 };
    }
  };

  const handleMouseEnter = (e, task) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ x: rect.left, y: rect.top - 10 });
    setHoveredTask(task);
  };

  const handleMouseLeave = () => {
    setHoveredTask(null);
  };

  if (modelagemTarefas.length === 0) {
    return (
      <div className="gantt-empty">
        <div className="gantt-empty__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="56" height="56">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <p className="gantt-empty__title">Nenhuma atividade encontrada</p>
        <p className="gantt-empty__subtitle">Nao ha tarefas de Modelagem/BIM no periodo selecionado</p>
      </div>
    );
  }

  const colCount = dateColumns.length;
  const totalCols = LEFT_COLS + colCount;

  return (
    <div className="gantt-container">
      <div
        className="gantt-grid"
        style={{ '--col-count': colCount, '--left-cols': LEFT_COLS, '--total-cols': totalCols }}
      >
        {/* ===== Header row ===== */}
        <div className="gantt-hdr gantt-hdr--tarefa">Tarefa</div>
        <div className="gantt-hdr gantt-hdr--time">Time</div>
        <div className="gantt-hdr gantt-hdr--projeto">Projeto</div>
        <div className="gantt-hdr gantt-hdr--data">Inicio</div>
        <div className="gantt-hdr gantt-hdr--data">Termino</div>
        {dateColumns.map((col, i) => (
          <div
            key={i}
            className={`gantt-hdr gantt-hdr--date ${col.isToday ? 'gantt-hdr--today' : ''} ${col.isWeekend ? 'gantt-hdr--weekend' : ''}`}
          >
            {col.label}
          </div>
        ))}

        {/* ===== Task rows ===== */}
        {modelagemTarefas.map((task, idx) => {
          const barPos = getBarPosition(task);
          const kpiColor = KPI_COLORS[(task.KPI || task.kpi || '').toLowerCase()] || '#94a3b8';
          const taskName = task.NomeDaTarefa || task.nome_tarefa || 'Tarefa';
          const discipline = task.Disciplina || task.disciplina || '';
          const discColor = getDisciplineColor(discipline);
          const project = task.project_name || task.projeto_nome || '';
          const time = task.nome_time || '';
          const isHovered = hoveredRow === idx;
          const hoverClass = isHovered ? 'gantt-cell--hovered' : '';

          return (
            <React.Fragment key={`task-${idx}`}>
              {/* Col 1: Tarefa */}
              <div
                className={`gantt-cell gantt-cell--tarefa ${hoverClass}`}
                title={taskName}
                onMouseEnter={() => setHoveredRow(idx)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <span
                  className="gantt-discipline-chip"
                  style={{ background: discColor.bg, color: discColor.text }}
                >
                  {discipline}
                </span>
                <div className="gantt-cell__task-row">
                  <span className="gantt-kpi-dot" style={{ background: kpiColor }} />
                  <span className="gantt-task-name">{taskName}</span>
                </div>
              </div>

              {/* Col 2: Time */}
              <div
                className={`gantt-cell gantt-cell--time ${hoverClass}`}
                title={time}
                onMouseEnter={() => setHoveredRow(idx)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {time}
              </div>

              {/* Col 3: Projeto */}
              <div
                className={`gantt-cell gantt-cell--projeto ${hoverClass}`}
                title={project}
                onMouseEnter={() => setHoveredRow(idx)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {project}
              </div>

              {/* Col 4: Inicio */}
              <div
                className={`gantt-cell gantt-cell--data ${hoverClass}`}
                onMouseEnter={() => setHoveredRow(idx)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {formatDisplayDate(task.DataDeInicio || task.data_inicio)}
              </div>

              {/* Col 5: Termino */}
              <div
                className={`gantt-cell gantt-cell--data ${hoverClass}`}
                onMouseEnter={() => setHoveredRow(idx)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {formatDisplayDate(task.DataDeTermino || task.data_termino)}
              </div>

              {/* Timeline columns */}
              <div
                className={`gantt-timeline-row ${isHovered ? 'gantt-timeline-row--hovered' : ''}`}
                style={{ gridColumn: `${LEFT_COLS + 1} / ${totalCols + 1}` }}
                onMouseEnter={() => setHoveredRow(idx)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {todayCol !== null && (
                  <div
                    className="gantt-today-line"
                    style={{ gridColumn: `${todayCol + 1} / ${todayCol + 2}` }}
                  />
                )}
                {barPos && (
                  <div
                    className="gantt-bar"
                    style={{
                      gridColumn: `${barPos.start - LEFT_COLS} / ${barPos.end - LEFT_COLS}`,
                      '--bar-color': kpiColor,
                    }}
                    onMouseEnter={(e) => handleMouseEnter(e, task)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <span className="gantt-bar__label">
                      {taskName.length > 30 ? taskName.substring(0, 30) + '...' : taskName}
                    </span>
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Tooltip */}
      {hoveredTask && (
        <div
          className="gantt-tooltip"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="gantt-tooltip__title">{hoveredTask.NomeDaTarefa || hoveredTask.nome_tarefa}</div>
          <div className="gantt-tooltip__row">
            <span>Projeto:</span> {hoveredTask.project_name || hoveredTask.projeto_nome}
          </div>
          <div className="gantt-tooltip__row">
            <span>Disciplina:</span> {hoveredTask.Disciplina || hoveredTask.disciplina}
          </div>
          <div className="gantt-tooltip__row">
            <span>Inicio:</span> {formatDisplayDate(hoveredTask.DataDeInicio || hoveredTask.data_inicio)}
          </div>
          <div className="gantt-tooltip__row">
            <span>Termino:</span> {formatDisplayDate(hoveredTask.DataDeTermino || hoveredTask.data_termino)}
          </div>
          <div className="gantt-tooltip__row">
            <span>KPI:</span>
            <span
              className="gantt-tooltip__kpi"
              style={{ color: KPI_COLORS[(hoveredTask.KPI || hoveredTask.kpi || '').toLowerCase()] || '#94a3b8' }}
            >
              {hoveredTask.KPI || hoveredTask.kpi || 'N/A'}
            </span>
          </div>
          {hoveredTask.nome_time && (
            <div className="gantt-tooltip__row">
              <span>Time:</span> {hoveredTask.nome_time}
            </div>
          )}
          {hoveredTask.lider && (
            <div className="gantt-tooltip__row">
              <span>Coordenador:</span> {hoveredTask.lider}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
