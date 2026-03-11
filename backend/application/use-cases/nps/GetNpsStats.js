/**
 * Use Case: GetNpsStats
 * Retorna estatísticas agregadas de NPS/CSAT/CES
 */

class GetNpsStats {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ projectCode, projectCodes, source } = {}) {
    return this.#repository.getStats({ projectCode, projectCodes, source });
  }
}

export { GetNpsStats };
