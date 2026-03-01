/**
 * Use Case: GetWeeklyReportStats
 *
 * Retorna estatísticas de geração de relatórios por semana (para KPI dashboard).
 * Cruza dados de projetos ativos (BigQuery) com relatórios gerados (Supabase).
 * Usa snapshots históricos quando disponíveis para dados precisos.
 * Filtra por nome_time do usuário (ex: "TIME Anna").
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
   * @param {string|null} params.nomeTime - Filtrar por nome_time (null = todos)
   * @returns {Promise<Object>} estatísticas por semana
   */
  async execute({ weeks = 12, nomeTime = null, allActiveProjects = null, reportEnabledProjects = null } = {}) {
    // Busca relatórios gerados por semana
    const weeklyStats = await this.#reportRepository.getWeeklyStats({ weeks, leaderName: nomeTime });

    // Busca projetos com toggle ON (pré-carregados do Supabase ou fallback BigQuery)
    if (!reportEnabledProjects) {
      reportEnabledProjects = await this.#bigqueryClient.queryActiveProjectsForWeeklyReports(nomeTime);
    }
    const totalReportEnabled = reportEnabledProjects.length;

    // Busca TODOS os projetos ativos (pré-carregados do Supabase ou fallback BigQuery)
    if (!allActiveProjects) {
      try {
        allActiveProjects = await this.#bigqueryClient.queryAllActiveProjects(nomeTime);
      } catch (err) {
        console.warn('[WeeklyReportStats] Erro ao buscar projetos ativos do BigQuery:', err.message);
        allActiveProjects = reportEnabledProjects;
      }
    }
    const totalAllActive = allActiveProjects.length;

    // Busca snapshots históricos
    let snapshots = [];
    try {
      snapshots = await this.#reportRepository.getSnapshots({ weeks, leaderName: nomeTime });
    } catch {
      // Tabela pode não existir ainda
    }
    const snapshotMap = new Map();
    for (const s of snapshots) {
      const key = `${s.week_year}-W${String(s.week_number).padStart(2, '0')}`;
      snapshotMap.set(key, s);
    }

    // Monta mapa de relatórios gerados por semana
    const statsMap = new Map();
    for (const stat of weeklyStats) {
      const key = `${stat.week_year}-W${String(stat.week_number).padStart(2, '0')}`;
      statsMap.set(key, {
        weekText: stat.week_text,
        generated: stat.total_generated,
      });
    }

    // Identifica semana atual
    const { weekNumber: currentWN, weekYear: currentWY } = GetWeeklyReportStats.getISOWeek(new Date());
    const currentWeekKey = `${currentWY}-W${String(currentWN).padStart(2, '0')}`;

    // Gera as últimas N semanas
    const result = [];
    const now = new Date();
    for (let i = weeks - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const { weekNumber, weekYear } = GetWeeklyReportStats.getISOWeek(d);
      const key = `${weekYear}-W${String(weekNumber).padStart(2, '0')}`;

      const snapshot = snapshotMap.get(key);
      const stat = statsMap.get(key);
      const isCurrentWeek = key === currentWeekKey;

      if (snapshot) {
        // Usar dados do snapshot (histórico preciso)
        result.push({
          weekYear,
          weekNumber,
          weekText: stat?.weekText || `S${weekNumber}`,
          totalActive: snapshot.total_active_projects,
          reportEnabled: snapshot.projects_report_enabled,
          reportsSent: snapshot.reports_sent,
          pctReportEnabled: parseFloat(snapshot.pct_report_enabled) || 0,
          pctReportsSent: parseFloat(snapshot.pct_reports_sent) || 0,
          generated: snapshot.reports_sent,
          active: snapshot.projects_report_enabled,
          coverage: parseFloat(snapshot.pct_reports_sent) || 0,
        });
      } else if (isCurrentWeek) {
        // Semana atual: calcular com dados em tempo real
        const generated = stat?.generated || 0;
        const pctEnabled = totalAllActive > 0
          ? Math.round((totalReportEnabled / totalAllActive) * 1000) / 10
          : 0;
        const pctSent = totalReportEnabled > 0
          ? Math.round((generated / totalReportEnabled) * 1000) / 10
          : 0;

        result.push({
          weekYear,
          weekNumber,
          weekText: stat?.weekText || `S${weekNumber}`,
          totalActive: totalAllActive,
          reportEnabled: totalReportEnabled,
          reportsSent: generated,
          pctReportEnabled: pctEnabled,
          pctReportsSent: pctSent,
          generated,
          active: totalReportEnabled,
          coverage: pctSent,
        });
      } else {
        // Semana passada sem snapshot: sem dados confiáveis
        result.push({
          weekYear,
          weekNumber,
          weekText: stat?.weekText || `S${weekNumber}`,
          totalActive: null,
          reportEnabled: null,
          reportsSent: stat?.generated || null,
          pctReportEnabled: null,
          pctReportsSent: null,
          generated: stat?.generated || null,
          active: null,
          coverage: null,
        });
      }
    }

    // Resumos da semana atual
    const currentWeek = result[result.length - 1];
    const prevWeek = result.length >= 2 ? result[result.length - 2] : null;

    // Médias 4 semanas (apenas semanas com dados)
    const last4WithData = result.slice(-4).filter(w => w.pctReportEnabled != null);
    const avgPctEnabled = last4WithData.length > 0
      ? Math.round(last4WithData.reduce((s, w) => s + w.pctReportEnabled, 0) / last4WithData.length * 10) / 10
      : 0;
    const avgPctSent = last4WithData.length > 0
      ? Math.round(last4WithData.reduce((s, w) => s + w.pctReportsSent, 0) / last4WithData.length * 10) / 10
      : 0;

    // Tendências (apenas semanas com dados)
    const prev4WithData = result.slice(-8, -4).filter(w => w.pctReportsSent != null);
    const prevAvgSent = prev4WithData.length > 0
      ? prev4WithData.reduce((s, w) => s + w.pctReportsSent, 0) / prev4WithData.length
      : 0;
    const prevAvgEnabled = prev4WithData.length > 0
      ? prev4WithData.reduce((s, w) => s + w.pctReportEnabled, 0) / prev4WithData.length
      : 0;

    const trendSent = avgPctSent > prevAvgSent ? 'up' : avgPctSent < prevAvgSent ? 'down' : 'stable';
    const trendEnabled = avgPctEnabled > prevAvgEnabled ? 'up' : avgPctEnabled < prevAvgEnabled ? 'down' : 'stable';

    // Projetos faltantes na semana atual
    const currentWeekMissing = currentWeek ? await this.#getMissingProjects(
      currentWeek.weekYear, currentWeek.weekNumber, reportEnabledProjects
    ) : [];

    // Auto-snapshot: se não existe para a semana atual, criar
    try {
      const exists = await this.#reportRepository.snapshotExists(currentWY, currentWN, nomeTime);
      if (!exists && currentWeek && currentWeek.pctReportEnabled != null) {
        await this.#reportRepository.saveSnapshot({
          weekYear: currentWY,
          weekNumber: currentWN,
          snapshotDate: now.toISOString().split('T')[0],
          totalActiveProjects: currentWeek.totalActive,
          projectsReportEnabled: currentWeek.reportEnabled,
          reportsSent: currentWeek.reportsSent,
          pctReportEnabled: currentWeek.pctReportEnabled,
          pctReportsSent: currentWeek.pctReportsSent,
          leaderName: nomeTime,
        });
      }
    } catch (err) {
      console.warn('[WeeklyReportStats] Erro ao criar auto-snapshot:', err.message);
    }

    return {
      summary: {
        currentPctEnabled: currentWeek?.pctReportEnabled || 0,
        currentPctSent: currentWeek?.pctReportsSent || 0,
        avgPctEnabled4Weeks: avgPctEnabled,
        avgPctSent4Weeks: avgPctSent,
        trendEnabled,
        trendSent,
        totalAllActive: currentWeek?.totalActive || 0,
        totalReportEnabled: currentWeek?.reportEnabled || 0,
        totalReportsSent: currentWeek?.reportsSent || 0,
        deltaPctEnabled: (prevWeek && prevWeek.pctReportEnabled != null)
          ? Math.round((currentWeek.pctReportEnabled - prevWeek.pctReportEnabled) * 10) / 10
          : 0,
        deltaPctSent: (prevWeek && prevWeek.pctReportsSent != null)
          ? Math.round((currentWeek.pctReportsSent - prevWeek.pctReportsSent) * 10) / 10
          : 0,
        currentCoverage: currentWeek?.coverage || 0,
        avgCoverage4Weeks: avgPctSent,
        trend: trendSent,
        totalActive: totalReportEnabled,
      },
      weeks: result,
      missingCurrentWeek: currentWeekMissing,
    };
  }

  async #getMissingProjects(weekYear, weekNumber, activeProjects) {
    const weekReports = await this.#reportRepository.findByWeek(weekYear, weekNumber);
    const generatedCodes = new Set(weekReports.map(r => r.projectCode));

    return activeProjects
      .filter(p => !generatedCodes.has(p.project_code))
      .map(p => ({
        project_code: p.project_code,
        project_name: p.project_code,
        lider: p.lider,
      }));
  }

  static getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { weekNumber, weekYear: d.getUTCFullYear() };
  }
}

export { GetWeeklyReportStats };
