/**
 * Use Case: GetTimeSavingsDetails
 * Retorna log de auditoria paginado e filtrável de eventos de economia.
 */

class GetTimeSavingsDetails {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  /**
   * @param {Object} params
   * @param {string} [params.catalogId] - Filtro por automação
   * @param {string} [params.userEmail] - Filtro por usuário
   * @param {string} [params.from] - Data início (ISO)
   * @param {string} [params.to] - Data fim (ISO)
   * @param {number} [params.page=1]
   * @param {number} [params.limit=50]
   * @returns {Promise<{data: Array, total: number, page: number, limit: number}>}
   */
  async execute({ catalogId, userEmail, from, to, page = 1, limit = 50 } = {}) {
    // Limitar máximo de resultados por página
    const safeLimit = Math.min(Math.max(1, limit), 200);
    const safePage = Math.max(1, page);

    const result = await this.#repository.findEvents({
      catalogId,
      userEmail,
      from,
      to,
      page: safePage,
      limit: safeLimit,
    });

    return {
      data: result.data.map(event => event.toResponse()),
      total: result.total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(result.total / safeLimit),
    };
  }
}

export { GetTimeSavingsDetails };
