/**
 * Use Case: GetPendingCounts
 *
 * Retorna contagem de feedbacks pendentes separados em bugs e feedbacks gerais.
 * Usado para badges de notificação na sidebar de configurações.
 */

class GetPendingCounts {
  #feedbackRepository;

  constructor(feedbackRepository) {
    this.#feedbackRepository = feedbackRepository;
  }

  /**
   * Executa o use case
   * @returns {Promise<{bugs: number, feedbacks: number}>}
   */
  async execute() {
    return await this.#feedbackRepository.getPendingCounts();
  }
}

export { GetPendingCounts };
