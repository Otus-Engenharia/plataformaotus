/**
 * Use Case: Estatísticas de Relatos por Projeto
 */

class GetRelatoStats {
  #relatoRepository;

  constructor(relatoRepository) {
    this.#relatoRepository = relatoRepository;
  }

  async execute(projectCode) {
    return await this.#relatoRepository.getStatsByProject(projectCode);
  }
}

export { GetRelatoStats };
