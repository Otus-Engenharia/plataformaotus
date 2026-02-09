/**
 * Use Case: UpdateDemandaStatus
 *
 * Atualiza o status de uma demanda e cria comentário automático.
 */

class UpdateDemandaStatus {
  #demandaRepository;

  constructor(demandaRepository) {
    this.#demandaRepository = demandaRepository;
  }

  async execute({ id, status, resolvedById }) {
    const demanda = await this.#demandaRepository.findById(id);

    if (!demanda) {
      throw new Error('Demanda não encontrada');
    }

    const oldStatus = demanda.status.value;

    demanda.updateStatus(status, resolvedById);

    const updatedDemanda = await this.#demandaRepository.update(demanda);

    // Cria comentário automático de mudança de status
    await this.#demandaRepository.saveComentario({
      demandaId: id,
      authorId: resolvedById,
      texto: `Status alterado de "${oldStatus}" para "${status}"`,
      tipo: 'status_change',
      metadata: { from: oldStatus, to: status },
    });

    const userIds = [updatedDemanda.authorId, updatedDemanda.assignedTo, updatedDemanda.resolvedById].filter(Boolean);
    const usersMap = await this.#demandaRepository.getUsersByIds(userIds);

    return updatedDemanda.toResponse(
      usersMap.get(updatedDemanda.authorId),
      usersMap.get(updatedDemanda.assignedTo),
      usersMap.get(updatedDemanda.resolvedById)
    );
  }
}

export { UpdateDemandaStatus };
