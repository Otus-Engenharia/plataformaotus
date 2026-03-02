/**
 * Interface: TimeSavingsRepository
 *
 * Define o contrato para persistência de eventos de economia de horas.
 * A implementação concreta fica na camada de infraestrutura.
 */

class TimeSavingsRepository {
  // --- Eventos ---

  /**
   * Salva um novo evento de economia de tempo
   * @param {TimeSavingsEvent} event
   * @returns {Promise<TimeSavingsEvent>}
   */
  async saveEvent(event) {
    throw new Error('Método saveEvent deve ser implementado');
  }

  /**
   * Busca eventos com filtros e paginação
   * @param {Object} filters
   * @param {string} filters.catalogId
   * @param {string} filters.userEmail
   * @param {string} filters.from - ISO date
   * @param {string} filters.to - ISO date
   * @param {number} filters.page
   * @param {number} filters.limit
   * @returns {Promise<{data: TimeSavingsEvent[], total: number}>}
   */
  async findEvents(filters = {}) {
    throw new Error('Método findEvents deve ser implementado');
  }

  // --- Agregações ---

  /**
   * Retorna totais agregados (total eventos, total minutos, usuários únicos)
   * @param {Object} filters - { from, to, area }
   * @returns {Promise<{totalEvents: number, totalMinutes: number, uniqueUsers: number}>}
   */
  async getSummary(filters = {}) {
    throw new Error('Método getSummary deve ser implementado');
  }

  /**
   * Retorna economia agrupada por automação
   * @param {Object} filters - { from, to, area }
   * @returns {Promise<Array<{catalogId, name, eventCount, totalMinutes}>>}
   */
  async getSummaryByAutomation(filters = {}) {
    throw new Error('Método getSummaryByAutomation deve ser implementado');
  }

  /**
   * Retorna economia agrupada por usuário
   * @param {Object} filters - { from, to, area }
   * @returns {Promise<Array<{userEmail, userName, eventCount, totalMinutes}>>}
   */
  async getSummaryByUser(filters = {}) {
    throw new Error('Método getSummaryByUser deve ser implementado');
  }

  /**
   * Retorna tendência mensal (últimos N meses)
   * @param {number} monthsBack
   * @returns {Promise<Array<{month, events, minutes}>>}
   */
  async getMonthlyTrend(monthsBack = 12) {
    throw new Error('Método getMonthlyTrend deve ser implementado');
  }

  // --- Catálogo ---

  /**
   * Lista todas as automações do catálogo
   * @param {boolean} activeOnly - Se true, retorna apenas ativos
   * @returns {Promise<Array>}
   */
  async findAllCatalog(activeOnly = true) {
    throw new Error('Método findAllCatalog deve ser implementado');
  }

  /**
   * Busca uma automação do catálogo por ID
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async findCatalogById(id) {
    throw new Error('Método findCatalogById deve ser implementado');
  }

  /**
   * Atualiza uma automação do catálogo
   * @param {string} id
   * @param {Object} updates - { default_minutes, is_active }
   * @returns {Promise<Object>}
   */
  async updateCatalog(id, updates) {
    throw new Error('Método updateCatalog deve ser implementado');
  }
}

export { TimeSavingsRepository };
