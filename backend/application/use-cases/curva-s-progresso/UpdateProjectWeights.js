/**
 * Use Case: UpdateProjectWeights
 * Salva overrides de pesos para um projeto específico
 */

import { WeightConfiguration } from '../../../domain/curva-s-progresso/entities/WeightConfiguration.js';

class UpdateProjectWeights {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  /**
   * @param {Object} params
   * @param {string} params.projectCode
   * @param {Object} params.phaseWeights - {phaseName: percent, ...}
   * @param {Object} params.disciplineWeights - {disciplineName: factor, ...}
   * @param {Object} params.activityWeights - {activityType: factor, ...}
   */
  async execute({ projectCode, phaseWeights, disciplineWeights, activityWeights }) {
    if (!projectCode) {
      throw new Error('Código do projeto é obrigatório');
    }

    // Construir configuração para validação
    const phaseArr = phaseWeights
      ? Object.entries(phaseWeights).map(([name, percent], idx) => ({
          phase_name: name,
          weight_percent: percent,
          sort_order: idx + 1,
        }))
      : [];

    const discArr = disciplineWeights
      ? Object.entries(disciplineWeights).map(([name, factor]) => ({
          discipline_name: name,
          weight_factor: factor,
        }))
      : [];

    const actArr = activityWeights
      ? Object.entries(activityWeights).map(([type, factor]) => ({
          activity_type: type,
          weight_factor: factor,
        }))
      : [];

    // Se alguma camada foi fornecida, validar a configuração completa
    // Buscar defaults para completar camadas não fornecidas
    const [defaultPhases, defaultDisc, defaultAct] = await Promise.all([
      phaseArr.length === 0 ? this.#repository.findDefaultPhaseWeights() : Promise.resolve(null),
      discArr.length === 0 ? this.#repository.findDefaultDisciplineWeights() : Promise.resolve(null),
      actArr.length === 0 ? this.#repository.findDefaultActivityWeights() : Promise.resolve(null),
    ]);

    const config = new WeightConfiguration({
      phaseWeights: phaseArr.length > 0 ? phaseArr : defaultPhases,
      disciplineWeights: discArr.length > 0 ? discArr : defaultDisc,
      activityWeights: actArr.length > 0 ? actArr : defaultAct,
    });

    const { valid, errors } = config.validate();
    if (!valid) {
      throw new Error(`Configuração inválida: ${errors.join('; ')}`);
    }

    // Salvar overrides
    const overrides = {
      phase_weights: phaseWeights || null,
      discipline_weights: disciplineWeights || null,
      activity_weights: activityWeights || null,
    };

    const saved = await this.#repository.saveProjectOverrides(projectCode, overrides);
    return saved;
  }
}

export { UpdateProjectWeights };
