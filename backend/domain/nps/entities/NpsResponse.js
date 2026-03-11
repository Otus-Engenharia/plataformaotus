/**
 * Entidade: NpsResponse
 * Aggregate Root do domínio de NPS
 *
 * Representa uma resposta de pesquisa de fechamento de fase (NPS + CSAT + CES).
 */

import { NpsScore } from '../value-objects/NpsScore.js';
import { NpsSource } from '../value-objects/NpsSource.js';
import { SatisfactionScore } from '../value-objects/SatisfactionScore.js';
import { DecisionLevel } from '../value-objects/DecisionLevel.js';

class NpsResponse {
  #id;
  #projectCode;
  #respondentEmail;
  #respondentName;
  #npsScore;
  #feedbackText;
  #source;
  #csatScore;
  #cesScore;
  #clientCompany;
  #projectName;
  #interviewedPerson;
  #decisionLevel;
  #createdAt;
  #updatedAt;

  constructor({
    id = null,
    projectCode,
    respondentEmail,
    respondentName = null,
    npsScore = null,
    feedbackText,
    source = 'plataforma',
    csatScore = null,
    cesScore = null,
    clientCompany = null,
    projectName = null,
    interviewedPerson = null,
    decisionLevel = null,
    createdAt = null,
    updatedAt = null,
  }) {
    if (!projectCode || String(projectCode).trim().length === 0) {
      throw new Error('O código do projeto é obrigatório');
    }

    if (!respondentEmail || String(respondentEmail).trim().length === 0) {
      throw new Error('O email do respondente é obrigatório');
    }

    this.#id = id;
    this.#projectCode = String(projectCode).trim();
    this.#respondentEmail = String(respondentEmail).trim();
    this.#respondentName = respondentName?.trim() || null;
    this.#npsScore = npsScore != null
      ? (npsScore instanceof NpsScore ? npsScore : new NpsScore(npsScore))
      : null;
    this.#feedbackText = feedbackText ? String(feedbackText).trim() : null;
    this.#source = source instanceof NpsSource ? source : new NpsSource(source);
    this.#csatScore = csatScore != null
      ? (csatScore instanceof SatisfactionScore ? csatScore : SatisfactionScore.csat(csatScore))
      : null;
    this.#cesScore = cesScore != null
      ? (cesScore instanceof SatisfactionScore ? cesScore : SatisfactionScore.ces(cesScore))
      : null;
    this.#clientCompany = clientCompany?.trim() || null;
    this.#projectName = projectName?.trim() || null;
    this.#interviewedPerson = interviewedPerson?.trim() || null;
    this.#decisionLevel = decisionLevel != null
      ? (decisionLevel instanceof DecisionLevel ? decisionLevel : new DecisionLevel(decisionLevel))
      : null;
    this.#createdAt = createdAt ? new Date(createdAt) : new Date();
    this.#updatedAt = updatedAt ? new Date(updatedAt) : new Date();
  }

  // Getters
  get id() { return this.#id; }
  get projectCode() { return this.#projectCode; }
  get respondentEmail() { return this.#respondentEmail; }
  get respondentName() { return this.#respondentName; }
  get npsScore() { return this.#npsScore; }
  get feedbackText() { return this.#feedbackText; }
  get source() { return this.#source; }
  get csatScore() { return this.#csatScore; }
  get cesScore() { return this.#cesScore; }
  get clientCompany() { return this.#clientCompany; }
  get projectName() { return this.#projectName; }
  get interviewedPerson() { return this.#interviewedPerson; }
  get decisionLevel() { return this.#decisionLevel; }
  get createdAt() { return this.#createdAt; }
  get updatedAt() { return this.#updatedAt; }

  get npsCategory() {
    return this.#npsScore?.category || null;
  }

  get npsCategoryLabel() {
    return this.#npsScore?.label || null;
  }

  toPersistence() {
    return {
      id: this.#id,
      project_code: this.#projectCode,
      respondent_email: this.#respondentEmail,
      respondent_name: this.#respondentName,
      nps_score: this.#npsScore?.value ?? null,
      feedback_text: this.#feedbackText,
      source: this.#source.value,
      csat_score: this.#csatScore?.value ?? null,
      ces_score: this.#cesScore?.value ?? null,
      client_company: this.#clientCompany,
      project_name: this.#projectName,
      interviewed_person: this.#interviewedPerson,
      decision_level: this.#decisionLevel?.value ?? null,
      created_at: this.#createdAt.toISOString(),
      updated_at: this.#updatedAt.toISOString(),
    };
  }

  toResponse() {
    return {
      id: this.#id,
      project_code: this.#projectCode,
      respondent_email: this.#respondentEmail,
      respondent_name: this.#respondentName,
      nps_score: this.#npsScore?.value ?? null,
      nps_category: this.#npsScore?.category ?? null,
      nps_category_label: this.#npsScore?.label ?? null,
      feedback_text: this.#feedbackText,
      source: this.#source.value,
      source_label: this.#source.label,
      csat_score: this.#csatScore?.value ?? null,
      csat_category: this.#csatScore?.category ?? null,
      csat_label: this.#csatScore?.label ?? null,
      ces_score: this.#cesScore?.value ?? null,
      ces_category: this.#cesScore?.category ?? null,
      ces_label: this.#cesScore?.label ?? null,
      client_company: this.#clientCompany,
      project_name: this.#projectName,
      interviewed_person: this.#interviewedPerson,
      decision_level: this.#decisionLevel?.value ?? null,
      decision_level_label: this.#decisionLevel?.label ?? null,
      created_at: this.#createdAt.toISOString(),
      updated_at: this.#updatedAt.toISOString(),
    };
  }

  static fromPersistence(data) {
    return new NpsResponse({
      id: data.id,
      projectCode: data.project_code,
      respondentEmail: data.respondent_email,
      respondentName: data.respondent_name,
      npsScore: data.nps_score,
      feedbackText: data.feedback_text,
      source: data.source,
      csatScore: data.csat_score,
      cesScore: data.ces_score,
      clientCompany: data.client_company,
      projectName: data.project_name,
      interviewedPerson: data.interviewed_person,
      decisionLevel: data.decision_level,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  }

  static create({
    projectCode, respondentEmail, respondentName, npsScore, feedbackText,
    source = 'plataforma', csatScore, cesScore, clientCompany, projectName,
    interviewedPerson, decisionLevel,
  }) {
    return new NpsResponse({
      projectCode, respondentEmail, respondentName, npsScore, feedbackText,
      source, csatScore, cesScore, clientCompany, projectName,
      interviewedPerson, decisionLevel,
    });
  }
}

export { NpsResponse };
