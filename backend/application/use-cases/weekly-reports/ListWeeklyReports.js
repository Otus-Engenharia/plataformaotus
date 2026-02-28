/**
 * Use Case: ListWeeklyReports
 *
 * Lista relatórios semanais de um projeto específico (histórico).
 */

class ListWeeklyReports {
  #reportRepository;

  constructor(reportRepository) {
    this.#reportRepository = reportRepository;
  }

  /**
   * @param {Object} params
   * @param {string} params.projectCode - Código do projeto
   * @param {number} params.limit - Máximo de resultados (default: 10)
   * @returns {Promise<Array>}
   */
  async execute({ projectCode, limit = 10 }) {
    if (!projectCode) {
      throw new Error('Código do projeto é obrigatório');
    }

    const reports = await this.#reportRepository.findByProject(projectCode, { limit });
    return reports.map(r => r.toResponse());
  }
}

export { ListWeeklyReports };
