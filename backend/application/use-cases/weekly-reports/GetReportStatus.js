/**
 * Use Case: GetReportStatus
 *
 * Retorna o status atual de um relatório em geração (para polling do frontend).
 */

class GetReportStatus {
  #reportRepository;

  constructor(reportRepository) {
    this.#reportRepository = reportRepository;
  }

  /**
   * @param {string} reportId - UUID do relatório
   * @returns {Promise<Object|null>}
   */
  async execute(reportId) {
    if (!reportId) {
      throw new Error('ID do relatório é obrigatório');
    }

    const report = await this.#reportRepository.findById(reportId);
    if (!report) return null;

    return report.toResponse();
  }
}

export { GetReportStatus };
