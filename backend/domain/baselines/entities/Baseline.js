/**
 * Entidade: Baseline (Aggregate Root)
 * Representa uma baseline de projeto com snapshot de tarefas.
 */

import { BaselineSource } from '../value-objects/BaselineSource.js';

class Baseline {
  #id;
  #projectCode;
  #revisionNumber;
  #name;
  #description;
  #createdByEmail;
  #snapshotDate;
  #taskCount;
  #isActive;
  #source;
  #metadata;
  #createdAt;
  #updatedAt;

  constructor({
    id = null,
    projectCode,
    revisionNumber = 0,
    name,
    description = null,
    createdByEmail = null,
    snapshotDate,
    taskCount = 0,
    isActive = true,
    source = 'platform',
    metadata = null,
    createdAt = null,
    updatedAt = null,
  }) {
    if (!projectCode?.trim()) throw new Error('Código do projeto é obrigatório');
    if (!name?.trim()) throw new Error('Nome da baseline é obrigatório');
    if (!snapshotDate) throw new Error('Data do snapshot é obrigatória');

    this.#id = id;
    this.#projectCode = projectCode.trim();
    this.#revisionNumber = Number(revisionNumber);
    this.#name = name.trim();
    this.#description = description?.trim() || null;
    this.#createdByEmail = createdByEmail;
    this.#snapshotDate = snapshotDate;
    this.#taskCount = Number(taskCount) || 0;
    this.#isActive = Boolean(isActive);
    this.#source = source instanceof BaselineSource ? source : new BaselineSource(source);
    this.#metadata = metadata;
    this.#createdAt = createdAt || new Date();
    this.#updatedAt = updatedAt || new Date();
  }

  // --- Getters ---
  get id() { return this.#id; }
  get projectCode() { return this.#projectCode; }
  get revisionNumber() { return this.#revisionNumber; }
  get name() { return this.#name; }
  get description() { return this.#description; }
  get createdByEmail() { return this.#createdByEmail; }
  get snapshotDate() { return this.#snapshotDate; }
  get taskCount() { return this.#taskCount; }
  get isActive() { return this.#isActive; }
  get source() { return this.#source; }
  get metadata() { return this.#metadata; }
  get createdAt() { return this.#createdAt; }
  get updatedAt() { return this.#updatedAt; }

  get revisionLabel() {
    if (this.#revisionNumber === 0) return 'Original';
    return `R${String(this.#revisionNumber).padStart(2, '0')}`;
  }

  // --- Comportamentos ---

  activate() {
    this.#isActive = true;
    this.#updatedAt = new Date();
  }

  deactivate() {
    this.#isActive = false;
    this.#updatedAt = new Date();
  }

  updateMetadata(name, description) {
    if (name?.trim()) this.#name = name.trim();
    if (description !== undefined) this.#description = description?.trim() || null;
    this.#updatedAt = new Date();
  }

  setTaskCount(count) {
    this.#taskCount = Number(count) || 0;
    this.#updatedAt = new Date();
  }

  // --- Serialização ---

  toPersistence() {
    return {
      project_code: this.#projectCode,
      revision_number: this.#revisionNumber,
      name: this.#name,
      description: this.#description,
      created_by_email: this.#createdByEmail,
      snapshot_date: this.#snapshotDate,
      task_count: this.#taskCount,
      is_active: this.#isActive,
      source: this.#source.value,
      metadata: this.#metadata,
    };
  }

  toResponse() {
    return {
      id: this.#id,
      project_code: this.#projectCode,
      revision_number: this.#revisionNumber,
      revision_label: this.revisionLabel,
      name: this.#name,
      description: this.#description,
      created_by_email: this.#createdByEmail,
      snapshot_date: this.#snapshotDate,
      task_count: this.#taskCount,
      is_active: this.#isActive,
      source: this.#source.value,
      metadata: this.#metadata,
      created_at: this.#createdAt,
      updated_at: this.#updatedAt,
    };
  }

  // --- Factories ---

  static create({ projectCode, revisionNumber, name, description, createdByEmail, snapshotDate, source }) {
    return new Baseline({
      projectCode,
      revisionNumber: revisionNumber || 0,
      name,
      description,
      createdByEmail,
      snapshotDate: snapshotDate || new Date().toISOString().split('T')[0],
      source: source || 'platform',
    });
  }

  static fromPersistence(row) {
    return new Baseline({
      id: row.id,
      projectCode: row.project_code,
      revisionNumber: row.revision_number,
      name: row.name,
      description: row.description,
      createdByEmail: row.created_by_email,
      snapshotDate: row.snapshot_date,
      taskCount: row.task_count,
      isActive: row.is_active,
      source: row.source,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}

export { Baseline };
