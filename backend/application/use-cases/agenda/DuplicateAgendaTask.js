/**
 * Use Case: DuplicateAgendaTask
 * Duplica uma tarefa de agenda para outro dia/horário.
 * Copia: name, standard_agenda_task, coompat_task_kind, related_discipline_id, phase.
 * Opcionalmente copia projetos vinculados.
 * Reseta: status = 'a fazer', recurrence = 'nunca', sem ToDos.
 */

import { AgendaTask } from '../../../domain/agenda/index.js';

class DuplicateAgendaTask {
  #agendaRepository;

  constructor(agendaRepository) {
    this.#agendaRepository = agendaRepository;
  }

  async execute({ sourceId, startDate, dueDate, userId, copyProjects = true }) {
    const source = await this.#agendaRepository.findById(sourceId);
    if (!source) {
      throw new Error(`Tarefa ${sourceId} não encontrada`);
    }

    const newTask = AgendaTask.create({
      name: source.name,
      startDate,
      dueDate,
      userId,
      standardAgendaTaskId: source.standardAgendaTaskId,
      compactTaskKind: source.compactTaskKind,
      relatedDisciplineId: source.relatedDisciplineId,
      phase: source.phase,
    });

    const saved = await this.#agendaRepository.save(newTask);

    if (copyProjects) {
      const projectIds = await this.#agendaRepository.findProjectsByTaskId(sourceId);
      if (projectIds.length > 0) {
        await this.#agendaRepository.saveProjectLinks(saved.id, projectIds);
      }
    }

    return saved.toResponse();
  }
}

export { DuplicateAgendaTask };
