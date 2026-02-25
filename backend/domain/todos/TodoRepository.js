/**
 * Interface: TodoRepository
 *
 * Define o contrato para persistência de ToDo's.
 * A implementação concreta fica na camada de infraestrutura.
 */

class TodoRepository {
  /**
   * Busca todos os ToDo's com filtros opcionais
   * @param {Object} options
   * @param {string} options.userId - ID do usuário logado
   * @param {Object} options.filters - { status, priority, projectId, assignee, search }
   * @param {Object} options.sort - { field, direction }
   * @returns {Promise<Array<Todo>>}
   */
  async findAll(options = {}) {
    throw new Error('Método findAll deve ser implementado');
  }

  /**
   * Busca ToDo por ID
   * @param {number} id
   * @returns {Promise<Todo|null>}
   */
  async findById(id) {
    throw new Error('Método findById deve ser implementado');
  }

  /**
   * Salva um novo ToDo
   * @param {Todo} todo
   * @returns {Promise<Todo>} - ToDo salvo com ID
   */
  async save(todo) {
    throw new Error('Método save deve ser implementado');
  }

  /**
   * Atualiza um ToDo existente
   * @param {Todo} todo
   * @returns {Promise<Todo>}
   */
  async update(todo) {
    throw new Error('Método update deve ser implementado');
  }

  /**
   * Remove um ToDo
   * @param {number} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    throw new Error('Método delete deve ser implementado');
  }

  /**
   * Busca estatísticas de ToDo's
   * @param {string} userId - ID do usuário (opcional, para filtrar)
   * @returns {Promise<Object>}
   */
  async getStats(userId) {
    throw new Error('Método getStats deve ser implementado');
  }

  /**
   * Busca dados de múltiplos usuários por IDs
   * @param {Array<string>} userIds
   * @returns {Promise<Map<string, {id: string, name: string, email: string}>>}
   */
  async getUsersByIds(userIds) {
    throw new Error('Método getUsersByIds deve ser implementado');
  }

  /**
   * Busca dados de múltiplos projetos por IDs
   * @param {Array<number>} projectIds
   * @returns {Promise<Map<number, {id: number, name: string}>>}
   */
  async getProjectsByIds(projectIds) {
    throw new Error('Método getProjectsByIds deve ser implementado');
  }

  /**
   * Busca nome de uma tarefa de agenda por ID
   * @param {number} agendaTaskId
   * @returns {Promise<{id: number, name: string}|null>}
   */
  async getAgendaTaskById(agendaTaskId) {
    throw new Error('Método getAgendaTaskById deve ser implementado');
  }

  /**
   * Busca nomes de múltiplas tarefas de agenda por IDs
   * @param {Array<number>} agendaTaskIds
   * @returns {Promise<Map<number, {id: number, name: string}>>}
   */
  async getAgendaTasksByIds(agendaTaskIds) {
    throw new Error('Método getAgendaTasksByIds deve ser implementado');
  }
}

export { TodoRepository };
