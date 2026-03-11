/**
 * Value Object: NpsSource
 * Representa a origem de uma resposta NPS
 */

const VALID_SOURCES = Object.freeze({
  PLATAFORMA: 'plataforma',
  GOOGLE_FORMS: 'google_forms',
  EXTERNO: 'externo',
});

const SOURCE_LABELS = Object.freeze({
  [VALID_SOURCES.PLATAFORMA]: 'Plataforma Otus',
  [VALID_SOURCES.GOOGLE_FORMS]: 'Google Forms',
  [VALID_SOURCES.EXTERNO]: 'Externo',
});

class NpsSource {
  #value;

  constructor(value) {
    const normalized = String(value).toLowerCase().trim();

    if (!NpsSource.isValid(normalized)) {
      throw new Error(
        `Fonte NPS inválida: "${value}". Valores permitidos: ${Object.values(VALID_SOURCES).join(', ')}`
      );
    }

    this.#value = normalized;
    Object.freeze(this);
  }

  get value() {
    return this.#value;
  }

  get label() {
    return SOURCE_LABELS[this.#value];
  }

  equals(other) {
    if (!(other instanceof NpsSource)) return false;
    return this.#value === other.value;
  }

  toString() {
    return this.#value;
  }

  toJSON() {
    return this.#value;
  }

  static isValid(value) {
    return Object.values(VALID_SOURCES).includes(value);
  }

  static get VALID_VALUES() {
    return Object.values(VALID_SOURCES);
  }

  static get SOURCES() {
    return VALID_SOURCES;
  }

  static plataforma() {
    return new NpsSource(VALID_SOURCES.PLATAFORMA);
  }

  static googleForms() {
    return new NpsSource(VALID_SOURCES.GOOGLE_FORMS);
  }

  static externo() {
    return new NpsSource(VALID_SOURCES.EXTERNO);
  }
}

export { NpsSource };
