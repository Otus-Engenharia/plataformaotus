/**
 * Use Case: UpdateEstudoCusto
 *
 * Atualiza campos gerais de uma solicitacao (prioridade, atribuicao, status, link estudo).
 */

class UpdateEstudoCusto {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ id, status, prioridade, assignedTo, resolvedById, linkEstudoCustos, contentFields }) {
    const estudo = await this.#repository.findById(id);

    if (!estudo) {
      throw new Error('Solicitacao nao encontrada');
    }

    if (status !== undefined) {
      const oldStatus = estudo.status.value;
      estudo.updateStatus(status, resolvedById);

      await this.#repository.saveComentario({
        estudoCustoId: id,
        authorId: resolvedById,
        texto: `Status alterado de "${oldStatus}" para "${status}"`,
        tipo: 'status_change',
        metadata: { from: oldStatus, to: status },
      });
    }

    if (prioridade !== undefined) {
      estudo.setPrioridade(prioridade);
    }

    if (assignedTo !== undefined) {
      const oldAssigned = estudo.assignedTo;
      estudo.assignTo(assignedTo);

      if (assignedTo && assignedTo !== oldAssigned) {
        const assignedData = await this.#repository.getUserById(assignedTo);
        await this.#repository.saveComentario({
          estudoCustoId: id,
          authorId: resolvedById,
          texto: `Solicitacao atribuida para ${assignedData?.name || assignedTo}`,
          tipo: 'atribuicao',
          metadata: { assigned_to: assignedTo },
        });
      }
    }

    if (linkEstudoCustos !== undefined) {
      estudo.updateLinkEstudoCustos(linkEstudoCustos);
    }

    if (contentFields && Object.keys(contentFields).length > 0) {
      estudo.updateContent(contentFields);
    }

    const updated = await this.#repository.update(estudo);

    const userIds = [updated.authorId, updated.assignedTo, updated.resolvedById].filter(Boolean);
    const usersMap = await this.#repository.getUsersByIds(userIds);

    return updated.toResponse(
      usersMap.get(updated.authorId),
      usersMap.get(updated.assignedTo),
      usersMap.get(updated.resolvedById)
    );
  }
}

export { UpdateEstudoCusto };
