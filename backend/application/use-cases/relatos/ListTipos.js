/**
 * Use Case: Listar Tipos de Relato
 */

class ListTipos {
  #relatoRepository;

  constructor(relatoRepository) {
    this.#relatoRepository = relatoRepository;
  }

  async execute() {
    return await this.#relatoRepository.findAllTipos();
  }
}

export { ListTipos };
