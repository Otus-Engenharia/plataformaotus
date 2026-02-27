/**
 * Use Case: CalculateProgress
 * Calcula o progresso de um projeto com base nos pesos configurados.
 * Orquestra: BigQuery (tarefas) + Supabase (pesos + discipline mappings)
 */

import { WeightConfiguration } from '../../../domain/curva-s-progresso/entities/WeightConfiguration.js';
import { WeightCalculationService } from '../../../domain/curva-s-progresso/services/WeightCalculationService.js';

class CalculateProgress {
  #repository;
  #queryTasks;
  #fetchDisciplineMappings;

  /**
   * @param {CurvaSProgressoRepository} repository
   * @param {Function} queryTasks - queryCurvaSProgressoTasks(smartsheetId, projectName)
   * @param {Function} fetchDisciplineMappings - fetchDisciplineMappings(projectId)
   */
  constructor(repository, queryTasks, fetchDisciplineMappings) {
    this.#repository = repository;
    this.#queryTasks = queryTasks;
    this.#fetchDisciplineMappings = fetchDisciplineMappings;
  }

  /**
   * @param {Object} params
   * @param {string} params.projectCode - Código do projeto
   * @param {string} params.smartsheetId - ID do SmartSheet
   * @param {string} params.projectName - Nome do projeto (fallback)
   * @param {string} params.projectId - ID Supabase do projeto (para discipline mappings)
   * @returns {Object} { tasks, progress, phase_breakdown, weights }
   */
  async execute({ projectCode, smartsheetId, projectName, projectId }) {
    // BigQuery: buscar tarefas (crítico, sem fallback)
    const tasks = await this.#queryTasks(smartsheetId, projectName);

    if (!tasks || tasks.length === 0) {
      return {
        tasks: [],
        progress: {
          total_progress: 0,
          planned_progress: 0,
          idp: null,
          desvio: null,
          total_tasks: 0,
          active_tasks: 0,
          excluded_tasks: 0,
          completed_tasks: 0,
        },
        phase_breakdown: [],
        weights: null,
      };
    }

    // Supabase: pesos e mappings (fallback para arrays vazios se indisponível)
    let phases = [], disciplines = [], activities = [], overrides = [], mappingsRaw = [];
    try {
      [phases, disciplines, activities, overrides, mappingsRaw] = await Promise.all([
        this.#repository.findDefaultPhaseWeights(),
        this.#repository.findDefaultDisciplineWeights(),
        this.#repository.findDefaultActivityWeights(),
        this.#repository.findProjectOverrides(projectCode),
        projectId ? this.#fetchDisciplineMappings(projectId) : Promise.resolve([]),
      ]);
    } catch (err) {
      console.warn('⚠️ Supabase indisponível para pesos, usando defaults vazios:', err.message);
    }

    // Montar configuração de pesos (defaults + overrides)
    const defaults = WeightConfiguration.fromDefaults({ phases, disciplines, activities });
    const weightConfig = WeightConfiguration.mergeWithOverrides(defaults, overrides, projectCode);

    // Montar mapa de discipline mappings (SmartSheet name -> standard name)
    const disciplineMappings = new Map();
    for (const m of (mappingsRaw || [])) {
      if (m.external_discipline_name && m.standard_discipline) {
        const standardName = m.standard_discipline.discipline_name || m.standard_discipline.short_name;
        if (standardName) {
          disciplineMappings.set(m.external_discipline_name, standardName);
        }
      }
    }

    // Calcular
    const result = WeightCalculationService.calculate({
      tasks,
      weightConfig,
      disciplineMappings,
    });

    return {
      ...result,
      weights: weightConfig.toResponse(),
    };
  }
}

export { CalculateProgress };
