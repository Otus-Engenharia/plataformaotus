/**
 * Use Case: GetBaseline
 * Busca detalhes de uma baseline pelo ID.
 */

class GetBaseline {
  #baselineRepository;

  constructor(baselineRepository) {
    this.#baselineRepository = baselineRepository;
  }

  async execute({ id }) {
    if (!id) {
      throw new Error('ID da baseline é obrigatório');
    }

    const baseline = await this.#baselineRepository.findById(id);
    if (!baseline) {
      throw new Error(`Baseline ${id} não encontrada`);
    }

    return baseline.toResponse();
  }
}

export { GetBaseline };
