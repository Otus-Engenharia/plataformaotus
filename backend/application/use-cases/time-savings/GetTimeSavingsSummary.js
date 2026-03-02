/**
 * Use Case: GetTimeSavingsSummary
 * Retorna dados agregados para o dashboard de economia de horas.
 *
 * Inclui: totais, economia por automação, por usuário, e tendência mensal.
 */

class GetTimeSavingsSummary {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  /**
   * @param {Object} params
   * @param {string} [params.period='all'] - 'all' | 'month' | 'week'
   * @param {string} [params.area] - Filtro por área ('projetos', 'lideres')
   * @returns {Promise<Object>}
   */
  async execute({ period = 'all', area = null } = {}) {
    const dateFilter = this.#computeDateFilter(period);

    const [totals, byAutomation, byUser, monthlyTrend] = await Promise.all([
      this.#repository.getSummary({ ...dateFilter, area }),
      this.#repository.getSummaryByAutomation({ ...dateFilter, area }),
      this.#repository.getSummaryByUser({ ...dateFilter, area }),
      this.#repository.getMonthlyTrend(12),
    ]);

    return {
      totals: {
        totalEvents: totals.totalEvents,
        totalMinutes: totals.totalMinutes,
        totalHours: Math.round(totals.totalMinutes / 60 * 10) / 10,
        uniqueUsers: totals.uniqueUsers,
      },
      byAutomation,
      byUser,
      monthlyTrend,
    };
  }

  #computeDateFilter(period) {
    if (period === 'all') return {};

    const now = new Date();

    if (period === 'month') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: from.toISOString() };
    }

    if (period === 'week') {
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Segunda como início
      const from = new Date(now);
      from.setDate(now.getDate() - diff);
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString() };
    }

    return {};
  }
}

export { GetTimeSavingsSummary };
