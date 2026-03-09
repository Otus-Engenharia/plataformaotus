class UpdateRegraCliente {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ companyId, precisaMedicao, diasSolicitarMedicao, diasAprovacaoMedicao, diasAntecedenciaFaturamento, observacaoFinanceiro }) {
    const regra = await this.#repository.findRegraByCompanyId(companyId);
    if (!regra) throw new Error('Regra nao encontrada para este cliente');

    regra.updateFields({
      precisaMedicao,
      diasSolicitarMedicao,
      diasAprovacaoMedicao,
      diasAntecedenciaFaturamento,
      observacaoFinanceiro,
    });

    const updated = await this.#repository.updateRegra(regra);
    return updated.toResponse();
  }
}

export { UpdateRegraCliente };
