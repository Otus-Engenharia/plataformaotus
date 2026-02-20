/**
 * Use Case: GetProgressTimeSeries
 * Calcula a série temporal mensal para o gráfico da Curva S.
 * Retorna a curva "Atual" (realizado + projeção futura)
 * e curvas de snapshots mensais (reprogramações).
 */

import { WeightConfiguration } from '../../../domain/curva-s-progresso/entities/WeightConfiguration.js';
import { WeightCalculationService } from '../../../domain/curva-s-progresso/services/WeightCalculationService.js';

class GetProgressTimeSeries {
  #repository;
  #queryTasks;
  #fetchDisciplineMappings;
  #querySnapshotTasks;

  constructor(repository, queryTasks, fetchDisciplineMappings, querySnapshotTasks = null) {
    this.#repository = repository;
    this.#queryTasks = queryTasks;
    this.#fetchDisciplineMappings = fetchDisciplineMappings;
    this.#querySnapshotTasks = querySnapshotTasks;
  }

  /**
   * @param {Object} params
   * @param {string} params.projectCode
   * @param {string} params.smartsheetId
   * @param {string} params.projectName
   * @param {string} params.projectId - Supabase project ID
   * @param {string} params.startDate - Data início do projeto
   * @param {string} params.endDate - Data fim do projeto
   * @returns {Object} { timeseries, snapshot_curves, progress, weights }
   */
  async execute({ projectCode, smartsheetId, projectName, projectId, startDate, endDate }) {
    const queries = [
      this.#queryTasks(smartsheetId, projectName),
      this.#repository.findDefaultPhaseWeights(),
      this.#repository.findDefaultDisciplineWeights(),
      this.#repository.findDefaultActivityWeights(),
      this.#repository.findProjectOverrides(projectCode),
      projectId ? this.#fetchDisciplineMappings(projectId) : Promise.resolve([]),
    ];

    // Buscar snapshots em paralelo se disponível
    if (this.#querySnapshotTasks) {
      queries.push(this.#querySnapshotTasks(smartsheetId, projectName));
    }

    const results = await Promise.all(queries);
    const [tasks, phases, disciplines, activities, overrides, mappingsRaw] = results;
    const rawSnapshot = results[6];
    const snapshotData = {
      rows: rawSnapshot?.rows || [],
      snapshots: rawSnapshot?.snapshots instanceof Map ? rawSnapshot.snapshots : new Map(),
    };

    if (!tasks || tasks.length === 0) {
      return { timeseries: [], snapshot_curves: [], progress: null, weights: null };
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

    // Calcular pesos por tarefa (dados atuais)
    const calcResult = WeightCalculationService.calculate({
      tasks,
      weightConfig,
      disciplineMappings,
    });

    // Derivar datas do projeto
    let projectStart = startDate || this.#deriveStartDate(tasks);
    let projectEnd = endDate || this.#deriveEndDate(tasks);

    // Expandir range com datas dos snapshots
    if (snapshotData.snapshots.size > 0) {
      for (const [, snapshotTasks] of snapshotData.snapshots) {
        const snapStart = this.#deriveStartDate(snapshotTasks);
        const snapEnd = this.#deriveEndDate(snapshotTasks);
        if (snapStart && (!projectStart || snapStart < projectStart)) projectStart = snapStart;
        if (snapEnd && (!projectEnd || snapEnd > projectEnd)) projectEnd = snapEnd;
      }
    }

    // Calcular série temporal atual (Executado + Projeção)
    const timeseries = WeightCalculationService.calculateTimeSeries({
      taskResults: calcResult.tasks,
      startDate: projectStart,
      endDate: projectEnd,
    });

    // Calcular curvas de snapshots (reprogramações mensais)
    const snapshot_curves = [];
    if (snapshotData.snapshots.size > 0) {
      const sortedDates = [...snapshotData.snapshots.keys()].sort();

      for (const snapshotDate of sortedDates) {
        const snapshotTasks = snapshotData.snapshots.get(snapshotDate);

        // Calcular pesos para este snapshot
        const snapCalc = WeightCalculationService.calculate({
          tasks: snapshotTasks,
          weightConfig,
          disciplineMappings,
        });

        // Calcular curva planejada (sem considerar status)
        const snapTimeseries = WeightCalculationService.calculatePlannedTimeSeries({
          taskResults: snapCalc.tasks,
          startDate: projectStart,
          endDate: projectEnd,
        });

        // Gerar label: "Jun/25"
        const d = new Date(snapshotDate);
        const label = `${d.toLocaleString('pt-BR', { month: 'short' })}/${String(d.getFullYear()).slice(2)}`;

        snapshot_curves.push({
          snapshot_date: snapshotDate,
          label: label.charAt(0).toUpperCase() + label.slice(1),
          timeseries: snapTimeseries,
        });
      }
    }

    return {
      timeseries,
      snapshot_curves,
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
