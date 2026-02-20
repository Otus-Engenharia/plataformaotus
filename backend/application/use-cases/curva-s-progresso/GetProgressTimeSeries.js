/**
 * Use Case: GetProgressTimeSeries
 * Calcula a série temporal mensal para o gráfico da Curva S.
 * Retorna a curva "Atual" (realizado + projeção futura).
 */

import { WeightConfiguration } from '../../../domain/curva-s-progresso/entities/WeightConfiguration.js';
import { WeightCalculationService } from '../../../domain/curva-s-progresso/services/WeightCalculationService.js';

class GetProgressTimeSeries {
  #repository;
  #queryTasks;
  #fetchDisciplineMappings;

  constructor(repository, queryTasks, fetchDisciplineMappings) {
    this.#repository = repository;
    this.#queryTasks = queryTasks;
    this.#fetchDisciplineMappings = fetchDisciplineMappings;
  }

  /**
   * @param {Object} params
   * @param {string} params.projectCode
   * @param {string} params.smartsheetId
   * @param {string} params.projectName
   * @param {string} params.projectId - Supabase project ID
   * @param {string} params.startDate - Data início do projeto
   * @param {string} params.endDate - Data fim do projeto
   * @returns {Object} { timeseries, progress, weights }
   */
  async execute({ projectCode, smartsheetId, projectName, projectId, startDate, endDate }) {
    const [tasks, phases, disciplines, activities, overrides, mappingsRaw] = await Promise.all([
      this.#queryTasks(smartsheetId, projectName),
      this.#repository.findDefaultPhaseWeights(),
      this.#repository.findDefaultDisciplineWeights(),
      this.#repository.findDefaultActivityWeights(),
      this.#repository.findProjectOverrides(projectCode),
      projectId ? this.#fetchDisciplineMappings(projectId) : Promise.resolve([]),
    ]);

    if (!tasks || tasks.length === 0) {
      return { timeseries: [], progress: null, weights: null };
    }

    const defaults = WeightConfiguration.fromDefaults({ phases, disciplines, activities });
    const weightConfig = WeightConfiguration.mergeWithOverrides(defaults, overrides, projectCode);

    const disciplineMappings = new Map();
    for (const m of (mappingsRaw || [])) {
      if (m.external_discipline_name && m.standard_discipline) {
        const standardName = m.standard_discipline.discipline_name || m.standard_discipline.short_name;
        if (standardName) {
          disciplineMappings.set(m.external_discipline_name, standardName);
        }
      }
    }

    // Calcular pesos por tarefa
    const calcResult = WeightCalculationService.calculate({
      tasks,
      weightConfig,
      disciplineMappings,
    });

    // Derivar datas do projeto se não fornecidas
    const projectStart = startDate || this.#deriveStartDate(tasks);
    const projectEnd = endDate || this.#deriveEndDate(tasks);

    // Calcular série temporal
    const timeseries = WeightCalculationService.calculateTimeSeries({
      taskResults: calcResult.tasks,
      startDate: projectStart,
      endDate: projectEnd,
    });

    return {
      timeseries,
      progress: calcResult.progress,
      weights: weightConfig.toResponse(),
    };
  }

  #deriveStartDate(tasks) {
    let earliest = null;
    for (const t of tasks) {
      const d = t.DataDeInicio ? new Date(t.DataDeInicio) : null;
      if (d && !isNaN(d.getTime()) && (!earliest || d < earliest)) {
        earliest = d;
      }
    }
    return earliest ? earliest.toISOString().split('T')[0] : null;
  }

  #deriveEndDate(tasks) {
    let latest = null;
    for (const t of tasks) {
      const d = t.DataDeTermino ? new Date(t.DataDeTermino) : null;
      if (d && !isNaN(d.getTime()) && (!latest || d > latest)) {
        latest = d;
      }
    }
    return latest ? latest.toISOString().split('T')[0] : null;
  }
}

export { GetProgressTimeSeries };
