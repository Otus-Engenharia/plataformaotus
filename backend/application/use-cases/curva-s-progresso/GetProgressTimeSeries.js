/**
 * Use Case: GetProgressTimeSeries
 * Calcula a série temporal mensal para o gráfico da Curva S.
 * Retorna a curva "Atual" (realizado + projeção futura)
 * e curvas de snapshots mensais (reprogramações).
 */

import { WeightConfiguration } from '../../../domain/curva-s-progresso/entities/WeightConfiguration.js';
import { WeightCalculationService, parseBqDate } from '../../../domain/curva-s-progresso/services/WeightCalculationService.js';

class GetProgressTimeSeries {
  #repository;
  #queryTasks;
  #fetchDisciplineMappings;
  #querySnapshotTasks;
  #baselineRepository;

  constructor(repository, queryTasks, fetchDisciplineMappings, querySnapshotTasks = null, baselineRepository = null) {
    this.#repository = repository;
    this.#queryTasks = queryTasks;
    this.#fetchDisciplineMappings = fetchDisciplineMappings;
    this.#querySnapshotTasks = querySnapshotTasks;
    this.#baselineRepository = baselineRepository;
  }

  /**
   * @param {Object} params
   * @param {string} params.projectCode
   * @param {string} params.smartsheetId
   * @param {string} params.projectName
   * @param {string} params.projectId - Supabase project ID
   * @param {string} params.startDate - Data início do projeto
   * @param {string} params.endDate - Data fim do projeto
   * @returns {Object} { timeseries, snapshot_curves, baseline_curve, prazos, progress, weights }
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

    // Derivar datas do projeto a partir de tarefas ATIVAS (com peso > 0)
    const activeTaskResults = calcResult.tasks.filter(t => t.peso_no_projeto > 0);
    let projectStart = startDate || this.#deriveStartDateFromResults(activeTaskResults);
    let projectEnd = endDate || this.#deriveEndDateFromResults(activeTaskResults);

    // Fallback: se nenhuma tarefa ativa, usar todas as tarefas
    if (!projectStart) projectStart = this.#deriveStartDate(tasks);
    if (!projectEnd) projectEnd = this.#deriveEndDate(tasks);

    console.log(`[GetProgressTimeSeries] tasks: ${tasks.length}, active: ${activeTaskResults.length}, ` +
      `projectStart: ${projectStart}, projectEnd: ${projectEnd}`);

    // Pré-calcular pesos dos snapshots e expandir range com tarefas ativas
    const snapshotCalcs = [];
    if (snapshotData.snapshots.size > 0) {
      const sortedDates = [...snapshotData.snapshots.keys()].sort();
      for (const snapshotDate of sortedDates) {
        const snapshotTasks = snapshotData.snapshots.get(snapshotDate);
        const snapCalc = WeightCalculationService.calculate({
          tasks: snapshotTasks,
          weightConfig,
          disciplineMappings,
        });
        // Expandir range com tarefas ativas do snapshot
        const snapActive = snapCalc.tasks.filter(t => t.peso_no_projeto > 0);
        const snapEnd = this.#deriveEndDateFromResults(snapActive);
        if (snapEnd && (!projectEnd || snapEnd > projectEnd)) projectEnd = snapEnd;

        snapshotCalcs.push({ snapshotDate, snapCalc });
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
    for (const { snapshotDate, snapCalc } of snapshotCalcs) {
      const snapTimeseries = WeightCalculationService.calculatePlannedTimeSeries({
        taskResults: snapCalc.tasks,
        startDate: projectStart,
        endDate: projectEnd,
      });

      // Gerar label: "Jun/25" - usar T12:00 para evitar problemas de timezone
      const d = new Date(snapshotDate + 'T12:00:00');
      const label = `${d.toLocaleString('pt-BR', { month: 'short' })}/${String(d.getFullYear()).slice(2)}`;

      snapshot_curves.push({
        snapshot_date: snapshotDate,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        timeseries: snapTimeseries,
      });
    }

    // Calcular curvas de Baselines
    let baseline_curve = null;
    const baseline_curves = [];

    // Estratégia 1: Buscar baselines do novo sistema (Supabase + BigQuery snapshots)
    if (this.#baselineRepository) {
      try {
        const baselines = await this.#baselineRepository.findByProjectCode(projectCode);
        for (const bl of baselines.filter(b => b.isActive)) {
          try {
            const snapTasks = await this.#baselineRepository.getTaskSnapshots(bl.id);
            if (snapTasks.length === 0) continue;

            const snapCalc = WeightCalculationService.calculate({
              tasks: snapTasks,
              weightConfig,
              disciplineMappings,
            });

            const snapActive = snapCalc.tasks.filter(t => t.peso_no_projeto > 0);
            if (snapActive.length === 0) continue;

            const curve = WeightCalculationService.calculatePlannedTimeSeries({
              taskResults: snapActive,
              startDate: projectStart,
              endDate: projectEnd,
            });

            baseline_curves.push({
              id: bl.id,
              label: bl.name,
              revision: bl.revisionNumber,
              revision_label: bl.revisionLabel,
              timeseries: curve,
            });
          } catch (err) {
            console.warn(`Aviso: Erro ao calcular baseline ${bl.id}:`, err.message);
          }
        }
      } catch (err) {
        console.warn('Aviso: Erro ao buscar baselines:', err.message);
      }
    }

    // Estratégia 2: Fallback para SmartSheet (DataDeFimBaselineOtus) se nenhuma baseline no novo sistema
    if (baseline_curves.length === 0) {
      const baselineTasks = calcResult.tasks
        .filter(t => t.peso_no_projeto > 0)
        .map(t => {
          const original = tasks.find(ot => String(ot.rowNumber) === String(t.rowNumber));
          const baselineEnd = parseBqDate(original?.DataDeFimBaselineOtus);
          if (!baselineEnd) return null;
          return { ...t, data_termino: baselineEnd };
        })
        .filter(Boolean);

      if (baselineTasks.length > 0) {
        const baselineTimeseries = WeightCalculationService.calculatePlannedTimeSeries({
          taskResults: baselineTasks,
          startDate: projectStart,
          endDate: projectEnd,
        });
        baseline_curve = {
          label: 'Baseline Original',
          timeseries: baselineTimeseries,
        };
      }
    } else {
      // Primeira baseline ativa como baseline_curve principal (retrocompatibilidade)
      baseline_curve = baseline_curves[0];
    }

    // Calcular KPIs de prazo
    const activeTasks = calcResult.tasks.filter(t => t.peso_no_projeto > 0);
    const prazo_atual = this.#deriveMaxDate(activeTasks.map(t => t.data_termino));

    // Prazo baseline: preferir último baseline do novo sistema (maior revision)
    let prazo_baseline = null;
    let prazo_baseline_label = 'Baseline original';
    let idp_baseline = null;
    let desvio_baseline = null;
    let baseline_planned_progress = null;

    if (baseline_curves.length > 0) {
      // Último baseline = maior revision number
      const lastBaseline = baseline_curves.reduce((best, cur) =>
        cur.revision > best.revision ? cur : best, baseline_curves[0]);

      // Prazo = max data_termino das tarefas do último baseline
      try {
        const lastBlTasks = await this.#baselineRepository.getTaskSnapshots(lastBaseline.id);
        if (lastBlTasks.length > 0) {
          const lastBlCalc = WeightCalculationService.calculate({
            tasks: lastBlTasks,
            weightConfig,
            disciplineMappings,
          });
          const lastBlActive = lastBlCalc.tasks.filter(t => t.peso_no_projeto > 0);
          prazo_baseline = this.#deriveMaxDate(lastBlActive.map(t => t.data_termino));
          prazo_baseline_label = lastBaseline.label || lastBaseline.revision_label;

          // IDP baseado no último baseline: progresso planejado pelo baseline até hoje
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          baseline_planned_progress = lastBlActive
            .filter(t => t.data_termino && new Date(t.data_termino) <= today)
            .reduce((sum, t) => sum + t.peso_no_projeto, 0);

          if (baseline_planned_progress > 0) {
            idp_baseline = Math.round((calcResult.progress.total_progress / baseline_planned_progress) * 100) / 100;
            desvio_baseline = Math.round((calcResult.progress.total_progress - baseline_planned_progress) * 100) / 100;
          }
        }
      } catch (err) {
        console.warn('Aviso: Erro ao calcular KPIs do último baseline:', err.message);
      }
    }

    // Fallback: DataDeFimBaselineOtus do SmartSheet
    if (!prazo_baseline) {
      const baselineEndDates = tasks
        .map(t => parseBqDate(t.DataDeFimBaselineOtus))
        .filter(Boolean);
      prazo_baseline = this.#deriveMaxDate(baselineEndDates);
    }

    let prazo_reprogramado = null;
    if (snapshotData.snapshots.size > 0) {
      const sortedDates = [...snapshotData.snapshots.keys()].sort();
      const latestSnapshotTasks = snapshotData.snapshots.get(sortedDates[sortedDates.length - 1]) || [];
      const snapEndDates = latestSnapshotTasks
        .map(t => parseBqDate(t.DataDeTermino))
        .filter(Boolean);
      prazo_reprogramado = this.#deriveMaxDate(snapEndDates);
    }

    let variacao_dias = null;
    if (prazo_baseline && prazo_atual) {
      variacao_dias = Math.round(
        (new Date(prazo_atual) - new Date(prazo_baseline)) / (1000 * 60 * 60 * 24)
      );
    }

    // Enriquecer progress com KPIs baseados no baseline
    const enrichedProgress = {
      ...calcResult.progress,
      idp_baseline,
      desvio_baseline,
      baseline_planned_progress,
    };

    return {
      timeseries,
      snapshot_curves,
      baseline_curve,
      baseline_curves,
      prazos: { prazo_baseline, prazo_baseline_label, prazo_reprogramado, prazo_atual, variacao_dias },
      progress: enrichedProgress,
      weights: weightConfig.toResponse(),
    };
  }

  #deriveStartDate(tasks) {
    let earliest = null;
    for (const t of tasks) {
      const raw = parseBqDate(t.DataDeInicio);
      const d = raw ? new Date(raw) : null;
      if (d && !isNaN(d.getTime()) && (!earliest || d < earliest)) {
        earliest = d;
      }
    }
    return earliest ? earliest.toISOString().split('T')[0] : null;
  }

  #deriveMaxDate(dateStrings) {
    let latest = null;
    for (const raw of dateStrings) {
      if (!raw) continue;
      const d = new Date(raw);
      if (!isNaN(d.getTime()) && (!latest || d > latest)) {
        latest = d;
      }
    }
    return latest ? latest.toISOString().split('T')[0] : null;
  }

  #deriveEndDate(tasks) {
    let latest = null;
    for (const t of tasks) {
      const raw = parseBqDate(t.DataDeTermino);
      const d = raw ? new Date(raw) : null;
      if (d && !isNaN(d.getTime()) && (!latest || d > latest)) {
        latest = d;
      }
    }
    return latest ? latest.toISOString().split('T')[0] : null;
  }

  // Derivar datas a partir de taskResults (já processados com data_inicio/data_termino)
  #deriveStartDateFromResults(taskResults) {
    let earliest = null;
    for (const t of taskResults) {
      const d = t.data_inicio ? new Date(t.data_inicio) : null;
      if (d && !isNaN(d.getTime()) && (!earliest || d < earliest)) earliest = d;
    }
    return earliest ? earliest.toISOString().split('T')[0] : null;
  }

  #deriveEndDateFromResults(taskResults) {
    let latest = null;
    for (const t of taskResults) {
      const d = t.data_termino ? new Date(t.data_termino) : null;
      if (d && !isNaN(d.getTime()) && (!latest || d > latest)) latest = d;
    }
    return latest ? latest.toISOString().split('T')[0] : null;
  }
}

export { GetProgressTimeSeries };
