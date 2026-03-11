/**
 * Value Object: DecisionLevel
 * Representa o nível de decisão do entrevistado
 */

const VALID_LEVELS = Object.freeze({
  DECISOR: 'decisor',
  NAO_DECISOR: 'nao_decisor',
});

const LEVEL_LABELS = Object.freeze({
  [VALID_LEVELS.DECISOR]: 'Decisor',
  [VALID_LEVELS.NAO_DECISOR]: 'Não decisor',
});

class DecisionLevel {
  #value;

  constructor(value) {
    const normalized = String(value).toLowerCase().trim();

    if (!DecisionLevel.isValid(normalized)) {
      throw new Error(
        `Nível de decisão inválido: "${value}". Valores permitidos: ${Object.values(VALID_LEVELS).join(', ')}`
      );
    }

    this.#value = normalized;
    Object.freeze(this);
  }

  get value() { return this.#value; }
  get label() { return LEVEL_LABELS[this.#value]; }

  equals(other) {
    if (!(other instanceof DecisionLevel)) return false;
    return this.#value === other.value;
  }

  toString() { return this.#value; }
  toJSON() { return this.#value; }

  static isValid(value) {
    return Object.values(VALID_LEVELS).includes(value);
  }

  static get VALID_VALUES() { return Object.values(VALID_LEVELS); }
  static get LEVELS() { return VALID_LEVELS; }

  static decisor() { return new DecisionLevel(VALID_LEVELS.DECISOR); }
  static naoDecisor() { return new DecisionLevel(VALID_LEVELS.NAO_DECISOR); }
}

export { DecisionLevel };
