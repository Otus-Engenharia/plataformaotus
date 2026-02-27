/**
 * Use Case: GetDefaultWeights
 * Busca todos os pesos padrão globais (fases, disciplinas, etapas)
 */

import { WeightConfiguration } from '../../../domain/curva-s-progresso/entities/WeightConfiguration.js';

class GetDefaultWeights {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute() {
    let phases = [], disciplines = [], activities = [];
    try {
      [phases, disciplines, activities] = await Promise.all([
        this.#repository.findDefaultPhaseWeights(),
        this.#repository.findDefaultDisciplineWeights(),
        this.#repository.findDefaultActivityWeights(),
      ]);
    } catch (err) {
      console.warn('⚠️ Supabase indisponível para pesos padrão:', err.message);
    }

    const config = WeightConfiguration.fromDefaults({ phases, disciplines, activities });
    return config.toResponse();
  }
}

export { GetDefaultWeights };
