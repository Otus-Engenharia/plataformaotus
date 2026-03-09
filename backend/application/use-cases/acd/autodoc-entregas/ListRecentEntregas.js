/**
 * Use Case: ListRecentEntregas
 * Lista entregas Autodoc recentes com filtros.
 */

class ListRecentEntregas {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ days = 7, projectCode, classification, page = 1, limit = 50 }) {
    const { data, total } = await this.#repository.findRecentDocuments({
      days, projectCode, classification, page, limit,
    });

    return {
      data: data.map(doc => doc.toResponse()),
      total,
      page,
      limit,
      days,
    };
  }
}

export { ListRecentEntregas };
