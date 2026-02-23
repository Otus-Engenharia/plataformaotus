/**
 * Use Case: ListBaselines
 * Lista todas as baselines de um projeto.
 */

class ListBaselines {
  #baselineRepository;

  constructor(baselineRepository) {
    this.#baselineRepository = baselineRepository;
  }

  async execute({ projectCode }) {
    if (!projectCode) {
      throw new Error('Código do projeto é obrigatório');
    }

    const baselines = await this.#baselineRepository.findByProjectCode(projectCode);
    return baselines.map(b => b.toResponse());
  }
}

export { ListBaselines };
