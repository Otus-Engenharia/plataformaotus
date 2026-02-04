/**
 * Use Case: GetFeedback
 *
 * Busca um feedback específico por ID.
 */

class GetFeedback {
  #feedbackRepository;

  constructor(feedbackRepository) {
    this.#feedbackRepository = feedbackRepository;
  }

  /**
   * Executa o use case
   * @param {number} id - ID do feedback
   * @returns {Promise<Object|null>}
   */
  async execute(id) {
    const feedback = await this.#feedbackRepository.findById(id);

    if (!feedback) {
      return null;
    }

    // Busca dados do autor e de quem resolveu
    const userIds = [feedback.authorId, feedback.resolvedById].filter(Boolean);
    const usersMap = await this.#feedbackRepository.getUsersByIds(userIds);

    const authorData = usersMap.get(feedback.authorId);
    const resolvedByData = usersMap.get(feedback.resolvedById);

    return feedback.toResponse(authorData, resolvedByData);
  }
}

export { GetFeedback };
