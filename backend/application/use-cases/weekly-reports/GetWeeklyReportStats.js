/**
 * Use Case: GetWeeklyReportStats
 *
 * Retorna estatísticas de geração de relatórios por semana (para KPI dashboard).
 * Cruza dados de projetos ativos (BigQuery) com relatórios gerados (Supabase).
 */

class GetWeeklyReportStats {
  #reportRepository;
  #bigqueryClient;

  constructor(reportRepository, bigqueryClient) {
    this.#reportRepository = reportRepository;
    this.#bigqueryClient = bigqueryClient;
  }

  /**
   * @param {Object} params
   * @param {number} params.weeks - Número de semanas para retornar (default: 12)
   * @param {string|null} params.leaderName - Filtrar por líder (null = todos)
   * @returns {Promise<Object>} estatísticas por semana
   */
  async execute({ weeks = 12, leaderName = null } = {}) {
    // Busca relatórios gerados por semana
    const weeklyStats = await this.#reportRepository.getWeeklyStats({ weeks, leaderName });

    // Busca projetos ativos com relatório semanal habilitado
    const activeProjects = await this.#bigqueryClient.queryActiveProjectsForWeeklyReports(leaderName);
    const totalActive = activeProjects.length;

    // Monta dados por semana
    const statsMap = new Map();
    for (const stat of weeklyStats) {
      const key = `${stat.week_year}-W${String(stat.week_number).padStart(2, '0')}`;
      statsMap.set(key, {
        weekYear: stat.week_year,
        weekNumber: stat.week_number,
        weekText: stat.week_text,
        generated: stat.total_generated,
        active: totalActive,
        coverage: totalActive > 0 ? Math.round((stat.total_generated / totalActive) * 100) : 0,
      });
    }

    // Gera as últimas N semanas (preenchendo lacunas com 0)
    const result = [];
    const now = new Date();
    for (let i = weeks - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const { weekNumber, weekYear } = GetWeeklyReportStats.#getISOWeek(d);
      const key = `${weekYear}-W${String(weekNumber).padStart(2, '0')}`;

      if (statsMap.has(key)) {
        result.push(statsMap.get(key));
      } else {
        result.push({
          weekYear,
          weekNumber,
          weekText: `S${weekNumber}`,
          generated: 0,
          active: totalActive,
          coverage: 0,
        });
      }
    }

    // Calcula resumos
    const currentWeek = result[result.length - 1];
    const last4Weeks = result.slice(-4);
    const avgCoverage = last4Weeks.length > 0
      ? Math.round(last4Weeks.reduce((sum, w) => sum + w.coverage, 0) / last4Weeks.length)
      : 0;

    // Tendência: compara média das últimas 4 com as 4 anteriores
    const prev4Weeks = result.slice(-8, -4);
    const prevAvg = prev4Weeks.length > 0
      ? prev4Weeks.reduce((sum, w) => sum + w.coverage, 0) / prev4Weeks.length
      : 0;
    const trend = avgCoverage > prevAvg ? 'up' : avgCoverage < prevAvg ? 'down' : 'stable';

    // Projetos que NÃO tiveram relatório na semana atual
    const currentWeekReports = currentWeek ? await this.#getMissingProjects(
      currentWeek.weekYear, currentWeek.weekNumber, activeProjects
    ) : [];

    return {
      summary: {
        currentCoverage: currentWeek?.coverage || 0,
        avgCoverage4Weeks: avgCoverage,
        trend,
        totalActive,
      },
      weeks: result,
      missingCurrentWeek: currentWeekReports,
    };
  }

  async #getMissingProjects(weekYear, weekNumber, activeProjects) {
    const weekReports = await this.#reportRepository.findByWeek(weekYear, weekNumber);
    const generatedCodes = new Set(weekReports.map(r => r.projectCode));

    return activeProjects
      .filter(p => !generatedCodes.has(p.project_code))
      .map(p => ({
        project_code: p.project_code,
        project_name: p.project_name || p.nome_comercial,
        lider: p.lider,
      }));
  }

  static #getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { weekNumber, weekYear: d.getUTCFullYear() };
  }
}

export { GetWeeklyReportStats };
