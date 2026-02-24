/**
 * Use Case: ListTodos
 * Lista ToDo's com filtros e ordenação
 */

class ListTodos {
  #todoRepository;

  constructor(todoRepository) {
    this.#todoRepository = todoRepository;
  }

  async execute({ userId, filters = {}, sort = {} } = {}) {
    const todos = await this.#todoRepository.findAll({ userId, filters, sort });

    if (todos.length === 0) return [];

    // Coleta IDs únicos para batch fetch
    const userIds = new Set();
    const projectIds = new Set();

    for (const todo of todos) {
      if (todo.assignee) userIds.add(todo.assignee);
      if (todo.createdBy) userIds.add(todo.createdBy);
      if (todo.projectId) projectIds.add(todo.projectId);
    }

    const [usersMap, projectsMap] = await Promise.all([
      this.#todoRepository.getUsersByIds([...userIds]),
      this.#todoRepository.getProjectsByIds([...projectIds]),
    ]);

    return todos.map(todo => todo.toResponse(
      usersMap.get(todo.assignee) || null,
      usersMap.get(todo.createdBy) || null,
      projectsMap.get(todo.projectId) || null
    ));
  }
}

export { ListTodos };
