/**
 * Value Object: NpsScore
 * Representa a nota NPS (0-10) com classificação automática
 */

const CATEGORIES = Object.freeze({
  PROMOTER: 'promoter',
  PASSIVE: 'passive',
  DETRACTOR: 'detractor',
});

const CATEGORY_LABELS = Object.freeze({
  [CATEGORIES.PROMOTER]: 'Promotor',
  [CATEGORIES.PASSIVE]: 'Neutro',
  [CATEGORIES.DETRACTOR]: 'Detrator',
});

class NpsScore {
  #value;

  constructor(value) {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10) {
      throw new Error(
        `Nota NPS inválida: "${value}". Deve ser um inteiro entre 0 e 10.`
      );
    }

    this.#value = parsed;
    Object.freeze(this);
  }

  get value() {
    return this.#value;
  }

  get category() {
    if (this.#value >= 9) return CATEGORIES.PROMOTER;
    if (this.#value >= 7) return CATEGORIES.PASSIVE;
    return CATEGORIES.DETRACTOR;
  }

  get label() {
    return CATEGORY_LABELS[this.category];
  }

  get isPromoter() {
    return this.category === CATEGORIES.PROMOTER;
  }

  get isPassive() {
    return this.category === CATEGORIES.PASSIVE;
  }

  get isDetractor() {
    return this.category === CATEGORIES.DETRACTOR;
  }

  equals(other) {
    if (!(other instanceof NpsScore)) return false;
    return this.#value === other.value;
  }

  toString() {
    return String(this.#value);
  }

  toJSON() {
    return this.#value;
  }

  static isValid(value) {
    if (value === null || value === undefined) return true;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 10;
  }

  static get CATEGORIES() {
    return CATEGORIES;
  }
}

export { NpsScore };
