/**
 * Use Case: CreateAgendaTask
 * Cria uma nova tarefa de agenda
 * Aplica a regra de duração mínima de 30 min em múltiplos de 30 min
 */

import { AgendaTask } from '../../../domain/agenda/index.js';

class CreateAgendaTask {
  #agendaRepository;

  constructor(agendaRepository) {
    this.#agendaRepository = agendaRepository;
  }

  async execute({
    name, startDate, dueDate, userId, recurrence,
    standardAgendaTaskId, compactTaskKind, relatedDisciplineId, phase,
    projectIds, selectedStandardTasks,
    recurrenceUntil, recurrenceCount, recurrenceCopyProjects,
  }) {
    // Se é recorrente, setar anchor e campos de recorrência
    const isRecurring = recurrence && recurrence !== 'nunca';

    const task = AgendaTask.create({
      name,
      startDate: startDate || null,
      dueDate: dueDate || null,
      userId,
      recurrence,
      standardAgendaTaskId,
      compactTaskKind,
      relatedDisciplineId,
      phase,
      recurrenceAnchorDate: isRecurring ? (startDate || null) : null,
      recurrenceUntil: isRecurring ? (recurrenceUntil || null) : null,
      recurrenceCount: isRecurring ? (recurrenceCount != null ? recurrenceCount : null) : null,
      recurrenceCopyProjects: isRecurring ? Boolean(recurrenceCopyProjects) : false,
    });

    const saved = await this.#agendaRepository.save(task);

    // Vincular projetos à tarefa (agenda_projects)
    if (projectIds?.length) {
      await this.#agendaRepository.saveProjectLinks(saved.id, projectIds);
    }

    // Criar ToDo's: 1 por standard_task × projeto
    if (selectedStandardTasks?.length && projectIds?.length) {
      const todos = [];
      for (const projectId of projectIds) {
        for (const st of selectedStandardTasks) {
          todos.push({
            name: st.name,
            due_date: saved.dueDate?.toISOString() || null,
            assignee: saved.userId,
            project_id: projectId,
            agenda_task_id: saved.id,
          });
        }
      }
      await this.#agendaRepository.saveTodos(todos);
    }

    return saved.toResponse();
  }
}

export { CreateAgendaTask };
