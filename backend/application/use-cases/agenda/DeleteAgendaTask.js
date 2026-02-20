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

    await this.#agendaRepository.delete(id);
  }
}

export { DeleteAgendaTask };
