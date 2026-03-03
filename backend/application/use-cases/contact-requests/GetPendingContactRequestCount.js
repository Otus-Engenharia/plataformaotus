/**
 * Use Case: GetPendingContactRequestCount
 * Retorna a contagem de solicitações pendentes (para badge de notificação).
 */

class GetPendingContactRequestCount {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute() {
    return await this.#repository.countPending();
  }
}

export { GetPendingContactRequestCount };
