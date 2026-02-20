/**
 * Use Case: UpdateAgendaTask
 * Atualiza uma tarefa de agenda existente
 * Utilizado para: drag & drop (reschedule), resize (resize), edição de campos
 */

class UpdateAgendaTask {
  #agendaRepository;

  constructor(agendaRepository) {
    this.#agendaRepository = agendaRepository;
  }

  async execute({ id, name, startDate, dueDate, status, recurrence, reschedule, resize }) {
    const task = await this.#agendaRepository.findById(id);

    if (!task) {
      throw new Error(`Tarefa de agenda com ID ${id} não encontrada`);
    }

    // Drag & drop: mover evento (reschedule mantém duração)
    if (reschedule) {
      task.reschedule(reschedule.startDate, reschedule.dueDate);
    }
    // Drag borda inferior: redimensionar evento
    else if (resize) {
      task.resize(resize.dueDate);
    }
    // Atualização de status
    else if (status !== undefined) {
      if (status === 'feito') {
        task.complete();
      } else {
        task.reopen();
      }
    }
    // Atualização de datas direta (ex: edição manual)
    else if (startDate !== undefined || dueDate !== undefined) {
      const newStart = startDate !== undefined ? startDate : task.startDate?.toISOString();
      const newDue = dueDate !== undefined ? dueDate : task.dueDate?.toISOString();
      task.reschedule(newStart, newDue);
    }

    const updated = await this.#agendaRepository.update(task);

    return updated.toResponse();
  }
}

export { UpdateAgendaTask };
