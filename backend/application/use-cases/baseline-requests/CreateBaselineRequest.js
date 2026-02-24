/**
 * Use Case: CreateBaselineRequest
 * Coordenador cria uma solicitação de nova baseline para aprovação do gerente.
 */

import { BaselineRequest } from '../../../domain/baseline-requests/entities/BaselineRequest.js';

class CreateBaselineRequest {
  #requestRepository;

  constructor(requestRepository) {
    this.#requestRepository = requestRepository;
  }

  async execute({ projectCode, projectName, title, description, responseDeadline, requestedById, requestedByEmail, requestedByName }) {
    if (!projectCode) {
      throw new Error('Código do projeto é obrigatório');
    }
    if (!title) {
      throw new Error('Título da solicitação é obrigatório');
    }
    if (!responseDeadline) {
      throw new Error('Prazo para resposta é obrigatório');
    }

    const request = BaselineRequest.create({
      projectCode,
      projectName,
      title,
      description,
      responseDeadline,
      requestedById,
      requestedByEmail,
      requestedByName,
    });

    const saved = await this.#requestRepository.save(request);
    return saved.toResponse();
  }
}

export { CreateBaselineRequest };
