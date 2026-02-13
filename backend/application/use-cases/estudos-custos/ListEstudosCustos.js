/**
 * Use Case: ListEstudosCustos
 *
 * Lista todas as solicitacoes de estudo de custos, enriquecidas com dados dos usuarios.
 */

class ListEstudosCustos {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ userId = null } = {}) {
    const estudos = await this.#repository.findAll({ userId });

    const authorIds = [...new Set(estudos.map(e => e.authorId).filter(Boolean))];
    const assignedIds = [...new Set(estudos.map(e => e.assignedTo).filter(Boolean))];
    const resolvedByIds = [...new Set(estudos.map(e => e.resolvedById).filter(Boolean))];
    const allUserIds = [...new Set([...authorIds, ...assignedIds, ...resolvedByIds])];

    const usersMap = await this.#repository.getUsersByIds(allUserIds);

    const estudosWithComments = await Promise.all(
      estudos.map(async (estudo) => {
        const comentarios = await this.#repository.findComentarios(estudo.id);
        const commentCount = comentarios.filter(c => c.tipo === 'comentario').length;

        const authorData = usersMap.get(estudo.authorId);
        const assignedData = usersMap.get(estudo.assignedTo);
        const resolvedByData = usersMap.get(estudo.resolvedById);

        return {
          ...estudo.toResponse(authorData, assignedData, resolvedByData),
          comment_count: commentCount,
        };
      })
    );

    return estudosWithComments;
  }
}

export { ListEstudosCustos };
