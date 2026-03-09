/**
 * Entidade: IfcChangeLog
 * Aggregate Root - Representa um evento de mudança detectado em uma pasta IFC.
 */

import { ChangeCategory } from '../value-objects/ChangeCategory.js';

class IfcChangeLog {
  #id;
  #projectCode;
  #driveFolderId;
  #category;
  #fileName;
  #driveFileId;
  #parsedBaseName;
  #previousRevision;
  #newRevision;
  #previousPhase;
  #newPhase;
  #fileSize;
  #driveModifiedTime;
  #scannedBy;
  #details;
  #createdAt;

  constructor({
    id = null,
    projectCode,
    driveFolderId,
    category,
    fileName,
    driveFileId,
    parsedBaseName = null,
    previousRevision = null,
    newRevision = null,
    previousPhase = null,
    newPhase = null,
    fileSize = null,
    driveModifiedTime = null,
    scannedBy = null,
    details = null,
    createdAt = null,
  }) {
    if (!projectCode) throw new Error('projectCode é obrigatório');
    if (!driveFolderId) throw new Error('driveFolderId é obrigatório');
    if (!fileName) throw new Error('fileName é obrigatório');
    if (!driveFileId) throw new Error('driveFileId é obrigatório');

    this.#id = id;
    this.#projectCode = projectCode;
    this.#driveFolderId = driveFolderId;
    this.#category = new ChangeCategory(category);
    this.#fileName = fileName;
    this.#driveFileId = driveFileId;
    this.#parsedBaseName = parsedBaseName;
    this.#previousRevision = previousRevision;
    this.#newRevision = newRevision;
    this.#previousPhase = previousPhase;
    this.#newPhase = newPhase;
    this.#fileSize = fileSize ? Number(fileSize) : null;
    this.#driveModifiedTime = driveModifiedTime ? new Date(driveModifiedTime) : null;
    this.#scannedBy = scannedBy;
    this.#details = details;
    this.#createdAt = createdAt ? new Date(createdAt) : new Date();
  }

  // Getters
  get id() { return this.#id; }
  get projectCode() { return this.#projectCode; }
  get driveFolderId() { return this.#driveFolderId; }
  get category() { return this.#category.value; }
  get categoryLabel() { return this.#category.label; }
  get categoryColor() { return this.#category.color; }
  get fileName() { return this.#fileName; }
  get driveFileId() { return this.#driveFileId; }
  get parsedBaseName() { return this.#parsedBaseName; }
  get previousRevision() { return this.#previousRevision; }
  get newRevision() { return this.#newRevision; }
  get previousPhase() { return this.#previousPhase; }
  get newPhase() { return this.#newPhase; }
  get fileSize() { return this.#fileSize; }
  get driveModifiedTime() { return this.#driveModifiedTime; }
  get scannedBy() { return this.#scannedBy; }
  get details() { return this.#details; }
  get createdAt() { return this.#createdAt; }

  toPersistence() {
    return {
      id: this.#id,
      project_code: this.#projectCode,
      drive_folder_id: this.#driveFolderId,
      category: this.#category.value,
      file_name: this.#fileName,
      drive_file_id: this.#driveFileId,
      parsed_base_name: this.#parsedBaseName,
      previous_revision: this.#previousRevision,
      new_revision: this.#newRevision,
      previous_phase: this.#previousPhase,
      new_phase: this.#newPhase,
      file_size: this.#fileSize,
      drive_modified_time: this.#driveModifiedTime?.toISOString() || null,
      scanned_by: this.#scannedBy,
      details: this.#details,
      created_at: this.#createdAt.toISOString(),
    };
  }

  toResponse() {
    return {
      id: this.#id,
      project_code: this.#projectCode,
      category: this.#category.value,
      category_label: this.#category.label,
      category_color: this.#category.color,
      file_name: this.#fileName,
      parsed_base_name: this.#parsedBaseName,
      previous_revision: this.#previousRevision,
      new_revision: this.#newRevision,
      previous_phase: this.#previousPhase,
      new_phase: this.#newPhase,
      file_size: this.#fileSize,
      drive_modified_time: this.#driveModifiedTime?.toISOString() || null,
      scanned_by: this.#scannedBy,
      details: this.#details,
      created_at: this.#createdAt.toISOString(),
    };
  }

  static fromPersistence(data) {
    return new IfcChangeLog({
      id: data.id,
      projectCode: data.project_code,
      driveFolderId: data.drive_folder_id,
      category: data.category,
      fileName: data.file_name,
      driveFileId: data.drive_file_id,
      parsedBaseName: data.parsed_base_name,
      previousRevision: data.previous_revision,
      newRevision: data.new_revision,
      previousPhase: data.previous_phase,
      newPhase: data.new_phase,
      fileSize: data.file_size,
      driveModifiedTime: data.drive_modified_time,
      scannedBy: data.scanned_by,
      details: data.details,
      createdAt: data.created_at,
    });
  }

  static createNovoArquivo({ projectCode, driveFolderId, fileName, driveFileId, parsedBaseName, fileSize, driveModifiedTime, scannedBy }) {
    return new IfcChangeLog({
      projectCode, driveFolderId, category: 'novo_arquivo',
      fileName, driveFileId, parsedBaseName, fileSize, driveModifiedTime, scannedBy,
    });
  }

  static createNovaRevisao({ projectCode, driveFolderId, fileName, driveFileId, parsedBaseName, previousRevision, newRevision, fileSize, driveModifiedTime, scannedBy }) {
    return new IfcChangeLog({
      projectCode, driveFolderId, category: 'nova_revisao',
      fileName, driveFileId, parsedBaseName,
      previousRevision, newRevision,
      fileSize, driveModifiedTime, scannedBy,
    });
  }

  static createMudancaFase({ projectCode, driveFolderId, fileName, driveFileId, parsedBaseName, previousPhase, newPhase, fileSize, driveModifiedTime, scannedBy }) {
    return new IfcChangeLog({
      projectCode, driveFolderId, category: 'mudanca_fase',
      fileName, driveFileId, parsedBaseName,
      previousPhase, newPhase,
      fileSize, driveModifiedTime, scannedBy,
    });
  }
}

export { IfcChangeLog };
