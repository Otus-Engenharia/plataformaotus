/**
 * Entidade: Todo
 * Aggregate Root do domínio de ToDo's
 *
 * Representa uma tarefa independente (nível 3 da EAP).
 * Pode existir vinculada a uma atividade de agenda ou de forma independente.
 */

import { TaskStatus } from '../value-objects/TaskStatus.js';
import { TaskPriority } from '../value-objects/TaskPriority.js';

class Todo {
  #id;
  #name;
  #description;
  #status;
  #priority;
  #startDate;
  #dueDate;
  #assignee;
  #createdBy;
  #projectId;
  #agendaTaskId;
  #closedAt;
  #closedBy;
  #createdAt;
  #updatedAt;

  constructor({
    id = null,
    name,
    description = null,
    status = 'backlog',
    priority = 'média',
    startDate = null,
    dueDate = null,
    assignee = null,
    createdBy = null,
    projectId = null,
    agendaTaskId = null,
    closedAt = null,
    closedBy = null,
    createdAt = null,
    updatedAt = null,
  }) {
    if (!name || name.trim().length === 0) {
      throw new Error('O nome da tarefa é obrigatório');
    }

    this.#id = id;
    this.#name = name.trim();
    this.#description = description?.trim() || null;
    this.#status = status instanceof TaskStatus ? status : new TaskStatus(status);
    this.#priority = priority instanceof TaskPriority ? priority : new TaskPriority(priority);
    this.#startDate = startDate ? new Date(startDate) : null;
    this.#dueDate = dueDate ? new Date(dueDate) : null;
    this.#assignee = assignee || null;
    this.#createdBy = createdBy || null;
    this.#projectId = projectId || null;
    this.#agendaTaskId = agendaTaskId || null;
    this.#closedAt = closedAt ? new Date(closedAt) : null;
    this.#closedBy = closedBy || null;
    this.#createdAt = createdAt ? new Date(createdAt) : new Date();
    this.#updatedAt = updatedAt ? new Date(updatedAt) : new Date();
  }

  // Getters
  get id() { return this.#id; }
  get name() { return this.#name; }
  get description() { return this.#description; }
  get status() { return this.#status; }
  get priority() { return this.#priority; }
  get startDate() { return this.#startDate; }
  get dueDate() { return this.#dueDate; }
  get assignee() { return this.#assignee; }
  get createdBy() { return this.#createdBy; }
  get projectId() { return this.#projectId; }
  get agendaTaskId() { return this.#agendaTaskId; }
  get closedAt() { return this.#closedAt; }
  get closedBy() { return this.#closedBy; }
  get createdAt() { return this.#createdAt; }
  get updatedAt() { return this.#updatedAt; }

  get isClosed() {
    return this.#status.isClosed;
  }

  get isOverdue() {
    if (!this.#dueDate || this.isClosed) return false;
    return new Date() > this.#dueDate;
  }

  isAssignedTo(userId) {
    return this.#assignee === userId;
  }

  belongsTo(userId) {
    return this.#createdBy === userId;
  }

  // --- Comportamentos do domínio ---

  /**
   * Completa a tarefa (checkbox)
   * @param {string} userId - ID do usuário que está completando
   */
  complete(userId) {
    if (this.isClosed) {
      throw new Error('Tarefa já está finalizada ou cancelada');
    }

    this.#status = TaskStatus.finalizado();
    this.#closedAt = new Date();
    this.#closedBy = userId || null;
    this.#updatedAt = new Date();
  }

  /**
   * Reabre a tarefa
   */
  reopen() {
    if (!this.isClosed) {
      throw new Error('Tarefa já está aberta');
    }

    this.#status = TaskStatus.aFazer();
    this.#closedAt = null;
    this.#closedBy = null;
    this.#updatedAt = new Date();
  }

  /**
   * Atualiza o status da tarefa
   * @param {string|TaskStatus} newStatus
   * @param {string} userId - ID do usuário que está atualizando
   */
  updateStatus(newStatus, userId = null) {
    const statusVO = newStatus instanceof TaskStatus
      ? newStatus
      : new TaskStatus(newStatus);

    if (statusVO.isClosed) {
      this.#closedAt = new Date();
      this.#closedBy = userId || null;
    } else if (this.#status.isClosed && statusVO.isOpen) {
      this.#closedAt = null;
      this.#closedBy = null;
    }

    this.#status = statusVO;
    this.#updatedAt = new Date();
  }

  /**
   * Atualiza a prioridade
   * @param {string|TaskPriority} newPriority
   */
  updatePriority(newPriority) {
    this.#priority = newPriority instanceof TaskPriority
      ? newPriority
      : new TaskPriority(newPriority);
    this.#updatedAt = new Date();
  }

  /**
   * Atualiza detalhes editáveis
   * @param {Object} details
   */
  updateDetails({ name, description, startDate, dueDate }) {
    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        throw new Error('O nome da tarefa é obrigatório');
      }
      this.#name = name.trim();
    }

    if (description !== undefined) {
      this.#description = description?.trim() || null;
    }

    if (startDate !== undefined) {
      this.#startDate = startDate ? new Date(startDate) : null;
    }

    if (dueDate !== undefined) {
      this.#dueDate = dueDate ? new Date(dueDate) : null;
    }

    this.#updatedAt = new Date();
  }

  /**
   * Reatribui a tarefa
   * @param {string} assigneeId
   */
  reassign(assigneeId) {
    this.#assignee = assigneeId || null;
    this.#updatedAt = new Date();
  }

  /**
   * Vincula a um projeto
   * @param {number} projectId
   */
  linkToProject(projectId) {
    this.#projectId = projectId || null;
    this.#updatedAt = new Date();
  }

  /**
   * Converte para objeto de persistência (snake_case)
   */
  toPersistence() {
    return {
      id: this.#id,
      name: this.#name,
      description: this.#description,
      status: this.#status.value,
      priority: this.#priority.value,
      start_date: this.#startDate?.toISOString() || null,
      due_date: this.#dueDate?.toISOString() || null,
      assignee: this.#assignee,
      created_by: this.#createdBy,
      project_id: this.#projectId,
      agenda_task_id: this.#agendaTaskId,
      closed_at: this.#closedAt?.toISOString() || null,
      created_at: this.#createdAt.toISOString(),
      updated_at: this.#updatedAt.toISOString(),
    };
  }

  /**
   * Converte para formato de resposta da API
   * @param {Object} assigneeData - { name, email }
   * @param {Object} createdByData - { name, email }
   * @param {Object} projectData - { id, name }
   */
  toResponse(assigneeData = null, createdByData = null, projectData = null) {
    return {
      id: this.#id,
      name: this.#name,
      description: this.#description,
      status: this.#status.value,
      status_label: this.#status.label,
      priority: this.#priority.value,
      priority_label: this.#priority.label,
      priority_color: this.#priority.color,
      start_date: this.#startDate?.toISOString() || null,
      due_date: this.#dueDate?.toISOString() || null,
      assignee: this.#assignee,
      assignee_name: assigneeData?.name || null,
      created_by: this.#createdBy,
      created_by_name: createdByData?.name || null,
      project_id: this.#projectId,
      project_name: projectData?.name || null,
      team_id: projectData?.team_id || null,
      team_name: projectData?.team_name || null,
      agenda_task_id: this.#agendaTaskId,
      closed_at: this.#closedAt?.toISOString() || null,
      created_at: this.#createdAt.toISOString(),
      updated_at: this.#updatedAt.toISOString(),
      is_closed: this.isClosed,
      is_overdue: this.isOverdue,
    };
  }

  /**
   * Factory: cria entidade a partir de dados do banco
   */
  static fromPersistence(data) {
    return new Todo({
      id: data.id,
      name: data.name,
      description: data.description,
      status: data.status,
      priority: data.priority || 'média',
      startDate: data.start_date,
      dueDate: data.due_date,
      assignee: data.assignee,
      createdBy: data.created_by,
      projectId: data.project_id,
      agendaTaskId: data.agenda_task_id,
      closedAt: data.closed_at,
      closedBy: data.closed_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  }

  /**
   * Factory: cria novo ToDo
   */
  static create({ name, description, priority, startDate, dueDate, assignee, createdBy, projectId }) {
    return new Todo({
      name,
      description,
      priority: priority || 'média',
      startDate,
      dueDate,
      assignee,
      createdBy,
      projectId,
    });
  }
}

export { Todo };
