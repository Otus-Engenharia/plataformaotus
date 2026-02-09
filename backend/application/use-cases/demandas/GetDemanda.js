/**
 * Use Case: GetDemanda
 *
 * Busca uma demanda específica por ID, com comentários.
 */

class GetDemanda {
  #demandaRepository;

  constructor(demandaRepository) {
    this.#demandaRepository = demandaRepository;
  }

  async execute(id) {
    const demanda = await this.#demandaRepository.findById(id);

    if (!demanda) {
      return null;
    }

    // Busca comentários
    const comentarios = await this.#demandaRepository.findComentarios(id);

    // Coleta IDs de todos os usuários envolvidos
    const commentAuthorIds = comentarios.map(c => c.author_id).filter(Boolean);
    const allUserIds = [
      ...new Set([
        demanda.authorId,
        demanda.assignedTo,
        demanda.resolvedById,
        ...commentAuthorIds,
      ].filter(Boolean))
    ];

    const usersMap = await this.#demandaRepository.getUsersByIds(allUserIds);

    const authorData = usersMap.get(demanda.authorId);
    const assignedData = usersMap.get(demanda.assignedTo);
    const resolvedByData = usersMap.get(demanda.resolvedById);

    // Enriquece comentários com dados dos autores
    const enrichedComentarios = comentarios.map(c => ({
      ...c,
      author_name: usersMap.get(c.author_id)?.name || null,
      author_email: usersMap.get(c.author_id)?.email || null,
    }));

    return {
      ...demanda.toResponse(authorData, assignedData, resolvedByData),
      comentarios: enrichedComentarios,
    };
  }
}

export { GetDemanda };
