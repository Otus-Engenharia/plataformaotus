/**
 * Entidade: AgendaTask
 * Aggregate Root do domínio de Agenda
 *
 * Representa uma atividade de nível 2 da EAP registrada na agenda de um colaborador.
 * Regra de negócio: quando start_date e due_date estão preenchidos, a duração
 * deve ser múltipla de 30 minutos (mínimo 30 min).
 */

import { AgendaTaskStatus } from '../value-objects/AgendaTaskStatus.js';
import { AgendaRecurrence } from '../value-objects/AgendaRecurrence.js';

const SLOT_MINUTES = 30;

class AgendaTask {
  #id;
  #name;
  #startDate;
  #dueDate;
  #userId;
  #status;
  #recurrence;
  #standardAgendaTaskId;
  #compactTaskKind;
  #relatedDisciplineId;
  #phase;
  #createdAt;
  // Campos de recorrência
  #parentTaskId;
  #recurrenceAnchorDate;
  #recurrenceUntil;
  #recurrenceCount;
  #recurrenceExcludedDates;
  #recurrenceCopyProjects;

  constructor({
    id = null,
    name,
    startDate = null,
    dueDate = null,
    userId,
    status = 'a fazer',
    recurrence = 'nunca',
    standardAgendaTaskId = null,
    compactTaskKind = null,
    relatedDisciplineId = null,
    phase = null,
    createdAt = null,
    parentTaskId = null,
    recurrenceAnchorDate = null,
    recurrenceUntil = null,
    recurrenceCount = null,
    recurrenceExcludedDates = null,
    recurrenceCopyProjects = false,
  }) {
    if (!name || name.trim().length === 0) {
      throw new Error('O nome da tarefa é obrigatório');
    }

    if (!userId) {
      throw new Error('O usuário responsável é obrigatório');
    }

    const parsedStart = startDate ? new Date(startDate) : null;
    const parsedDue = dueDate ? new Date(dueDate) : null;

    if (parsedStart && parsedDue) {
      AgendaTask.validateDuration(parsedStart, parsedDue);
    }

    this.#id = id;
    this.#name = name.trim();
    this.#startDate = parsedStart;
    this.#dueDate = parsedDue;
    this.#userId = userId;
    this.#status = status instanceof AgendaTaskStatus ? status : new AgendaTaskStatus(status);
    this.#recurrence = recurrence instanceof AgendaRecurrence ? recurrence : new AgendaRecurrence(recurrence);
    this.#standardAgendaTaskId = standardAgendaTaskId || null;
    this.#compactTaskKind = compactTaskKind || null;
    this.#relatedDisciplineId = relatedDisciplineId || null;
    this.#phase = phase || null;
    this.#createdAt = createdAt ? new Date(createdAt) : new Date();
    // Recorrência
    this.#parentTaskId = parentTaskId || null;
    this.#recurrenceAnchorDate = recurrenceAnchorDate ? new Date(recurrenceAnchorDate) : null;
    this.#recurrenceUntil = recurrenceUntil ? new Date(recurrenceUntil) : null;
    this.#recurrenceCount = recurrenceCount != null ? Number(recurrenceCount) : null;
    this.#recurrenceExcludedDates = Array.isArray(recurrenceExcludedDates) ? recurrenceExcludedDates : [];
    this.#recurrenceCopyProjects = Boolean(recurrenceCopyProjects);
  }

  // Getters
  get id() { return this.#id; }
  get name() { return this.#name; }
  get startDate() { return this.#startDate; }
  get dueDate() { return this.#dueDate; }
  get userId() { return this.#userId; }
  get status() { return this.#status; }
  get recurrence() { return this.#recurrence; }
  get standardAgendaTaskId() { return this.#standardAgendaTaskId; }
  get compactTaskKind() { return this.#compactTaskKind; }
  get relatedDisciplineId() { return this.#relatedDisciplineId; }
  get phase() { return this.#phase; }
  get createdAt() { return this.#createdAt; }
  get parentTaskId() { return this.#parentTaskId; }
  get recurrenceAnchorDate() { return this.#recurrenceAnchorDate; }
  get recurrenceUntil() { return this.#recurrenceUntil; }
  get recurrenceCount() { return this.#recurrenceCount; }
  get recurrenceExcludedDates() { return this.#recurrenceExcludedDates; }
  get recurrenceCopyProjects() { return this.#recurrenceCopyProjects; }

  // Propriedades calculadas
  get isScheduled() {
    return !!(this.#startDate && this.#dueDate);
  }

  get durationMinutes() {
    if (!this.isScheduled) return null;
    return Math.round((this.#dueDate - this.#startDate) / (1000 * 60));
  }

  get isDone() {
    return this.#status.isDone;
  }

  get isRecurring() {
    return this.#recurrence.isRecurring;
  }

  get isRecurringParent() {
    return this.isRecurring && !this.#parentTaskId;
  }

  get isRecurringChild() {
    return !!this.#parentTaskId;
  }

  // --- Comportamentos do domínio ---

  /**
   * Move o evento para um novo horário mantendo a duração original (drag & drop)
   */
  reschedule(newStartDate, newDueDate) {
    const parsedStart = new Date(newStartDate);
    const parsedDue = new Date(newDueDate);

    AgendaTask.validateDuration(parsedStart, parsedDue);

    this.#startDate = parsedStart;
    this.#dueDate = parsedDue;
  }

  /**
   * Altera a duração do evento redimensionando o fim (drag na borda inferior)
   */
  resize(newDueDate) {
    if (!this.#startDate) {
      throw new Error('Não é possível redimensionar uma tarefa sem horário de início');
    }

    const parsedDue = new Date(newDueDate);
    AgendaTask.validateDuration(this.#startDate, parsedDue);

    this.#dueDate = parsedDue;
  }

  /**
   * Marca a tarefa como concluída
   */
  complete() {
    this.#status = AgendaTaskStatus.feito();
  }

  /**
   * Reabre a tarefa
   */
  reopen() {
    this.#status = AgendaTaskStatus.aFazer();
  }

  /**
   * Altera o tipo de recorrência
   */
  changeRecurrence(newRecurrence) {
    this.#recurrence = newRecurrence instanceof AgendaRecurrence
      ? newRecurrence
      : new AgendaRecurrence(newRecurrence);
  }

  /**
   * Altera o grupo de atividade padrão (standard_agenda_task) e opcionalmente o nome
   */
  changeStandardTask(newStandardAgendaTaskId, newName) {
    this.#standardAgendaTaskId = newStandardAgendaTaskId;
    if (newName) {
      this.#name = newName;
    }
  }

  /**
   * Define a data-modelo (anchor) para materialização de instâncias futuras
   */
  setAnchorDate(date) {
    this.#recurrenceAnchorDate = date ? new Date(date) : null;
  }

  /**
   * Define a data limite da recorrência
   */
  setRecurrenceUntil(date) {
    this.#recurrenceUntil = date ? new Date(date) : null;
  }

  /**
   * Define o número máximo de repetições
   */
  setRecurrenceCount(count) {
    this.#recurrenceCount = count != null ? Number(count) : null;
  }

  /**
   * Define se deve copiar projetos para instâncias filhas
   */
  setCopyProjects(value) {
    this.#recurrenceCopyProjects = !!value;
  }

  /**
   * Adiciona uma data à lista de exclusões (para "deletar apenas esta")
   */
  addExcludedDate(dateStr) {
    if (dateStr && !this.#recurrenceExcludedDates.includes(dateStr)) {
      this.#recurrenceExcludedDates = [...this.#recurrenceExcludedDates, dateStr];
    }
  }

  /**
   * Converte para objeto de persistência (snake_case)
   */
  toPersistence() {
    return {
      id: this.#id,
      name: this.#name,
      start_date: this.#startDate?.toISOString() || null,
      due_date: this.#dueDate?.toISOString() || null,
      user_id: this.#userId,
      status: this.#status.value,
      recurrence: this.#recurrence.value,
      standard_agenda_task: this.#standardAgendaTaskId,
      coompat_task_kind: this.#compactTaskKind,
      related_discipline_id: this.#relatedDisciplineId,
      phase: this.#phase,
      created_at: this.#createdAt.toISOString(),
      parent_task_id: this.#parentTaskId,
      recurrence_anchor_date: this.#recurrenceAnchorDate?.toISOString() || null,
      recurrence_until: this.#recurrenceUntil?.toISOString() || null,
      recurrence_count: this.#recurrenceCount,
      recurrence_excluded_dates: this.#recurrenceExcludedDates.length > 0 ? this.#recurrenceExcludedDates : null,
      recurrence_copy_projects: this.#recurrenceCopyProjects,
    };
  }

  /**
   * Converte para formato de resposta da API
   */
  toResponse() {
    return {
      id: this.#id,
      name: this.#name,
      start_date: this.#startDate?.toISOString() || null,
      due_date: this.#dueDate?.toISOString() || null,
      user_id: this.#userId,
      status: this.#status.value,
      status_label: this.#status.label,
      recurrence: this.#recurrence.value,
      recurrence_label: this.#recurrence.label,
      standard_agenda_task: this.#standardAgendaTaskId,
      coompat_task_kind: this.#compactTaskKind,
      related_discipline_id: this.#relatedDisciplineId,
      phase: this.#phase,
      created_at: this.#createdAt.toISOString(),
      // Campos calculados
      is_scheduled: this.isScheduled,
      duration_minutes: this.durationMinutes,
      is_done: this.isDone,
      // Campos de recorrência
      parent_task_id: this.#parentTaskId,
      recurrence_anchor_date: this.#recurrenceAnchorDate?.toISOString() || null,
      recurrence_until: this.#recurrenceUntil?.toISOString() || null,
      recurrence_count: this.#recurrenceCount,
      recurrence_copy_projects: this.#recurrenceCopyProjects,
    };
  }

  /**
   * Factory: cria a partir de dados do banco de dados
   */
  static fromPersistence(data) {
    return new AgendaTask({
      id: data.id,
      name: data.name,
      startDate: data.start_date,
      dueDate: data.due_date,
      userId: data.user_id,
      status: data.status,
      recurrence: data.recurrence,
      standardAgendaTaskId: data.standard_agenda_task,
      compactTaskKind: data.coompat_task_kind,
      relatedDisciplineId: data.related_discipline_id,
      phase: data.phase,
      createdAt: data.created_at,
      parentTaskId: data.parent_task_id,
      recurrenceAnchorDate: data.recurrence_anchor_date,
      recurrenceUntil: data.recurrence_until,
      recurrenceCount: data.recurrence_count,
      recurrenceExcludedDates: data.recurrence_excluded_dates,
      recurrenceCopyProjects: data.recurrence_copy_projects,
    });
  }

  /**
   * Factory: cria nova tarefa
   */
  static create({
    name, startDate, dueDate, userId, recurrence,
    standardAgendaTaskId, compactTaskKind, relatedDisciplineId, phase,
    parentTaskId, recurrenceAnchorDate, recurrenceUntil, recurrenceCount,
    recurrenceExcludedDates, recurrenceCopyProjects,
  }) {
    return new AgendaTask({
      name,
      startDate: startDate || null,
      dueDate: dueDate || null,
      userId,
      recurrence: recurrence || 'nunca',
      standardAgendaTaskId: standardAgendaTaskId || null,
      compactTaskKind: compactTaskKind || null,
      relatedDisciplineId: relatedDisciplineId || null,
      phase: phase || null,
      parentTaskId: parentTaskId || null,
      recurrenceAnchorDate: recurrenceAnchorDate || null,
      recurrenceUntil: recurrenceUntil || null,
      recurrenceCount: recurrenceCount != null ? recurrenceCount : null,
      recurrenceExcludedDates: recurrenceExcludedDates || null,
      recurrenceCopyProjects: recurrenceCopyProjects || false,
    });
  }

  /**
   * Valida que a duração entre dois timestamps é múltipla de 30 minutos e não negativa
   */
  static validateDuration(startDate, dueDate) {
    if (dueDate <= startDate) {
      throw new Error('A data de término deve ser posterior à data de início');
    }

    const durationMs = dueDate - startDate;
    const durationMinutes = durationMs / (1000 * 60);

    if (durationMinutes % SLOT_MINUTES !== 0) {
      throw new Error(
        `A duração deve ser múltipla de ${SLOT_MINUTES} minutos. Duração calculada: ${durationMinutes} minutos`
      );
    }
  }
}

export { AgendaTask };
