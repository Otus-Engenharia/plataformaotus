/**
 * Use Case: GetPercepcaoStats
 * Retorna indicadores agregados: IP/IVE/ISP global, por projeto e evolução mensal.
 */

class GetPercepcaoStats {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ mes, ano } = {}) {
    const filters = {};
    if (mes) filters.mes = Number(mes);
    if (ano) filters.ano = Number(ano);

    const percepcoes = await this.#repository.findAll(filters);
    const responses = percepcoes.map(p => p.toResponse());

    if (responses.length === 0) {
      return { global: null, porProjeto: [], evolucao: [] };
    }

    // Global averages
    const global = this.#calcularMedias(responses);

    // Por projeto
    const byProjeto = new Map();
    for (const r of responses) {
      if (!byProjeto.has(r.projeto_codigo)) byProjeto.set(r.projeto_codigo, []);
      byProjeto.get(r.projeto_codigo).push(r);
    }
    const porProjeto = [...byProjeto.entries()].map(([codigo, items]) => ({
      projeto_codigo: codigo,
      respostas: items.length,
      ...this.#calcularMedias(items),
    }));

    // Evolução mensal
    const byPeriodo = new Map();
    for (const r of responses) {
      if (!byPeriodo.has(r.periodo_key)) byPeriodo.set(r.periodo_key, []);
      byPeriodo.get(r.periodo_key).push(r);
    }
    const evolucao = [...byPeriodo.entries()]
      .map(([key, items]) => ({
        periodo_key: key,
        periodo_label: items[0].periodo_label,
        respostas: items.length,
        ...this.#calcularMedias(items),
      }))
      .sort((a, b) => a.periodo_key.localeCompare(b.periodo_key));

    return { global, porProjeto, evolucao };
  }

  #calcularMedias(items) {
    const sum = { ip: 0, ive: 0, isp: 0 };
    for (const r of items) {
      sum.ip += r.ip;
      sum.ive += r.ive;
      sum.isp += r.isp;
    }
    const n = items.length;
    return {
      avg_ip: Math.round((sum.ip / n) * 100) / 100,
      avg_ive: Math.round((sum.ive / n) * 100) / 100,
      avg_isp: Math.round((sum.isp / n) * 100) / 100,
      total_respostas: n,
    };
  }
}

export { GetPercepcaoStats };
