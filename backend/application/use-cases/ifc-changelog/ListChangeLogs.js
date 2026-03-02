/**
 * Use Case: ListChangeLogs
 * Lista logs de mudança de um projeto específico com paginação.
 */

class ListChangeLogs {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ projectCode, page = 1, limit = 50, category = null }) {
    const { data, total } = await this.#repository.findChangeLogsByProject(
      projectCode,
      { page, limit, category }
    );

    return {
      data: data.map(cl => cl.toResponse()),
      total,
      page,
      limit,
    };
  }
}

export { ListChangeLogs };
