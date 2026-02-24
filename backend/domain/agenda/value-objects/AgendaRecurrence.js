/**
 * Value Object: AgendaRecurrence
 * Representa os tipos de recorrência de uma tarefa de agenda
 */

const VALID_RECURRENCES = Object.freeze({
  NUNCA: 'nunca',
  DIARIA: 'diária',
  DIARIA_UTIL: 'diária_útil',
  SEMANAL: 'semanal',
  MENSAL: 'mensal',
});

const RECURRENCE_LABELS = Object.freeze({
  [VALID_RECURRENCES.NUNCA]: 'Nunca',
  [VALID_RECURRENCES.DIARIA]: 'Diária',
  [VALID_RECURRENCES.DIARIA_UTIL]: 'Diária (dias úteis)',
  [VALID_RECURRENCES.SEMANAL]: 'Semanal',
  [VALID_RECURRENCES.MENSAL]: 'Mensal',
});

class AgendaRecurrence {
  #value;

  constructor(value) {
    const normalizedValue = String(value).trim();

    if (!AgendaRecurrence.isValid(normalizedValue)) {
      throw new Error(
        `Recorrência inválida: "${value}". Valores permitidos: ${Object.values(VALID_RECURRENCES).join(', ')}`
      );
    }

    this.#value = normalizedValue;
    Object.freeze(this);
  }

  get value() {
    return this.#value;
  }

  get label() {
    return RECURRENCE_LABELS[this.#value];
  }

  get isRecurring() {
    return this.#value !== VALID_RECURRENCES.NUNCA;
  }

  get isNever() {
    return this.#value === VALID_RECURRENCES.NUNCA;
  }

  equals(other) {
    if (!(other instanceof AgendaRecurrence)) {
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
    return Object.values(VALID_RECURRENCES).includes(value);
  }

  static fromString(value) {
    return new AgendaRecurrence(value);
  }

  static get VALID_VALUES() {
    return Object.values(VALID_RECURRENCES);
  }

  static get RECURRENCES() {
    return VALID_RECURRENCES;
  }

  static nunca() {
    return new AgendaRecurrence(VALID_RECURRENCES.NUNCA);
  }

  static diaria() {
    return new AgendaRecurrence(VALID_RECURRENCES.DIARIA);
  }

  static semanal() {
    return new AgendaRecurrence(VALID_RECURRENCES.SEMANAL);
  }

  static mensal() {
    return new AgendaRecurrence(VALID_RECURRENCES.MENSAL);
  }
}

export { AgendaRecurrence, VALID_RECURRENCES as AgendaRecurrenceEnum };
