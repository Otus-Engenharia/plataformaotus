/**
 * Use Case: CompleteTodo
 * Toggle de conclusão — alterna entre finalizado e a fazer
 * Gerencia closed_at e closed_by
 */

class CompleteTodo {
  #todoRepository;

  constructor(todoRepository) {
    this.#todoRepository = todoRepository;
  }

  async execute({ id, userId }) {
    const todo = await this.#todoRepository.findById(id);
    if (!todo) {
      throw new Error('ToDo não encontrado');
    }

    if (todo.isClosed) {
      todo.reopen();
    } else {
      todo.complete(userId);
    }

    const updated = await this.#todoRepository.update(todo);

    // Enriquece resposta
    const userIds = [updated.assignee, updated.createdBy].filter(Boolean);
    const usersMap = await this.#todoRepository.getUsersByIds(userIds);

    let projectData = null;
    if (updated.projectId) {
      const projectsMap = await this.#todoRepository.getProjectsByIds([updated.projectId]);
      projectData = projectsMap.get(updated.projectId) || null;
    }

    return updated.toResponse(
      usersMap.get(updated.assignee) || null,
      usersMap.get(updated.createdBy) || null,
      projectData
    );
  }
}

export { CompleteTodo };
