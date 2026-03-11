/**
 * Use Case: ListClassificacoes
 *
 * Lista todas as classificações de clientes.
 */

class ListClassificacoes {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute() {
    const classificacoes = await this.#repository.findAllClassificacoes();
    return classificacoes.map(c => c.toResponse());
  }
}

export { ListClassificacoes };
