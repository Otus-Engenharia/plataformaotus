/**
 * Use Case: UpdateTodo
 * Atualização parcial de um ToDo usando métodos do domínio
 */

class UpdateTodo {
  #todoRepository;

  constructor(todoRepository) {
    this.#todoRepository = todoRepository;
  }

  async execute({ id, name, description, status, priority, startDate, dueDate, assignee, projectId, agendaTaskId, userId }) {
    const todo = await this.#todoRepository.findById(id);
    if (!todo) {
      throw new Error('ToDo não encontrado');
    }

    // Aplica mudanças usando métodos do domínio
    if (status !== undefined) {
      todo.updateStatus(status, userId);
    }

    if (priority !== undefined) {
      todo.updatePriority(priority);
    }

    if (name !== undefined || description !== undefined || startDate !== undefined || dueDate !== undefined) {
      todo.updateDetails({ name, description, startDate, dueDate });
    }

    if (assignee !== undefined) {
      todo.reassign(assignee);
    }

    if (projectId !== undefined) {
      todo.linkToProject(projectId);
    }

    if (agendaTaskId !== undefined) {
      todo.linkToAgendaTask(agendaTaskId);
    }

    const updated = await this.#todoRepository.update(todo);

    // Garante que o projeto do ToDo esteja vinculado à agenda
    if (updated.agendaTaskId && updated.projectId) {
      await this.#todoRepository.ensureAgendaProjectLink(updated.agendaTaskId, updated.projectId);
    }

    // Enriquece resposta
    const userIds = [updated.assignee, updated.createdBy].filter(Boolean);
    const usersMap = await this.#todoRepository.getUsersByIds(userIds);

    let projectData = null;
    if (updated.projectId) {
      const projectsMap = await this.#todoRepository.getProjectsByIds([updated.projectId]);
      projectData = projectsMap.get(updated.projectId) || null;
    }

    let agendaTaskData = null;
    if (updated.agendaTaskId) {
      agendaTaskData = await this.#todoRepository.getAgendaTaskById(updated.agendaTaskId);
    }

    return updated.toResponse(
      usersMap.get(updated.assignee) || null,
      usersMap.get(updated.createdBy) || null,
      projectData,
      agendaTaskData
    );
  }
}

export { UpdateTodo };
