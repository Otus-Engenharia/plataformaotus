/**
 * Use Case: ImportNpsResponses
 * Importa múltiplas respostas NPS/CSAT/CES em batch
 */

import { NpsResponse } from '../../../domain/nps/entities/NpsResponse.js';

class ImportNpsResponses {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute(responses) {
    const entities = responses.map(r => new NpsResponse({
      projectCode: r.project_code,
      respondentEmail: r.respondent_email,
      respondentName: r.respondent_name || null,
      npsScore: r.nps_score ?? null,
      feedbackText: r.feedback_text || null,
      source: r.source || 'google_forms',
      csatScore: r.csat_score ?? null,
      cesScore: r.ces_score ?? null,
      clientCompany: r.client_company || null,
      projectName: r.project_name || null,
      interviewedPerson: r.interviewed_person || null,
      decisionLevel: r.decision_level || null,
      createdAt: r.created_at || null,
      updatedAt: r.updated_at || r.created_at || null,
    }));

    return this.#repository.saveBatch(entities);
  }
}

export { ImportNpsResponses };
