/**
 * Use Case: GetTodo
 * Busca um ToDo por ID com dados enriquecidos
 */

class GetTodo {
  #todoRepository;

  constructor(todoRepository) {
    this.#todoRepository = todoRepository;
  }

  async execute(id) {
    const todo = await this.#todoRepository.findById(id);
    if (!todo) return null;

    const userIds = [todo.assignee, todo.createdBy].filter(Boolean);
    const usersMap = await this.#todoRepository.getUsersByIds(userIds);

    let projectData = null;
    if (todo.projectId) {
      const projectsMap = await this.#todoRepository.getProjectsByIds([todo.projectId]);
      projectData = projectsMap.get(todo.projectId) || null;
    }

    return todo.toResponse(
      usersMap.get(todo.assignee) || null,
      usersMap.get(todo.createdBy) || null,
      projectData
    );
  }
}

export { GetTodo };
