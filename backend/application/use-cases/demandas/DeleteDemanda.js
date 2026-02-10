/**
 * Use Case: DeleteDemanda
 *
 * Deleta uma demanda e seus comentarios associados.
 */

class DeleteDemanda {
  #demandaRepository;

  constructor(demandaRepository) {
    this.#demandaRepository = demandaRepository;
  }

  async execute({ id }) {
    const demanda = await this.#demandaRepository.findById(id);

    if (!demanda) {
      throw new Error('Demanda não encontrada');
    }

    // Deleta comentarios associados
    await this.#demandaRepository.deleteComentariosByDemandaId(id);

    // Deleta a demanda
    await this.#demandaRepository.delete(id);

    return { id, deleted: true };
  }
}

export { DeleteDemanda };
