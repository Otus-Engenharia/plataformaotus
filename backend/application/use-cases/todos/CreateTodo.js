/**
 * Use Case: CreateTodo
 * Cria um novo ToDo independente
 */

import { Todo } from '../../../domain/todos/entities/Todo.js';

class CreateTodo {
  #todoRepository;

  constructor(todoRepository) {
    this.#todoRepository = todoRepository;
  }

  async execute({ name, description, priority, dueDate, assignee, createdBy, projectId, agendaTaskId }) {
    const todo = Todo.create({
      name,
      description,
      priority,
      dueDate,
      assignee,
      createdBy,
      projectId,
      agendaTaskId,
    });

    const saved = await this.#todoRepository.save(todo);

    // Enriquece com dados de usuário e projeto
    const userIds = [saved.assignee, saved.createdBy].filter(Boolean);
    const usersMap = await this.#todoRepository.getUsersByIds(userIds);

    let projectData = null;
    if (saved.projectId) {
      const projectsMap = await this.#todoRepository.getProjectsByIds([saved.projectId]);
      projectData = projectsMap.get(saved.projectId) || null;
    }

    return saved.toResponse(
      usersMap.get(saved.assignee) || null,
      usersMap.get(saved.createdBy) || null,
      projectData
    );
  }
}

export { CreateTodo };
