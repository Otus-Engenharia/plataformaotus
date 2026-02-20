/**
 * Interface: AgendaRepository
 * Define o contrato para persistência do domínio de Agenda
 */

class AgendaRepository {
  /**
   * Busca tarefas agendadas de um usuário em um intervalo de datas
   * @param {string} userId
   * @param {string} startDate - ISO string
   * @param {string} endDate - ISO string
   * @returns {Promise<AgendaTask[]>}
   */
  async findByUserAndDateRange(userId, startDate, endDate) {
    throw new Error('Método findByUserAndDateRange deve ser implementado');
  }

  /**
   * Busca uma tarefa pelo ID
   * @param {number} id
   * @returns {Promise<AgendaTask|null>}
   */
  async findById(id) {
    throw new Error('Método findById deve ser implementado');
  }

  /**
   * Persiste uma nova tarefa
   * @param {AgendaTask} task
   * @returns {Promise<AgendaTask>}
   */
  async save(task) {
    throw new Error('Método save deve ser implementado');
  }

  /**
   * Atualiza uma tarefa existente
   * @param {AgendaTask} task
   * @returns {Promise<AgendaTask>}
   */
  async update(task) {
    throw new Error('Método update deve ser implementado');
  }

  /**
   * Remove uma tarefa pelo ID
   * @param {number} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    throw new Error('Método delete deve ser implementado');
  }

  /**
   * Retorna os IDs de projetos vinculados a uma tarefa
   * @param {number} taskId
   * @returns {Promise<number[]>}
   */
  async findProjectsByTaskId(taskId) {
    throw new Error('Método findProjectsByTaskId deve ser implementado');
  }

  /**
   * Vincula projetos a uma tarefa de agenda (agenda_projects)
   * @param {number} taskId
   * @param {number[]} projectIds
   * @returns {Promise<void>}
   */
  async saveProjectLinks(taskId, projectIds) {
    throw new Error('Método saveProjectLinks deve ser implementado');
  }

  /**
   * Cria ToDo's na tabela tasks
   * @param {Array<{ name, due_date, assignee, project_id, agenda_task_id }>} todos
   * @returns {Promise<void>}
   */
  async saveTodos(todos) {
    throw new Error('Método saveTodos deve ser implementado');
  }

  /**
   * Busca ToDo's por IDs de tarefas de agenda
   * @param {number[]} agendaTaskIds
   * @returns {Promise<Array>}
   */
  async findTodosByAgendaTaskIds(agendaTaskIds) {
    throw new Error('Método findTodosByAgendaTaskIds deve ser implementado');
  }

  /**
   * Atualiza o status de um ToDo
   * @param {number} todoId
   * @param {string} status
   * @returns {Promise<Object>}
   */
  async updateTodoStatus(todoId, status) {
    throw new Error('Método updateTodoStatus deve ser implementado');
  }
}

export { AgendaRepository };
