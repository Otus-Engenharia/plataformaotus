/**
 * Interface: WeeklyReportRepository
 *
 * Define o contrato para persistência de Relatórios Semanais.
 * A implementação concreta fica na camada de infraestrutura.
 */

class WeeklyReportRepository {
  /**
   * Salva um novo relatório
   * @param {WeeklyReport} report
   * @returns {Promise<WeeklyReport>} relatório salvo com ID
   */
  async save(report) {
    throw new Error('Método save deve ser implementado');
  }

  /**
   * Atualiza um relatório existente
   * @param {WeeklyReport} report
   * @returns {Promise<WeeklyReport>}
   */
  async update(report) {
    throw new Error('Método update deve ser implementado');
  }

  /**
   * Busca relatório por ID
   * @param {string} id - UUID do relatório
   * @returns {Promise<WeeklyReport|null>}
   */
  async findById(id) {
    throw new Error('Método findById deve ser implementado');
  }

  /**
   * Busca relatórios de um projeto específico
   * @param {string} projectCode
   * @param {Object} options
   * @param {number} options.limit - máximo de resultados
   * @returns {Promise<Array<WeeklyReport>>}
   */
  async findByProject(projectCode, options = {}) {
    throw new Error('Método findByProject deve ser implementado');
  }

  /**
   * Busca relatórios de uma semana específica
   * @param {number} weekYear
   * @param {number} weekNumber
   * @returns {Promise<Array<WeeklyReport>>}
   */
  async findByWeek(weekYear, weekNumber) {
    throw new Error('Método findByWeek deve ser implementado');
  }

  /**
   * Retorna estatísticas de geração por semana (para KPI dashboard)
   * @param {Object} options
   * @param {number} options.weeks - número de semanas para retornar
   * @param {string|null} options.leaderName - filtrar por líder
   * @returns {Promise<Array<{week_year, week_number, week_text, total_generated}>>}
   */
  async getWeeklyStats(options = {}) {
    throw new Error('Método getWeeklyStats deve ser implementado');
  }

  /**
   * Verifica se já existe relatório para um projeto em uma semana
   * @param {string} projectCode
   * @param {number} weekYear
   * @param {number} weekNumber
   * @returns {Promise<boolean>}
   */
  async existsForProjectWeek(projectCode, weekYear, weekNumber) {
    throw new Error('Método existsForProjectWeek deve ser implementado');
  }
}

export { WeeklyReportRepository };
