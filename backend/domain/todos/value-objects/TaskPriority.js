/**
 * Value Object: TaskPriority
 * Representa os níveis de prioridade de um ToDo
 */

const VALID_PRIORITIES = Object.freeze({
  BAIXA: 'baixa',
  MEDIA: 'média',
  ALTA: 'alta',
});

const PRIORITY_LABELS = Object.freeze({
  [VALID_PRIORITIES.BAIXA]: 'Baixa',
  [VALID_PRIORITIES.MEDIA]: 'Média',
  [VALID_PRIORITIES.ALTA]: 'Alta',
});

const PRIORITY_COLORS = Object.freeze({
  [VALID_PRIORITIES.BAIXA]: '#22c55e',
  [VALID_PRIORITIES.MEDIA]: '#f59e0b',
  [VALID_PRIORITIES.ALTA]: '#ef4444',
});

const PRIORITY_ORDER = Object.freeze({
  [VALID_PRIORITIES.ALTA]: 1,
  [VALID_PRIORITIES.MEDIA]: 2,
  [VALID_PRIORITIES.BAIXA]: 3,
});

class TaskPriority {
  #value;

  constructor(value) {
    const normalizedValue = String(value).toLowerCase().trim();

    if (!TaskPriority.isValid(normalizedValue)) {
      throw new Error(
        `Prioridade inválida: "${value}". Valores permitidos: ${Object.values(VALID_PRIORITIES).join(', ')}`
      );
    }

    this.#value = normalizedValue;
    Object.freeze(this);
  }

  get value() {
    return this.#value;
  }

  get label() {
    return PRIORITY_LABELS[this.#value];
  }

  get color() {
    return PRIORITY_COLORS[this.#value];
  }

  get order() {
    return PRIORITY_ORDER[this.#value];
  }

  get isHigh() {
    return this.#value === VALID_PRIORITIES.ALTA;
  }

  equals(other) {
    if (!(other instanceof TaskPriority)) {
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
    return Object.values(VALID_PRIORITIES).includes(value);
  }

  static fromString(value) {
    return new TaskPriority(value);
  }

  static get VALID_VALUES() {
    return Object.values(VALID_PRIORITIES);
  }

  static get PRIORITIES() {
    return VALID_PRIORITIES;
  }

  // Factory methods
  static baixa() {
    return new TaskPriority(VALID_PRIORITIES.BAIXA);
  }

  static media() {
    return new TaskPriority(VALID_PRIORITIES.MEDIA);
  }

  static alta() {
    return new TaskPriority(VALID_PRIORITIES.ALTA);
  }
}

export { TaskPriority, VALID_PRIORITIES as TaskPriorityEnum };
