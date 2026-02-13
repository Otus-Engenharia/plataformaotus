/**
 * Use Case: CreateClient
 * Cria uma nova empresa do tipo 'client' a partir do formulário de passagem
 */

class CreateClient {
  #projetoRepository;

  constructor(projetoRepository) {
    this.#projetoRepository = projetoRepository;
  }

  async execute({ name, company_address, maturidade_cliente, nivel_cliente }) {
    if (!name || !name.trim()) {
      throw new Error('O nome do cliente é obrigatório.');
    }

    return await this.#projetoRepository.saveClient({
      name: name.trim(),
      company_address: company_address?.trim() || null,
      maturidade_cliente: maturidade_cliente?.trim() || null,
      nivel_cliente: nivel_cliente?.trim() || null,
    });
  }
}

export { CreateClient };
