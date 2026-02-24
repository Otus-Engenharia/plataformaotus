/**
 * Entidade: BaselineRequest
 * Aggregate Root do domínio de Solicitações de Baseline
 *
 * Representa uma solicitação de criação de linha base feita por um coordenador,
 * que precisa ser aprovada ou rejeitada por um gerente (leader).
 */

import { RequestStatus } from '../value-objects/RequestStatus.js';

class BaselineRequest {
  #id;
  #projectCode;
  #projectName;
  #title;
  #description;
  #responseDeadline;
  #status;
  #requestedById;
  #requestedByEmail;
  #requestedByName;
  #reviewedById;
  #reviewedByEmail;
  #reviewedByName;
  #reviewedAt;
  #rejectionReason;
  #baselineId;
  #gmailDraftId;
  #createdAt;
  #updatedAt;

  constructor({
    id = null,
    projectCode,
    projectName = null,
    title,
    description = null,
    responseDeadline,
    status = 'pendente',
    requestedById,
    requestedByEmail,
    requestedByName = null,
    reviewedById = null,
    reviewedByEmail = null,
    reviewedByName = null,
    reviewedAt = null,
    rejectionReason = null,
    baselineId = null,
    gmailDraftId = null,
    createdAt = null,
    updatedAt = null,
  }) {
    if (!projectCode) {
      throw new Error('O código do projeto é obrigatório');
    }
    if (!title || title.trim().length === 0) {
      throw new Error('O título da solicitação é obrigatório');
    }
    if (!responseDeadline) {
      throw new Error('O prazo para resposta é obrigatório');
    }
    if (!requestedByEmail) {
      throw new Error('O email do solicitante é obrigatório');
    }

    this.#id = id;
    this.#projectCode = projectCode;
    this.#projectName = projectName || null;
    this.#title = title.trim();
    this.#description = description?.trim() || null;
    this.#responseDeadline = new Date(responseDeadline);
    this.#status = status instanceof RequestStatus ? status : new RequestStatus(status);
    this.#requestedById = requestedById || null;
    this.#requestedByEmail = requestedByEmail;
    this.#requestedByName = requestedByName || null;
    this.#reviewedById = reviewedById || null;
    this.#reviewedByEmail = reviewedByEmail || null;
    this.#reviewedByName = reviewedByName || null;
    this.#reviewedAt = reviewedAt ? new Date(reviewedAt) : null;
    this.#rejectionReason = rejectionReason || null;
    this.#baselineId = baselineId || null;
    this.#gmailDraftId = gmailDraftId || null;
    this.#createdAt = createdAt ? new Date(createdAt) : new Date();
    this.#updatedAt = updatedAt ? new Date(updatedAt) : new Date();
  }

  // Getters
  get id() { return this.#id; }
  get projectCode() { return this.#projectCode; }
  get projectName() { return this.#projectName; }
  get title() { return this.#title; }
  get description() { return this.#description; }
  get responseDeadline() { return this.#responseDeadline; }
  get status() { return this.#status; }
  get requestedById() { return this.#requestedById; }
  get requestedByEmail() { return this.#requestedByEmail; }
  get requestedByName() { return this.#requestedByName; }
  get reviewedById() { return this.#reviewedById; }
  get reviewedByEmail() { return this.#reviewedByEmail; }
  get reviewedByName() { return this.#reviewedByName; }
  get reviewedAt() { return this.#reviewedAt; }
  get rejectionReason() { return this.#rejectionReason; }
  get baselineId() { return this.#baselineId; }
  get gmailDraftId() { return this.#gmailDraftId; }
  get createdAt() { return this.#createdAt; }
  get updatedAt() { return this.#updatedAt; }

  get isPending() { return this.#status.isPendente; }
  get isApproved() { return this.#status.isAprovada; }
  get isRejected() { return this.#status.isRejeitada; }

  get isOverdue() {
    return this.#status.isPendente && new Date() > this.#responseDeadline;
  }

  // --- Comportamentos do domínio ---

  /**
   * Aprova a solicitação de baseline
   */
  approve(reviewerId, reviewerEmail, reviewerName, baselineId) {
    if (!this.#status.isPendente) {
      throw new Error('Apenas solicitações pendentes podem ser aprovadas');
    }
    if (!reviewerEmail) {
      throw new Error('O email do aprovador é obrigatório');
    }

    this.#status = RequestStatus.aprovada();
    this.#reviewedById = reviewerId || null;
    this.#reviewedByEmail = reviewerEmail;
    this.#reviewedByName = reviewerName || null;
    this.#reviewedAt = new Date();
    this.#baselineId = baselineId || null;
    this.#updatedAt = new Date();
  }

  /**
   * Rejeita a solicitação de baseline
   */
  reject(reviewerId, reviewerEmail, reviewerName, reason) {
    if (!this.#status.isPendente) {
      throw new Error('Apenas solicitações pendentes podem ser rejeitadas');
    }
    if (!reason || reason.trim().length === 0) {
      throw new Error('A justificativa da rejeição é obrigatória');
    }
    if (!reviewerEmail) {
      throw new Error('O email do revisor é obrigatório');
    }

    this.#status = RequestStatus.rejeitada();
    this.#reviewedById = reviewerId || null;
    this.#reviewedByEmail = reviewerEmail;
    this.#reviewedByName = reviewerName || null;
    this.#reviewedAt = new Date();
    this.#rejectionReason = reason.trim();
    this.#updatedAt = new Date();
  }

  /**
   * Registra o ID do Gmail draft criado
   */
  setGmailDraftId(draftId) {
    this.#gmailDraftId = draftId || null;
    this.#updatedAt = new Date();
  }

  /**
   * Converte para formato de persistência (Supabase)
   */
  toPersistence() {
    return {
      id: this.#id,
      project_code: this.#projectCode,
      project_name: this.#projectName,
      title: this.#title,
      description: this.#description,
      response_deadline: this.#responseDeadline.toISOString().split('T')[0],
      status: this.#status.value,
      requested_by_id: this.#requestedById,
      requested_by_email: this.#requestedByEmail,
      requested_by_name: this.#requestedByName,
      reviewed_by_id: this.#reviewedById,
      reviewed_by_email: this.#reviewedByEmail,
      reviewed_by_name: this.#reviewedByName,
      reviewed_at: this.#reviewedAt?.toISOString() || null,
      rejection_reason: this.#rejectionReason,
      baseline_id: this.#baselineId,
      gmail_draft_id: this.#gmailDraftId,
      created_at: this.#createdAt.toISOString(),
      updated_at: this.#updatedAt.toISOString(),
    };
  }

  /**
   * Converte para formato de resposta da API
   */
  toResponse() {
    return {
      id: this.#id,
      project_code: this.#projectCode,
      project_name: this.#projectName,
      title: this.#title,
      description: this.#description,
      response_deadline: this.#responseDeadline.toISOString().split('T')[0],
      status: this.#status.value,
      requested_by_id: this.#requestedById,
      requested_by_email: this.#requestedByEmail,
      requested_by_name: this.#requestedByName,
      reviewed_by_id: this.#reviewedById,
      reviewed_by_email: this.#reviewedByEmail,
      reviewed_by_name: this.#reviewedByName,
      reviewed_at: this.#reviewedAt?.toISOString() || null,
      rejection_reason: this.#rejectionReason,
      baseline_id: this.#baselineId,
      gmail_draft_id: this.#gmailDraftId,
      created_at: this.#createdAt.toISOString(),
      updated_at: this.#updatedAt.toISOString(),
      // Campos calculados
      is_pending: this.isPending,
      is_overdue: this.isOverdue,
    };
  }

  /**
   * Factory: cria entidade a partir de dados do banco
   */
  static fromPersistence(data) {
    return new BaselineRequest({
      id: data.id,
      projectCode: data.project_code,
      projectName: data.project_name,
      title: data.title,
      description: data.description,
      responseDeadline: data.response_deadline,
      status: data.status,
      requestedById: data.requested_by_id,
      requestedByEmail: data.requested_by_email,
      requestedByName: data.requested_by_name,
      reviewedById: data.reviewed_by_id,
      reviewedByEmail: data.reviewed_by_email,
      reviewedByName: data.reviewed_by_name,
      reviewedAt: data.reviewed_at,
      rejectionReason: data.rejection_reason,
      baselineId: data.baseline_id,
      gmailDraftId: data.gmail_draft_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  }

  /**
   * Factory: cria nova solicitação
   */
  static create({ projectCode, projectName, title, description, responseDeadline, requestedById, requestedByEmail, requestedByName }) {
    return new BaselineRequest({
      projectCode,
      projectName,
      title,
      description,
      responseDeadline,
      requestedById,
      requestedByEmail,
      requestedByName,
    });
  }
}

export { BaselineRequest };
