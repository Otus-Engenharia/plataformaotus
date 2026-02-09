/**
 * Use Case: ListDemandas
 *
 * Lista todas as demandas, enriquecidas com dados dos usuários.
 */

class ListDemandas {
  #demandaRepository;

  constructor(demandaRepository) {
    this.#demandaRepository = demandaRepository;
  }

  async execute({ userId = null } = {}) {
    const demandas = await this.#demandaRepository.findAll({ userId });

    // Coleta IDs únicos
    const authorIds = [...new Set(demandas.map(d => d.authorId).filter(Boolean))];
    const assignedIds = [...new Set(demandas.map(d => d.assignedTo).filter(Boolean))];
    const resolvedByIds = [...new Set(demandas.map(d => d.resolvedById).filter(Boolean))];
    const allUserIds = [...new Set([...authorIds, ...assignedIds, ...resolvedByIds])];

    const usersMap = await this.#demandaRepository.getUsersByIds(allUserIds);

    // Busca contagem de comentários para cada demanda
    const demandasWithComments = await Promise.all(
      demandas.map(async (demanda) => {
        const comentarios = await this.#demandaRepository.findComentarios(demanda.id);
        const commentCount = comentarios.filter(c => c.tipo === 'comentario').length;

        const authorData = usersMap.get(demanda.authorId);
        const assignedData = usersMap.get(demanda.assignedTo);
        const resolvedByData = usersMap.get(demanda.resolvedById);

        return {
          ...demanda.toResponse(authorData, assignedData, resolvedByData),
          comment_count: commentCount,
        };
      })
    );

    return demandasWithComments;
  }
}

export { ListDemandas };
