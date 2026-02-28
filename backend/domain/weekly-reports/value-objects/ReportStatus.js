/**
 * Value Object: ReportStatus
 * Representa os estados possíveis de um relatório semanal no pipeline de geração
 */

const VALID_STATUSES = Object.freeze({
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

const STATUS_LABELS = Object.freeze({
  [VALID_STATUSES.IN_PROGRESS]: 'Em Progresso',
  [VALID_STATUSES.COMPLETED]: 'Concluído',
  [VALID_STATUSES.FAILED]: 'Falhou',
});

class ReportStatus {
  #value;

  constructor(value) {
    const normalizedValue = String(value).toLowerCase().trim();

    if (!ReportStatus.isValid(normalizedValue)) {
      throw new Error(
        `Status inválido: "${value}". Valores permitidos: ${Object.values(VALID_STATUSES).join(', ')}`
      );
    }

    this.#value = normalizedValue;
    Object.freeze(this);
  }

  get value() {
    return this.#value;
  }

  get label() {
    return STATUS_LABELS[this.#value];
  }

  get isCompleted() {
    return this.#value === VALID_STATUSES.COMPLETED;
  }

  get isFailed() {
    return this.#value === VALID_STATUSES.FAILED;
  }

  get isInProgress() {
    return this.#value === VALID_STATUSES.IN_PROGRESS;
  }

  get isDone() {
    return this.isCompleted || this.isFailed;
  }

  equals(other) {
    if (!(other instanceof ReportStatus)) return false;
    return this.#value === other.value;
  }

  toString() {
    return this.#value;
  }

  toJSON() {
    return this.#value;
  }

  static isValid(value) {
    return Object.values(VALID_STATUSES).includes(value);
  }

  static get VALID_VALUES() {
    return Object.values(VALID_STATUSES);
  }

  static get STATUSES() {
    return VALID_STATUSES;
  }

  static inProgress() {
    return new ReportStatus(VALID_STATUSES.IN_PROGRESS);
  }

  static completed() {
    return new ReportStatus(VALID_STATUSES.COMPLETED);
  }

  static failed() {
    return new ReportStatus(VALID_STATUSES.FAILED);
  }
}

export { ReportStatus, VALID_STATUSES as ReportStatusEnum };
