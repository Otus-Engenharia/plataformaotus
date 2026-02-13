/**
 * Value Object: PadraoAcabamento
 * Representa o padrão de acabamento de um empreendimento
 */

const VALID_TYPES = Object.freeze({
  AAA: 'aaa',
  A: 'a',
  MEDIO_ALTO: 'medio_alto',
  MEDIO: 'medio',
  POPULAR: 'popular',
});

const TYPE_LABELS = Object.freeze({
  [VALID_TYPES.AAA]: 'AAA',
  [VALID_TYPES.A]: 'A',
  [VALID_TYPES.MEDIO_ALTO]: 'Médio-alto (B)',
  [VALID_TYPES.MEDIO]: 'Médio (Econômico)',
  [VALID_TYPES.POPULAR]: 'Popular (MCMV)',
});

class PadraoAcabamento {
  #value;

  constructor(value) {
    const normalizedValue = String(value).toLowerCase().trim();

    if (!PadraoAcabamento.isValid(normalizedValue)) {
      throw new Error(
        `Padrão de acabamento inválido: "${value}". Valores permitidos: ${Object.values(VALID_TYPES).join(', ')}`
      );
    }

    this.#value = normalizedValue;
    Object.freeze(this);
  }

  get value() {
    return this.#value;
  }

  get label() {
    return TYPE_LABELS[this.#value];
  }

  equals(other) {
    if (!(other instanceof PadraoAcabamento)) return false;
    return this.#value === other.value;
  }

  toString() {
    return this.#value;
  }

  toJSON() {
    return this.#value;
  }

  static isValid(value) {
    return Object.values(VALID_TYPES).includes(value);
  }

  static get VALID_VALUES() {
    return Object.values(VALID_TYPES);
  }

  static allOptions() {
    return Object.values(VALID_TYPES).map(v => ({ value: v, label: TYPE_LABELS[v] }));
  }
}

export { PadraoAcabamento, VALID_TYPES as PadraoAcabamentoEnum };
