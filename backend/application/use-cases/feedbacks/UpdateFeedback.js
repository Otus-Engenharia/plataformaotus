/**
 * Use Case: UpdateFeedback
 *
 * Atualiza um feedback (status, análise, ação, categoria).
 */

class UpdateFeedback {
  #feedbackRepository;

  constructor(feedbackRepository) {
    this.#feedbackRepository = feedbackRepository;
  }

  /**
   * Executa o use case
   * @param {Object} input
   * @param {number} input.id - ID do feedback
   * @param {string} input.status - Novo status (opcional)
   * @param {string} input.adminAnalysis - Análise do admin (opcional)
   * @param {string} input.adminAction - Ação a tomar (opcional)
   * @param {string} input.category - Categoria (opcional)
   * @param {string} input.area - Área do feedback (opcional)
   * @param {string} input.resolvedById - ID de quem está atualizando
   * @returns {Promise<Object>}
   */
  async execute({ id, status, adminAnalysis, adminAction, category, area, resolvedById }) {
    // Busca o feedback
    const feedback = await this.#feedbackRepository.findById(id);

    if (!feedback) {
      throw new Error('Feedback não encontrado');
    }

    // Aplica as atualizações usando métodos do domínio
    if (status !== undefined) {
      feedback.updateStatus(status, resolvedById);
    }

    if (adminAnalysis !== undefined || adminAction !== undefined) {
      feedback.addAdminResponse(adminAnalysis, adminAction);
    }

    if (category !== undefined) {
      feedback.setCategory(category);
    }

    if (area !== undefined) {
      feedback.setArea(area);
    }

    // Persiste
    const updatedFeedback = await this.#feedbackRepository.update(feedback);

    // Busca dados dos usuários para a resposta
    const userIds = [updatedFeedback.authorId, updatedFeedback.resolvedById].filter(Boolean);
    const usersMap = await this.#feedbackRepository.getUsersByIds(userIds);

    const authorData = usersMap.get(updatedFeedback.authorId);
    const resolvedByData = usersMap.get(updatedFeedback.resolvedById);

    return updatedFeedback.toResponse(authorData, resolvedByData);
  }
}

export { UpdateFeedback };
