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

  // --- Métodos de recorrência ---

  /**
   * Busca todas as tarefas-pai recorrentes de um usuário
   * @param {string} userId
   * @returns {Promise<AgendaTask[]>}
   */
  async findRecurringParents(userId) {
    throw new Error('Método findRecurringParents deve ser implementado');
  }

  /**
   * Retorna as start_dates de filhas de um pai em um range
   * @param {number} parentId
   * @param {string} startDate - ISO string
   * @param {string} endDate - ISO string
   * @returns {Promise<string[]>} array de ISO date strings
   */
  async findChildrenDatesInRange(parentId, startDate, endDate) {
    throw new Error('Método findChildrenDatesInRange deve ser implementado');
  }

  /**
   * Insere múltiplas tarefas de uma vez (batch insert)
   * @param {AgendaTask[]} tasks
   * @returns {Promise<AgendaTask[]>}
   */
  async saveMany(tasks) {
    throw new Error('Método saveMany deve ser implementado');
  }

  /**
   * Deleta filhas de um pai com start_date >= afterDate
   * @param {number} parentId
   * @param {string} afterDate - ISO string
   * @returns {Promise<void>}
   */
  async deleteFutureByParent(parentId, afterDate) {
    throw new Error('Método deleteFutureByParent deve ser implementado');
  }

  /**
   * Deleta todas as filhas de um pai
   * @param {number} parentId
   * @returns {Promise<void>}
   */
  async deleteAllChildren(parentId) {
    throw new Error('Método deleteAllChildren deve ser implementado');
  }

  /**
   * Retorna todas as instâncias de um grupo (parent + filhas)
   * @param {number} parentTaskId - ID do parent
   * @returns {Promise<AgendaTask[]>}
   */
  async findGroupInstances(parentTaskId) {
    throw new Error('Método findGroupInstances deve ser implementado');
  }

  /**
   * Conta filhas de um pai
   * @param {number} parentId
   * @returns {Promise<number>}
   */
  async countChildrenByParent(parentId) {
    throw new Error('Método countChildrenByParent deve ser implementado');
  }

  /**
   * Aplica delta de tempo a múltiplas instâncias
   * @param {number[]} ids
   * @param {number} deltaMs - diferença em milissegundos
   * @returns {Promise<void>}
   */
  async applyDeltaToInstances(ids, deltaMs) {
    throw new Error('Método applyDeltaToInstances deve ser implementado');
  }

  /**
   * Atualiza campos de recorrência do parent
   * @param {number} parentId
   * @param {Object} fields - { recurrence_anchor_date, recurrence_until, recurrence_excluded_dates }
   * @returns {Promise<void>}
   */
  async updateParentRecurrenceFields(parentId, fields) {
    throw new Error('Método updateParentRecurrenceFields deve ser implementado');
  }

  /**
   * Atualiza o grupo de atividade e nome de múltiplas instâncias
   * @param {number[]} ids
   * @param {number} standardAgendaTaskId
   * @param {string} name
   * @returns {Promise<void>}
   */
  async updateGroupForInstances(ids, standardAgendaTaskId, name) {
    throw new Error('Método updateGroupForInstances deve ser implementado');
  }
}

export { AgendaRepository };
