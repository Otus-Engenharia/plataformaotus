/**
 * Entidade: AutodocDocument
 * Aggregate Root - Representa um documento entregue via Autodoc.
 */

import { DocumentClassification } from '../value-objects/DocumentClassification.js';

class AutodocDocument {
  #id;
  #autodocDocId;
  #autodocCustomerId;
  #projectCode;
  #documentName;
  #documentCode;
  #revision;
  #phaseName;
  #disciplineName;
  #formatFolder;
  #fileUrl;
  #rawSize;
  #status;
  #autodocStatusName;
  #author;
  #classification;
  #previousRevision;
  #previousPhase;
  #autodocCreatedAt;
  #syncedAt;

  constructor({
    id = null,
    autodocDocId,
    autodocCustomerId,
    projectCode,
    documentName,
    documentCode = null,
    revision = null,
    phaseName = null,
    disciplineName = null,
    formatFolder = null,
    fileUrl = null,
    rawSize = null,
    status = null,
    autodocStatusName = null,
    author = null,
    classification = null,
    previousRevision = null,
    previousPhase = null,
    autodocCreatedAt,
    syncedAt = null,
  }) {
    if (!autodocDocId) throw new Error('autodocDocId e obrigatorio');
    if (!autodocCustomerId) throw new Error('autodocCustomerId e obrigatorio');
    if (!projectCode) throw new Error('projectCode e obrigatorio');
    if (!documentName) throw new Error('documentName e obrigatorio');
    if (!autodocCreatedAt) throw new Error('autodocCreatedAt e obrigatorio');

    this.#id = id;
    this.#autodocDocId = autodocDocId;
    this.#autodocCustomerId = autodocCustomerId;
    this.#projectCode = projectCode;
    this.#documentName = documentName;
    this.#documentCode = documentCode;
    this.#revision = revision;
    this.#phaseName = phaseName;
    this.#disciplineName = disciplineName;
    this.#formatFolder = formatFolder;
    this.#fileUrl = fileUrl;
    this.#rawSize = rawSize ? Number(rawSize) : null;
    this.#status = status;
    this.#autodocStatusName = autodocStatusName;
    this.#author = author;
    this.#classification = classification ? new DocumentClassification(classification) : null;
    this.#previousRevision = previousRevision;
    this.#previousPhase = previousPhase;
    this.#autodocCreatedAt = new Date(autodocCreatedAt);
    this.#syncedAt = syncedAt ? new Date(syncedAt) : new Date();
  }

  // Getters
  get id() { return this.#id; }
  get autodocDocId() { return this.#autodocDocId; }
  get autodocCustomerId() { return this.#autodocCustomerId; }
  get projectCode() { return this.#projectCode; }
  get documentName() { return this.#documentName; }
  get documentCode() { return this.#documentCode; }
  get revision() { return this.#revision; }
  get phaseName() { return this.#phaseName; }
  get disciplineName() { return this.#disciplineName; }
  get formatFolder() { return this.#formatFolder; }
  get fileUrl() { return this.#fileUrl; }
  get rawSize() { return this.#rawSize; }
  get status() { return this.#status; }
  get autodocStatusName() { return this.#autodocStatusName; }
  get author() { return this.#author; }
  get classification() { return this.#classification?.value || null; }
  get classificationLabel() { return this.#classification?.label || null; }
  get classificationColor() { return this.#classification?.color || null; }
  get previousRevision() { return this.#previousRevision; }
  get previousPhase() { return this.#previousPhase; }
  get autodocCreatedAt() { return this.#autodocCreatedAt; }
  get syncedAt() { return this.#syncedAt; }

  classify(classification) {
    this.#classification = new DocumentClassification(classification);
  }

  setPreviousRevision(rev) { this.#previousRevision = rev; }
  setPreviousPhase(phase) { this.#previousPhase = phase; }

  toPersistence() {
    return {
      id: this.#id,
      autodoc_doc_id: this.#autodocDocId,
      autodoc_customer_id: this.#autodocCustomerId,
      project_code: this.#projectCode,
      document_name: this.#documentName,
      document_code: this.#documentCode,
      revision: this.#revision,
      phase_name: this.#phaseName,
      discipline_name: this.#disciplineName,
      format_folder: this.#formatFolder,
      file_url: this.#fileUrl,
      raw_size: this.#rawSize,
      status: this.#status,
      autodoc_status_name: this.#autodocStatusName,
      author: this.#author,
      classification: this.#classification?.value || null,
      previous_revision: this.#previousRevision,
      previous_phase: this.#previousPhase,
      autodoc_created_at: this.#autodocCreatedAt.toISOString(),
      synced_at: this.#syncedAt.toISOString(),
    };
  }

  toResponse() {
    return {
      id: this.#id,
      autodoc_doc_id: this.#autodocDocId,
      project_code: this.#projectCode,
      document_name: this.#documentName,
      document_code: this.#documentCode,
      revision: this.#revision,
      phase_name: this.#phaseName,
      discipline_name: this.#disciplineName,
      format_folder: this.#formatFolder,
      file_url: this.#fileUrl,
      raw_size: this.#rawSize,
      status: this.#status,
      autodoc_status_name: this.#autodocStatusName,
      author: this.#author,
      classification: this.#classification?.value || null,
      classification_label: this.#classification?.label || null,
      classification_color: this.#classification?.color || null,
      previous_revision: this.#previousRevision,
      previous_phase: this.#previousPhase,
      autodoc_created_at: this.#autodocCreatedAt.toISOString(),
      synced_at: this.#syncedAt.toISOString(),
    };
  }

  static fromPersistence(data) {
    return new AutodocDocument({
      id: data.id,
      autodocDocId: data.autodoc_doc_id,
      autodocCustomerId: data.autodoc_customer_id,
      projectCode: data.project_code,
      documentName: data.document_name,
      documentCode: data.document_code,
      revision: data.revision,
      phaseName: data.phase_name,
      disciplineName: data.discipline_name,
      formatFolder: data.format_folder,
      fileUrl: data.file_url,
      rawSize: data.raw_size,
      status: data.status,
      autodocStatusName: data.autodoc_status_name,
      author: data.author,
      classification: data.classification,
      previousRevision: data.previous_revision,
      previousPhase: data.previous_phase,
      autodocCreatedAt: data.autodoc_created_at,
      syncedAt: data.synced_at,
    });
  }

  static create({ autodocDocId, autodocCustomerId, projectCode, documentName, documentCode, revision, phaseName, disciplineName, formatFolder, fileUrl, rawSize, status, autodocStatusName, author, autodocCreatedAt }) {
    return new AutodocDocument({
      autodocDocId, autodocCustomerId, projectCode, documentName, documentCode, revision,
      phaseName, disciplineName, formatFolder, fileUrl, rawSize, status, autodocStatusName,
      author, autodocCreatedAt,
    });
  }
}

export { AutodocDocument };
