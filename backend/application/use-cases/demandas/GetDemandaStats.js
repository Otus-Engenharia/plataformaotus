/**
 * Use Case: GetDemandaStats
 *
 * Retorna estatísticas de demandas.
 */

class GetDemandaStats {
  #demandaRepository;

  constructor(demandaRepository) {
    this.#demandaRepository = demandaRepository;
  }

  async execute() {
    return await this.#demandaRepository.getStats();
  }
}

export { GetDemandaStats };
