/**
 * Use Case: UpdateClassificacao
 *
 * Cria ou atualiza a classificação (A/B/C/D) de um cliente.
 * Se o cliente já possui classificação, reclassifica. Caso contrário, cria.
 * Recebe companyId (FK) e clienteNome (cache desnormalizado).
 */

import { ClassificacaoCliente } from '../../../domain/customer-success/entities/ClassificacaoCliente.js';

class UpdateClassificacao {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ companyId, clienteNome, classificacao, userId, userName }) {
    const existing = await this.#repository.findClassificacaoByCompanyId(companyId);

    if (existing) {
      existing.reclassify(classificacao, userId, userName);
      const updated = await this.#repository.updateClassificacao(existing);
      return updated.toResponse();
    }

    const nova = ClassificacaoCliente.create({
      companyId,
      cliente: clienteNome,
      classificacao,
      updatedById: userId,
      updatedByName: userName,
    });
    const saved = await this.#repository.saveClassificacao(nova);
    return saved.toResponse();
  }
}

export { UpdateClassificacao };
