/**
 * Use Case: CreateContact
 * Cria um novo contato vinculado a uma empresa
 */

class CreateContact {
  #projetoRepository;

  constructor(projetoRepository) {
    this.#projetoRepository = projetoRepository;
  }

  async execute({ name, email, phone, position, company_id }) {
    if (!name || !name.trim()) {
      throw new Error('O nome do contato é obrigatório.');
    }
    if (!company_id) {
      throw new Error('A empresa é obrigatória.');
    }

    return await this.#projetoRepository.saveContact({
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      position: position?.trim() || null,
      company_id,
    });
  }
}

export { CreateContact };
