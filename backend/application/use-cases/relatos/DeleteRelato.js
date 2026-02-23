/**
 * Use Case: Remover Relato
 */

class DeleteRelato {
  #relatoRepository;

  constructor(relatoRepository) {
    this.#relatoRepository = relatoRepository;
  }

  async execute(id) {
    const relato = await this.#relatoRepository.findById(id);
    if (!relato) {
      throw new Error('Relato não encontrado');
    }
    await this.#relatoRepository.delete(id);
    return relato;
  }
}

export { DeleteRelato };
