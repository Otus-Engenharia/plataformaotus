/**
 * Domain Service: WeightCalculationService
 *
 * Motor de cálculo puro (sem I/O) que calcula pesos por tarefa
 * e o progresso geral do projeto com base na configuração de pesos.
 *
 * Fórmula:
 * 1. Para cada tarefa Level 5 com etapa reconhecida:
 *    combined_factor = fator_disciplina × fator_etapa
 * 2. Dentro da fase:
 *    peso_na_fase = combined_factor / Σ(combined_factors na fase) × 100%
 * 3. No projeto:
 *    peso_no_projeto = peso_fase% × peso_na_fase% / 100
 * 4. Se N tarefas no mesmo grupo (fase+disciplina+etapa):
 *    peso_por_tarefa = peso_no_projeto / N
 */

import { ActivityType } from '../value-objects/ActivityType.js';

// Status que indicam tarefa concluída
const COMPLETED_STATUSES = [
  'concluída', 'concluida', 'completa', 'complete', 'done',
  '100%', 'finalizado', 'finalizada', 'entregue',
  'feito',
];

function isTaskComplete(status) {
  if (!status) return false;
  return COMPLETED_STATUSES.some(s =>
    status.toLowerCase().trim() === s
  );
}

class WeightCalculationService {
  /**
   * Calcula os pesos por tarefa e o progresso do projeto.
   *
   * @param {Object} params
   * @param {Array} params.tasks - Tarefas Level 5 do BigQuery (com fase_nome)
   * @param {WeightConfiguration} params.weightConfig - Configuração de pesos
   * @param {Map<string,string>} params.disciplineMappings - Map<smartsheetName, standardName>
   * @returns {Object} { tasks, progress, breakdown }
   */
  static calculate({ tasks, weightConfig, disciplineMappings = new Map() }) {
    // 1. Enriquecer tarefas com etapa, disciplina padrão e filtrar
    const enrichedTasks = tasks.map(task => {
      const activityType = ActivityType.parse(task.NomeDaTarefa);
      const rawDiscipline = (task.Disciplina || '').trim();
      const standardDiscipline = disciplineMappings.get(rawDiscipline) || rawDiscipline;

      return {
        ...task,
        activity_type: activityType ? activityType.value : null,
        standard_discipline: standardDiscipline,
        is_complete: isTaskComplete(task.Status),
      };
    });

    // Filtrar tarefas com etapa reconhecida (as sem etapa têm peso = 0)
    const activeTasks = enrichedTasks.filter(t => t.activity_type !== null);
    const excludedTasks = enrichedTasks.filter(t => t.activity_type === null);

    // 2. Agrupar por (fase, disciplina padrão, etapa)
    const groups = new Map();
    for (const task of activeTasks) {
      const key = `${task.fase_nome}||${task.standard_discipline}||${task.activity_type}`;
      if (!groups.has(key)) {
        groups.set(key, {
          fase: task.fase_nome,
          discipline: task.standard_discipline,
          activityType: task.activity_type,
          tasks: [],
        });
      }
      groups.get(key).tasks.push(task);
    }

    // 3. Calcular combined_factor por grupo e total por fase
    const phaseTotals = new Map(); // fase -> sum of combined_factors
    for (const group of groups.values()) {
      const discFactor = weightConfig.getDisciplineFactor(group.discipline);
      const actFactor = weightConfig.getActivityFactor(group.activityType);
      group.combined_factor = discFactor * actFactor;

      const current = phaseTotals.get(group.fase) || 0;
      phaseTotals.set(group.fase, current + group.combined_factor);
    }

    // 4. Calcular peso por tarefa
    const taskResults = [];
    let totalProgress = 0;

    for (const group of groups.values()) {
      const phaseWeight = weightConfig.getPhaseWeight(group.fase);
      const phasePercent = phaseWeight ? phaseWeight.percent : 0;
      const phaseTotal = phaseTotals.get(group.fase) || 1;

      const pesoNaFase = phaseTotal > 0
        ? (group.combined_factor / phaseTotal) * 100
        : 0;
      const pesoNoProjeto = (phasePercent * pesoNaFase) / 100;
      const pesoPorTarefa = group.tasks.length > 0
        ? pesoNoProjeto / group.tasks.length
        : 0;

      for (const task of group.tasks) {
        const result = {
          rowNumber: task.rowNumber,
          task_name: task.NomeDaTarefa,
          fase: group.fase,
          discipline_raw: task.Disciplina,
          discipline_standard: group.discipline,
          activity_type: group.activityType,
          status: task.Status,
          is_complete: task.is_complete,
          data_inicio: task.DataDeInicio,
          data_termino: task.DataDeTermino,
          peso_na_fase: Math.round(pesoNaFase * 100) / 100,
          peso_no_projeto: Math.round(pesoPorTarefa * 10000) / 10000,
        };
        taskResults.push(result);

        if (task.is_complete) {
          totalProgress += pesoPorTarefa;
        }
      }
    }

    // Adicionar tarefas excluídas (peso = 0)
    for (const task of excludedTasks) {
      taskResults.push({
        rowNumber: task.rowNumber,
        task_name: task.NomeDaTarefa,
        fase: task.fase_nome,
        discipline_raw: task.Disciplina,
        discipline_standard: task.standard_discipline,
        activity_type: null,
        status: task.Status,
        is_complete: task.is_complete,
        data_inicio: task.DataDeInicio,
        data_termino: task.DataDeTermino,
        peso_na_fase: 0,
        peso_no_projeto: 0,
      });
    }

    // Ordenar por rowNumber
    taskResults.sort((a, b) => Number(a.rowNumber) - Number(b.rowNumber));

    // 5. Breakdown por fase
    const phaseBreakdown = [];
    for (const pw of weightConfig.phaseWeights) {
      const phaseTasks = taskResults.filter(t => t.fase === pw.phaseName && t.peso_no_projeto > 0);
      const phaseProgress = phaseTasks
        .filter(t => t.is_complete)
        .reduce((sum, t) => sum + t.peso_no_projeto, 0);
      const phaseTotal = phaseTasks.reduce((sum, t) => sum + t.peso_no_projeto, 0);

      phaseBreakdown.push({
        phase_name: pw.phaseName,
        weight_percent: pw.percent,
        total_tasks: phaseTasks.length,
        completed_tasks: phaseTasks.filter(t => t.is_complete).length,
        phase_progress: Math.round(phaseProgress * 10000) / 10000,
        phase_total_weight: Math.round(phaseTotal * 10000) / 10000,
      });
    }

    // 6. Calcular IDP (Índice de Desempenho de Prazo)
    // IDP = progresso real / progresso planejado até hoje
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let plannedProgress = 0;
    for (const task of taskResults) {
      if (task.peso_no_projeto <= 0) continue;
      const termino = task.data_termino ? new Date(task.data_termino) : null;
      if (termino && termino <= today) {
        plannedProgress += task.peso_no_projeto;
      }
    }
    plannedProgress = Math.round(plannedProgress * 100) / 100;

    const idp = plannedProgress > 0
      ? Math.round((totalProgress / plannedProgress) * 100) / 100
      : null; // null = sem dados planejados até hoje

    const desvio = plannedProgress > 0
      ? Math.round((totalProgress - plannedProgress) * 100) / 100
      : null;

    return {
      tasks: taskResults,
      progress: {
        total_progress: Math.round(totalProgress * 100) / 100,
        planned_progress: plannedProgress,
        idp,
        desvio,
        total_tasks: enrichedTasks.length,
        active_tasks: activeTasks.length,
        excluded_tasks: excludedTasks.length,
        completed_tasks: activeTasks.filter(t => t.is_complete).length,
      },
      phase_breakdown: phaseBreakdown,
    };
  }

  /**
   * Gera lista de meses entre startDate e endDate.
   * @returns {Array} [{year, month, label, endOfMonth}]
   */
  static generateMonthlyRange(startDate, endDate) {
    if (!startDate || !endDate) return [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

    const months = [];
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0);

    while (current <= endMonth) {
      months.push({
        year: current.getFullYear(),
        month: current.getMonth(),
        label: `${current.toLocaleString('pt-BR', { month: 'short' })}/${String(current.getFullYear()).slice(2)}`,
        endOfMonth: new Date(current.getFullYear(), current.getMonth() + 1, 0),
      });
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  }

  /**
   * Calcula série temporal mensal para o gráfico da Curva S.
   * Para cada mês, calcula o peso acumulado das tarefas com DataDeTermino <= fim do mês.
   * Meses passados consideram apenas tarefas concluídas; meses futuros consideram todas.
   *
   * @param {Object} params
   * @param {Array} params.taskResults - Resultado do calculate() com peso_no_projeto
   * @param {string} params.startDate - Data início do projeto (YYYY-MM-DD)
   * @param {string} params.endDate - Data fim do projeto (YYYY-MM-DD)
   * @returns {Array} [{month, cumulative_progress, monthly_increment, is_past}, ...]
   */
  static calculateTimeSeries({ taskResults, startDate, endDate }) {
    const months = this.generateMonthlyRange(startDate, endDate);
    if (months.length === 0) return [];

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const activeTasks = taskResults.filter(t => t.peso_no_projeto > 0);

    const timeSeries = [];
    let previousCumulative = 0;

    for (const m of months) {
      let cumulativeProgress = 0;

      for (const task of activeTasks) {
        const termino = task.data_termino ? new Date(task.data_termino) : null;

        if (m.endOfMonth <= today) {
          if (task.is_complete && termino && termino <= m.endOfMonth) {
            cumulativeProgress += task.peso_no_projeto;
          }
        } else {
          if (termino && termino <= m.endOfMonth) {
            cumulativeProgress += task.peso_no_projeto;
          }
        }
      }

      const monthlyIncrement = cumulativeProgress - previousCumulative;
      timeSeries.push({
        month: m.label,
        year: m.year,
        month_number: m.month + 1,
        cumulative_progress: Math.round(cumulativeProgress * 100) / 100,
        monthly_increment: Math.round(monthlyIncrement * 100) / 100,
        is_past: m.endOfMonth <= today,
      });
      previousCumulative = cumulativeProgress;
    }

    return timeSeries;
  }

  /**
   * Calcula série temporal planejada (ignora status, usa apenas DataDeTermino).
   * Usada para curvas de snapshots/reprogramações.
   */
  static calculatePlannedTimeSeries({ taskResults, startDate, endDate }) {
    const months = this.generateMonthlyRange(startDate, endDate);
    if (months.length === 0) return [];

    const activeTasks = taskResults.filter(t => t.peso_no_projeto > 0);

    const timeSeries = [];
    let previousCumulative = 0;

    for (const m of months) {
      let cumulativeProgress = 0;

      for (const task of activeTasks) {
        const termino = task.data_termino ? new Date(task.data_termino) : null;
        if (termino && termino <= m.endOfMonth) {
          cumulativeProgress += task.peso_no_projeto;
        }
      }

      const monthlyIncrement = cumulativeProgress - previousCumulative;
      timeSeries.push({
        month: m.label,
        year: m.year,
        month_number: m.month + 1,
        cumulative_progress: Math.round(cumulativeProgress * 100) / 100,
        monthly_increment: Math.round(monthlyIncrement * 100) / 100,
      });
      previousCumulative = cumulativeProgress;
    }

    return timeSeries;
  }
}

export { WeightCalculationService, isTaskComplete };
