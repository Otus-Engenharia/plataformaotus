/**
 * Value Object: AgendaTaskStatus
 * Representa os estados possíveis de uma tarefa de agenda
 */

const VALID_STATUSES = Object.freeze({
  A_FAZER: 'a fazer',
  FEITO: 'feito',
});

const STATUS_LABELS = Object.freeze({
  [VALID_STATUSES.A_FAZER]: 'A Fazer',
  [VALID_STATUSES.FEITO]: 'Feito',
});

class AgendaTaskStatus {
  #value;

  constructor(value) {
    const normalizedValue = String(value).trim();

    if (!AgendaTaskStatus.isValid(normalizedValue)) {
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

  get isDone() {
    return this.#value === VALID_STATUSES.FEITO;
  }

  get isOpen() {
    return this.#value === VALID_STATUSES.A_FAZER;
  }

  equals(other) {
    if (!(other instanceof AgendaTaskStatus)) {
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
    return new AgendaTaskStatus(value);
  }

  static get VALID_VALUES() {
    return Object.values(VALID_STATUSES);
  }

  static get STATUSES() {
    return VALID_STATUSES;
  }

  static aFazer() {
    return new AgendaTaskStatus(VALID_STATUSES.A_FAZER);
  }

  static feito() {
    return new AgendaTaskStatus(VALID_STATUSES.FEITO);
  }
}

export { AgendaTaskStatus, VALID_STATUSES as AgendaTaskStatusEnum };
