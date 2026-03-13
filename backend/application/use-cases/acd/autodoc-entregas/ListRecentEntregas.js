/**
 * Use Case: ListRecentEntregas
 * Lista entregas Autodoc recentes com filtros.
 */

class ListRecentEntregas {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ days = 7, startDate, endDate, projectCode, classification, page = 1, limit = 50, filterBy = 'created' }) {
    const { data, total } = await this.#repository.findRecentDocuments({
      days, startDate, endDate, projectCode, classification, page, limit, filterBy,
    });

    const nameMap = await this.#repository.getProjectNameMap();

    return {
      data: data.map(doc => {
        const resp = doc.toResponse();
        resp.project_name = nameMap.get(resp.project_code) || resp.project_code;
        return resp;
      }),
      total,
      page,
      limit,
      days,
    };
  }
}

export { ListRecentEntregas };
