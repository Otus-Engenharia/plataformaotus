/**
 * Entidade: IfcFileSnapshot
 * Representa o estado atual de um arquivo em uma pasta IFC do Google Drive.
 * Usado para comparação em scans subsequentes.
 */

import { IfcFileName } from '../value-objects/IfcFileName.js';

class IfcFileSnapshot {
  #id;
  #projectCode;
  #driveFolderId;
  #driveFileId;
  #fileName;
  #fileSize;
  #mimeType;
  #md5Checksum;
  #driveCreatedTime;
  #driveModifiedTime;
  #parsedBaseName;
  #parsedPhase;
  #parsedRevision;
  #parsedDiscipline;
  #firstSeenAt;
  #lastSeenAt;
  #isDeleted;

  constructor({
    id = null,
    projectCode,
    driveFolderId,
    driveFileId,
    fileName,
    fileSize = null,
    mimeType = null,
    md5Checksum = null,
    driveCreatedTime = null,
    driveModifiedTime = null,
    parsedBaseName = null,
    parsedPhase = null,
    parsedRevision = null,
    parsedDiscipline = null,
    firstSeenAt = null,
    lastSeenAt = null,
    isDeleted = false,
  }) {
    if (!projectCode) throw new Error('projectCode é obrigatório');
    if (!driveFolderId) throw new Error('driveFolderId é obrigatório');
    if (!driveFileId) throw new Error('driveFileId é obrigatório');
    if (!fileName) throw new Error('fileName é obrigatório');

    this.#id = id;
    this.#projectCode = projectCode;
    this.#driveFolderId = driveFolderId;
    this.#driveFileId = driveFileId;
    this.#fileName = fileName;
    this.#fileSize = fileSize ? Number(fileSize) : null;
    this.#mimeType = mimeType;
    this.#md5Checksum = md5Checksum;
    this.#driveCreatedTime = driveCreatedTime ? new Date(driveCreatedTime) : null;
    this.#driveModifiedTime = driveModifiedTime ? new Date(driveModifiedTime) : null;
    this.#firstSeenAt = firstSeenAt ? new Date(firstSeenAt) : new Date();
    this.#lastSeenAt = lastSeenAt ? new Date(lastSeenAt) : new Date();
    this.#isDeleted = Boolean(isDeleted);

    // Parse ou usa cache
    if (parsedBaseName) {
      this.#parsedBaseName = parsedBaseName;
      this.#parsedPhase = parsedPhase;
      this.#parsedRevision = parsedRevision;
      this.#parsedDiscipline = parsedDiscipline;
    } else {
      const parsed = IfcFileName.parse(fileName);
      this.#parsedBaseName = parsed.baseName;
      this.#parsedPhase = parsed.phase;
      this.#parsedRevision = parsed.revision;
      this.#parsedDiscipline = parsed.discipline;
    }
  }

  // Getters
  get id() { return this.#id; }
  get projectCode() { return this.#projectCode; }
  get driveFolderId() { return this.#driveFolderId; }
  get driveFileId() { return this.#driveFileId; }
  get fileName() { return this.#fileName; }
  get fileSize() { return this.#fileSize; }
  get mimeType() { return this.#mimeType; }
  get md5Checksum() { return this.#md5Checksum; }
  get driveCreatedTime() { return this.#driveCreatedTime; }
  get driveModifiedTime() { return this.#driveModifiedTime; }
  get parsedBaseName() { return this.#parsedBaseName; }
  get parsedPhase() { return this.#parsedPhase; }
  get parsedRevision() { return this.#parsedRevision; }
  get parsedDiscipline() { return this.#parsedDiscipline; }
  get firstSeenAt() { return this.#firstSeenAt; }
  get lastSeenAt() { return this.#lastSeenAt; }
  get isDeleted() { return this.#isDeleted; }

  markSeen() {
    this.#lastSeenAt = new Date();
  }

  markDeleted() {
    this.#isDeleted = true;
  }

  toPersistence() {
    return {
      id: this.#id,
      project_code: this.#projectCode,
      drive_folder_id: this.#driveFolderId,
      drive_file_id: this.#driveFileId,
      file_name: this.#fileName,
      file_size: this.#fileSize,
      mime_type: this.#mimeType,
      md5_checksum: this.#md5Checksum,
      drive_created_time: this.#driveCreatedTime?.toISOString() || null,
      drive_modified_time: this.#driveModifiedTime?.toISOString() || null,
      parsed_base_name: this.#parsedBaseName,
      parsed_phase: this.#parsedPhase,
      parsed_revision: this.#parsedRevision,
      parsed_discipline: this.#parsedDiscipline,
      first_seen_at: this.#firstSeenAt.toISOString(),
      last_seen_at: this.#lastSeenAt.toISOString(),
      is_deleted: this.#isDeleted,
    };
  }

  static fromPersistence(data) {
    return new IfcFileSnapshot({
      id: data.id,
      projectCode: data.project_code,
      driveFolderId: data.drive_folder_id,
      driveFileId: data.drive_file_id,
      fileName: data.file_name,
      fileSize: data.file_size,
      mimeType: data.mime_type,
      md5Checksum: data.md5_checksum,
      driveCreatedTime: data.drive_created_time,
      driveModifiedTime: data.drive_modified_time,
      parsedBaseName: data.parsed_base_name,
      parsedPhase: data.parsed_phase,
      parsedRevision: data.parsed_revision,
      parsedDiscipline: data.parsed_discipline,
      firstSeenAt: data.first_seen_at,
      lastSeenAt: data.last_seen_at,
      isDeleted: data.is_deleted,
    });
  }

  static create({ projectCode, driveFolderId, driveFileId, fileName, fileSize, mimeType, md5Checksum, driveCreatedTime, driveModifiedTime }) {
    return new IfcFileSnapshot({
      projectCode,
      driveFolderId,
      driveFileId,
      fileName,
      fileSize,
      mimeType,
      md5Checksum,
      driveCreatedTime,
      driveModifiedTime,
    });
  }
}

export { IfcFileSnapshot };
