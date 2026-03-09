/**
 * Use Case: ListRecentChanges
 * Lista mudanças recentes em todos os projetos.
 */

class ListRecentChanges {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ page = 1, limit = 20, days = 7 }) {
    const { data, total } = await this.#repository.findRecentChangeLogs(
      { page, limit, days }
    );

    return {
      data: data.map(cl => cl.toResponse()),
      total,
      page,
      limit,
      days,
    };
  }
}

export { ListRecentChanges };
