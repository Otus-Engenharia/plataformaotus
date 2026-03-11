/**
 * Value Object: SatisfactionScore
 * Representa uma nota de satisfação (CSAT ou CES) de 0-10
 */

const TYPES = Object.freeze({
  CSAT: 'csat',
  CES: 'ces',
});

const CSAT_CATEGORIES = Object.freeze({
  SATISFIED: 'satisfied',
  NEUTRAL: 'neutral',
  UNSATISFIED: 'unsatisfied',
});

const CES_CATEGORIES = Object.freeze({
  EASY: 'easy',
  NEUTRAL: 'neutral',
  DIFFICULT: 'difficult',
});

const CSAT_LABELS = Object.freeze({
  [CSAT_CATEGORIES.SATISFIED]: 'Satisfeito',
  [CSAT_CATEGORIES.NEUTRAL]: 'Neutro',
  [CSAT_CATEGORIES.UNSATISFIED]: 'Insatisfeito',
});

const CES_LABELS = Object.freeze({
  [CES_CATEGORIES.EASY]: 'Fácil',
  [CES_CATEGORIES.NEUTRAL]: 'Neutro',
  [CES_CATEGORIES.DIFFICULT]: 'Difícil',
});

class SatisfactionScore {
  #value;
  #type;

  constructor(value, type) {
    if (!Object.values(TYPES).includes(type)) {
      throw new Error(`Tipo inválido: "${type}". Use 'csat' ou 'ces'.`);
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10) {
      throw new Error(
        `Nota ${type.toUpperCase()} inválida: "${value}". Deve ser um inteiro entre 0 e 10.`
      );
    }

    this.#value = parsed;
    this.#type = type;
    Object.freeze(this);
  }

  get value() { return this.#value; }
  get type() { return this.#type; }

  get category() {
    if (this.#type === TYPES.CSAT) {
      if (this.#value >= 7) return CSAT_CATEGORIES.SATISFIED;
      if (this.#value >= 4) return CSAT_CATEGORIES.NEUTRAL;
      return CSAT_CATEGORIES.UNSATISFIED;
    }
    // CES
    if (this.#value >= 7) return CES_CATEGORIES.EASY;
    if (this.#value >= 4) return CES_CATEGORIES.NEUTRAL;
    return CES_CATEGORIES.DIFFICULT;
  }

  get label() {
    if (this.#type === TYPES.CSAT) return CSAT_LABELS[this.category];
    return CES_LABELS[this.category];
  }

  equals(other) {
    if (!(other instanceof SatisfactionScore)) return false;
    return this.#value === other.value && this.#type === other.type;
  }

  toString() { return String(this.#value); }
  toJSON() { return this.#value; }

  static isValid(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 10;
  }

  static csat(value) { return new SatisfactionScore(value, TYPES.CSAT); }
  static ces(value) { return new SatisfactionScore(value, TYPES.CES); }

  static get TYPES() { return TYPES; }
  static get CSAT_CATEGORIES() { return CSAT_CATEGORIES; }
  static get CES_CATEGORIES() { return CES_CATEGORIES; }
}

export { SatisfactionScore };
