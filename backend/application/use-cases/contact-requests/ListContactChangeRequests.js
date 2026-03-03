/**
 * Use Case: ListContactChangeRequests
 * Lista solicitações de alteração de contato (por status, projeto ou solicitante).
 */

class ListContactChangeRequests {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ pendingOnly, requesterEmail, projectCode, status, requestType }) {
    let requests;

    if (pendingOnly) {
      requests = await this.#repository.findPending();
    } else if (requesterEmail) {
      requests = await this.#repository.findByRequester(requesterEmail);
    } else if (projectCode) {
      requests = await this.#repository.findByProjectCode(projectCode);
    } else {
      requests = await this.#repository.findAll({ status, requestType });
    }

    return requests.map(r => r.toResponse());
  }
}

export { ListContactChangeRequests };
