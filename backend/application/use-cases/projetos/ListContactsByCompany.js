/**
 * Use Case: ListContactsByCompany
 * Busca contatos de uma empresa para o dropdown do formulário
 */

class ListContactsByCompany {
  #projetoRepository;

  constructor(projetoRepository) {
    this.#projetoRepository = projetoRepository;
  }

  async execute(companyId) {
    if (!companyId) {
      throw new Error('company_id é obrigatório');
    }
    return await this.#projetoRepository.findContactsByCompany(companyId);
  }
}

export { ListContactsByCompany };
