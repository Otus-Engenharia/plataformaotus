/**
 * Entidade: ChangeAnnotation
 * Representa uma anotação do coordenador sobre uma alteração detectada
 * entre snapshots mensais. Overlay editável sem alterar dados brutos.
 */

import { ChangeType } from '../value-objects/ChangeType.js';

class ChangeAnnotation {
  #id;
  #projectCode;
  #fromSnapshotDate;
  #toSnapshotDate;
  #changeType;
  #taskName;
  #disciplina;
  #description;
  #justification;
  #isVisible;
  #createdByEmail;
  #updatedByEmail;
  #createdAt;
  #updatedAt;

  constructor({
    id = null,
    projectCode,
    fromSnapshotDate,
    toSnapshotDate,
    changeType,
    taskName,
    disciplina = null,
    description = null,
    justification = null,
    isVisible = true,
    createdByEmail = null,
    updatedByEmail = null,
    createdAt = null,
    updatedAt = null,
  }) {
    if (!projectCode?.trim()) throw new Error('Código do projeto é obrigatório');
    if (!fromSnapshotDate) throw new Error('Data do snapshot anterior é obrigatória');
    if (!toSnapshotDate) throw new Error('Data do snapshot atual é obrigatória');
    if (!taskName?.trim()) throw new Error('Nome da tarefa é obrigatório');

    this.#id = id;
    this.#projectCode = projectCode.trim();
    this.#fromSnapshotDate = fromSnapshotDate;
    this.#toSnapshotDate = toSnapshotDate;
    this.#changeType = changeType instanceof ChangeType ? changeType : new ChangeType(changeType);
    this.#taskName = taskName.trim();
    this.#disciplina = disciplina?.trim() || null;
    this.#description = description?.trim() || null;
    this.#justification = justification?.trim() || null;
    this.#isVisible = Boolean(isVisible);
    this.#createdByEmail = createdByEmail;
    this.#updatedByEmail = updatedByEmail;
    this.#createdAt = createdAt || new Date();
    this.#updatedAt = updatedAt || new Date();
  }

  // --- Getters ---
  get id() { return this.#id; }
  get projectCode() { return this.#projectCode; }
  get fromSnapshotDate() { return this.#fromSnapshotDate; }
  get toSnapshotDate() { return this.#toSnapshotDate; }
  get changeType() { return this.#changeType; }
  get taskName() { return this.#taskName; }
  get disciplina() { return this.#disciplina; }
  get description() { return this.#description; }
  get justification() { return this.#justification; }
  get isVisible() { return this.#isVisible; }
  get createdByEmail() { return this.#createdByEmail; }
  get updatedByEmail() { return this.#updatedByEmail; }
  get createdAt() { return this.#createdAt; }
  get updatedAt() { return this.#updatedAt; }

  // --- Comportamentos ---

  annotate(description, justification, updatedByEmail = null) {
    if (description !== undefined) this.#description = description?.trim() || null;
    if (justification !== undefined) this.#justification = justification?.trim() || null;
    if (updatedByEmail) this.#updatedByEmail = updatedByEmail;
    this.#updatedAt = new Date();
  }

  toggleVisibility(updatedByEmail = null) {
    this.#isVisible = !this.#isVisible;
    if (updatedByEmail) this.#updatedByEmail = updatedByEmail;
    this.#updatedAt = new Date();
  }

  setVisibility(isVisible, updatedByEmail = null) {
    this.#isVisible = Boolean(isVisible);
    if (updatedByEmail) this.#updatedByEmail = updatedByEmail;
    this.#updatedAt = new Date();
  }

  // --- Serialização ---

  toPersistence() {
    return {
      project_code: this.#projectCode,
      from_snapshot_date: this.#fromSnapshotDate,
      to_snapshot_date: this.#toSnapshotDate,
      change_type: this.#changeType.value,
      task_name: this.#taskName,
      disciplina: this.#disciplina,
      description: this.#description,
      justification: this.#justification,
      is_visible: this.#isVisible,
      created_by_email: this.#createdByEmail,
      updated_by_email: this.#updatedByEmail,
    };
  }

  toResponse() {
    return {
      id: this.#id,
      project_code: this.#projectCode,
      from_snapshot_date: this.#fromSnapshotDate,
      to_snapshot_date: this.#toSnapshotDate,
      change_type: this.#changeType.value,
      change_type_label: this.#changeType.label,
      task_name: this.#taskName,
      disciplina: this.#disciplina,
      description: this.#description,
      justification: this.#justification,
      is_visible: this.#isVisible,
      created_by_email: this.#createdByEmail,
      updated_by_email: this.#updatedByEmail,
      created_at: this.#createdAt,
      updated_at: this.#updatedAt,
    };
  }

  // --- Factories ---

  static create({ projectCode, fromSnapshotDate, toSnapshotDate, changeType, taskName, disciplina, description, justification, isVisible, createdByEmail }) {
    return new ChangeAnnotation({
      projectCode,
      fromSnapshotDate,
      toSnapshotDate,
      changeType,
      taskName,
      disciplina,
      description,
      justification,
      isVisible,
      createdByEmail,
    });
  }

  static fromPersistence(row) {
    return new ChangeAnnotation({
      id: row.id,
      projectCode: row.project_code,
      fromSnapshotDate: row.from_snapshot_date,
      toSnapshotDate: row.to_snapshot_date,
      changeType: row.change_type,
      taskName: row.task_name,
      disciplina: row.disciplina,
      description: row.description,
      justification: row.justification,
      isVisible: row.is_visible,
      createdByEmail: row.created_by_email,
      updatedByEmail: row.updated_by_email,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}

export { ChangeAnnotation };
