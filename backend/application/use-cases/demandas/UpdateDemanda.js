/**
 * Use Case: UpdateDemanda
 *
 * Atualiza campos gerais de uma demanda (prioridade, atribuição, status).
 */

class UpdateDemanda {
  #demandaRepository;

  constructor(demandaRepository) {
    this.#demandaRepository = demandaRepository;
  }

  async execute({ id, status, prioridade, assignedTo, resolvedById, contentFields }) {
    const demanda = await this.#demandaRepository.findById(id);

    if (!demanda) {
      throw new Error('Demanda não encontrada');
    }

    if (status !== undefined) {
      const oldStatus = demanda.status.value;
      demanda.updateStatus(status, resolvedById);

      await this.#demandaRepository.saveComentario({
        demandaId: id,
        authorId: resolvedById,
        texto: `Status alterado de "${oldStatus}" para "${status}"`,
        tipo: 'status_change',
        metadata: { from: oldStatus, to: status },
      });
    }

    if (prioridade !== undefined) {
      demanda.setPrioridade(prioridade);
    }

    if (assignedTo !== undefined) {
      const oldAssigned = demanda.assignedTo;
      demanda.assignTo(assignedTo);

      if (assignedTo && assignedTo !== oldAssigned) {
        const assignedData = await this.#demandaRepository.getUserById(assignedTo);
        await this.#demandaRepository.saveComentario({
          demandaId: id,
          authorId: resolvedById,
          texto: `Demanda atribuída para ${assignedData?.name || assignedTo}`,
          tipo: 'atribuicao',
          metadata: { assigned_to: assignedTo },
        });
      }
    }

    if (contentFields && Object.keys(contentFields).length > 0) {
      demanda.updateContent(contentFields);
    }

    const updatedDemanda = await this.#demandaRepository.update(demanda);

    const userIds = [updatedDemanda.authorId, updatedDemanda.assignedTo, updatedDemanda.resolvedById].filter(Boolean);
    const usersMap = await this.#demandaRepository.getUsersByIds(userIds);

    return updatedDemanda.toResponse(
      usersMap.get(updatedDemanda.authorId),
      usersMap.get(updatedDemanda.assignedTo),
      usersMap.get(updatedDemanda.resolvedById)
    );
  }
}

export { UpdateDemanda };
