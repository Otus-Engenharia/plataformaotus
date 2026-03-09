/**
 * Use Case: GetChangeLogSummary
 * Retorna estatísticas agregadas de mudanças IFC com validação de nomenclatura.
 */

import { validateFilesInBatch } from '../../../../shared/nomenclatura-validator.js';

class GetChangeLogSummary {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ days = 7 }) {
    const summary = await this.#repository.getRecentSummary(days);

    // Buscar padrões de nomenclatura para todos os projetos do período
    const projectCodes = [...new Set(summary.logs.map(l => l.project_code))];
    const patterns = await this.#repository.getNomenclaturaPatternsForProjects(projectCodes);

    // Validar nomenclatura de todos os arquivos
    const validationResults = validateFilesInBatch(summary.logs, patterns);

    let conformes = 0;
    let naoConformes = 0;
    let semPadrao = 0;

    for (const result of validationResults.values()) {
      if (result.conforme === null) {
        semPadrao++;
      } else if (result.conforme) {
        conformes++;
      } else {
        naoConformes++;
      }
    }

    return {
      totalMudancas: summary.totalMudancas,
      porCategoria: summary.porCategoria,
      projetosAtivos: summary.projetosAtivos,
      tamanhoTotal: summary.tamanhoTotal,
      nomenclatura: {
        configurados: patterns.size,
        conformes,
        naoConformes,
        semPadrao,
      },
    };
  }
}

export { GetChangeLogSummary };
