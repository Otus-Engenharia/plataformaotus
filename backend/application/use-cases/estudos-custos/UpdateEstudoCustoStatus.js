/**
 * Use Case: UpdateEstudoCustoStatus
 *
 * Atualiza o status de uma solicitacao e cria comentario automatico.
 */

class UpdateEstudoCustoStatus {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ id, status, resolvedById }) {
    const estudo = await this.#repository.findById(id);

    if (!estudo) {
      throw new Error('Solicitacao nao encontrada');
    }

    const oldStatus = estudo.status.value;

    estudo.updateStatus(status, resolvedById);

    const updated = await this.#repository.update(estudo);

    await this.#repository.saveComentario({
      estudoCustoId: id,
      authorId: resolvedById,
      texto: `Status alterado de "${oldStatus}" para "${status}"`,
      tipo: 'status_change',
      metadata: { from: oldStatus, to: status },
    });

    const userIds = [updated.authorId, updated.assignedTo, updated.resolvedById].filter(Boolean);
    const usersMap = await this.#repository.getUsersByIds(userIds);

    return updated.toResponse(
      usersMap.get(updated.authorId),
      usersMap.get(updated.assignedTo),
      usersMap.get(updated.resolvedById)
    );
  }
}

export { UpdateEstudoCustoStatus };
