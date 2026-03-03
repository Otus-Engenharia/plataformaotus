/**
 * Use Case: GetPhaseDurations
 * Retorna a duração por fase do projeto, exibindo apenas as 5 fases principais:
 * - Estudo Preliminar (Fase 01)
 * - Anteprojeto (Fase 02)
 * - Pré-executivo (Fase 03)
 * - Executivo (Fase 04)
 * - Liberado Obra (Fase 05, quando presente)
 *
 * executado_dias: span real das linhas de fase (Level 2) no Smartsheet
 * baselines: duração planejada por fase para cada baseline ativo
 */

import {
  queryCurrentPhaseDurations,
  queryBaselinePhaseDurations,
} from '../../../bigquery.js';

// Configuração das 5 fases relevantes em ordem fixa
const PHASES_ORDER = [
  { label: 'Estudo Preliminar', test: (n) => /estudo\s*preliminar/i.test(n) },
  { label: 'Anteprojeto', test: (n) => /anteprojeto/i.test(n) },
  { label: 'Pré-executivo', test: (n) => /pr[eé].?executivo/i.test(n) },
  { label: 'Executivo', test: (n) => /executivo/i.test(n) && !/pr[eé].?executivo/i.test(n) },
  { label: 'Liberado Obra', test: (n) => /liberado\s*(obra|para\s*obra)/i.test(n) },
];

function normalizePhase(rawName) {
  return PHASES_ORDER.find(p => p.test(rawName)) || null;
}

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
    const allBaselines = await this.#baselineRepository.findByProjectCode(projectCode);
    const activeBaselines = allBaselines.filter(b => b.isActive);

    // 2. Query linhas de fase (Level 2) agrupadas por fase
    const actualRows = await queryCurrentPhaseDurations(smartsheetId, projectName);

    // 3. Query durações de baselines (se houver)
    let blRows = [];
    if (activeBaselines.length > 0) {
      blRows = await queryBaselinePhaseDurations(
        projectCode,
        activeBaselines.map(b => b.id)
      );
    }

    // 4. Montar mapa de duração executada (apenas fases das 5 principais)
    const executadoMap = {};
    for (const r of actualRows) {
      const phaseConfig = normalizePhase(r.fase_nome);
      if (!phaseConfig) continue;
      executadoMap[phaseConfig.label] = Math.max(0, Number(r.executado_dias) || 0);
    }

    // 5. Montar mapa por baseline (apenas fases das 5 principais)
    const blByBaseline = {};
    for (const r of blRows) {
      const phaseConfig = normalizePhase(r.fase_nome);
      if (!phaseConfig) continue;
      const blId = String(r.baseline_id);
      if (!blByBaseline[blId]) blByBaseline[blId] = {};
      blByBaseline[blId][phaseConfig.label] = Math.max(0, Number(r.duracao_dias) || 0);
    }

    // 6. Construir lista de fases na ordem fixa (apenas as que têm dados)
    const phasesWithData = new Set([
      ...Object.keys(executadoMap),
      ...Object.values(blByBaseline).flatMap(Object.keys),
    ]);
    const phases = PHASES_ORDER
      .filter(p => phasesWithData.has(p.label))
      .map(p => p.label);

    // 7. Formatar baselines com metadados (todos os ativos)
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
      },
      baselines: formattedBaselines,
    };
  }
}
