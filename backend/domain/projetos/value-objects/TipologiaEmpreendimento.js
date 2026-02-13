/**
 * Value Object: TipologiaEmpreendimento
 * Representa os tipos de empreendimento de um projeto
 */

const VALID_TYPES = Object.freeze({
  RESIDENCIAL: 'residencial',
  COMERCIAL: 'comercial',
  MISTO_1: 'misto_1',
  MISTO_2: 'misto_2',
  HOTEL: 'hotel',
});

const TYPE_LABELS = Object.freeze({
  [VALID_TYPES.RESIDENCIAL]: 'Residencial',
  [VALID_TYPES.COMERCIAL]: 'Comercial',
  [VALID_TYPES.MISTO_1]: 'Misto 1 (torres comercial e residencial)',
  [VALID_TYPES.MISTO_2]: 'Misto 2 (1ºs pavimentos comercial)',
  [VALID_TYPES.HOTEL]: 'Hotel',
});

class TipologiaEmpreendimento {
  #value;

  constructor(value) {
    const normalizedValue = String(value).toLowerCase().trim();

    if (!TipologiaEmpreendimento.isValid(normalizedValue)) {
      throw new Error(
        `Tipologia inválida: "${value}". Valores permitidos: ${Object.values(VALID_TYPES).join(', ')}`
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
    if (!(other instanceof TipologiaEmpreendimento)) return false;
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

export { TipologiaEmpreendimento, VALID_TYPES as TipologiaEmpreendimentoEnum };
