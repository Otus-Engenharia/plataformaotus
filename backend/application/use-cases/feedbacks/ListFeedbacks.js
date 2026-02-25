/**
 * Use Case: ListFeedbacks
 *
 * Lista todos os feedbacks, enriquecidos com dados dos autores.
 */

class ListFeedbacks {
  #feedbackRepository;

  constructor(feedbackRepository) {
    this.#feedbackRepository = feedbackRepository;
  }

  /**
   * Executa o use case
   * @param {Object} options
   * @param {string} options.userId - ID do usuário logado (para ordenar próprios primeiro)
   * @param {string|null} options.area - Área para filtrar
   * @param {number|null} options.viewerRoleLevel - Nível de acesso do viewer para filtro hierárquico
   * @returns {Promise<Array>}
   */
  async execute({ userId = null, area = null, viewerRoleLevel = null } = {}) {
    // Busca feedbacks com filtros
    const feedbacks = await this.#feedbackRepository.findAll({ userId, area, viewerRoleLevel });

    // Coleta IDs únicos de autores e resolvedores
    const authorIds = [...new Set(feedbacks.map(f => f.authorId).filter(Boolean))];
    const resolvedByIds = [...new Set(feedbacks.map(f => f.resolvedById).filter(Boolean))];
    const allUserIds = [...new Set([...authorIds, ...resolvedByIds])];

    // Busca dados dos usuários
    const usersMap = await this.#feedbackRepository.getUsersByIds(allUserIds);

    // Converte para formato de resposta
    return feedbacks.map(feedback => {
      const authorData = usersMap.get(feedback.authorId);
      const resolvedByData = usersMap.get(feedback.resolvedById);
      return feedback.toResponse(authorData, resolvedByData);
    });
  }
}

export { ListFeedbacks };
