/**
 * Value Object: TaskStatus
 * Representa os estados possíveis de um ToDo no ciclo de vida
 */

const VALID_STATUSES = Object.freeze({
  BACKLOG: 'backlog',
  A_FAZER: 'a fazer',
  EM_PROGRESSO: 'em progresso',
  FINALIZADO: 'finalizado',
  VALIDACAO: 'validação',
  CANCELADO: 'cancelado',
});

const STATUS_LABELS = Object.freeze({
  [VALID_STATUSES.BACKLOG]: 'Backlog',
  [VALID_STATUSES.A_FAZER]: 'A Fazer',
  [VALID_STATUSES.EM_PROGRESSO]: 'Em Progresso',
  [VALID_STATUSES.FINALIZADO]: 'Finalizado',
  [VALID_STATUSES.VALIDACAO]: 'Validação',
  [VALID_STATUSES.CANCELADO]: 'Cancelado',
});

const CLOSED_STATUSES = Object.freeze([
  VALID_STATUSES.FINALIZADO,
  VALID_STATUSES.CANCELADO,
]);

class TaskStatus {
  #value;

  constructor(value) {
    const normalizedValue = String(value).toLowerCase().trim();

    if (!TaskStatus.isValid(normalizedValue)) {
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

  get isClosed() {
    return CLOSED_STATUSES.includes(this.#value);
  }

  get isOpen() {
    return !this.isClosed;
  }

  get isActionable() {
    return this.#value === VALID_STATUSES.A_FAZER || this.#value === VALID_STATUSES.EM_PROGRESSO;
  }

  equals(other) {
    if (!(other instanceof TaskStatus)) {
      return false;
    }
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

  static fromString(value) {
    return new TaskStatus(value);
  }

  static get VALID_VALUES() {
    return Object.values(VALID_STATUSES);
  }

  static get STATUSES() {
    return VALID_STATUSES;
  }

  // Factory methods
  static backlog() {
    return new TaskStatus(VALID_STATUSES.BACKLOG);
  }

  static aFazer() {
    return new TaskStatus(VALID_STATUSES.A_FAZER);
  }

  static emProgresso() {
    return new TaskStatus(VALID_STATUSES.EM_PROGRESSO);
  }

  static finalizado() {
    return new TaskStatus(VALID_STATUSES.FINALIZADO);
  }

  static validacao() {
    return new TaskStatus(VALID_STATUSES.VALIDACAO);
  }

  static cancelado() {
    return new TaskStatus(VALID_STATUSES.CANCELADO);
  }
}

export { TaskStatus, VALID_STATUSES as TaskStatusEnum };
