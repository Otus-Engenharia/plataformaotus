/**
 * Use Case: GetClienteChurnStats
 *
 * Retorna estatísticas de retenção e churn de clientes para um mês/ano.
 */

class GetClienteChurnStats {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ month, year }) {
    const stats = await this.#repository.getSnapshotStats({ month, year });

    const total = stats.clientesAtivos + stats.churns;
    const taxaRetencao = total > 0
      ? (stats.clientesAtivos / total) * 100
      : 0;

    return {
      clientesAtivos: stats.clientesAtivos,
      churns: stats.churns,
      projetosAtivos: stats.projetosAtivos,
      projetosInativos: stats.projetosInativos,
      projetosEncerrados: stats.projetosEncerrados,
      taxaRetencao: Number(taxaRetencao.toFixed(2)),
    };
  }
}

export { GetClienteChurnStats };
