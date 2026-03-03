/**
 * Use Case: RejectContactChangeRequest
 * Equipe de dados rejeita a solicitação com justificativa obrigatória.
 */

class RejectContactChangeRequest {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ requestId, reviewerId, reviewerEmail, reviewerName, reason }) {
    if (!reason?.trim()) {
      throw new Error('Justificativa é obrigatória para rejeição');
    }

    const request = await this.#repository.findById(requestId);
    if (!request) {
      throw new Error('Solicitação não encontrada');
    }

    request.reject(reviewerId, reviewerEmail, reviewerName, reason);

    const updated = await this.#repository.update(request);
    return { request: updated.toResponse() };
  }
}

export { RejectContactChangeRequest };
