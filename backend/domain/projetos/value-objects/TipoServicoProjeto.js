/**
 * Value Object: TipoServicoProjeto
 * Representa o tipo de serviço prestado no projeto (coordenação ou compatibilização)
 */

const VALID_TYPES = Object.freeze({
  COORDENACAO: 'coordenacao',
  COMPATIBILIZACAO: 'compatibilizacao',
});

const TYPE_LABELS = Object.freeze({
  [VALID_TYPES.COORDENACAO]: 'Coordenação',
  [VALID_TYPES.COMPATIBILIZACAO]: 'Compatibilização',
});

class TipoServicoProjeto {
  #value;

  constructor(value) {
    const normalizedValue = String(value).toLowerCase().trim();

    if (!TipoServicoProjeto.isValid(normalizedValue)) {
      throw new Error(
        `Tipo de serviço inválido: "${value}". Valores permitidos: ${Object.values(VALID_TYPES).join(', ')}`
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
    if (!(other instanceof TipoServicoProjeto)) return false;
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

export { TipoServicoProjeto, VALID_TYPES as TipoServicoProjetoEnum };
