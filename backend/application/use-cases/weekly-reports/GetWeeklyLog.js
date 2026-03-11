/**
 * Use Case: GetWeeklyLog
 *
 * Retorna matriz projeto x semana para auditoria de envio de relatórios.
 * 4 estados: "sent", "not_sent", "inactive", "not_registered".
 */

import { GetWeeklyReportStats } from './GetWeeklyReportStats.js';

// Semana mínima: feature lançada em 2026-W10 (02/03 - 08/03)
const MIN_WEEK = { year: 2026, week: 10 };

class GetWeeklyLog {
  #reportRepository;

  constructor(reportRepository) {
    this.#reportRepository = reportRepository;
  }

  /**
   * @param {Object} params
   * @param {number} params.weeks - Número de semanas (default: 8)
   * @param {Array<{project_code, comercial_name?, name?, relatorio_semanal_status?}>} params.allActiveProjects
   * @returns {Promise<Object>} { weeks, projects }
   */
  async execute({ weeks = 8, allActiveProjects = [] } = {}) {
    // Classificar projetos por status do toggle
    const enabledProjectCodes = [];
    for (const p of allActiveProjects) {
      if (p.relatorio_semanal_status === 'ativo') {
        enabledProjectCodes.push(p.project_code);
      }
    }

    // Busca rows crus do repositório (apenas projetos com bot ativo)
    const rows = enabledProjectCodes.length > 0
      ? await this.#reportRepository.getWeeklyLog({ weeks, projectCodes: enabledProjectCodes })
      : [];

    // Gera colunas de semanas (últimas N), filtrando semanas anteriores a MIN_WEEK
    const weekColumns = [];
    const now = new Date();
    const { weekNumber: currentWN, weekYear: currentWY } = GetWeeklyReportStats.getISOWeek(now);

    for (let i = weeks - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const { weekNumber, weekYear } = GetWeeklyReportStats.getISOWeek(d);

      // Filtrar semanas anteriores ao lançamento
      if (weekYear < MIN_WEEK.year || (weekYear === MIN_WEEK.year && weekNumber < MIN_WEEK.week)) {
        continue;
      }

      const weekKey = `${weekYear}-${weekNumber}`;
      const weekText = GetWeeklyReportStats.getWeekDateRange(weekYear, weekNumber);
      const isCurrent = weekYear === currentWY && weekNumber === currentWN;

      weekColumns.push({ weekYear, weekNumber, weekKey, weekText, isCurrent });
    }

    // Set para lookup O(1): "projectCode|weekYear-weekNumber"
    const sentSet = new Set();
    for (const row of rows) {
      sentSet.add(`${(row.project_code || '').trim()}|${row.week_year}-${row.week_number}`);
    }

    // Monta matriz: bot ativo primeiro, depois inativos, depois não cadastrados
    const activeProjects = [];
    const inactiveProjects = [];
    const notRegisteredProjects = [];

    for (const p of allActiveProjects) {
      const status = p.relatorio_semanal_status;
      const botActive = status === 'ativo';
      const botInactive = status === 'desativado';

      const weeksMap = {};
      for (const col of weekColumns) {
        if (botActive) {
          weeksMap[col.weekKey] = sentSet.has(`${(p.project_code || '').trim()}|${col.weekKey}`) ? 'sent' : 'not_sent';
        } else if (botInactive) {
          weeksMap[col.weekKey] = 'inactive';
        } else {
          weeksMap[col.weekKey] = 'not_registered';
        }
      }

      const entry = {
        project_code: p.project_code,
        project_name: p.comercial_name || p.name || p.project_code,
        bot_active: botActive,
        weeks: weeksMap,
      };

      if (botActive) {
        activeProjects.push(entry);
      } else if (botInactive) {
        inactiveProjects.push(entry);
      } else {
        notRegisteredProjects.push(entry);
      }
    }

    return { weeks: weekColumns, projects: [...activeProjects, ...inactiveProjects, ...notRegisteredProjects] };
  }
}

export { GetWeeklyLog };
