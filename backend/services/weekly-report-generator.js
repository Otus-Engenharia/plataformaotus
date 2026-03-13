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
  // BigQuery DATE/DATETIME objects have a `.value` string property
  if (typeof value === 'object' && typeof value.value === 'string') {
    return parseDate(value.value);
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
  const baselines = (rawData?.baselines && typeof rawData.baselines === 'object') ? rawData.baselines : {};

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

  // Diagnostic logging
  const statusCounts = {};
  for (const t of filteredTasks) {
    const s = normalizeText(t.Status || '') || '(vazio)';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }
  console.log(`[weekly-report] processData: ${tasks.length} raw tasks → ${filteredTasks.length} after filter. Status breakdown:`, statusCounts);

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
    if (!task || typeof task !== 'object') continue;
    const statusNorm = normalizeText(task.Status || '');
    const temInfoAtraso = hasDelayInfo(task);

    // Overdue: task not completed but end date already passed
    let isOverdue = false;
    if (statusNorm !== 'feito' && statusNorm !== 'nao feito' && !temInfoAtraso) {
      const endDateStr = getField(task, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date');
      const endDt = parseDate(endDateStr);
      if (endDt && startOfDay(endDt) < refDate) {
        isOverdue = true;
      }
    }

    if (statusNorm === 'nao feito' || temInfoAtraso || isOverdue) {
      delayedTasks.push(task);
    }
  }

  // 3b. Completed tasks - grouped by discipline
  const completedTeam = {};
  const completedClient = {};
  for (const task of allTasks) {
    if (!task || typeof task !== 'object') continue;
    const statusLower = String(task.Status || '').toLowerCase().trim();
    if (statusLower !== 'feito') continue;

    const endDateStr = getField(task, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date');
    const endDt = parseDate(endDateStr);
    if (!endDt) continue; // sem data de término → não incluir
    const endNorm = startOfDay(endDt);
    if (endNorm < since) continue; // antes do período → não incluir

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
    // Mostrar atrasos da última semana ou do futuro — excluir apenas datas muito antigas
    const endDateStr = getField(task, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date');
    const endDt = parseDate(endDateStr);
    if (endDt && startOfDay(endDt) < since) continue; // mais antigo que 7 dias → excluir

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
    const statusNormSched = normalizeText(task.Status || '');
    if (statusNormSched === 'nao feito') continue; // já aparece em Atrasos e Desvios

    const discipline = task.Disciplina || task.Discipline || 'Sem Disciplina';
    const taskStartStr = getField(task, 'Data Inicio', 'Data de Inicio', 'Data de Início', 'Start Date');
    const taskEndStr = getField(task, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date');

    if (!taskStartStr && !taskEndStr) continue;

    const startDt = parseDate(taskStartStr);
    const endDt = parseDate(taskEndStr);
    const startNorm = startDt ? startOfDay(startDt) : null;
    const endNorm = endDt ? startOfDay(endDt) : null;

    // Tarefa tem data dentro da janela [refDate, futureCutoff]?
    let inPeriod = false;
    if (startNorm && startNorm >= refDate && startNorm <= futureCutoff) inPeriod = true;
    if (endNorm && endNorm >= refDate && endNorm <= futureCutoff) inPeriod = true;

    // Tarefa em andamento: já começou e prazo ainda não venceu
    const isInProgress = startNorm && endNorm &&
      startNorm <= refDate && endNorm >= refDate;

    // Tarefa overdue: prazo venceu (últimos 7 dias) mas não está feita
    const isOverdue = endNorm && endNorm < refDate && endNorm >= since;

    if (!inPeriod && !isInProgress && !isOverdue) continue;

    // Classificar por datas (não por status textual)
    let category;
    if (isOverdue || isInProgress) {
      category = 'em_andamento';
    } else if (startNorm && startNorm > refDate) {
      category = 'a_iniciar';
    } else {
      category = 'programadas';
    }

    task._overdue = !!isOverdue;

    if (isClientDiscipline(discipline)) {
      task._category = category;
      scheduleClient.push(task);
    } else {
      if (!scheduleTeam[discipline]) scheduleTeam[discipline] = { a_iniciar: [], programadas: [], em_andamento: [] };
      scheduleTeam[discipline][category].push(task);
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
    (s, d) => s + d.a_iniciar.length + d.programadas.length + (d.em_andamento?.length || 0),
    0,
  );

  console.log(`[weekly-report] processData result: ${allTasks.length} allTasks, ${delayedTasks.length} delayed, ${totalCompleted} completed, ${scheduleClient.length} scheduleClient, ${totalScheduleTeam} scheduleTeam, ${activeIssues.length} activeIssues`);

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
    baselines,
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
  orangeLight: '#fff8ee',
  grayDark: '#2d2d2d',
  grayLight: '#f8f9fa',
  grayMuted: '#e9ecef',
  text: '#1e293b',
  textLight: '#64748b',
  textMuted: '#94a3b8',
  success: '#16a34a',
  danger: '#dc2626',
  info: '#2563eb',
};

/**
 * Clean project/client name: replace underscores with spaces, normalize whitespace.
 */
function cleanName(name) {
  if (!name) return '';
  return name.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

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
    return `<p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:${OTUS.text};">\u2713 Sem pend\u00eancias das disciplinas <strong>Cliente</strong> e <strong>Otus</strong> nesta semana.</p>`;
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

    html += `<div style="margin-bottom:24px;"><p style="margin:0 0 12px;font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;color:${OTUS.text};text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid ${OTUS.grayMuted};padding-bottom:8px;">${esc(discipline)}</p>`;

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
      return `<p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:${OTUS.textLight};">\u2713 Nenhuma atividade conclu\u00edda das disciplinas <strong>Cliente</strong> e <strong>Otus</strong> no per\u00edodo (\u00faltimos 7 dias).</p>`;
    }
    return `<p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:${OTUS.textLight};">\u2713 Nenhuma atividade conclu\u00edda no per\u00edodo (\u00faltimos 7 dias).</p>`;
  }

  let html = '';
  for (const [discipline, tasks] of Object.entries(completed)) {
    html += `<div style="margin-bottom:20px;"><p style="margin:0 0 10px;font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;color:${OTUS.text};text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid ${OTUS.grayMuted};padding-bottom:8px;">${esc(discipline)}</p>`;

    for (const task of tasks) {
      const dateStr = formatDateShort(getField(task, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date'));
      const name = getField(task, 'Nome da Tarefa', 'Task Name') || '';
      const observacaoOtus = getField(task, 'Observacao Otus', 'Observação Otus') || '';

      html += `<div style="margin-bottom:10px;padding-left:12px;">`;
      html += `<p style="margin:0 0 4px;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:${OTUS.text};line-height:1.6;"><span style="font-family:'Montserrat',sans-serif;font-size:11px;color:${OTUS.text};font-weight:600;background:#f1f5f9;padding:3px 8px;border-radius:4px;margin-right:8px;">${esc(dateStr)}</span>${esc(name)}</p>`;

      if (!isEmptyValue(observacaoOtus)) {
        html += `<div style="margin:6px 0 0;padding:8px 12px;background:${OTUS.orangeLight};border-left:2px solid ${OTUS.orange};border-radius:0 4px 4px 0;margin-left:12px;"><p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:${OTUS.text};line-height:1.5;"><span style="font-weight:600;color:${OTUS.orange};">Obs Otus:</span> ${esc(observacaoOtus)}</p></div>`;
      }

      html += `</div>`;
    }

    html += `</div>`;
  }

  return html;
}

function _generateAtrasosClientSection(delays, baselines = {}) {
  if (!delays || delays.length === 0) {
    return `<p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:${OTUS.text};">\u2713 Nenhum atraso identificado das disciplinas <strong>Cliente</strong> e <strong>Otus</strong> no per\u00edodo.</p>`;
  }

  let html = '';
  for (const task of delays) {
    const discipline = task.Disciplina || task.Discipline || 'Sem Disciplina';
    const name = getField(task, 'Nome da Tarefa', 'Task Name') || '';
    const motivo = getField(task, 'Motivo de atraso', 'Delay Reason') || '';
    const observacaoOtus = getField(task, 'Observacao Otus', 'Observação Otus') || '';

    const snap = baselines[task.rowNumber] || baselines[String(task.rowNumber)] || null;
    const prevDate = snap ? formatDateShort(snap.dataBaseline) : '';
    const newDate  = snap ? formatDateShort(snap.dataReprog)   : '';

    html += `<div style="margin-bottom:14px;padding:14px 16px;background:#fef2f2;border-radius:6px;border-left:3px solid ${OTUS.danger};">`;
    html += `<p style="margin:0;font-family:'Montserrat',sans-serif;font-size:10px;color:${OTUS.textLight};font-weight:600;text-transform:uppercase;letter-spacing:1px;">${esc(discipline)}</p>`;
    html += `<p style="margin:6px 0 0;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:${OTUS.text};font-weight:500;">${esc(name)}</p>`;

    if (prevDate || newDate) {
      html += `<p style="margin:8px 0 0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:${OTUS.textLight};">`;
      html += `<span style="text-decoration:line-through;color:${OTUS.textMuted};">${esc(prevDate)}</span>`;
      html += `<span style="margin:0 8px;color:${OTUS.textMuted};">\u2192</span>`;
      html += `<span style="font-family:'Montserrat',sans-serif;font-weight:600;color:${OTUS.text};background:#fef3c7;padding:2px 8px;border-radius:4px;">${esc(newDate)}</span>`;
      html += `</p>`;
    }

    if (!isEmptyValue(motivo)) {
      html += `<div style="margin:10px 0 0;padding:8px 12px;background:#fff5f5;border-left:2px solid ${OTUS.danger};border-radius:0 4px 4px 0;"><p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:${OTUS.danger};line-height:1.5;"><span style="font-weight:600;">Motivo:</span> ${esc(motivo)}</p></div>`;
    }
    if (!isEmptyValue(observacaoOtus)) {
      html += `<div style="margin:8px 0 0;padding:8px 12px;background:${OTUS.orangeLight};border-left:2px solid ${OTUS.orange};border-radius:0 4px 4px 0;"><p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:${OTUS.text};line-height:1.5;"><span style="font-weight:600;color:${OTUS.orange};">Obs Otus:</span> ${esc(observacaoOtus)}</p></div>`;
    }

    html += `</div>`;
  }

  return html;
}

function _generateAtrasosTeamSection(delays, baselines = {}) {
  if (!delays || delays.length === 0) {
    return `<p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:${OTUS.text};">\u2713 Nenhum atraso identificado no per\u00edodo.</p>`;
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

    html += `<div style="margin-bottom:20px;"><p style="margin:0 0 12px;font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;color:${OTUS.text};text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid ${OTUS.grayMuted};padding-bottom:8px;">${esc(discipline)}</p>`;

    for (const task of tasks) {
      const name = getField(task, 'Nome da Tarefa', 'Task Name') || '';
      const motivo = getField(task, 'Motivo de atraso', 'Delay Reason') || '';
      const observacaoOtus = getField(task, 'Observacao Otus', 'Observação Otus') || '';

      const snap = baselines[task.rowNumber] || baselines[String(task.rowNumber)] || null;
      const prevDate = snap ? formatDateShort(snap.dataBaseline) : '';
      const newDate  = snap ? formatDateShort(snap.dataReprog)   : '';

      html += `<div style="margin:0 0 14px;padding:12px 14px;background:#fef2f2;border-radius:6px;border-left:3px solid ${OTUS.danger};">`;
      html += `<p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:${OTUS.text};font-weight:500;">${esc(name)}</p>`;

      if (prevDate || newDate) {
        html += `<p style="margin:6px 0 0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:${OTUS.textLight};">`;
        html += `<span style="text-decoration:line-through;color:${OTUS.textMuted};">${esc(prevDate)}</span>`;
        html += `<span style="margin:0 8px;color:${OTUS.textMuted};">\u2192</span>`;
        html += `<span style="font-family:'Montserrat',sans-serif;font-weight:600;color:${OTUS.text};background:#fef3c7;padding:2px 8px;border-radius:4px;">${esc(newDate)}</span>`;
        html += `</p>`;
      }

      if (!isEmptyValue(motivo)) {
        html += `<div style="margin:10px 0 0;padding:8px 12px;background:#fff5f5;border-left:2px solid ${OTUS.danger};border-radius:0 4px 4px 0;"><p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:${OTUS.danger};line-height:1.5;"><span style="font-weight:600;">Motivo:</span> ${esc(motivo)}</p></div>`;
      }
      if (!isEmptyValue(observacaoOtus)) {
        html += `<div style="margin:8px 0 0;padding:8px 12px;background:${OTUS.orangeLight};border-left:2px solid ${OTUS.orange};border-radius:0 4px 4px 0;"><p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:${OTUS.text};line-height:1.5;"><span style="font-weight:600;color:${OTUS.orange};">Obs Otus:</span> ${esc(observacaoOtus)}</p></div>`;
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
    return `<p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:${OTUS.textLight};">\u2713 Nenhuma atividade prevista das disciplinas <strong>Cliente</strong> e <strong>Otus</strong> para os pr\u00f3ximos ${days} dias.</p>`;
  }

  // Group by discipline, split a_iniciar / programadas / em_andamento
  const byDiscipline = {};
  for (const task of schedule) {
    if (!task || typeof task !== 'object') continue;
    const discipline = task.Disciplina || task.Discipline || 'Sem Disciplina';
    if (!byDiscipline[discipline]) byDiscipline[discipline] = { a_iniciar: [], programadas: [], em_andamento: [] };
    const cat = task._category || 'programadas';
    byDiscipline[discipline][cat].push(task);
  }

  let html = '';
  for (const [discipline, categories] of Object.entries(byDiscipline)) {
    if (!categories.a_iniciar.length && !categories.programadas.length && !categories.em_andamento.length) continue;

    html += `<div style="margin-bottom:24px;"><p style="margin:0 0 14px;font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;color:${OTUS.text};text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid ${OTUS.grayMuted};padding-bottom:8px;">${esc(discipline)}</p>`;

    if (categories.a_iniciar.length) {
      html += `<p style="margin:0 0 8px;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:600;color:${OTUS.orange};text-transform:uppercase;letter-spacing:1px;">\u25CF A Iniciar</p>`;
      for (const task of categories.a_iniciar) {
        const startDate = getField(task, 'Data Inicio', 'Data de Inicio', 'Data de Início', 'Start Date');
        const endDate = getField(task, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date');
        const dateStr = formatStartEndRange(startDate, endDate) || 's/ data';
        const name = getField(task, 'Nome da Tarefa', 'Task Name') || '';
        const observacaoOtus = getField(task, 'Observacao Otus', 'Observação Otus') || '';

        html += `<div style="margin-bottom:6px;padding-left:16px;">`;
        html += `<p style="margin:0 0 4px;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:${OTUS.text};line-height:1.6;"><span style="font-family:'Montserrat',sans-serif;font-size:11px;color:${OTUS.text};font-weight:600;background:#f1f5f9;padding:3px 8px;border-radius:4px;margin-right:8px;">${esc(dateStr)}</span>${esc(name)}</p>`;
        if (!isEmptyValue(observacaoOtus)) {
          html += `<div style="margin:6px 0 0;padding:8px 12px;background:${OTUS.orangeLight};border-left:2px solid ${OTUS.orange};border-radius:0 4px 4px 0;margin-left:12px;"><p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:${OTUS.text};line-height:1.5;"><span style="font-weight:600;color:${OTUS.orange};">Obs Otus:</span> ${esc(observacaoOtus)}</p></div>`;
        }
        html += `</div>`;
      }
    }

    if (categories.programadas.length) {
      html += `<p style="margin:14px 0 8px;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:1px;">\u25CF Entregas Programadas</p>`;
      for (const task of categories.programadas) {
        const dateStr = formatDateShort(getField(task, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date')) || 's/ data';
        const name = getField(task, 'Nome da Tarefa', 'Task Name') || '';
        const observacaoOtus = getField(task, 'Observacao Otus', 'Observação Otus') || '';

        html += `<div style="margin-bottom:6px;padding-left:16px;">`;
        html += `<p style="margin:0 0 4px;font-family:'Source Sans Pro',sans-serif;font-size:13px;color:#666;line-height:1.6;"><span style="font-family:'Montserrat',sans-serif;font-size:11px;color:#666;font-weight:500;background:#f5f5f5;padding:2px 6px;border-radius:3px;margin-right:8px;">${esc(dateStr)}</span>${esc(name)}</p>`;
        if (!isEmptyValue(observacaoOtus)) {
          html += `<div style="margin:6px 0 0;padding:8px 12px;background:${OTUS.orangeLight};border-left:2px solid ${OTUS.orange};border-radius:0 4px 4px 0;margin-left:12px;"><p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:${OTUS.text};line-height:1.5;"><span style="font-weight:600;color:${OTUS.orange};">Obs Otus:</span> ${esc(observacaoOtus)}</p></div>`;
        }
        html += `</div>`;
      }
    }

    if (categories.em_andamento.length) {
      html += `<p style="margin:14px 0 8px;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:600;color:#2563EB;text-transform:uppercase;letter-spacing:1px;">\u25CF Em Andamento</p>`;
      for (const task of categories.em_andamento) {
        const startDate = getField(task, 'Data Inicio', 'Data de Inicio', 'Data de Início', 'Start Date');
        const endDate = getField(task, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date');
        const dateStr = formatStartEndRange(startDate, endDate) || 's/ data';
        const name = getField(task, 'Nome da Tarefa', 'Task Name') || '';
        const observacaoOtus = getField(task, 'Observacao Otus', 'Observação Otus') || '';
        const overdueBadge = task._overdue ? '<span style="font-family:\'Montserrat\',sans-serif;font-size:9px;font-weight:700;color:#fff;background:#DC2626;padding:2px 6px;border-radius:3px;margin-right:6px;">ATRASADA</span>' : '';

        html += `<div style="margin-bottom:6px;padding-left:16px;">`;
        html += `<p style="margin:0 0 4px;font-family:'Source Sans Pro',sans-serif;font-size:13px;color:#444;line-height:1.6;">${overdueBadge}<span style="font-family:'Montserrat',sans-serif;font-size:11px;color:#2563EB;font-weight:500;background:#eff6ff;padding:2px 6px;border-radius:3px;margin-right:8px;">${esc(dateStr)}</span>${esc(name)}</p>`;
        if (!isEmptyValue(observacaoOtus)) {
          html += `<div style="margin:6px 0 0;padding:8px 12px;background:${OTUS.orangeLight};border-left:2px solid ${OTUS.orange};border-radius:0 4px 4px 0;margin-left:12px;"><p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:${OTUS.text};line-height:1.5;"><span style="font-weight:600;color:${OTUS.orange};">Obs Otus:</span> ${esc(observacaoOtus)}</p></div>`;
        }
        html += `</div>`;
      }
    }

    html += `</div>`;
  }

  return html;
}

function _generateCronogramaTeamSection(schedule) {
  const hasContent = schedule && Object.values(schedule).some(
    d => d.a_iniciar?.length || d.programadas?.length || d.em_andamento?.length,
  );
  if (!hasContent) {
    return `<p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:${OTUS.textLight};">Nenhuma atividade prevista para as pr\u00f3ximas semanas.</p>`;
  }

  let html = '';
  for (const [discipline, categories] of Object.entries(schedule)) {
    html += `<div style="margin-bottom:24px;"><p style="margin:0 0 14px;font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;color:${OTUS.text};text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid ${OTUS.grayMuted};padding-bottom:8px;">${esc(discipline)}</p>`;

    if (categories.a_iniciar && categories.a_iniciar.length) {
      html += `<p style="margin:0 0 8px;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:600;color:${OTUS.orange};text-transform:uppercase;letter-spacing:1px;">\u25CF A Iniciar</p>`;
      for (const task of categories.a_iniciar) {
        const startDate = getField(task, 'Data Inicio', 'Data de Inicio', 'Data de Início', 'Start Date');
        const endDate = getField(task, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date');
        const dateStr = formatStartEndRange(startDate, endDate) || 's/ data';
        const name = getField(task, 'Nome da Tarefa', 'Task Name') || '';
        const observacaoOtus = getField(task, 'Observacao Otus', 'Observação Otus') || '';

        html += `<div style="margin-bottom:6px;padding-left:16px;">`;
        html += `<p style="margin:0 0 4px;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:${OTUS.text};line-height:1.6;"><span style="font-family:'Montserrat',sans-serif;font-size:11px;color:${OTUS.text};font-weight:600;background:#f1f5f9;padding:3px 8px;border-radius:4px;margin-right:8px;">${esc(dateStr)}</span>${esc(name)}</p>`;
        if (!isEmptyValue(observacaoOtus)) {
          html += `<div style="margin:6px 0 0;padding:8px 12px;background:${OTUS.orangeLight};border-left:2px solid ${OTUS.orange};border-radius:0 4px 4px 0;margin-left:12px;"><p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:${OTUS.text};line-height:1.5;"><span style="font-weight:600;color:${OTUS.orange};">Obs Otus:</span> ${esc(observacaoOtus)}</p></div>`;
        }
        html += `</div>`;
      }
    }

    if (categories.programadas && categories.programadas.length) {
      html += `<p style="margin:14px 0 8px;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:1px;">\u25CF Entregas Programadas</p>`;
      for (const task of categories.programadas) {
        const dateStr = formatDateShort(getField(task, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date')) || 's/ data';
        const name = getField(task, 'Nome da Tarefa', 'Task Name') || '';
        const observacaoOtus = getField(task, 'Observacao Otus', 'Observação Otus') || '';

        html += `<div style="margin-bottom:6px;padding-left:16px;">`;
        html += `<p style="margin:0 0 4px;font-family:'Source Sans Pro',sans-serif;font-size:13px;color:#666;line-height:1.6;"><span style="font-family:'Montserrat',sans-serif;font-size:11px;color:#666;font-weight:500;background:#f5f5f5;padding:2px 6px;border-radius:3px;margin-right:8px;">${esc(dateStr)}</span>${esc(name)}</p>`;
        if (!isEmptyValue(observacaoOtus)) {
          html += `<div style="margin:6px 0 0;padding:8px 12px;background:${OTUS.orangeLight};border-left:2px solid ${OTUS.orange};border-radius:0 4px 4px 0;margin-left:12px;"><p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:${OTUS.text};line-height:1.5;"><span style="font-weight:600;color:${OTUS.orange};">Obs Otus:</span> ${esc(observacaoOtus)}</p></div>`;
        }
        html += `</div>`;
      }
    }

    if (categories.em_andamento && categories.em_andamento.length) {
      html += `<p style="margin:14px 0 8px;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:600;color:#2563EB;text-transform:uppercase;letter-spacing:1px;">\u25CF Em Andamento</p>`;
      for (const task of categories.em_andamento) {
        const startDate = getField(task, 'Data Inicio', 'Data de Inicio', 'Data de Início', 'Start Date');
        const endDate = getField(task, 'Data Termino', 'Data Término', 'Data de Termino', 'Data de Término', 'End Date');
        const dateStr = formatStartEndRange(startDate, endDate) || 's/ data';
        const name = getField(task, 'Nome da Tarefa', 'Task Name') || '';
        const observacaoOtus = getField(task, 'Observacao Otus', 'Observação Otus') || '';
        const overdueBadge = task._overdue ? '<span style="font-family:\'Montserrat\',sans-serif;font-size:9px;font-weight:700;color:#fff;background:#DC2626;padding:2px 6px;border-radius:3px;margin-right:6px;">ATRASADA</span>' : '';

        html += `<div style="margin-bottom:6px;padding-left:16px;">`;
        html += `<p style="margin:0 0 4px;font-family:'Source Sans Pro',sans-serif;font-size:13px;color:#444;line-height:1.6;">${overdueBadge}<span style="font-family:'Montserrat',sans-serif;font-size:11px;color:#2563EB;font-weight:500;background:#eff6ff;padding:2px 6px;border-radius:3px;margin-right:8px;">${esc(dateStr)}</span>${esc(name)}</p>`;
        if (!isEmptyValue(observacaoOtus)) {
          html += `<div style="margin:6px 0 0;padding:8px 12px;background:${OTUS.orangeLight};border-left:2px solid ${OTUS.orange};border-radius:0 4px 4px 0;margin-left:12px;"><p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:${OTUS.text};line-height:1.5;"><span style="font-weight:600;color:${OTUS.orange};">Obs Otus:</span> ${esc(observacaoOtus)}</p></div>`;
        }
        html += `</div>`;
      }
    }

    html += `</div>`;
  }

  return html;
}

// -- Relatos da Semana ----------------------------------------------------

/**
 * Gera HTML da seção "Relatos da Semana" para o relatório do cliente.
 * @param {Array} relatos - Relatos da semana (já filtrados por data)
 * @param {Object} tiposMap - { slug: { label, color } }
 * @param {Object} prioridadesMap - { slug: { label, color } }
 * @returns {string} HTML inline
 */
// -- Relatos da Semana ----------------------------------------------------

/**
 * Gera HTML da seção "Relatos da Semana" para o relatório do cliente.
 * @param {Array} relatos - Relatos da semana (já filtrados por data)
 * @param {Object} tiposMap - { slug: { label, color } }
 * @param {Object} prioridadesMap - { slug: { label, color } }
 * @returns {string} HTML inline
 */
function _generateRelatosSection(relatos, tiposMap = {}, prioridadesMap = {}) {
  if (!relatos || relatos.length === 0) {
    return `<p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:${OTUS.textLight};">Nenhum relato registrado no per\u00edodo (\u00faltimos 7 dias).</p>`;
  }

  // Agrupar por tipo (suporta entidade Relato ou objeto plano)
  const grouped = {};
  for (const r of relatos) {
    const tipoSlug = (r.tipo && typeof r.tipo === 'object' ? r.tipo.slug : null) || r.tipo_slug || 'informativo';
    if (!grouped[tipoSlug]) grouped[tipoSlug] = [];
    grouped[tipoSlug].push(r);
  }

  // Ordem de prioridade dos tipos
  const tipoOrder = ['bloqueio', 'risco', 'decisao', 'informativo', 'licao-aprendida'];
  const sortedSlugs = Object.keys(grouped).sort((a, b) => {
    const ia = tipoOrder.indexOf(a);
    const ib = tipoOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  let html = '';

  for (const slug of sortedSlugs) {
    const items = grouped[slug];
    const tipoInfo = tiposMap[slug] || {};
    const tipoLabel = tipoInfo.label || slug;
    const tipoColor = tipoInfo.color || '#6B7280';

    // Heading do tipo (padrão disciplinas)
    html += `<div style="margin-bottom:20px;">`;
    html += `<p style="margin:0 0 10px;font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;color:${OTUS.text};text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid ${OTUS.grayMuted};padding-bottom:8px;">`;
    html += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${esc(tipoColor)};margin-right:8px;vertical-align:middle;"></span>`;
    html += `${esc(tipoLabel)}`;
    html += `<span style="margin-left:8px;font-size:9px;color:#888;font-weight:600;">(${items.length})</span>`;
    html += `</p>`;

    for (const r of items) {
      const code = r.code || `RL-${r.id || ''}`;
      const titulo = r.titulo || '';
      const descricao = r.descricao || '';
      const authorName = r.authorName || r.author_name || '';
      const createdAt = r.createdAt || r.created_at;
      const dateStr = formatDateShort(createdAt);
      const isResolved = r.isResolved != null ? r.isResolved : (r.is_resolved || false);

      const prioSlug = (r.prioridade && typeof r.prioridade === 'object' ? r.prioridade.slug : null) || r.prioridade_slug || '';
      const prioInfo = prioridadesMap[prioSlug] || {};
      const prioLabel = prioInfo.label || prioSlug;
      const prioColor = prioInfo.color || '#6B7280';

      // Card do relato (padrão cards de atraso)
      html += `<div style="margin-bottom:12px;padding:14px 16px;background:#fafafa;border-radius:4px;border-left:3px solid ${esc(tipoColor)};">`;

      // Linha 1: código + título
      html += `<p style="margin:0 0 6px;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:#1a1a1a;font-weight:500;">`;
      html += `<span style="font-family:'Montserrat',sans-serif;font-size:11px;font-weight:600;background:#fff3e0;color:${OTUS.orange};padding:2px 6px;border-radius:3px;margin-right:8px;">${esc(code)}</span>`;
      html += `${esc(titulo)}`;
      html += `</p>`;

      // Linha 2: prioridade + autor + data + status
      html += `<p style="margin:0 0 4px;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:#666;">`;
      if (prioLabel) {
        html += `<span style="display:inline-block;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;color:${esc(prioColor)};text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid ${esc(prioColor)};padding-bottom:1px;margin-right:10px;">${esc(prioLabel)}</span>`;
      }
      if (authorName) {
        html += `${esc(authorName)}`;
      }
      if (dateStr) {
        html += `<span style="margin-left:8px;color:#999;">${esc(dateStr)}</span>`;
      }
      if (isResolved) {
        html += `<span style="margin-left:10px;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.5px;">Resolvido</span>`;
      }
      html += `</p>`;

      // Linha 3: descrição (se houver)
      if (descricao && descricao.trim().length > 0) {
        const truncated = descricao.length > 200 ? descricao.substring(0, 200) + '...' : descricao;
        html += `<p style="margin:6px 0 0;font-family:'Source Sans Pro',sans-serif;font-size:12px;color:#444;line-height:1.5;padding-left:4px;">${esc(truncated)}</p>`;
      }

      html += `</div>`;
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
  // No placeholder when image is missing - header uses full width
  return '';
}

function _generateBaseHtml({
  projectName,
  subtitle,
  date,
  weekPeriod,
  greeting,
  sections,
  showDashboardButton,
  projectId,
  reportType,
  projectImageBase64,
  ganttUrl,
  disciplinaUrl,
  logoBase64,
}) {
  const cleanedSubtitle = cleanName(subtitle);
  const cleanedProject = cleanName(projectName);

  // Build sections HTML
  let sectionsHtml = '';
  for (const section of sections) {
    const isOpen = section.open ? 'open' : '';
    const badgeColor = section.count > 0 ? OTUS.orange : OTUS.success;
    const badgeBg = section.count > 0 ? OTUS.orangeLight : '#f0fdf4';
    const badgeText = section.count > 0 ? OTUS.orange : OTUS.success;

    sectionsHtml += `
            <details ${isOpen} style="margin:0 0 10px;border:1px solid ${OTUS.grayMuted};border-radius:8px;overflow:hidden;">
                <summary style="padding:14px 20px;cursor:pointer;font-family:'Montserrat',sans-serif;font-size:14px;font-weight:600;color:${OTUS.black};background:#ffffff;display:flex;align-items:center;gap:12px;border-left:3px solid ${badgeColor};">
                    <span style="flex:1;">${section.title}</span>
                    <span style="display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:26px;background:${badgeBg};color:${badgeText};border-radius:13px;font-size:12px;font-weight:700;padding:0 8px;">${section.count}</span>
                    <span class="chevron" style="color:${OTUS.textMuted};font-size:10px;">\u25BC</span>
                </summary>
                <div style="padding:20px;background:#ffffff;border-top:1px solid ${OTUS.grayMuted};font-family:'Source Sans Pro',sans-serif;">${section.content}</div>
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

  // Footer buttons - stacked layout for better spacing
  let footerButtons = '<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>';
  if (ganttUrl) {
    footerButtons += `<td style="padding:0 6px 0 0;vertical-align:middle;"><a href="${ganttUrl}" style="display:inline-block;padding:10px 18px;background:${OTUS.black};color:#ffffff;text-decoration:none;border-radius:6px;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:600;white-space:nowrap;">Cronograma</a></td>`;
  }
  if (disciplinaUrl) {
    footerButtons += `<td style="padding:0 6px;vertical-align:middle;"><a href="${disciplinaUrl}" style="display:inline-block;padding:10px 18px;background:#ffffff;color:${OTUS.text};text-decoration:none;border-radius:6px;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:600;border:1px solid ${OTUS.grayMuted};white-space:nowrap;">Disciplinas</a></td>`;
  }
  footerButtons += `<td style="padding:0 6px;vertical-align:middle;"><a href="${construflowUrl}" style="display:inline-block;padding:10px 18px;background:${OTUS.black};color:#ffffff;text-decoration:none;border-radius:6px;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:600;white-space:nowrap;">Construflow</a></td>`;
  footerButtons += `<td style="padding:0 0 0 6px;vertical-align:middle;"><a href="https://docs.google.com/forms/d/e/1FAIpQLSdc4k3NuH2Eu0GM7uBGJ2_Fq5iscxwG-99Sks6P5ho6AZyi0w/viewform" style="display:inline-block;padding:10px 18px;background:#ffffff;color:${OTUS.text};text-decoration:none;border-radius:6px;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:600;border:1px solid ${OTUS.grayMuted};white-space:nowrap;">Feedback</a></td>`;
  footerButtons += '</tr></table>';

  // Logo HTML
  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" alt="Otus" style="height:32px;width:auto;" />`
    : `<span style="font-family:'Montserrat',sans-serif;font-size:18px;font-weight:700;color:${OTUS.black};">OTUS</span>`;

  // Week period line
  const weekPeriodHtml = weekPeriod
    ? `<span style="font-family:'Montserrat',sans-serif;font-size:11px;font-weight:600;color:${OTUS.textLight};letter-spacing:0.3px;">${esc(weekPeriod)}</span>`
    : '';

  // Header layout: two-column if image exists, single-column otherwise
  const hasImage = !!projectImageBase64;
  const imageHtml = _generateProjectImageHtml(projectImageBase64, cleanedProject);

  let heroContent;
  if (hasImage) {
    heroContent = `
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td style="vertical-align:top;width:60%;">
                                        <p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:10px;color:${OTUS.orange};text-transform:uppercase;letter-spacing:2px;font-weight:600;">Cliente</p>
                                        <p style="margin:6px 0 0;font-family:'Montserrat',sans-serif;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;line-height:1.15;">${esc(cleanedSubtitle)}</p>
                                        <p style="margin:16px 0 0;font-family:'Source Sans Pro',sans-serif;font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:2px;">Projeto</p>
                                        <p style="margin:4px 0 0;font-family:'Montserrat',sans-serif;font-size:15px;font-weight:500;color:rgba(255,255,255,0.85);">${esc(cleanedProject)}</p>
                                        <table cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;">
                                            <tr>
                                                <td style="background:${OTUS.orange};padding:7px 18px;border-radius:20px;">
                                                    <span style="font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;color:${OTUS.black};text-transform:uppercase;letter-spacing:0.8px;">${esc(reportType)}</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                    <td style="vertical-align:middle;width:40%;text-align:right;">
                                        ${imageHtml}
                                    </td>
                                </tr>
                            </table>`;
  } else {
    heroContent = `
                                        <p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:10px;color:${OTUS.orange};text-transform:uppercase;letter-spacing:2px;font-weight:600;">Cliente</p>
                                        <p style="margin:6px 0 0;font-family:'Montserrat',sans-serif;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;line-height:1.15;">${esc(cleanedSubtitle)}</p>
                                        <p style="margin:16px 0 0;font-family:'Source Sans Pro',sans-serif;font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:2px;">Projeto</p>
                                        <p style="margin:4px 0 0;font-family:'Montserrat',sans-serif;font-size:16px;font-weight:500;color:rgba(255,255,255,0.85);">${esc(cleanedProject)}</p>
                                        <table cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;">
                                            <tr>
                                                <td style="background:${OTUS.orange};padding:7px 18px;border-radius:20px;">
                                                    <span style="font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;color:${OTUS.black};text-transform:uppercase;letter-spacing:0.8px;">${esc(reportType)}</span>
                                                </td>
                                            </tr>
                                        </table>`;
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relat\u00f3rio - ${esc(cleanedProject)}</title>
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
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:620px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

                    <!-- BARRA SUPERIOR BRANCA COM LOGO -->
                    <tr>
                        <td style="background:#ffffff;padding:18px 32px;border-bottom:2px solid ${OTUS.orange};">
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td style="vertical-align:middle;">
                                        ${logoHtml}
                                    </td>
                                    <td align="right" style="vertical-align:middle;">
                                        <span style="font-family:'Source Sans Pro',sans-serif;font-size:12px;color:${OTUS.textLight};">${esc(date)}</span>
                                        ${weekPeriodHtml ? `<br>${weekPeriodHtml}` : ''}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- HEADER HERO -->
                    <tr>
                        <td style="background:linear-gradient(135deg, ${OTUS.black} 0%, #2d2d2d 100%);padding:32px;">
                            ${heroContent}
                        </td>
                    </tr>

                    <!-- SAUDACAO -->
                    <tr>
                        <td style="padding:28px 40px 20px;">
                            <p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:16px;color:${OTUS.text};line-height:1.7;">${greeting}</p>
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
                        <td style="padding:0 40px 28px;">
                            <p style="margin:0;font-family:'Source Sans Pro',sans-serif;font-size:14px;color:${OTUS.textLight};line-height:1.7;">Fico \u00e0 disposi\u00e7\u00e3o para esclarecimentos.</p>
                        </td>
                    </tr>

                    <!-- RODAPE -->
                    <tr>
                        <td style="padding:20px 32px;background:${OTUS.grayLight};border-top:1px solid ${OTUS.grayMuted};">
                            ${footerButtons}
                        </td>
                    </tr>

                    <!-- ASSINATURA OTUS -->
                    <tr>
                        <td align="center" style="padding:12px 32px 16px;background:${OTUS.grayLight};">
                            <span style="font-family:'Montserrat',sans-serif;font-size:10px;color:${OTUS.textMuted};letter-spacing:0.5px;">Gerado pela Plataforma Otus</span>
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
 *   - relatos: Array - relatos da semana (já filtrados)
 *   - tiposMap: Object - { slug: { label, color } }
 *   - prioridadesMap: Object - { slug: { label, color } }
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
    relatos = [],
    tiposMap = {},
    prioridadesMap = {},
  } = options;

  const projectName = nameOverride || processedData.projectName || 'Projeto';
  const clientName = clientOverride || processedData.clientName || projectName;
  const projectId = processedData.projectId || '';
  const scheduleDays = processedData.scheduleDays || 15;

  const now = new Date();
  const todayStr = formatDateFull(now);

  // Compute week number and period (Mon-Fri of current week)
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const oneJan = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now - oneJan) / 86400000 + oneJan.getDay()) / 7);
  const weekPeriod = `Semana ${weekNum} | ${formatDateShort(monday)} - ${formatDateShort(friday)}`;

  const sm = processedData.smartsheet || {};
  const cf = processedData.construflow || {};
  const baselines = processedData.baselines || {};

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
  const atrasosClientHtml = _generateAtrasosClientSection(delaysClient, baselines);
  const cronogramaClientHtml = _generateCronogramaClientSection(scheduleClient, ganttUrl, disciplinaUrl, scheduleDays);

  // Relatos da Semana
  const countRelatos = relatos.length;
  const relatosHtml = _generateRelatosSection(relatos, tiposMap, prioridadesMap);

  const clientSections = [
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
  ];

  // Só adiciona seção de relatos se houver relatos
  if (countRelatos > 0) {
    clientSections.push({
      title: 'Relatos da Semana',
      count: countRelatos,
      color: OTUS.orange,
      content: relatosHtml,
      open: false,
    });
  }

  const clientHtml = _generateBaseHtml({
    projectName,
    subtitle: clientName,
    date: todayStr,
    weekPeriod,
    greeting: 'Prezados,<br>Segue o status atualizado do projeto para esta semana.',
    sections: clientSections,
    showDashboardButton: !hideDashboard,
    projectId,
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
    (s, d) => s + (d.a_iniciar?.length || 0) + (d.programadas?.length || 0) + (d.em_andamento?.length || 0),
    0,
  );

  const concluidasTeamHtml = _generateConcluidasSection(completedTeam, false);
  const atrasosTeamHtml = _generateAtrasosTeamSection(delaysTeam, baselines);
  const cronogramaTeamHtml = _generateCronogramaTeamSection(scheduleTeam);

  const teamHtml = _generateBaseHtml({
    projectName,
    subtitle: clientName,
    date: todayStr,
    weekPeriod,
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
    reportType: 'Relat\u00f3rio Projetistas',
    projectImageBase64,
    ganttUrl,
    disciplinaUrl,
    logoBase64,
  });

  return { clientHtml, teamHtml };
}

// ---------------------------------------------------------------------------
// Fetch image from Google Drive as base64 data URI
// ---------------------------------------------------------------------------

/**
 * Extracts a Google Drive file ID from various URL formats.
 * Supports:
 *   - https://drive.google.com/file/d/FILE_ID/view
 *   - https://drive.google.com/open?id=FILE_ID
 *   - https://drive.google.com/uc?id=FILE_ID
 *   - Raw file ID (alphanumeric string 20+ chars)
 */
function extractDriveFileId(url) {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];
  const dMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch) return dMatch[1];
  return null;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Fetches an image from Google Drive and returns it as a base64 data URI.
 *
 * @param {string} driveUrl - Google Drive URL or file ID
 * @returns {Promise<string|null>} base64 data URI or null on failure
 */
export async function fetchDriveImageAsBase64(driveUrl) {
  const fileId = extractDriveFileId(driveUrl);
  if (!fileId) {
    console.warn('[WeeklyReport] Não foi possível extrair file ID da URL da capa:', driveUrl);
    return null;
  }

  const { google } = await import('googleapis');
  const path = await import('path');

  const keyFile = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account-key.json');
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const drive = google.drive({ version: 'v3', auth });

  // Get file metadata (mimeType + size)
  const meta = await drive.files.get({ fileId, fields: 'mimeType,size', supportsAllDrives: true });
  const mimeType = meta.data.mimeType || 'image/png';
  const size = parseInt(meta.data.size || '0', 10);

  if (size > MAX_IMAGE_SIZE) {
    console.warn(`[WeeklyReport] Imagem da capa muito grande (${(size / 1024 / 1024).toFixed(1)}MB) — pulando`);
    return null;
  }

  // Download file content
  const response = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  );

  const buffer = Buffer.from(response.data);
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

// ---------------------------------------------------------------------------
// Upload to Google Drive (uses service account)
// ---------------------------------------------------------------------------

/**
 * Uploads client and team HTML reports to Google Drive via service account.
 *
 * @param {string} clientHtml - HTML do relatório do cliente
 * @param {string} teamHtml - HTML do relatório do time
 * @param {Object} options - { projectName, driveFolderId }
 * @returns {Promise<{ clientUrl: string|null, teamUrl: string|null }>}
 */
export async function uploadToDrive(clientHtml, teamHtml, options = {}) {
  const { projectName = 'Projeto', driveFolderId } = options;
  const dateStr = new Date().toISOString().split('T')[0];
  const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();

  if (!driveFolderId) {
    console.warn('[WeeklyReport] driveFolderId não fornecido — pulando upload no Drive');
    return { clientUrl: null, teamUrl: null };
  }

  const { google } = await import('googleapis');
  const path = await import('path');

  const keyFile = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account-key.json');
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const drive = google.drive({ version: 'v3', auth });

  let clientUrl = null;
  let teamUrl = null;

  // Upload relatório cliente
  if (clientHtml) {
    const clientFile = await drive.files.create({
      requestBody: {
        name: `Email_cliente_${safeName}_${dateStr}.html`,
        mimeType: 'text/html',
        parents: [driveFolderId],
      },
      media: {
        mimeType: 'text/html',
        body: clientHtml,
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });
    clientUrl = clientFile.data.webViewLink;
  }

  // Upload relatório equipe
  if (teamHtml) {
    const teamFile = await drive.files.create({
      requestBody: {
        name: `Email_time_${safeName}_${dateStr}.html`,
        mimeType: 'text/html',
        parents: [driveFolderId],
      },
      media: {
        mimeType: 'text/html',
        body: teamHtml,
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });
    teamUrl = teamFile.data.webViewLink;
  }

  return { clientUrl, teamUrl, folderUrl: `https://drive.google.com/drive/folders/${driveFolderId}` };
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
    leaderEmail = null,
    otusTeamEmails = [],
    userId,
    weekText = '',
  } = options;

  const CS_EMAIL = 'cs@otusengenharia.com';

  // Monta CC base: líder + CS + equipe Otus, filtrando nulos/vazios e deduplicando
  const baseCc = [...new Set([leaderEmail, CS_EMAIL, ...otusTeamEmails].filter(e => e && e.includes('@')))];

  let clientDraftUrl = null;
  let teamDraftUrl = null;

  const subject = `Relatório Semanal - ${projectName}${weekText ? ` - ${weekText}` : ''}`;

  // Cria rascunho para o cliente
  if (userId && clientEmails.length > 0 && clientHtml) {
    try {
      // CC = baseCc sem quem já está no To
      const toSet = new Set(clientEmails.map(e => e.toLowerCase()));
      const cc = baseCc.filter(e => !toSet.has(e.toLowerCase()));

      const result = await createGmailDraft(userId, {
        to: clientEmails,
        cc: cc.length > 0 ? cc : undefined,
        subject: `${subject} - Cliente`,
        body: `Relatório semanal do projeto ${projectName} para o cliente.`,
        htmlBody: clientHtml,
      });
      clientDraftUrl = `https://mail.google.com/mail/u/0/#drafts?compose=${result.draftId}`;
    } catch (err) {
      console.warn(`[WeeklyReport] Erro ao criar rascunho Gmail (cliente):`, err.message);
      if (err.message === 'GMAIL_NOT_AUTHORIZED') {
        console.warn('[WeeklyReport] Usuário não autorizou Gmail. Pulando rascunhos.');
        return { clientDraftUrl: null, teamDraftUrl: null };
      }
    }
  }

  // Cria rascunho para o time (inclui emails do cliente + equipe)
  if (userId && (teamEmails.length > 0 || clientEmails.length > 0) && teamHtml) {
    try {
      const allTo = [...clientEmails, ...teamEmails];
      const toSet = new Set(allTo.map(e => e.toLowerCase()));
      const cc = baseCc.filter(e => !toSet.has(e.toLowerCase()));

      const result = await createGmailDraft(userId, {
        to: allTo,
        cc: cc.length > 0 ? cc : undefined,
        subject: `${subject} - Equipe`,
        body: `Relatório semanal do projeto ${projectName} para a equipe.`,
        htmlBody: teamHtml,
      });
      teamDraftUrl = `https://mail.google.com/mail/u/0/#drafts?compose=${result.draftId}`;
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
