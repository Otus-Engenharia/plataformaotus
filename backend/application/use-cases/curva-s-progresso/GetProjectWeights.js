/**
 * Use Case: GetProjectWeights
 * Busca pesos de um projeto (merge de defaults + overrides)
 */

import { WeightConfiguration } from '../../../domain/curva-s-progresso/entities/WeightConfiguration.js';

class GetProjectWeights {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  /**
   * @param {string} projectCode - Código do projeto
   */
  async execute(projectCode) {
    if (!projectCode) {
      throw new Error('Código do projeto é obrigatório');
    }

    // Buscar defaults e overrides em paralelo (fallback para vazios se Supabase indisponível)
    let phases = [], disciplines = [], activities = [], overrides = [];
    try {
      [phases, disciplines, activities, overrides] = await Promise.all([
        this.#repository.findDefaultPhaseWeights(),
        this.#repository.findDefaultDisciplineWeights(),
        this.#repository.findDefaultActivityWeights(),
        this.#repository.findProjectOverrides(projectCode),
      ]);
    } catch (err) {
      console.warn('⚠️ Supabase indisponível para pesos do projeto:', err.message);
    }

    const defaults = WeightConfiguration.fromDefaults({ phases, disciplines, activities });

    const config = WeightConfiguration.mergeWithOverrides(
      defaults,
      overrides,
      projectCode
    );

    return config.toResponse();
  }
}

export { GetProjectWeights };
