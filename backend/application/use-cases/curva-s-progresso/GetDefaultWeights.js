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
    const [phases, disciplines, activities] = await Promise.all([
      this.#repository.findDefaultPhaseWeights(),
      this.#repository.findDefaultDisciplineWeights(),
      this.#repository.findDefaultActivityWeights(),
    ]);

    const config = WeightConfiguration.fromDefaults({ phases, disciplines, activities });
    return config.toResponse();
  }
}

export { GetDefaultWeights };
