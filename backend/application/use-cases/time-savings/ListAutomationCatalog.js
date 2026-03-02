/**
 * Use Case: ListAutomationCatalog
 * Retorna todas as automações do catálogo com suas estimativas.
 */

class ListAutomationCatalog {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  /**
   * @param {Object} params
   * @param {boolean} [params.activeOnly=true] - Se true, retorna apenas ativos
   * @returns {Promise<Array>}
   */
  async execute({ activeOnly = true } = {}) {
    return await this.#repository.findAllCatalog(activeOnly);
  }
}

export { ListAutomationCatalog };
