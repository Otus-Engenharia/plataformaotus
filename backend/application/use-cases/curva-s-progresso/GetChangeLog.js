/**
 * Use Case: GetChangeLog
 * Computa o log de alterações mensais comparando snapshots consecutivos
 * e faz merge com anotações do coordenador armazenadas no Supabase.
 */

import { SnapshotDiffService } from '../../../domain/curva-s-progresso/services/SnapshotDiffService.js';

class GetChangeLog {
  #repository;
  #querySnapshotTasks;

  constructor(repository, querySnapshotTasks) {
    this.#repository = repository;
    this.#querySnapshotTasks = querySnapshotTasks;
  }

  /**
   * @param {Object} params
   * @param {string} params.projectCode
   * @param {string} params.smartsheetId
   * @param {string} params.projectName
   * @returns {{ month_pairs, overall_summary, discipline_scores }}
   */
  async execute({ projectCode, smartsheetId, projectName }) {
    if (!projectCode) throw new Error('projectCode é obrigatório');
    if (!smartsheetId && !projectName) throw new Error('smartsheetId ou projectName é obrigatório');

    // 1. Buscar snapshots mensais do BigQuery
    const { snapshots } = await this.#querySnapshotTasks(smartsheetId, projectName);

    if (!snapshots || snapshots.size === 0) {
      return {
        month_pairs: [],
        overall_summary: { total_changes: 0, months_analyzed: 0 },
        discipline_scores: [],
      };
    }

    // 2. Computar diffs entre snapshots consecutivos
    const diffResult = SnapshotDiffService.diffAllSnapshots(snapshots);

    // 3. Buscar anotações do Supabase
    let annotations = [];
    try {
      annotations = await this.#repository.findAnnotationsByProject(projectCode);
    } catch (err) {
      console.warn('Aviso: Erro ao buscar anotações do changelog:', err.message);
    }

    // 4. Indexar anotações para merge rápido
    const annotationMap = new Map();
    for (const a of annotations) {
      const fromDate = typeof a.fromSnapshotDate === 'object' && a.fromSnapshotDate !== null
        ? String(a.fromSnapshotDate) : a.fromSnapshotDate;
      const toDate = typeof a.toSnapshotDate === 'object' && a.toSnapshotDate !== null
        ? String(a.toSnapshotDate) : a.toSnapshotDate;
      const key = `${fromDate}|${toDate}|${a.changeType.value}|${a.taskName}`;
      annotationMap.set(key, a.toResponse());
    }

    // 5. Merge: anexar annotation em cada change
    let totalAnnotated = 0;
    for (const pair of diffResult.month_pairs) {
      for (const change of pair.changes) {
        const key = `${pair.from_snapshot}|${pair.to_snapshot}|${change.type}|${change.task_name}`;
        const annotation = annotationMap.get(key) || null;
        change.annotation = annotation;
        if (annotation) totalAnnotated++;
      }
      pair.summary.annotated = pair.changes.filter(c => c.annotation !== null).length;
    }

    diffResult.overall_summary.total_annotated = totalAnnotated;

    // 6. Scoring de disciplinas
    const disciplineScores = SnapshotDiffService.scoreDisciplines(diffResult);

    return {
      ...diffResult,
      discipline_scores: disciplineScores,
    };
  }
}

export { GetChangeLog };
