/**
 * Entidade: ContactChangeRequest
 * Aggregate Root do domínio de Solicitações de Alteração de Contato
 *
 * Representa uma solicitação de criação/edição de contato ou empresa,
 * feita pela equipe de operação e aprovada/rejeitada pela equipe de dados.
 */

import { RequestStatus } from '../value-objects/RequestStatus.js';
import { ContactRequestType } from '../value-objects/ContactRequestType.js';

class ContactChangeRequest {
  #id;
  #requestType;
  #status;
  #payload;
  #targetContactId;
  #targetCompanyId;
  #projectCode;
  #requestedById;
  #requestedByEmail;
  #requestedByName;
  #reviewedById;
  #reviewedByEmail;
  #reviewedByName;
  #reviewedAt;
  #rejectionReason;
  #resultContactId;
  #resultCompanyId;
  #createdAt;
  #updatedAt;

  constructor({
    id = null,
    requestType,
    status = 'pendente',
    payload,
    targetContactId = null,
    targetCompanyId = null,
    projectCode = null,
    requestedById = null,
    requestedByEmail,
    requestedByName = null,
    reviewedById = null,
    reviewedByEmail = null,
    reviewedByName = null,
    reviewedAt = null,
    rejectionReason = null,
    resultContactId = null,
    resultCompanyId = null,
    createdAt = null,
    updatedAt = null,
  }) {
    if (!requestedByEmail) {
      throw new Error('O email do solicitante é obrigatório');
    }
    if (!requestType) {
      throw new Error('O tipo de solicitação é obrigatório');
    }
    if (!payload || Object.keys(payload).length === 0) {
      throw new Error('Os dados da solicitação são obrigatórios');
    }

    this.#id = id;
    this.#requestType = requestType instanceof ContactRequestType ? requestType : new ContactRequestType(requestType);
    this.#status = status instanceof RequestStatus ? status : new RequestStatus(status);
    this.#payload = typeof payload === 'string' ? JSON.parse(payload) : { ...payload };
    this.#targetContactId = targetContactId || null;
    this.#targetCompanyId = targetCompanyId || null;
    this.#projectCode = projectCode || null;
    this.#requestedById = requestedById || null;
    this.#requestedByEmail = requestedByEmail;
    this.#requestedByName = requestedByName || null;
    this.#reviewedById = reviewedById || null;
    this.#reviewedByEmail = reviewedByEmail || null;
    this.#reviewedByName = reviewedByName || null;
    this.#reviewedAt = reviewedAt ? new Date(reviewedAt) : null;
    this.#rejectionReason = rejectionReason || null;
    this.#resultContactId = resultContactId || null;
    this.#resultCompanyId = resultCompanyId || null;
    this.#createdAt = createdAt ? new Date(createdAt) : new Date();
    this.#updatedAt = updatedAt ? new Date(updatedAt) : new Date();

    // Validações por tipo
    if (this.#requestType.isEditarContato && !this.#targetContactId) {
      throw new Error('O contato alvo é obrigatório para edição');
    }
    if (this.#requestType.isNovoContato && !this.#payload.name) {
      throw new Error('O nome do contato é obrigatório');
    }
    if (this.#requestType.isNovaEmpresa && !this.#payload.name) {
      throw new Error('O nome da empresa é obrigatório');
    }
  }

  // Getters
  get id() { return this.#id; }
  get requestType() { return this.#requestType; }
  get status() { return this.#status; }
  get payload() { return { ...this.#payload }; }
  get targetContactId() { return this.#targetContactId; }
  get targetCompanyId() { return this.#targetCompanyId; }
  get projectCode() { return this.#projectCode; }
  get requestedById() { return this.#requestedById; }
  get requestedByEmail() { return this.#requestedByEmail; }
  get requestedByName() { return this.#requestedByName; }
  get reviewedById() { return this.#reviewedById; }
  get reviewedByEmail() { return this.#reviewedByEmail; }
  get reviewedByName() { return this.#reviewedByName; }
  get reviewedAt() { return this.#reviewedAt; }
  get rejectionReason() { return this.#rejectionReason; }
  get resultContactId() { return this.#resultContactId; }
  get resultCompanyId() { return this.#resultCompanyId; }
  get createdAt() { return this.#createdAt; }
  get updatedAt() { return this.#updatedAt; }

  get isPending() { return this.#status.isPendente; }
  get isApproved() { return this.#status.isAprovada; }
  get isRejected() { return this.#status.isRejeitada; }

  // --- Comportamentos do domínio ---

  approve(reviewerId, reviewerEmail, reviewerName, resultContactId = null, resultCompanyId = null) {
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
    this.#resultContactId = resultContactId || null;
    this.#resultCompanyId = resultCompanyId || null;
    this.#updatedAt = new Date();
  }

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

  toPersistence() {
    return {
      id: this.#id,
      request_type: this.#requestType.value,
      status: this.#status.value,
      payload: this.#payload,
      target_contact_id: this.#targetContactId,
      target_company_id: this.#targetCompanyId,
      project_code: this.#projectCode,
      requested_by_id: this.#requestedById,
      requested_by_email: this.#requestedByEmail,
      requested_by_name: this.#requestedByName,
      reviewed_by_id: this.#reviewedById,
      reviewed_by_email: this.#reviewedByEmail,
      reviewed_by_name: this.#reviewedByName,
      reviewed_at: this.#reviewedAt?.toISOString() || null,
      rejection_reason: this.#rejectionReason,
      result_contact_id: this.#resultContactId,
      result_company_id: this.#resultCompanyId,
      created_at: this.#createdAt.toISOString(),
      updated_at: this.#updatedAt.toISOString(),
    };
  }

  toResponse() {
    return {
      id: this.#id,
      request_type: this.#requestType.value,
      request_type_label: this.#requestType.label,
      status: this.#status.value,
      payload: this.#payload,
      target_contact_id: this.#targetContactId,
      target_company_id: this.#targetCompanyId,
      project_code: this.#projectCode,
      requested_by_id: this.#requestedById,
      requested_by_email: this.#requestedByEmail,
      requested_by_name: this.#requestedByName,
      reviewed_by_id: this.#reviewedById,
      reviewed_by_email: this.#reviewedByEmail,
      reviewed_by_name: this.#reviewedByName,
      reviewed_at: this.#reviewedAt?.toISOString() || null,
      rejection_reason: this.#rejectionReason,
      result_contact_id: this.#resultContactId,
      result_company_id: this.#resultCompanyId,
      created_at: this.#createdAt.toISOString(),
      updated_at: this.#updatedAt.toISOString(),
      is_pending: this.isPending,
    };
  }

  static fromPersistence(data) {
    return new ContactChangeRequest({
      id: data.id,
      requestType: data.request_type,
      status: data.status,
      payload: data.payload,
      targetContactId: data.target_contact_id,
      targetCompanyId: data.target_company_id,
      projectCode: data.project_code,
      requestedById: data.requested_by_id,
      requestedByEmail: data.requested_by_email,
      requestedByName: data.requested_by_name,
      reviewedById: data.reviewed_by_id,
      reviewedByEmail: data.reviewed_by_email,
      reviewedByName: data.reviewed_by_name,
      reviewedAt: data.reviewed_at,
      rejectionReason: data.rejection_reason,
      resultContactId: data.result_contact_id,
      resultCompanyId: data.result_company_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  }

  static create({ requestType, payload, targetContactId, targetCompanyId, projectCode, requestedById, requestedByEmail, requestedByName }) {
    return new ContactChangeRequest({
      requestType,
      payload,
      targetContactId,
      targetCompanyId,
      projectCode,
      requestedById,
      requestedByEmail,
      requestedByName,
    });
  }
}

export { ContactChangeRequest };
