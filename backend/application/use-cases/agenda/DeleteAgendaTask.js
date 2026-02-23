/**
 * Use Case: DeleteAgendaTask
 * Remove uma tarefa de agenda
 */

class DeleteAgendaTask {
  #agendaRepository;

  constructor(agendaRepository) {
    this.#agendaRepository = agendaRepository;
  }

  async execute(id) {
    const task = await this.#agendaRepository.findById(id);

    if (!task) {
      throw new Error(`Tarefa de agenda com ID ${id} não encontrada`);
    }

    // Se é parent de um grupo recorrente, deletar filhas primeiro (CASCADE cuida,
    // mas ser explícito evita problemas com project links e todos)
    if (task.isRecurringParent) {
      await this.#agendaRepository.deleteAllChildren(id);
    }

    await this.#agendaRepository.delete(id);
  }
}

export { DeleteAgendaTask };
