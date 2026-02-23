/**
 * Use Case: GetPortfolioChangeLog
 * Computa o log de alterações de TODOS os projetos do portfolio,
 * agregando resultados para visão consolidada dos líderes.
 */

import { SnapshotDiffService } from '../../../domain/curva-s-progresso/services/SnapshotDiffService.js';

class GetPortfolioChangeLog {
  #queryAllSnapshotTasks;

  constructor(queryAllSnapshotTasks) {
    this.#queryAllSnapshotTasks = queryAllSnapshotTasks;
  }

  /**
   * @param {Object} params
   * @param {string[]} [params.projectIds] - IDs de projetos para filtrar (opcional)
   * @returns {{ by_project, summary, aggregated_discipline_scores }}
   */
  async execute({ projectIds } = {}) {
    const { projectSnapshots } = await this.#queryAllSnapshotTasks();

    if (!projectSnapshots || projectSnapshots.size === 0) {
      return {
        by_project: [],
        summary: { total_projects: 0, total_changes: 0, total_desvios: 0, total_criadas: 0, total_deletadas: 0, total_nao_feitas: 0 },
        aggregated_discipline_scores: [],
      };
    }

    const filterSet = projectIds ? new Set(projectIds) : null;
    const byProject = [];

    for (const [projectId, snapshots] of projectSnapshots) {
      if (filterSet && !filterSet.has(projectId)) continue;
      if (snapshots.size < 2) continue; // Precisa de pelo menos 2 snapshots para diff

      const diffResult = SnapshotDiffService.diffAllSnapshots(snapshots);
      if (diffResult.overall_summary.total_changes === 0) continue;

      const disciplineScores = SnapshotDiffService.scoreDisciplines(diffResult);

      byProject.push({
        project_id: projectId,
        month_pairs: diffResult.month_pairs,
        overall_summary: diffResult.overall_summary,
        discipline_scores: disciplineScores,
      });
    }

    // Ordenar por total de alterações (mais problemáticos primeiro)
    byProject.sort((a, b) => b.overall_summary.total_changes - a.overall_summary.total_changes);

    // Agregar summary cross-portfolio
    const summary = {
      total_projects: byProject.length,
      total_changes: byProject.reduce((s, p) => s + p.overall_summary.total_changes, 0),
      total_desvios: byProject.reduce((s, p) => s + p.overall_summary.total_desvios, 0),
      total_criadas: byProject.reduce((s, p) => s + p.overall_summary.total_criadas, 0),
      total_deletadas: byProject.reduce((s, p) => s + p.overall_summary.total_deletadas, 0),
      total_nao_feitas: byProject.reduce((s, p) => s + p.overall_summary.total_nao_feitas, 0),
    };

    // Agregar disciplinas cross-portfolio
    const discMap = new Map();
    for (const proj of byProject) {
      for (const ds of proj.discipline_scores) {
        if (!discMap.has(ds.disciplina)) {
          discMap.set(ds.disciplina, { disciplina: ds.disciplina, total: 0, desvios: 0, criadas: 0, deletadas: 0, nao_feitas: 0, total_desvio_dias: 0 });
        }
        const agg = discMap.get(ds.disciplina);
        agg.total += ds.total;
        agg.desvios += ds.desvios;
        agg.criadas += ds.criadas;
        agg.deletadas += ds.deletadas;
        agg.nao_feitas += ds.nao_feitas;
        agg.total_desvio_dias += ds.total_desvio_dias;
      }
    }
    const aggregatedDisciplineScores = [...discMap.values()].sort((a, b) => b.total - a.total);

    return { by_project: byProject, summary, aggregated_discipline_scores: aggregatedDisciplineScores };
  }
}

export { GetPortfolioChangeLog };
