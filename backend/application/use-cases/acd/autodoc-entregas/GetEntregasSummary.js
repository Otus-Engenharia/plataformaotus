/**
 * Use Case: GetEntregasSummary
 * Retorna estatisticas agregadas de entregas Autodoc.
 */

class GetEntregasSummary {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ days = 7 }) {
    return this.#repository.getSummary({ days });
  }
}

export { GetEntregasSummary };
