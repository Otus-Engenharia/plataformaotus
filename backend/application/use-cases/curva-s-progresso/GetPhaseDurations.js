/**
 * Use Case: GetPhaseDurations
 * Retorna a duração por fase do projeto, separando:
 * - executado_dias: span das tarefas concluídas (status conclusão)
 * - a_executar_dias: span das tarefas ainda não concluídas
 * - baselines: duração planejada por fase para cada baseline ativo
 */

import {
  queryCurrentPhaseDurations,
  queryBaselinePhaseDurations,
} from '../../../bigquery.js';

export class GetPhaseDurations {
  #baselineRepository;

  constructor(baselineRepository) {
    this.#baselineRepository = baselineRepository;
  }

  /**
   * @param {Object} params
   * @param {string} params.projectCode
   * @param {string} params.smartsheetId
   * @param {string} params.projectName
   * @returns {Object} { phases, actual, baselines }
   */
  async execute({ projectCode, smartsheetId, projectName }) {
    // 1. Buscar baselines ativos do projeto
    const allBaselines = await this.#baselineRepository.listByProject(projectCode);
    const activeBaselines = allBaselines.filter(b => b.isActive);

    // 2. Query tarefas atuais agrupadas por fase
    const actualRows = await queryCurrentPhaseDurations(smartsheetId, projectName);

    // 3. Query durações de baselines (se houver)
    let blRows = [];
    if (activeBaselines.length > 0) {
      blRows = await queryBaselinePhaseDurations(
        projectCode,
        activeBaselines.map(b => b.id)
      );
    }

    // 4. Agregar fases únicas (união de todas as fontes)
    const phaseSet = new Set();
    for (const r of actualRows) phaseSet.add(r.fase_nome);
    for (const r of blRows) phaseSet.add(r.fase_nome);

    // Ordenar fases: FASE 01, FASE 02... (ordem natural)
    const phases = Array.from(phaseSet).sort();

    // 5. Montar mapa de duração atual
    const executadoMap = {};
    const aExecutarMap = {};
    for (const r of actualRows) {
      executadoMap[r.fase_nome] = Math.max(0, Number(r.executado_dias) || 0);
      aExecutarMap[r.fase_nome] = Math.max(0, Number(r.a_executar_dias) || 0);
    }

    // 6. Montar mapa por baseline
    const blByBaseline = {};
    for (const r of blRows) {
      const blId = String(r.baseline_id);
      if (!blByBaseline[blId]) blByBaseline[blId] = {};
      blByBaseline[blId][r.fase_nome] = Math.max(0, Number(r.duracao_dias) || 0);
    }

    // 7. Formatar baselines com metadados
    const formattedBaselines = activeBaselines.map(b => ({
      id: b.id,
      revision_number: b.revisionNumber,
      revision_label: b.revisionLabel,
      label: b.name,
      snapshot_date: b.snapshotDate,
      durations: blByBaseline[String(b.id)] || {},
    }));

    return {
      phases,
      actual: {
        executado: executadoMap,
        a_executar: aExecutarMap,
      },
      baselines: formattedBaselines,
    };
  }
}
