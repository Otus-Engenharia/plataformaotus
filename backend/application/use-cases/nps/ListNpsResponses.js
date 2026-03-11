/**
 * Use Case: ListNpsResponses
 * Lista respostas NPS com filtros opcionais
 */

class ListNpsResponses {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ projectCode, projectCodes, source, limit } = {}) {
    const responses = await this.#repository.findAll({ projectCode, projectCodes, source, limit });
    return responses.map(r => r.toResponse());
  }
}

export { ListNpsResponses };
