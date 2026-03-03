/**
 * Use Case: ListAgendaComments
 * Retorna os comentários de uma tarefa de agenda
 */

class ListAgendaComments {
  #agendaRepository;

  constructor(agendaRepository) {
    this.#agendaRepository = agendaRepository;
  }

  async execute(agendaTaskId) {
    if (!agendaTaskId) {
      throw new Error('O ID da tarefa é obrigatório');
    }

    return this.#agendaRepository.findCommentsByTaskId(agendaTaskId);
  }
}

export { ListAgendaComments };
