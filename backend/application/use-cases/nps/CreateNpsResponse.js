/**
 * Use Case: CreateNpsResponse
 * Cria uma nova resposta NPS/CSAT/CES
 */

import { NpsResponse } from '../../../domain/nps/entities/NpsResponse.js';

class CreateNpsResponse {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute({
    project_code, nps_score, feedback_text, respondentEmail, respondentName,
    source = 'plataforma', csat_score, ces_score, client_company, project_name,
    interviewed_person, decision_level,
  }) {
    const entity = NpsResponse.create({
      projectCode: project_code,
      respondentEmail,
      respondentName,
      npsScore: nps_score ?? null,
      feedbackText: feedback_text,
      source,
      csatScore: csat_score ?? null,
      cesScore: ces_score ?? null,
      clientCompany: client_company || null,
      projectName: project_name || null,
      interviewedPerson: interviewed_person || null,
      decisionLevel: decision_level || null,
    });

    const saved = await this.#repository.save(entity);
    return saved.toResponse();
  }
}

export { CreateNpsResponse };
