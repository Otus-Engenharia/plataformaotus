/**
 * Use Case: UpdateFeedbackStatus
 *
 * Atualiza o status de um feedback.
 */

class UpdateFeedbackStatus {
  #feedbackRepository;

  constructor(feedbackRepository) {
    this.#feedbackRepository = feedbackRepository;
  }

  /**
   * Executa o use case
   * @param {Object} input
   * @param {number} input.id - ID do feedback
   * @param {string} input.status - Novo status
   * @param {string} input.resolvedById - ID de quem está atualizando
   * @returns {Promise<Object>}
   */
  async execute({ id, status, resolvedById }) {
    // Busca o feedback
    const feedback = await this.#feedbackRepository.findById(id);

    if (!feedback) {
      throw new Error('Feedback não encontrado');
    }

    // Atualiza o status (validações no domínio)
    feedback.updateStatus(status, resolvedById);

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

export { UpdateFeedbackStatus };
