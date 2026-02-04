/**
 * Use Case: GetFeedbackStats
 *
 * Retorna estatísticas de feedbacks.
 */

class GetFeedbackStats {
  #feedbackRepository;

  constructor(feedbackRepository) {
    this.#feedbackRepository = feedbackRepository;
  }

  /**
   * Executa o use case
   * @returns {Promise<Object>}
   */
  async execute() {
    return await this.#feedbackRepository.getStats();
  }
}

export { GetFeedbackStats };
