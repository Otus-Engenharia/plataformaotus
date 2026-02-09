/**
 * Value Object: Prioridade
 * Representa os níveis de prioridade de uma demanda
 */

const VALID_PRIORIDADES = Object.freeze({
  BAIXA: 'baixa',
  NORMAL: 'normal',
  ALTA: 'alta',
  URGENTE: 'urgente',
});

const PRIORIDADE_LABELS = Object.freeze({
  [VALID_PRIORIDADES.BAIXA]: 'Baixa',
  [VALID_PRIORIDADES.NORMAL]: 'Normal',
  [VALID_PRIORIDADES.ALTA]: 'Alta',
  [VALID_PRIORIDADES.URGENTE]: 'Urgente',
});

const PRIORIDADE_COLORS = Object.freeze({
  [VALID_PRIORIDADES.BAIXA]: '#6b7280',
  [VALID_PRIORIDADES.NORMAL]: '#3b82f6',
  [VALID_PRIORIDADES.ALTA]: '#f59e0b',
  [VALID_PRIORIDADES.URGENTE]: '#ef4444',
});

class Prioridade {
  #value;

  constructor(value) {
    const normalizedValue = String(value).toLowerCase().trim();

    if (!Prioridade.isValid(normalizedValue)) {
      throw new Error(
        `Prioridade inválida: "${value}". Valores permitidos: ${Object.values(VALID_PRIORIDADES).join(', ')}`
      );
    }

    this.#value = normalizedValue;
    Object.freeze(this);
  }

  get value() {
    return this.#value;
  }

  get label() {
    return PRIORIDADE_LABELS[this.#value];
  }

  get color() {
    return PRIORIDADE_COLORS[this.#value];
  }

  get isUrgent() {
    return this.#value === VALID_PRIORIDADES.URGENTE;
  }

  get isHigh() {
    return this.#value === VALID_PRIORIDADES.ALTA || this.#value === VALID_PRIORIDADES.URGENTE;
  }

  equals(other) {
    if (!(other instanceof Prioridade)) {
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
    return Object.values(VALID_PRIORIDADES).includes(value);
  }

  static fromString(value) {
    return new Prioridade(value);
  }

  static get VALID_VALUES() {
    return Object.values(VALID_PRIORIDADES);
  }

  static get PRIORIDADES() {
    return VALID_PRIORIDADES;
  }

  static normal() {
    return new Prioridade(VALID_PRIORIDADES.NORMAL);
  }

  static alta() {
    return new Prioridade(VALID_PRIORIDADES.ALTA);
  }

  static urgente() {
    return new Prioridade(VALID_PRIORIDADES.URGENTE);
  }
}

export { Prioridade, VALID_PRIORIDADES as PrioridadeEnum };
