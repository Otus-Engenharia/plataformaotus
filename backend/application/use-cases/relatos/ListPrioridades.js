/**
 * Use Case: Listar Prioridades de Relato
 */

class ListPrioridades {
  #relatoRepository;

  constructor(relatoRepository) {
    this.#relatoRepository = relatoRepository;
  }

  async execute() {
    return await this.#relatoRepository.findAllPrioridades();
  }
}

export { ListPrioridades };
