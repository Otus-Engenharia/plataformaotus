/**
 * Use Case: GetEstudoCustoStats
 *
 * Retorna estatisticas de solicitacoes de estudo de custos.
 */

class GetEstudoCustoStats {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute() {
    return await this.#repository.getStats();
  }
}

export { GetEstudoCustoStats };
