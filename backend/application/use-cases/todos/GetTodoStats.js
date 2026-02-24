/**
 * Use Case: GetTodoStats
 * Retorna estatísticas de ToDo's por status e prioridade
 */

class GetTodoStats {
  #todoRepository;

  constructor(todoRepository) {
    this.#todoRepository = todoRepository;
  }

  async execute({ userId } = {}) {
    return await this.#todoRepository.getStats(userId);
  }
}

export { GetTodoStats };
