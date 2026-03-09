class GetUpcomingParcelas {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ months = 2, leader = null }) {
    const parcelas = await this.#repository.findUpcomingParcelas({ leader });
    const responses = parcelas.map(p => p.toResponse());

    if (months) {
      const now = new Date();
      const cutoff = new Date(now);
      cutoff.setMonth(cutoff.getMonth() + Number(months));

      return responses.filter(p => {
        const dateStr = p.data_pagamento_efetiva;
        if (!dateStr) return true; // Include parcelas without date
        const date = new Date(dateStr);
        return date <= cutoff;
      });
    }

    return responses;
  }
}

export { GetUpcomingParcelas };
