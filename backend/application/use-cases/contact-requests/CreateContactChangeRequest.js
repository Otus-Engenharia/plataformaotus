/**
 * Use Case: CreateContactChangeRequest
 * Equipe de operação cria uma solicitação de alteração de contato/empresa.
 */

import { ContactChangeRequest } from '../../../domain/contact-requests/entities/ContactChangeRequest.js';

class CreateContactChangeRequest {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({ requestType, payload, targetContactId, targetCompanyId, projectCode, requestedById, requestedByEmail, requestedByName }) {
    if (!requestType) {
      throw new Error('Tipo de solicitação é obrigatório');
    }
    if (!payload || Object.keys(payload).length === 0) {
      throw new Error('Dados da solicitação são obrigatórios');
    }

    const request = ContactChangeRequest.create({
      requestType,
      payload,
      targetContactId,
      targetCompanyId,
      projectCode,
      requestedById,
      requestedByEmail,
      requestedByName,
    });

    const saved = await this.#repository.save(request);
    return saved.toResponse();
  }
}

export { CreateContactChangeRequest };
