/**
 * Use Case: GetEstudoCusto
 *
 * Busca uma solicitacao especifica por ID, com comentarios.
 */

class GetEstudoCusto {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute(id) {
    const estudo = await this.#repository.findById(id);

    if (!estudo) {
      return null;
    }

    const comentarios = await this.#repository.findComentarios(id);

    const commentAuthorIds = comentarios.map(c => c.author_id).filter(Boolean);
    const allUserIds = [
      ...new Set([
        estudo.authorId,
        estudo.assignedTo,
        estudo.resolvedById,
        ...commentAuthorIds,
      ].filter(Boolean))
    ];

    const usersMap = await this.#repository.getUsersByIds(allUserIds);

    const authorData = usersMap.get(estudo.authorId);
    const assignedData = usersMap.get(estudo.assignedTo);
    const resolvedByData = usersMap.get(estudo.resolvedById);

    const enrichedComentarios = comentarios.map(c => ({
      ...c,
      author_name: usersMap.get(c.author_id)?.name || null,
      author_email: usersMap.get(c.author_id)?.email || null,
    }));

    return {
      ...estudo.toResponse(authorData, assignedData, resolvedByData),
      comentarios: enrichedComentarios,
    };
  }
}

export { GetEstudoCusto };
