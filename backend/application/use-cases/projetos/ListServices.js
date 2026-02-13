/**
 * Use Case: ListServices
 * Busca serviços disponíveis (entregáveis Otus) para o dropdown do formulário
 */

class ListServices {
  #projetoRepository;

  constructor(projetoRepository) {
    this.#projetoRepository = projetoRepository;
  }

  async execute() {
    return await this.#projetoRepository.findServices();
  }
}

export { ListServices };
