/**
 * Weekly Report Generator - Node.js port of Python report_system
 *
 * Ported from:
 *   - report_system/processors/data_processor.py
 *   - report_system/generators/html_report_generator.py
 *
 * Generates two HTML reports (client and team) from BigQuery/Smartsheet data
 * for weekly project status emails.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Remove diacritics (accents) from a string.
 * e.g. "não" -> "nao", "Coordenação" -> "Coordenacao"
 */
function removeDiacritics(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalize a status/text value: trim, lowercase, remove accents, collapse spaces.
 */
function normalizeText(value) {
  if (value === null || value === undefined) return '';
  let text = String(value).trim().toLowerCase();
  text = removeDiacritics(text);
  text = text.replace(/\s+/g, ' ');
  return text;
}

/**
 * Check whether a value is "empty" in the sense used throughout the codebase:
 * null, undefined, empty string, or one of the pandas-style sentinel strings.
 */
function isEmptyValue(val) {
  if (val === null || val === undefined) return true;
  const s = String(val).trim().toLowerCase();
  return s === '' || s === 'nan' || s === 'none' || s === 'nat';
}

/**
 * Safely get a value from an object trying multiple key names in order.
 */
function getField(obj, ...keys) {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null) return v;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Date utilities
// ---------------------------------------------------------------------------

const DATE_FORMATS = [
  // DD/MM/YYYY
  { re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, parse: (m) => new Date(+m[3], +m[2] - 1, +m[1]) },
  // DD/MM/YY
  { re: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, parse: (m) => new Date(2000 + +m[3], +m[2] - 1, +m[1]) },
  // YYYY-MM-DD (with optional T...)
  { re: /^(\d{4})-(\d{2})-(\d{2})/, parse: (m) => new Date(+m[1], +m[2] - 1, +m[3]) },
  // DD/MM (assume current year)
  { re: /^(\d{1,2})\/(\d{1,2})$/, parse: (m) => new Date(new Date().getFullYear(), +m[2] - 1, +m[1]) },
];

/**
 * Parse a date value (string, Date, or number) into a Date object.
 * Returns null on failure.
 */
function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  const str = String(value).trim();
  if (isEmptyValue(str)) return null;

  for (const fmt of DATE_FORMATS) {
    const m = str.match(fmt.re);
    if (m) {
      const d = fmt.parse(m);
      if (!isNaN(d.getTime())) return d;
    }
  }
  // Last resort: native parse
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Format a date as DD/MM.
 */
function formatDateShort(value) {
  const d = parseDate(value);
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

/**
 * Format a date as DD/MM/YYYY.
 */
function formatDateFull(value) {
  const d = parseDate(value);
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Format a start/end range as "dd/mm a dd/mm".
 */
function formatStartEndRange(startDate, endDate) {
  const startOk = !isEmptyValue(startDate);
  const endOk = !isEmptyValue(endDate);
  if (startOk && endOk) {
    const sf = formatDateShort(startDate);
    const ef = formatDateShort(endDate);
    if (sf && ef && sf !== ef) return `${sf} a ${ef}`;
    return sf || ef;
  }
  if (startOk) return formatDateShort(startDate);
  if (endOk) return formatDateShort(endDate);
  return '';
}

/**
 * Format a deadline (ISO-style string) as DD/MM/YYYY.
 */
function formatDeadlineDate(deadlineValue) {
  if (isEmptyValue(deadlineValue)) return '';
  const d = parseDate(deadlineValue);
  if (d) return formatDateFull(d);
  return String(deadlineValue).substring(0, 10);
}

/**
 * Strip time components from a Date (set to midnight).
 */
function startOfDay(d) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

/**
 * Get today at midnight.
 */
function today() {
  return startOfDay(new Date());
}

// ---------------------------------------------------------------------------
// Discipline helpers
// ---------------------------------------------------------------------------

/**
 * Check if a discipline name belongs to the client/Otus side.
 * Matches "cliente", "otus", "coordenacao/coordenacao" with partial matching.
 */
function isClientDiscipline(discipline) {
  if (!discipline) return false;
  const lower = String(discipline).trim().toLowerCase();
  const normalized = removeDiacritics(lower);
  return (
    lower.includes('cliente') ||
    lower.includes('otus') ||
    normalized.includes('coordenacao') ||
    lower.includes('coordenacao')
  );
}

/**
 * Check if a task has delay-related info filled in.
 */
function hasDelayInfo(task) {
  const delayKeys = [
    'Categoria de atraso',
    'Delay Category',
    'Motivo de atraso',
    'Motivo do atraso',
    'Delay Reason',
  ];
  for (const key of delayKeys) {
    const val = task[key];
    if (val !== null && val !== undefined && !isEmptyValue(val)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// CaminhoCriticoMarco removal filter helpers
// ---------------------------------------------------------------------------

const REMOVE_VALUES = [
  'int - remover relatorio',
  'int - remover relatório',
  'int-remover relatorio',
  'int-remover relatório',
  'remover relatorio',
  'remover relatório',
  'remover relatorios',
  'remover relatórios',
];

const CRITICAL_PATH_COLUMN_NAMES = [
  'Caminho critico - Marco',
  'CaminhoCriticoMarco',
];

function findCriticalPathColumn(taskKeys) {
  // First pass: exact normalized match
  for (const key of taskKeys) {
    const norm = normalizeText(key);
    for (const candidate of CRITICAL_PATH_COLUMN_NAMES) {
      if (norm === normalizeText(candidate)) return key;
    }
  }
  // Second pass: partial match
  for (const key of taskKeys) {
    const norm = normalizeText(key);
    if (norm.includes('caminho') && norm.includes('critico') && norm.includes('marco')) {
      return key;
    }
  }
  return null;
}

function shouldKeepTask(task, criticalPathColumn) {
  if (!criticalPathColumn) return true;
  const val = task[criticalPathColumn];
  if (isEmptyValue(val)) return true;
  const normalized = normalizeText(val);
  for (const removeVal of REMOVE_VALUES) {
    const removeNorm = normalizeText(removeVal);
    if (normalized === removeNorm || normalized.startsWith(removeNorm) || normalized.includes(removeNorm)) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// processData
// ---------------------------------------------------------------------------

/**
 * Process raw data from BigQuery into structured report data.
 *
 * @param {Object} rawData - { issues: Array, tasks: Array, disciplines: Array }
 *   - issues: Construflow issues (with status, status_y/status_x, name, priority, etc.)
 *   - tasks: Smartsheet tasks (with Status, Disciplina, dates, etc.)
 *   - disciplines: optional array of discipline names
 * @param {Object} options
 *   - clientDisciplines: string[] - discipline names to filter for client issues
 *   - scheduleDays: number - days ahead for schedule section (default 15)
 *   - sinceDate: Date|string - start of reporting period (default 7 days ago)
 *   - referenceDate: Date|string - reference date (default now)
 *   - projectId: string
 *   - projectName: string
 *   - clientName: string
 * @returns {Object} processedData suitable for generateHtml
 */
export function processData(rawData, options = {}) {
  const {
    clientDisciplines = [],
    scheduleDays = 15,
    sinceDate: sinceOpt,
    referenceDate: refOpt,
    projectId = '',
    projectName = 'Projeto',
    clientName = '',
  } = options;

  const issues = Array.isArray(rawData?.issues) ? rawData.issues : [];
  const tasks = Array.isArray(rawData?.tasks) ? rawData.tasks : [];

  const refDate = refOpt ? startOfDay(parseDate(refOpt) || new Date()) : today();
  let since = sinceOpt ? parseDate(sinceOpt) : null;
  if (since) since = startOfDay(since);
  else since = new Date(refDate.getTime() - 7 * 86400000);

  // ------------------------------------------------------------------
  // 1. Filter tasks: remove "INT - Remover Relatorio" entries
  // ------------------------------------------------------------------
  let filteredTasks = tasks;
  if (tasks.length > 0) {
    const sampleKeys = Object.keys(tasks[0]);
    const critCol = findCriticalPathColumn(sampleKeys);
    if (critCol) {
      filteredTasks = tasks.filter((t) => shouldKeepTask(t, critCol));
    }
  }

  // ------------------------------------------------------------------
  // 2. Process Construflow issues
  // ------------------------------------------------------------------
  // Filter active issues (status_x or status == 'active', status_y in ['todo','follow'])
  let activeIssues = [];
  for (const issue of issues) {
    const statusIssue = issue.status_x || issue.status || '';
    const statusDisc = issue.status_y || '';
    if (statusIssue === 'active' && (statusDisc === 'todo' || statusDisc === 'follow')) {
      activeIssues.push(issue);
    }
  }

  // Filter client issues from active issues
  const clientDisciplinesNorm = clientDisciplines.map((d) => normalizeText(d));
  let clientIssues = [];
  if (clientDisciplinesNorm.length > 0) {
    clientIssues = activeIssues.filter((issue) => {
      const issueDiscipline = normalizeText(issue.name || '');
      // Exact match
      if (clientDisciplinesNorm.includes(issueDiscipline)) return true;
      // Partial match
      for (const cd of clientDisciplinesNorm) {
        if (cd && issueDiscipline.includes(cd)) return true;
      }
      return false;
    });
    // Further filter: only todo status for client pendencies
    clientIssues = clientIssues.filter((i) => (i.status_y || '') === 'todo');
  }

  // Discipline counts
  const disciplineCounts = {};
  for (const issue of activeIssues) {
    const name = issue.name || 'Sem Disciplina';
    disciplineCounts[name] = (disciplineCounts[name] || 0) + 1;
  }

  // ------------------------------------------------------------------
  // 3. Process Smartsheet tasks
  // ------------------------------------------------------------------
  const allTasks = filteredTasks;

  // 3a. Delayed tasks
  const delayedTasks = [];
  for (const task of allTasks) {
    const statusNorm = normalizeText(task.Status || '');
    const temInfoAtraso = hasDelayInfo(task);

    let atrasadaPorData = false;
    if (statusNorm !== 'feito') {
      const endDateStr = getField(task, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date');
      const endDt = parseDate(endDateStr);
      if (endDt && startOfDay(endDt) < refDate) {
        atrasadaPorData = true;
      }
    }

    if (statusNorm === 'nao feito' || temInfoAtraso || atrasadaPorData) {
      delayedTasks.push(task);
    }
  }

  // 3b. Completed tasks - grouped by discipline
  const completedTeam = {};
  const completedClient = {};
  for (const task of allTasks) {
    const statusLower = String(task.Status || '').toLowerCase().trim();
    if (statusLower !== 'feito') continue;

    const endDateStr = getField(task, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date');
    const endDt = parseDate(endDateStr);
    if (endDt) {
      const endNorm = startOfDay(endDt);
      if (endNorm < since) continue; // before reporting period
    }

    const discipline = task.Disciplina || task.Discipline || 'Sem Disciplina';
    if (isClientDiscipline(discipline)) {
      if (!completedClient[discipline]) completedClient[discipline] = [];
      completedClient[discipline].push(task);
    } else {
      if (!completedTeam[discipline]) completedTeam[discipline] = [];
      completedTeam[discipline].push(task);
    }
  }

  // 3c. Delays split by client/team
  const delaysClient = [];
  const delaysTeam = [];
  for (const task of delayedTasks) {
    const discipline = task.Disciplina || task.Discipline || '';
    // Date period filter
    const endDateStr = getField(task, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date');
    const reprogDateStr = task['Data de Fim - Reprogramado Otus'] || '';
    let taskDate = parseDate(endDateStr) || parseDate(reprogDateStr);
    if (taskDate) {
      const taskDateNorm = startOfDay(taskDate);
      if (taskDateNorm < since || taskDateNorm > refDate) continue;
    }

    if (isClientDiscipline(discipline)) {
      delaysClient.push(task);
    } else {
      delaysTeam.push(task);
    }
  }

  // 3d. Schedule - client (flat list) and team (grouped by discipline)
  const futureCutoff = new Date(refDate.getTime() + scheduleDays * 86400000);

  const scheduleClient = [];
  const scheduleTeam = {};
  for (const task of allTasks) {
    if (!task || typeof task !== 'object') continue;
    const statusLower = String(task.Status || '').toLowerCase().trim();
    if (statusLower === 'feito') continue;

    const discipline = task.Disciplina || task.Discipline || 'Sem Disciplina';
    const taskStartStr = getField(task, 'Data Inicio', 'Data de Inicio', 'Data de Início', 'Start Date');
    const taskEndStr = getField(task, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date');

    if (!taskStartStr && !taskEndStr) continue;

    let inPeriod = false;
    const startDt = parseDate(taskStartStr);
    const endDt = parseDate(taskEndStr);

    if (startDt) {
      const sn = startOfDay(startDt);
      if (sn >= refDate && sn <= futureCutoff) inPeriod = true;
    }
    if (endDt) {
      const en = startOfDay(endDt);
      if (en >= refDate && en <= futureCutoff) inPeriod = true;
    }
    if (!inPeriod) continue;

    if (isClientDiscipline(discipline)) {
      scheduleClient.push(task);
    } else {
      if (!scheduleTeam[discipline]) scheduleTeam[discipline] = { a_iniciar: [], programadas: [] };
      if (statusLower === 'a fazer') {
        scheduleTeam[discipline].a_iniciar.push(task);
      } else {
        scheduleTeam[discipline].programadas.push(task);
      }
    }
  }

  // Sort client schedule by end date
  scheduleClient.sort((a, b) => {
    const da = parseDate(getField(a, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date'));
    const db = parseDate(getField(b, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date'));
    return (da?.getTime() || Infinity) - (db?.getTime() || Infinity);
  });

  // ------------------------------------------------------------------
  // Build result
  // ------------------------------------------------------------------
  const totalCompleted =
    Object.values(completedClient).reduce((s, a) => s + a.length, 0) +
    Object.values(completedTeam).reduce((s, a) => s + a.length, 0);
  const totalScheduleTeam = Object.values(scheduleTeam).reduce(
    (s, d) => s + d.a_iniciar.length + d.programadas.length,
    0,
  );

  return {
    projectId,
    projectName,
    clientName,
    referenceDate: refDate.toISOString(),
    sinceDate: since.toISOString(),
    scheduleDays,
    construflow: {
      activeIssues,
      clientIssues,
      disciplineCounts,
      totalActive: activeIssues.length,
      totalClient: clientIssues.length,
    },
    smartsheet: {
      allTasks,
      delayedTasks,
      completedClient,
      completedTeam,
      delaysClient,
      delaysTeam,
      scheduleClient,
      scheduleTeam,
    },
    summary: {
      totalTasks: allTasks.length,
      totalDelayed: delayedTasks.length,
      totalCompleted,
      totalActiveIssues: activeIssues.length,
      totalClientIssues: clientIssues.length,
      delaysClient: delaysClient.length,
      delaysTeam: delaysTeam.length,
      scheduleClient: scheduleClient.length,
      scheduleTeam: totalScheduleTeam,
    },
  };
}

// ---------------------------------------------------------------------------
// generateHtml
// ---------------------------------------------------------------------------

// Otus color palette
const OTUS = {
  black: '#1a1a1a',
  orange: '#f5a623',
  grayDark: '#2d2d2d',
  grayLight: '#f5f5f5',
  text: '#333333',
  textLight: '#666666',
};

/**
 * Escape HTML special characters.
 */
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// -- Section generators ---------------------------------------------------

function _generatePendenciasSection(issues, projectId) {
  if (!issues || issues.length === 0) {
    return `<p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:#1a1a1a;">\u2713 Sem pend\u00eancias das disciplinas <strong>Cliente</strong> e <strong>Otus</strong> nesta semana.</p>`;
  }

  const colorHigh = '#1a1a1a';
  const colorMedium = '#666666';
  const colorLow = '#999999';
  const accent = OTUS.orange;

  // Group by discipline then by priority
  const byDiscipline = {};
  for (const issue of issues) {
    const discipline = issue.name || 'Sem Disciplina';
    if (!byDiscipline[discipline]) byDiscipline[discipline] = { alta: [], media: [], baixa: [] };

    const priority = String(issue.priority || '').toLowerCase();
    const item = {
      code: issue.code || '',
      title: issue.title || 'Sem titulo',
      id: issue.id || '',
      deadline: issue.deadline || '',
    };

    if (['high', 'alta', '3'].includes(priority)) byDiscipline[discipline].alta.push(item);
    else if (['medium', 'media', 'media', '2'].includes(priority)) byDiscipline[discipline].media.push(item);
    else byDiscipline[discipline].baixa.push(item);
  }

  let html = '';
  for (const [discipline, priorities] of Object.entries(byDiscipline)) {
    if (!priorities.alta.length && !priorities.media.length && !priorities.baixa.length) continue;

    html += `<div style="margin-bottom:24px;"><p style="margin:0 0 12px;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #eee;padding-bottom:6px;">${esc(discipline)}</p>`;

    // Helper to render priority group
    const renderPriorityGroup = (items, label, pColor, fontSize, linkColor, bgStyle, borderStyle) => {
      if (!items.length) return '';
      let s = `<div style="margin-bottom:16px;padding-left:12px;">`;
      s += `<p style="margin:0 0 8px;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;color:${pColor};text-transform:uppercase;letter-spacing:1px;${borderStyle}display:inline-block;">${label}</p>`;
      s += `<div style="padding-left:0;">`;
      for (const item of items) {
        const url = `https://app.construflow.com.br/workspace/project/${projectId}/issues?issueId=${item.id}`;
        const issueCode = item.code || item.id || '';
        let deadlineHtml = '';
        if (!isEmptyValue(item.deadline)) {
          const deadlineDateStr = formatDeadlineDate(item.deadline);
          if (deadlineDateStr) {
            deadlineHtml = `<span style="margin-left:8px;font-family:'Montserrat',sans-serif;font-size:11px;color:${accent};font-weight:600;background:#fff3e0;padding:2px 8px;border-radius:3px;">\u23F0 ${deadlineDateStr}</span>`;
          }
        }
        const codeFontSize = label === 'Prioridade Alta' ? '11px' : '10px';
        const linkText = `\uD83D\uDD17 <span style="font-family:'Montserrat',sans-serif;font-size:${codeFontSize};color:${accent};font-weight:600;background:#fff3e0;padding:2px 6px;border-radius:3px;margin-right:8px;">${esc(issueCode)}</span>${esc(item.title)}`;
        s += `<p style="margin:0 0 ${label === 'Prioridade Baixa' ? '6' : '8'}px;font-family:'Source Sans Pro',sans-serif;font-size:${fontSize};color:${linkColor};line-height:1.7;${bgStyle}"><a href="${url}" style="color:${linkColor};text-decoration:underline;${label === 'Prioridade Alta' ? 'font-weight:500;border-bottom:1px solid ' + accent + ';' : 'border-bottom:1px solid ' + accent + ';'}">${linkText}</a>${deadlineHtml}</p>`;
      }
      s += `</div></div>`;
      return s;
    };

    html += renderPriorityGroup(
      priorities.alta,
      'Prioridade Alta',
      colorHigh,
      '14px',
      '#1a1a1a',
      `padding:8px 12px;background:#f8f8f8;border-radius:4px;border-left:3px solid ${accent};`,
      `border-bottom:2px solid ${colorHigh};padding-bottom:4px;`,
    );
    html += renderPriorityGroup(
      priorities.media,
      'Prioridade M\u00e9dia',
      colorMedium,
      '14px',
      '#444',
      `padding:6px 12px;border-left:2px solid #ddd;`,
      `border-bottom:1px solid #ddd;padding-bottom:4px;`,
    );
    html += renderPriorityGroup(
      priorities.baixa,
      'Prioridade Baixa',
      colorLow,
      '13px',
      '#666',
      `padding-left:12px;`,
      ``,
    );

    html += `</div>`;
  }

  return html;
}

function _generateConcluidasSection(completed, isClientReport) {
  if (!completed || Object.keys(completed).length === 0) {
    if (isClientReport) {
      return `<p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:#666;">\u2713 Nenhuma atividade conclu\u00edda das disciplinas <strong>Cliente</strong> e <strong>Otus</strong> no per\u00edodo (\u00faltimos 7 dias).</p>`;
    }
    return `<p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:#666;">\u2713 Nenhuma atividade conclu\u00edda no per\u00edodo (\u00faltimos 7 dias).</p>`;
  }

  let html = '';
  for (const [discipline, tasks] of Object.entries(completed)) {
    html += `<div style="margin-bottom:20px;"><p style="margin:0 0 10px;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #eee;padding-bottom:6px;">${esc(discipline)}</p>`;

    for (const task of tasks) {
      const dateStr = formatDateShort(getField(task, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date'));
      const name = getField(task, 'Nome da Tarefa', 'Task Name') || '';
      const observacaoOtus = getField(task, 'Observacao Otus', 'Observação Otus') || '';

      html += `<div style="margin-bottom:8px;padding-left:12px;">`;
      html += `<p style="margin:0 0 4px;font-family:'Source Sans Pro',sans-serif;font-size:13px;color:#444;line-height:1.6;"><span style="font-family:'Montserrat',sans-serif;font-size:11px;color:#1a1a1a;font-weight:600;background:#f5f5f5;padding:2px 6px;border-radius:3px;margin-right:8px;">${esc(dateStr)}</span>${esc(name)}</p>`;

      if (!isEmptyValue(observacaoOtus)) {
        html += `<p style="margin:4px 0 0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:${OTUS.orange};font-style:italic;padding-left:20px;"><span style="font-weight:600;color:${OTUS.orange};">Observa\u00e7\u00e3o Otus:</span> ${esc(observacaoOtus)}</p>`;
      }

      html += `</div>`;
    }

    html += `</div>`;
  }

  return html;
}

function _generateAtrasosClientSection(delays) {
  if (!delays || delays.length === 0) {
    return `<p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:#1a1a1a;">\u2713 Nenhum atraso identificado das disciplinas <strong>Cliente</strong> e <strong>Otus</strong> no per\u00edodo.</p>`;
  }

  let html = '';
  for (const task of delays) {
    const discipline = task.Disciplina || task.Discipline || 'Sem Disciplina';
    const name = getField(task, 'Nome da Tarefa', 'Task Name') || '';
    const prevDate = formatDateShort(getField(task, 'Data de Fim - Reprogramado Otus', 'Baseline End'));
    const newDate = formatDateShort(getField(task, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date'));
    const motivo = getField(task, 'Motivo de atraso', 'Delay Reason') || '';
    const observacaoOtus = getField(task, 'Observacao Otus', 'Observação Otus') || '';

    html += `<div style="margin-bottom:14px;padding:14px 16px;background:#fafafa;border-radius:4px;border-left:3px solid #1a1a1a;">`;
    html += `<p style="margin:0;font-family:'Montserrat',sans-serif;font-size:10px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:1px;">${esc(discipline)}</p>`;
    html += `<p style="margin:6px 0 0;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:#1a1a1a;font-weight:500;">${esc(name)}</p>`;
    html += `<p style="margin:8px 0 0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:#666;">`;
    html += `<span style="text-decoration:line-through;color:#999;">${esc(prevDate)}</span>`;
    html += `<span style="margin:0 6px;color:#ccc;">\u2192</span>`;
    html += `<span style="font-family:'Montserrat',sans-serif;font-weight:600;color:#1a1a1a;background:${OTUS.orange};padding:2px 8px;border-radius:3px;">${esc(newDate)}</span>`;
    html += `</p>`;

    if (!isEmptyValue(motivo)) {
      html += `<p style="margin:8px 0 0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:#dc2626;font-style:italic;border-top:1px solid #eee;padding-top:8px;"><span style="font-weight:600;color:#dc2626;">Motivo:</span> ${esc(motivo)}</p>`;
    }
    if (!isEmptyValue(observacaoOtus)) {
      html += `<p style="margin:8px 0 0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:${OTUS.orange};font-style:italic;border-top:1px solid #eee;padding-top:8px;"><span style="font-weight:600;color:${OTUS.orange};">Observa\u00e7\u00e3o Otus:</span> ${esc(observacaoOtus)}</p>`;
    }

    html += `</div>`;
  }

  return html;
}

function _generateAtrasosTeamSection(delays) {
  if (!delays || delays.length === 0) {
    return `<p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:#1a1a1a;">\u2713 Nenhum atraso identificado no per\u00edodo.</p>`;
  }

  // Group by discipline
  const byDiscipline = {};
  for (const task of delays) {
    const discipline = task.Disciplina || task.Discipline || 'Sem Disciplina';
    if (!byDiscipline[discipline]) byDiscipline[discipline] = [];
    byDiscipline[discipline].push(task);
  }

  let html = '';
  for (const [discipline, tasks] of Object.entries(byDiscipline)) {
    if (!tasks.length) continue;

    html += `<div style="margin-bottom:20px;"><p style="margin:0 0 12px;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #eee;padding-bottom:6px;">${esc(discipline)}</p>`;

    for (const task of tasks) {
      const name = getField(task, 'Nome da Tarefa', 'Task Name') || '';
      const prevDate = formatDateShort(task['Data de Fim - Reprogramado Otus'] || '');
      const newDate = formatDateShort(getField(task, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date'));
      const motivo = getField(task, 'Motivo de atraso', 'Delay Reason') || '';
      const observacaoOtus = getField(task, 'Observacao Otus', 'Observação Otus') || '';

      html += `<div style="margin:0 0 14px;padding:12px 14px;background:#fafafa;border-radius:4px;border-left:3px solid ${OTUS.orange};">`;
      html += `<p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:#1a1a1a;font-weight:500;">${esc(name)}</p>`;
      html += `<p style="margin:6px 0 0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:#666;">`;
      html += `<span style="text-decoration:line-through;color:#999;">${esc(prevDate)}</span>`;
      html += `<span style="margin:0 6px;color:#ccc;">\u2192</span>`;
      html += `<span style="font-family:'Montserrat',sans-serif;font-weight:600;color:#1a1a1a;background:${OTUS.orange};padding:2px 8px;border-radius:3px;">${esc(newDate)}</span>`;
      html += `</p>`;

      if (!isEmptyValue(motivo)) {
        html += `<p style="margin:8px 0 0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:#dc2626;font-style:italic;border-top:1px solid #eee;padding-top:8px;"><span style="font-weight:600;color:#dc2626;">Motivo:</span> ${esc(motivo)}</p>`;
      }
      if (!isEmptyValue(observacaoOtus)) {
        html += `<p style="margin:8px 0 0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:${OTUS.orange};font-style:italic;border-top:1px solid #eee;padding-top:8px;"><span style="font-weight:600;color:${OTUS.orange};">Observa\u00e7\u00e3o Otus:</span> ${esc(observacaoOtus)}</p>`;
      }

      html += `</div>`;
    }

    html += `</div>`;
  }

  return html;
}

function _generateCronogramaClientSection(schedule, ganttUrl, disciplinaUrl, scheduleDays) {
  const days = scheduleDays && scheduleDays > 0 ? scheduleDays : 15;

  if (!schedule || schedule.length === 0) {
    return `<p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:#666;">\u2713 Nenhuma atividade prevista das disciplinas <strong>Cliente</strong> e <strong>Otus</strong> para os pr\u00f3ximos ${days} dias.</p>`;
  }

  // Group by discipline, split a_iniciar / programadas
  const byDiscipline = {};
  for (const task of schedule) {
    if (!task || typeof task !== 'object') continue;
    const discipline = task.Disciplina || task.Discipline || 'Sem Disciplina';
    if (!byDiscipline[discipline]) byDiscipline[discipline] = { a_iniciar: [], programadas: [] };
    const status = String(task.Status || '').toLowerCase().trim();
    if (status === 'a fazer') byDiscipline[discipline].a_iniciar.push(task);
    else byDiscipline[discipline].programadas.push(task);
  }

  let html = '';
  for (const [discipline, categories] of Object.entries(byDiscipline)) {
    if (!categories.a_iniciar.length && !categories.programadas.length) continue;

    html += `<div style="margin-bottom:24px;"><p style="margin:0 0 14px;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #eee;padding-bottom:6px;">${esc(discipline)}</p>`;

    if (categories.a_iniciar.length) {
      html += `<p style="margin:0 0 8px;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:600;color:${OTUS.orange};text-transform:uppercase;letter-spacing:1px;">\u25CF A Iniciar</p>`;
      for (const task of categories.a_iniciar) {
        const startDate = getField(task, 'Data Inicio', 'Data de Inicio', 'Data de Início', 'Start Date');
        const endDate = getField(task, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date');
        const dateStr = formatStartEndRange(startDate, endDate);
        const name = getField(task, 'Nome da Tarefa', 'Task Name') || '';
        const observacaoOtus = getField(task, 'Observacao Otus', 'Observação Otus') || '';

        html += `<div style="margin-bottom:6px;padding-left:16px;">`;
        html += `<p style="margin:0 0 4px;font-family:'Source Sans Pro',sans-serif;font-size:13px;color:#444;line-height:1.6;"><span style="font-family:'Montserrat',sans-serif;font-size:11px;color:#1a1a1a;font-weight:600;background:#f5f5f5;padding:2px 6px;border-radius:3px;margin-right:8px;">${esc(dateStr)}</span>${esc(name)}</p>`;
        if (!isEmptyValue(observacaoOtus)) {
          html += `<p style="margin:4px 0 0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:${OTUS.orange};font-style:italic;padding-left:20px;"><span style="font-weight:600;color:${OTUS.orange};">Observa\u00e7\u00e3o Otus:</span> ${esc(observacaoOtus)}</p>`;
        }
        html += `</div>`;
      }
    }

    if (categories.programadas.length) {
      html += `<p style="margin:14px 0 8px;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:1px;">\u25CF Entregas Programadas</p>`;
      for (const task of categories.programadas) {
        const dateStr = formatDateShort(getField(task, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date'));
        const name = getField(task, 'Nome da Tarefa', 'Task Name') || '';
        const observacaoOtus = getField(task, 'Observacao Otus', 'Observação Otus') || '';

        html += `<div style="margin-bottom:6px;padding-left:16px;">`;
        html += `<p style="margin:0 0 4px;font-family:'Source Sans Pro',sans-serif;font-size:13px;color:#666;line-height:1.6;"><span style="font-family:'Montserrat',sans-serif;font-size:11px;color:#666;font-weight:500;background:#f5f5f5;padding:2px 6px;border-radius:3px;margin-right:8px;">${esc(dateStr)}</span>${esc(name)}</p>`;
        if (!isEmptyValue(observacaoOtus)) {
          html += `<p style="margin:4px 0 0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:${OTUS.orange};font-style:italic;padding-left:20px;"><span style="font-weight:600;color:${OTUS.orange};">Observa\u00e7\u00e3o Otus:</span> ${esc(observacaoOtus)}</p>`;
        }
        html += `</div>`;
      }
    }

    html += `</div>`;
  }

  return html;
}

function _generateCronogramaTeamSection(schedule) {
  if (!schedule || Object.keys(schedule).length === 0) {
    return `<p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:#666;">Nenhuma atividade prevista para as pr\u00f3ximas semanas.</p>`;
  }

  let html = '';
  for (const [discipline, categories] of Object.entries(schedule)) {
    html += `<div style="margin-bottom:24px;"><p style="margin:0 0 14px;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #eee;padding-bottom:6px;">${esc(discipline)}</p>`;

    if (categories.a_iniciar && categories.a_iniciar.length) {
      html += `<p style="margin:0 0 8px;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:600;color:${OTUS.orange};text-transform:uppercase;letter-spacing:1px;">\u25CF A Iniciar</p>`;
      for (const task of categories.a_iniciar) {
        const startDate = getField(task, 'Data Inicio', 'Data de Inicio', 'Data de Início', 'Start Date');
        const endDate = getField(task, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date');
        const dateStr = formatStartEndRange(startDate, endDate);
        const name = getField(task, 'Nome da Tarefa', 'Task Name') || '';
        const observacaoOtus = getField(task, 'Observacao Otus', 'Observação Otus') || '';

        html += `<div style="margin-bottom:6px;padding-left:16px;">`;
        html += `<p style="margin:0 0 4px;font-family:'Source Sans Pro',sans-serif;font-size:13px;color:#444;line-height:1.6;"><span style="font-family:'Montserrat',sans-serif;font-size:11px;color:#1a1a1a;font-weight:600;background:#f5f5f5;padding:2px 6px;border-radius:3px;margin-right:8px;">${esc(dateStr)}</span>${esc(name)}</p>`;
        if (!isEmptyValue(observacaoOtus)) {
          html += `<p style="margin:4px 0 0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:${OTUS.orange};font-style:italic;padding-left:20px;"><span style="font-weight:600;color:${OTUS.orange};">Observa\u00e7\u00e3o Otus:</span> ${esc(observacaoOtus)}</p>`;
        }
        html += `</div>`;
      }
    }

    if (categories.programadas && categories.programadas.length) {
      html += `<p style="margin:14px 0 8px;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:1px;">\u25CF Entregas Programadas</p>`;
      for (const task of categories.programadas) {
        const dateStr = formatDateShort(getField(task, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date'));
        const name = getField(task, 'Nome da Tarefa', 'Task Name') || '';
        const observacaoOtus = getField(task, 'Observacao Otus', 'Observação Otus') || '';

        html += `<div style="margin-bottom:6px;padding-left:16px;">`;
        html += `<p style="margin:0 0 4px;font-family:'Source Sans Pro',sans-serif;font-size:13px;color:#666;line-height:1.6;"><span style="font-family:'Montserrat',sans-serif;font-size:11px;color:#666;font-weight:500;background:#f5f5f5;padding:2px 6px;border-radius:3px;margin-right:8px;">${esc(dateStr)}</span>${esc(name)}</p>`;
        if (!isEmptyValue(observacaoOtus)) {
          html += `<p style="margin:4px 0 0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:${OTUS.orange};font-style:italic;padding-left:20px;"><span style="font-weight:600;color:${OTUS.orange};">Observa\u00e7\u00e3o Otus:</span> ${esc(observacaoOtus)}</p>`;
        }
        html += `</div>`;
      }
    }

    html += `</div>`;
  }

  return html;
}

// -- Base HTML template ---------------------------------------------------

function _generateProjectImageHtml(imageBase64, projectName) {
  if (imageBase64) {
    return `<img src="${imageBase64}" alt="${esc(projectName)}" style="width:140px;height:140px;object-fit:cover;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.2);" />`;
  }
  return `<div style="width:140px;height:140px;background:rgba(255,255,255,0.05);border-radius:12px;border:2px dashed rgba(255,255,255,0.15);display:inline-block;"></div>`;
}

function _generateBaseHtml({
  projectName,
  subtitle,
  date,
  greeting,
  sections,
  showDashboardButton,
  projectId,
  headerColor,
  reportType,
  projectImageBase64,
  ganttUrl,
  disciplinaUrl,
  logoBase64,
}) {
  // Build sections HTML
  let sectionsHtml = '';
  for (const section of sections) {
    const isOpen = section.open ? 'open' : '';
    const badgeColor = section.count > 0 ? OTUS.orange : '#4ade80';

    sectionsHtml += `
            <details ${isOpen} style="margin:0 0 12px;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
                <summary style="padding:16px 20px;cursor:pointer;font-family:'Montserrat',sans-serif;font-size:14px;font-weight:600;color:${OTUS.black};background:#fafafa;display:flex;align-items:center;gap:12px;">
                    <span style="flex:1;">${section.title}</span>
                    <span style="display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;background:${badgeColor};color:#ffffff;border-radius:6px;font-size:12px;font-weight:600;padding:0 8px;">${section.count}</span>
                    <span class="chevron" style="color:#999;font-size:10px;">\u25BC</span>
                </summary>
                <div style="padding:20px;background:#ffffff;font-family:'Source Sans Pro',sans-serif;">${section.content}</div>
            </details>`;
  }

  // Dashboard button (client only)
  let dashboardButton = '';
  if (showDashboardButton) {
    dashboardButton = `
                    <tr>
                        <td style="padding:0 32px 32px;">
                            <a href="https://otus.datotecnologia.com.br/grupos" style="display:block;padding:14px 24px;background:${OTUS.orange};color:${OTUS.black};text-decoration:none;border-radius:8px;font-family:'Montserrat',sans-serif;font-size:13px;font-weight:600;text-align:center;">Acessar Dashboard de Indicadores</a>
                        </td>
                    </tr>`;
  }

  const construflowUrl = projectId
    ? `https://app.construflow.com.br/workspace/project/${projectId}/issues`
    : 'https://app.construflow.com.br';

  // Footer buttons
  let footerButtons = '<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr nowrap>';
  if (ganttUrl) {
    footerButtons += `<td nowrap style="padding-right:8px;vertical-align:middle;"><a href="${ganttUrl}" style="display:inline-block;padding:10px 16px;background:${OTUS.black};color:#ffffff;text-decoration:none;border-radius:6px;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:600;white-space:nowrap;">Cronograma</a></td>`;
  }
  if (disciplinaUrl) {
    footerButtons += `<td nowrap style="padding-right:8px;vertical-align:middle;"><a href="${disciplinaUrl}" style="display:inline-block;padding:10px 16px;background:#ffffff;color:${OTUS.text};text-decoration:none;border-radius:6px;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:600;border:1px solid #e0e0e0;white-space:nowrap;">Relat\u00f3rio Disciplinas</a></td>`;
  }
  footerButtons += `<td nowrap style="padding-right:8px;vertical-align:middle;"><a href="${construflowUrl}" style="display:inline-block;padding:10px 16px;background:${OTUS.black};color:#ffffff;text-decoration:none;border-radius:6px;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:600;white-space:nowrap;">Acessar Construflow</a></td>`;
  footerButtons += `<td nowrap style="vertical-align:middle;"><a href="https://docs.google.com/forms/d/e/1FAIpQLSdc4k3NuH2Eu0GM7uBGJ2_Fq5iscxwG-99Sks6P5ho6AZyi0w/viewform" style="display:inline-block;padding:10px 16px;background:#ffffff;color:${OTUS.text};text-decoration:none;border-radius:6px;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:600;border:1px solid #e0e0e0;white-space:nowrap;">Enviar Feedback</a></td>`;
  footerButtons += '</tr></table>';

  // Logo HTML
  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" alt="Otus" style="height:32px;width:auto;" />`
    : `<span style="font-family:'Montserrat',sans-serif;font-size:18px;font-weight:700;color:${OTUS.black};">OTUS</span>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relat\u00f3rio - ${esc(projectName)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Source+Sans+Pro:wght@400;600&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; }
        details summary::-webkit-details-marker { display: none; }
        details summary { list-style: none; }
        details[open] summary .chevron { transform: rotate(180deg); }
        .chevron { transition: transform 0.2s ease; display: inline-block; }
    </style>
</head>
<body style="margin:0;padding:0;background:${OTUS.grayLight};font-family:'Source Sans Pro',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${OTUS.text};">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${OTUS.grayLight};">
        <tr>
            <td align="center" style="padding:40px 20px;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:620px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

                    <!-- BARRA SUPERIOR BRANCA COM LOGO -->
                    <tr>
                        <td style="background:#ffffff;padding:20px 32px;border-bottom:3px solid ${OTUS.orange};">
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td style="vertical-align:middle;">
                                        ${logoHtml}
                                    </td>
                                    <td align="right" style="vertical-align:middle;">
                                        <span style="font-family:'Source Sans Pro',sans-serif;font-size:12px;color:${OTUS.textLight};">${esc(date)}</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- HEADER HERO COM INFORMACOES -->
                    <tr>
                        <td style="background:linear-gradient(135deg, ${OTUS.black} 0%, #2d2d2d 100%);padding:32px;">
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <!-- Coluna Esquerda: Informacoes -->
                                    <td style="vertical-align:top;width:60%;">
                                        <!-- Cliente -->
                                        <p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:10px;color:${OTUS.orange};text-transform:uppercase;letter-spacing:2px;font-weight:600;">Cliente</p>
                                        <p style="margin:4px 0 0;font-family:'Montserrat',sans-serif;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;line-height:1.1;">${esc(subtitle)}</p>

                                        <!-- Projeto -->
                                        <p style="margin:20px 0 0;font-family:'Source Sans Pro',sans-serif;font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:2px;">Projeto</p>
                                        <p style="margin:4px 0 0;font-family:'Montserrat',sans-serif;font-size:16px;font-weight:500;color:rgba(255,255,255,0.9);">${esc(projectName)}</p>

                                        <!-- Tipo de Relatorio -->
                                        <table cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
                                            <tr>
                                                <td style="background:${OTUS.orange};padding:8px 16px;border-radius:20px;">
                                                    <span style="font-family:'Montserrat',sans-serif;font-size:11px;font-weight:600;color:${OTUS.black};text-transform:uppercase;letter-spacing:0.5px;">${esc(reportType)}</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                    <!-- Coluna Direita: Espaco para imagem -->
                                    <td style="vertical-align:middle;width:40%;text-align:right;">
                                        ${_generateProjectImageHtml(projectImageBase64, projectName)}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- SAUDACAO -->
                    <tr>
                        <td style="padding:24px 40px;">
                            <p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:15px;color:${OTUS.text};line-height:1.7;">${greeting}</p>
                        </td>
                    </tr>

                    <!-- SECOES -->
                    <tr>
                        <td style="padding:0 32px 32px;">
                            ${sectionsHtml}
                        </td>
                    </tr>

                    ${dashboardButton}

                    <!-- ENCERRAMENTO -->
                    <tr>
                        <td style="padding:0 40px 32px;">
                            <p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:${OTUS.textLight};line-height:1.7;">Fico \u00e0 disposi\u00e7\u00e3o para esclarecimentos.</p>
                        </td>
                    </tr>

                    <!-- RODAPE -->
                    <tr>
                        <td style="padding:20px 32px;background:${OTUS.grayLight};border-top:1px solid #e0e0e0;">
                            ${footerButtons}
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public: generateHtml
// ---------------------------------------------------------------------------

/**
 * Generate client and team HTML reports from processed data.
 *
 * @param {Object} processedData - output of processData()
 * @param {Object} options
 *   - projectName: string (override)
 *   - clientName: string (override)
 *   - hideDashboard: boolean - hide dashboard button on client report
 *   - ganttUrl: string - URL for Gantt chart link
 *   - disciplinaUrl: string - URL for discipline report link
 *   - projectImageBase64: string - base64 project image
 *   - logoBase64: string - base64 logo (data URI)
 * @returns {{ clientHtml: string, teamHtml: string }}
 */
export function generateHtml(processedData, options = {}) {
  const {
    projectName: nameOverride,
    clientName: clientOverride,
    hideDashboard = false,
    ganttUrl = null,
    disciplinaUrl = null,
    projectImageBase64 = null,
    logoBase64 = null,
  } = options;

  const projectName = nameOverride || processedData.projectName || 'Projeto';
  const clientName = clientOverride || processedData.clientName || projectName;
  const projectId = processedData.projectId || '';
  const scheduleDays = processedData.scheduleDays || 15;

  const todayStr = formatDateFull(new Date());

  const sm = processedData.smartsheet || {};
  const cf = processedData.construflow || {};

  // -- Client report --
  const clientIssues = cf.clientIssues || [];
  const delaysClient = sm.delaysClient || [];
  const scheduleClient = sm.scheduleClient || [];
  const completedClient = sm.completedClient || {};

  const countPendencias = clientIssues.length;
  const countAtrasosClient = delaysClient.length;
  const countCronogramaClient = scheduleClient.length;
  const countConcluidasClient = Object.values(completedClient).reduce((s, a) => s + a.length, 0);

  const pendenciasHtml = _generatePendenciasSection(clientIssues, projectId);
  const concluidasClientHtml = _generateConcluidasSection(completedClient, true);
  const atrasosClientHtml = _generateAtrasosClientSection(delaysClient);
  const cronogramaClientHtml = _generateCronogramaClientSection(scheduleClient, ganttUrl, disciplinaUrl, scheduleDays);

  const clientHtml = _generateBaseHtml({
    projectName,
    subtitle: clientName,
    date: todayStr,
    greeting: 'Prezados,<br>Segue o status atualizado do projeto para esta semana.',
    sections: [
      {
        title: 'Pend\u00eancias do Cliente',
        count: countPendencias,
        color: countPendencias > 0 ? '#dc2626' : '#16a34a',
        content: pendenciasHtml,
        open: true,
      },
      {
        title: 'Atividades Conclu\u00eddas',
        count: countConcluidasClient,
        color: '#16a34a',
        content: concluidasClientHtml,
        open: false,
      },
      {
        title: 'Atrasos e Desvios',
        count: countAtrasosClient,
        color: countAtrasosClient > 0 ? '#dc2626' : '#16a34a',
        content: atrasosClientHtml,
        open: false,
      },
      {
        title: 'Cronograma',
        count: countCronogramaClient,
        color: '#64748b',
        content: cronogramaClientHtml,
        open: false,
      },
    ],
    showDashboardButton: !hideDashboard,
    projectId,
    headerColor: '#0f172a',
    reportType: 'Relat\u00f3rio Cliente',
    projectImageBase64,
    ganttUrl,
    disciplinaUrl,
    logoBase64,
  });

  // -- Team report --
  const completedTeam = sm.completedTeam || {};
  const delaysTeam = sm.delaysTeam || [];
  const scheduleTeam = sm.scheduleTeam || {};

  const countConcluidasTeam = Object.values(completedTeam).reduce((s, a) => s + a.length, 0);
  const countAtrasosTeam = delaysTeam.length;
  const countCronogramaTeam = Object.values(scheduleTeam).reduce(
    (s, d) => s + (d.a_iniciar?.length || 0) + (d.programadas?.length || 0),
    0,
  );

  const concluidasTeamHtml = _generateConcluidasSection(completedTeam, false);
  const atrasosTeamHtml = _generateAtrasosTeamSection(delaysTeam);
  const cronogramaTeamHtml = _generateCronogramaTeamSection(scheduleTeam);

  const teamHtml = _generateBaseHtml({
    projectName,
    subtitle: clientName,
    date: todayStr,
    greeting: 'Boa tarde, pessoal,<br>Segue o status do projeto para esta semana.',
    sections: [
      {
        title: 'Atividades Conclu\u00eddas',
        count: countConcluidasTeam,
        color: '#16a34a',
        content: concluidasTeamHtml,
        open: true,
      },
      {
        title: 'Atrasos e Desvios',
        count: countAtrasosTeam,
        color: countAtrasosTeam > 0 ? '#dc2626' : '#16a34a',
        content: atrasosTeamHtml,
        open: false,
      },
      {
        title: 'Cronograma',
        count: countCronogramaTeam,
        color: '#64748b',
        content: cronogramaTeamHtml,
        open: false,
      },
    ],
    showDashboardButton: false,
    projectId,
    headerColor: '#1e293b',
    reportType: 'Relat\u00f3rio Projetistas',
    projectImageBase64,
    ganttUrl,
    disciplinaUrl,
    logoBase64,
  });

  return { clientHtml, teamHtml };
}

// ---------------------------------------------------------------------------
// Placeholder: uploadToDrive
// ---------------------------------------------------------------------------

/**
 * Placeholder for Google Drive upload. Returns mock URLs.
 *
 * @param {string} clientHtml
 * @param {string} teamHtml
 * @param {Object} options - { projectName, driveFolderId }
 * @returns {Promise<{ clientUrl: string, teamUrl: string }>}
 */
export async function uploadToDrive(clientHtml, teamHtml, options = {}) {
  const { projectName = 'Projeto', driveFolderId = '' } = options;
  const dateStr = new Date().toISOString().split('T')[0];
  const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();

  // TODO: Implement actual Google Drive upload via googleapis
  return {
    clientUrl: `https://drive.google.com/mock/Email_cliente_${safeName}_${dateStr}.html`,
    teamUrl: `https://drive.google.com/mock/Email_time_${safeName}_${dateStr}.html`,
    message: 'Placeholder - Google Drive upload not yet implemented',
  };
}

// ---------------------------------------------------------------------------
// Gmail Draft Creation (uses gmail.js)
// ---------------------------------------------------------------------------

import { createGmailDraft } from '../gmail.js';

/**
 * Creates Gmail drafts for client and team reports.
 *
 * @param {string} clientHtml - HTML do relatório do cliente
 * @param {string} teamHtml - HTML do relatório do time
 * @param {Object} options - { projectName, clientEmails, teamEmails, userId, weekText }
 * @returns {Promise<{ clientDraftUrl: string|null, teamDraftUrl: string|null }>}
 */
export async function createGmailDrafts(clientHtml, teamHtml, options = {}) {
  const {
    projectName = 'Projeto',
    clientEmails = [],
    teamEmails = [],
    userId,
    weekText = '',
  } = options;

  let clientDraftUrl = null;
  let teamDraftUrl = null;

  const subject = `Relatório Semanal - ${projectName}${weekText ? ` - ${weekText}` : ''}`;

  // Cria rascunho para o cliente
  if (userId && clientEmails.length > 0 && clientHtml) {
    try {
      const result = await createGmailDraft(userId, {
        to: clientEmails,
        subject: `${subject} - Cliente`,
        body: `Relatório semanal do projeto ${projectName} para o cliente.`,
        htmlBody: clientHtml,
      });
      clientDraftUrl = `https://mail.google.com/mail/u/0/#drafts/${result.messageId}`;
    } catch (err) {
      console.warn(`[WeeklyReport] Erro ao criar rascunho Gmail (cliente):`, err.message);
      if (err.message === 'GMAIL_NOT_AUTHORIZED') {
        console.warn('[WeeklyReport] Usuário não autorizou Gmail. Pulando rascunhos.');
        return { clientDraftUrl: null, teamDraftUrl: null };
      }
    }
  }

  // Cria rascunho para o time
  if (userId && teamEmails.length > 0 && teamHtml) {
    try {
      const result = await createGmailDraft(userId, {
        to: teamEmails,
        subject: `${subject} - Equipe`,
        body: `Relatório semanal do projeto ${projectName} para a equipe.`,
        htmlBody: teamHtml,
      });
      teamDraftUrl = `https://mail.google.com/mail/u/0/#drafts/${result.messageId}`;
    } catch (err) {
      console.warn(`[WeeklyReport] Erro ao criar rascunho Gmail (equipe):`, err.message);
    }
  }

  return { clientDraftUrl, teamDraftUrl };
}

// ---------------------------------------------------------------------------
// Default export (class-like interface)
// ---------------------------------------------------------------------------

const WeeklyReportGenerator = {
  processData,
  generateHtml,
  uploadToDrive,
  createGmailDrafts,
};

export default WeeklyReportGenerator;
