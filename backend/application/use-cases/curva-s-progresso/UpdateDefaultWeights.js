/**
 * Use Case: UpdateDefaultWeights
 * Atualiza os pesos padrão globais (requer privilégio)
 */

import { WeightConfiguration } from '../../../domain/curva-s-progresso/entities/WeightConfiguration.js';

class UpdateDefaultWeights {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  /**
   * @param {Object} params
   * @param {Array} params.phaseWeights - [{phase_name, weight_percent, sort_order}]
   * @param {Array} params.disciplineWeights - [{discipline_name, weight_factor, standard_discipline_id?}]
   * @param {Array} params.activityWeights - [{activity_type, weight_factor}]
   */
  async execute({ phaseWeights, disciplineWeights, activityWeights }) {
    // Validar a configuração antes de salvar
    const config = new WeightConfiguration({
      phaseWeights: (phaseWeights || []).map((pw, idx) => ({
        phase_name: pw.phase_name,
        weight_percent: pw.weight_percent,
        sort_order: pw.sort_order ?? idx + 1,
      })),
      disciplineWeights: (disciplineWeights || []).map(dw => ({
        discipline_name: dw.discipline_name,
        weight_factor: dw.weight_factor,
        standard_discipline_id: dw.standard_discipline_id || null,
      })),
      activityWeights: (activityWeights || []).map(aw => ({
        activity_type: aw.activity_type,
        weight_factor: aw.weight_factor,
      })),
    });

    const { valid, errors } = config.validate();
    if (!valid) {
      throw new Error(`Configuração inválida: ${errors.join('; ')}`);
    }

    // Salvar cada camada
    const results = await Promise.all([
      phaseWeights ? this.#repository.saveDefaultPhaseWeights(
        phaseWeights.map((pw, idx) => ({
          phase_name: pw.phase_name,
          weight_percent: pw.weight_percent,
          sort_order: pw.sort_order ?? idx + 1,
        }))
      ) : this.#repository.findDefaultPhaseWeights(),
      disciplineWeights ? this.#repository.saveDefaultDisciplineWeights(
        disciplineWeights.map(dw => ({
          discipline_name: dw.discipline_name,
          weight_factor: dw.weight_factor,
          standard_discipline_id: dw.standard_discipline_id || null,
        }))
      ) : this.#repository.findDefaultDisciplineWeights(),
      activityWeights ? this.#repository.saveDefaultActivityWeights(
        activityWeights.map(aw => ({
          activity_type: aw.activity_type,
          weight_factor: aw.weight_factor,
        }))
      ) : this.#repository.findDefaultActivityWeights(),
    ]);

    const saved = WeightConfiguration.fromDefaults({
      phases: results[0],
      disciplines: results[1],
      activities: results[2],
    });

    return saved.toResponse();
  }
}

export { UpdateDefaultWeights };
