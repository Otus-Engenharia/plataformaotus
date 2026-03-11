/**
 * Use Case: GetComplianceReport
 * Retorna quais projetos ativos foram preenchidos no mês e quais estão pendentes.
 */

class GetComplianceReport {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  /**
   * @param {Object} input
   * @param {number} input.mes
   * @param {number} input.ano
   * @param {Array<{project_code: string}>} input.projetosAtivos - lista de projetos ativos
   */
  async execute({ mes, ano, projetosAtivos }) {
    const m = Number(mes);
    const a = Number(ano);

    const projetosComResposta = await this.#repository.findProjetosComResposta(m, a);
    const respondidosSet = new Set(projetosComResposta);

    const codigosAtivos = projetosAtivos.map(p => p.project_code).filter(Boolean);
    const preenchidos = codigosAtivos.filter(c => respondidosSet.has(c));
    const pendentes = codigosAtivos.filter(c => !respondidosSet.has(c));

    return {
      mes: m,
      ano: a,
      total_ativos: codigosAtivos.length,
      total_preenchidos: preenchidos.length,
      total_pendentes: pendentes.length,
      percentual: codigosAtivos.length > 0
        ? Math.round((preenchidos.length / codigosAtivos.length) * 100)
        : 0,
      preenchidos,
      pendentes,
    };
  }
}

export { GetComplianceReport };
