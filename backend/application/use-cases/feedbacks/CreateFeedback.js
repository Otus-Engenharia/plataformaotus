/**
 * Use Case: CreateFeedback
 *
 * Cria um novo feedback.
 */

import { Feedback } from '../../../domain/feedbacks/entities/Feedback.js';

class CreateFeedback {
  #feedbackRepository;

  constructor(feedbackRepository) {
    this.#feedbackRepository = feedbackRepository;
  }

  /**
   * Executa o use case
   * @param {Object} input
   * @param {string} input.type - Tipo do feedback
   * @param {string} input.titulo - Título (opcional)
   * @param {string} input.feedbackText - Texto do feedback
   * @param {string} input.authorId - ID do autor
   * @param {string} input.pageUrl - URL da página (opcional)
   * @param {string} input.screenshotUrl - URL do screenshot (opcional)
   * @returns {Promise<Object>}
   */
  async execute({ type, titulo, feedbackText, authorId, pageUrl, screenshotUrl, area, authorRoleLevel }) {
    // Cria a entidade com validações do domínio
    const feedback = Feedback.create({
      type,
      titulo,
      feedbackText,
      authorId,
      pageUrl,
      screenshotUrl,
      area,
      authorRoleLevel,
    });

    // Persiste
    const savedFeedback = await this.#feedbackRepository.save(feedback);

    // Busca dados do autor para a resposta
    const authorData = await this.#feedbackRepository.getUserById(authorId);

    return savedFeedback.toResponse(authorData);
  }
}

export { CreateFeedback };
