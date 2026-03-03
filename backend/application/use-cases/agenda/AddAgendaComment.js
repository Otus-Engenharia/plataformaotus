/**
 * Use Case: AddAgendaComment
 * Adiciona um comentário a uma tarefa de agenda
 */

class AddAgendaComment {
  #agendaRepository;

  constructor(agendaRepository) {
    this.#agendaRepository = agendaRepository;
  }

  async execute({ agendaTaskId, authorId, texto }) {
    if (!agendaTaskId) {
      throw new Error('ID da tarefa é obrigatório');
    }

    if (!texto || !texto.trim()) {
      throw new Error('Texto do comentário é obrigatório');
    }

    return this.#agendaRepository.saveComment({
      agendaTaskId,
      authorId,
      texto: texto.trim(),
    });
  }
}

export { AddAgendaComment };
