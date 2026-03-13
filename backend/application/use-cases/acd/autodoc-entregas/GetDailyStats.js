/**
 * Use Case: GetDailyStats
 *
 * Retorna estatísticas diárias de entregas agrupadas por projeto.
 */

class GetDailyStats {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ days = 7, startDate, endDate } = {}) {
    const stats = await this.#repository.getDailyStats({ days, startDate, endDate });
    const nameMap = await this.#repository.getProjectNameMap();

    const projectNames = {};
    for (const [code, name] of nameMap) {
      projectNames[code] = name;
    }

    return { dailyStats: stats, projectNames };
  }
}

export { GetDailyStats };
