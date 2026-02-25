/**
 * Interface: FeedbackRepository
 *
 * Define o contrato para persistência de Feedbacks.
 * A implementação concreta fica na camada de infraestrutura.
 *
 * Em JavaScript, usamos uma classe abstrata para definir o contrato.
 */

class FeedbackRepository {
  /**
   * Busca todos os feedbacks com filtros opcionais
   * @param {Object} options - Opções de busca
   * @param {string} options.userId - ID do usuário logado (para ordenar próprios primeiro)
   * @param {string|null} options.area - Área para filtrar (null = sem filtro)
   * @param {number|null} options.viewerRoleLevel - Nível de acesso do viewer para filtro hierárquico
   * @returns {Promise<Array<Feedback>>}
   */
  async findAll(options = {}) {
    throw new Error('Método findAll deve ser implementado');
  }

  /**
   * Busca feedback por ID
   * @param {number} id - ID do feedback
   * @returns {Promise<Feedback|null>}
   */
  async findById(id) {
    throw new Error('Método findById deve ser implementado');
  }

  /**
   * Busca feedbacks por autor
   * @param {string} authorId - ID do autor
   * @returns {Promise<Array<Feedback>>}
   */
  async findByAuthor(authorId) {
    throw new Error('Método findByAuthor deve ser implementado');
  }

  /**
   * Busca feedbacks por status
   * @param {string} status - Status do feedback
   * @returns {Promise<Array<Feedback>>}
   */
  async findByStatus(status) {
    throw new Error('Método findByStatus deve ser implementado');
  }

  /**
   * Salva um novo feedback
   * @param {Feedback} feedback - Entidade Feedback
   * @returns {Promise<Feedback>} - Feedback salvo com ID
   */
  async save(feedback) {
    throw new Error('Método save deve ser implementado');
  }

  /**
   * Atualiza um feedback existente
   * @param {Feedback} feedback - Entidade Feedback
   * @returns {Promise<Feedback>}
   */
  async update(feedback) {
    throw new Error('Método update deve ser implementado');
  }

  /**
   * Remove um feedback
   * @param {number} id - ID do feedback
   * @returns {Promise<void>}
   */
  async delete(id) {
    throw new Error('Método delete deve ser implementado');
  }

  /**
   * Busca estatísticas de feedbacks por status
   * @returns {Promise<Object>}
   */
  async getStats() {
    throw new Error('Método getStats deve ser implementado');
  }

  /**
   * Busca dados do usuário por ID
   * @param {string} userId - ID do usuário
   * @returns {Promise<{id: string, name: string, email: string}|null>}
   */
  async getUserById(userId) {
    throw new Error('Método getUserById deve ser implementado');
  }

  /**
   * Busca dados de múltiplos usuários por IDs
   * @param {Array<string>} userIds - IDs dos usuários
   * @returns {Promise<Map<string, {id: string, name: string, email: string}>>}
   */
  async getUsersByIds(userIds) {
    throw new Error('Método getUsersByIds deve ser implementado');
  }
}

export { FeedbackRepository };
