/**
 * Value Object: TipoPagamento
 * Representa o tipo de pagamento do projeto (MRR ou SPOT)
 */

const VALID_TYPES = Object.freeze({
  MRR: 'mrr',
  SPOT: 'spot',
});

const TYPE_LABELS = Object.freeze({
  [VALID_TYPES.MRR]: 'MRR',
  [VALID_TYPES.SPOT]: 'SPOT',
});

class TipoPagamento {
  #value;

  constructor(value) {
    const normalizedValue = String(value).toLowerCase().trim();

    if (!TipoPagamento.isValid(normalizedValue)) {
      throw new Error(
        `Tipo de pagamento inválido: "${value}". Valores permitidos: ${Object.values(VALID_TYPES).join(', ')}`
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
    if (!(other instanceof TipoPagamento)) return false;
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

export { TipoPagamento, VALID_TYPES as TipoPagamentoEnum };
