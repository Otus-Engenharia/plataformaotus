/**
 * Use Case: CountMyFeedbackUpdates
 *
 * Conta feedbacks do autor que foram atualizados por admin/dev
 * desde um determinado timestamp (para badge de notificação).
 */

class CountMyFeedbackUpdates {
  #feedbackRepository;

  constructor(feedbackRepository) {
    this.#feedbackRepository = feedbackRepository;
  }

  /**
   * @param {Object} input
   * @param {string} input.authorId - ID do autor logado
   * @param {string} input.since - ISO timestamp de referência
   * @returns {Promise<number>}
   */
  async execute({ authorId, since }) {
    if (!authorId) {
      throw new Error('authorId é obrigatório');
    }
    if (!since) {
      throw new Error('since é obrigatório');
    }

    return await this.#feedbackRepository.countUpdatedForAuthor(authorId, since);
  }
}

export { CountMyFeedbackUpdates };
