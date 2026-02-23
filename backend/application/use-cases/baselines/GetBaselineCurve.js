/**
 * Use Case: GetBaselineCurve
 * Calcula a curva de uma baseline a partir do snapshot de tarefas.
 *
 * Fluxo:
 * 1. Busca metadados da baseline no Supabase
 * 2. Busca snapshot de tarefas no BigQuery
 * 3. Calcula pesos via WeightCalculationService
 * 4. Gera timeseries planejada
 */

import { WeightCalculationService } from '../../../domain/curva-s-progresso/services/WeightCalculationService.js';

class GetBaselineCurve {
  #baselineRepository;
  #curvaSRepository;

  constructor(baselineRepository, curvaSRepository) {
    this.#baselineRepository = baselineRepository;
    this.#curvaSRepository = curvaSRepository;
  }

  async execute({ id, projectCode, startDate, endDate }) {
    if (!id) {
      throw new Error('ID da baseline é obrigatório');
    }

    // 1. Buscar baseline
    const baseline = await this.#baselineRepository.findById(id);
    if (!baseline) {
      throw new Error(`Baseline ${id} não encontrada`);
    }

    // 2. Buscar snapshot de tarefas
    const snapshotTasks = await this.#baselineRepository.getTaskSnapshots(id);
    if (!snapshotTasks || snapshotTasks.length === 0) {
      return {
        id: baseline.id,
        label: baseline.name,
        revision: baseline.revisionNumber,
        timeseries: [],
      };
    }

    // 3. Buscar configuração de pesos
    const code = projectCode || baseline.projectCode;
    const defaults = await this.#loadWeightConfig(code);

    // 4. Buscar mapeamento de disciplinas
    const disciplineMappings = await this.#loadDisciplineMappings();

    // 5. Calcular pesos das tarefas do snapshot
    const calcResult = WeightCalculationService.calculate({
      tasks: snapshotTasks,
      weightConfig: defaults.weightConfig,
      disciplineMappings,
    });

    // 6. Derivar datas do snapshot
    const activeTasks = calcResult.tasks.filter(t => t.peso_no_projeto > 0);
    const derivedStart = this.#deriveMinDate(activeTasks, 'data_inicio');
    const derivedEnd = this.#deriveMaxDate(activeTasks, 'data_termino');

    const effectiveStart = startDate || derivedStart;
    const effectiveEnd = endDate || derivedEnd;

    // 7. Gerar curva planejada
    const timeseries = WeightCalculationService.calculatePlannedTimeSeries({
      taskResults: activeTasks,
      startDate: effectiveStart,
      endDate: effectiveEnd,
    });

    return {
      id: baseline.id,
      label: baseline.name,
      revision: baseline.revisionNumber,
      revision_label: baseline.revisionLabel,
      timeseries,
    };
  }

  async #loadWeightConfig(projectCode) {
    const { WeightConfiguration } = await import('../../../domain/curva-s-progresso/entities/WeightConfiguration.js');

    const phases = await this.#curvaSRepository.findDefaultPhaseWeights();
    const disciplines = await this.#curvaSRepository.findDefaultDisciplineWeights();
    const activities = await this.#curvaSRepository.findDefaultActivityWeights();

    const defaultConfig = WeightConfiguration.fromDefaults({ phases, disciplines, activities });

    let weightConfig = defaultConfig;
    if (projectCode) {
      const overrides = await this.#curvaSRepository.findProjectOverrides(projectCode);
      if (overrides) {
        weightConfig = WeightConfiguration.mergeWithOverrides(defaultConfig, overrides, projectCode);
      }
    }

    return { weightConfig };
  }

  async #loadDisciplineMappings() {
    try {
      const mappings = await this.#curvaSRepository.findDefaultDisciplineWeights();
      const map = new Map();
      for (const m of mappings) {
        if (m.standard_discipline_id) {
          map.set(m.discipline_name, m.standard_discipline_id);
        }
      }
      return map;
    } catch {
      return new Map();
    }
  }

  #deriveMinDate(tasks, field) {
    let earliest = null;
    for (const t of tasks) {
      const raw = t[field];
      const d = raw ? new Date(typeof raw === 'object' && raw.value ? raw.value : raw) : null;
      if (d && !isNaN(d.getTime()) && (!earliest || d < earliest)) earliest = d;
    }
    return earliest ? earliest.toISOString().split('T')[0] : null;
  }

  #deriveMaxDate(tasks, field) {
    let latest = null;
    for (const t of tasks) {
      const raw = t[field];
      const d = raw ? new Date(typeof raw === 'object' && raw.value ? raw.value : raw) : null;
      if (d && !isNaN(d.getTime()) && (!latest || d > latest)) latest = d;
    }
    return latest ? latest.toISOString().split('T')[0] : null;
  }
}

export { GetBaselineCurve };
