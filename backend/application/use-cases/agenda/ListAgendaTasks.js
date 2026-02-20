/**
 * Use Case: ListAgendaTasks
 * Retorna as tarefas agendadas de um usuário em um intervalo de datas
 */

class ListAgendaTasks {
  #agendaRepository;

  constructor(agendaRepository) {
    this.#agendaRepository = agendaRepository;
  }

  async execute({ userId, startDate, endDate }) {
    if (!userId) {
      throw new Error('O ID do usuário é obrigatório');
    }

    if (!startDate || !endDate) {
      throw new Error('O intervalo de datas (startDate, endDate) é obrigatório');
    }

    const tasks = await this.#agendaRepository.findByUserAndDateRange(userId, startDate, endDate);

    return tasks.map(task => task.toResponse());
  }
}

export { ListAgendaTasks };
