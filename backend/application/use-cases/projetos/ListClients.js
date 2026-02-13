/**
 * Use Case: ListClients
 * Busca empresas do tipo 'client' para o dropdown do formulário
 */

class ListClients {
  #projetoRepository;

  constructor(projetoRepository) {
    this.#projetoRepository = projetoRepository;
  }

  async execute() {
    return await this.#projetoRepository.findClients();
  }
}

export { ListClients };
