/**
 * Use Case: GetAgendaTask
 * Busca uma tarefa de agenda pelo ID
 */

class GetAgendaTask {
  #agendaRepository;

  constructor(agendaRepository) {
    this.#agendaRepository = agendaRepository;
  }

  async execute(id) {
    const task = await this.#agendaRepository.findById(id);

    if (!task) {
      return null;
    }

    return task.toResponse();
  }
}

export { GetAgendaTask };
