/**
 * Value Object: Dimensao
 * Representa uma dimensão de avaliação na escala 1-3.
 * Imutável. Suporta nullable (ex: cronograma em projetos de compatibilização).
 */

const LABELS = Object.freeze({
  1: 'Insatisfeito',
  2: 'Neutro',
  3: 'Satisfeito',
});

class Dimensao {
  #value;

  constructor(value) {
    if (value === null || value === undefined) {
      this.#value = null;
      Object.freeze(this);
      return;
    }

    const num = Number(value);
    if (!Number.isInteger(num) || num < 1 || num > 3) {
      throw new Error(`Dimensão inválida: "${value}". Deve ser 1, 2 ou 3.`);
    }

    this.#value = num;
    Object.freeze(this);
  }

  get value() {
    return this.#value;
  }

  get isNull() {
    return this.#value === null;
  }

  get label() {
    return this.#value !== null ? LABELS[this.#value] : null;
  }

  equals(other) {
    if (!(other instanceof Dimensao)) return false;
    return this.#value === other.value;
  }

  toString() {
    return this.#value !== null ? String(this.#value) : '';
  }

  toJSON() {
    return this.#value;
  }

  static nullable(value) {
    return new Dimensao(value ?? null);
  }

  static required(value, nome) {
    if (value === null || value === undefined) {
      throw new Error(`A dimensão "${nome}" é obrigatória.`);
    }
    return new Dimensao(value);
  }

  static get LABELS() {
    return LABELS;
  }

  static get SCALE() {
    return [1, 2, 3];
  }
}

export { Dimensao };
