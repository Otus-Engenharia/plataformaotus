import { RegraCliente } from '../../../domain/pagamentos/entities/RegraCliente.js';

class CreateRegraCliente {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ companyId, companyName, precisaMedicao, diasSolicitarMedicao, diasAprovacaoMedicao, diasAntecedenciaFaturamento, observacaoFinanceiro, createdBy }) {
    const existing = await this.#repository.findRegraByCompanyId(companyId);
    if (existing) throw new Error('Ja existe uma regra para este cliente');

    const regra = RegraCliente.create({
      companyId,
      companyName,
      precisaMedicao,
      diasSolicitarMedicao,
      diasAprovacaoMedicao,
      diasAntecedenciaFaturamento,
      observacaoFinanceiro,
      createdBy,
    });

    const saved = await this.#repository.saveRegra(regra);
    return saved.toResponse();
  }
}

export { CreateRegraCliente };
