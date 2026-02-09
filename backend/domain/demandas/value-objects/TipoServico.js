/**
 * Value Object: TipoServico
 * Representa os subtipos de serviço dentro da categoria "Modelagem"
 */

const VALID_TIPOS = Object.freeze({
  MODELAGEM_COMPATIBILIZACAO: 'modelagem_compatibilizacao',
  PRANCHAS_ALVENARIA: 'pranchas_alvenaria',
  PRANCHAS_FURACAO: 'pranchas_furacao',
  UNIR_MARKUPS: 'unir_markups',
  QUANTITATIVO: 'quantitativo',
  OUTRO: 'outro',
});

const TIPO_LABELS = Object.freeze({
  [VALID_TIPOS.MODELAGEM_COMPATIBILIZACAO]: 'Modelagem para Compatibilização',
  [VALID_TIPOS.PRANCHAS_ALVENARIA]: 'Pranchas de Alvenaria',
  [VALID_TIPOS.PRANCHAS_FURACAO]: 'Pranchas de Furação',
  [VALID_TIPOS.UNIR_MARKUPS]: 'Unir Markups',
  [VALID_TIPOS.QUANTITATIVO]: 'Quantitativo',
  [VALID_TIPOS.OUTRO]: 'Outro',
});

class TipoServico {
  #value;

  constructor(value) {
    const normalizedValue = String(value).toLowerCase().trim();

    if (!TipoServico.isValid(normalizedValue)) {
      throw new Error(
        `Tipo de serviço inválido: "${value}". Valores permitidos: ${Object.values(VALID_TIPOS).join(', ')}`
      );
    }

    this.#value = normalizedValue;
    Object.freeze(this);
  }

  get value() {
    return this.#value;
  }

  get label() {
    return TIPO_LABELS[this.#value];
  }

  get isOutro() {
    return this.#value === VALID_TIPOS.OUTRO;
  }

  equals(other) {
    if (!(other instanceof TipoServico)) {
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
    return Object.values(VALID_TIPOS).includes(value);
  }

  static fromString(value) {
    return new TipoServico(value);
  }

  static get VALID_VALUES() {
    return Object.values(VALID_TIPOS);
  }

  static get TIPOS() {
    return VALID_TIPOS;
  }
}

export { TipoServico, VALID_TIPOS as TipoServicoEnum };
