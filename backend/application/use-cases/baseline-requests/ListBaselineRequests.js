/**
 * Use Case: ListBaselineRequests
 * Lista solicitações de baseline (por projeto ou pendentes).
 */

class ListBaselineRequests {
  #requestRepository;

  constructor(requestRepository) {
    this.#requestRepository = requestRepository;
  }

  async execute({ projectCode, pendingOnly }) {
    let requests;

    if (pendingOnly) {
      requests = await this.#requestRepository.findPending();
    } else if (projectCode) {
      requests = await this.#requestRepository.findByProjectCode(projectCode);
    } else {
      throw new Error('Informe project_code ou pendingOnly');
    }

    return requests.map(r => r.toResponse());
  }
}

export { ListBaselineRequests };
