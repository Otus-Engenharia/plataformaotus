/**
 * Value Object: DemandaCategoria
 * Representa as categorias de demanda do apoio de projetos
 */

const VALID_CATEGORIAS = Object.freeze({
  AJUSTE_PASTAS: 'ajuste_pastas',
  MODELO_FEDERADO: 'modelo_federado',
  MODELAGEM: 'modelagem',
});

const CATEGORIA_LABELS = Object.freeze({
  [VALID_CATEGORIAS.AJUSTE_PASTAS]: 'Ajuste de Pastas',
  [VALID_CATEGORIAS.MODELO_FEDERADO]: 'Ajuste de Modelo Federado',
  [VALID_CATEGORIAS.MODELAGEM]: 'Modelagem',
});

const CATEGORIA_ICONS = Object.freeze({
  [VALID_CATEGORIAS.AJUSTE_PASTAS]: '📁',
  [VALID_CATEGORIAS.MODELO_FEDERADO]: '🏗️',
  [VALID_CATEGORIAS.MODELAGEM]: '📐',
});

class DemandaCategoria {
  #value;

  constructor(value) {
    const normalizedValue = String(value).toLowerCase().trim();

    if (!DemandaCategoria.isValid(normalizedValue)) {
      throw new Error(
        `Categoria inválida: "${value}". Valores permitidos: ${Object.values(VALID_CATEGORIAS).join(', ')}`
      );
    }

    this.#value = normalizedValue;
    Object.freeze(this);
  }

  get value() {
    return this.#value;
  }

  get label() {
    return CATEGORIA_LABELS[this.#value];
  }

  get icon() {
    return CATEGORIA_ICONS[this.#value];
  }

  get isModelagem() {
    return this.#value === VALID_CATEGORIAS.MODELAGEM;
  }

  equals(other) {
    if (!(other instanceof DemandaCategoria)) {
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
    return Object.values(VALID_CATEGORIAS).includes(value);
  }

  static fromString(value) {
    return new DemandaCategoria(value);
  }

  static get VALID_VALUES() {
    return Object.values(VALID_CATEGORIAS);
  }

  static get CATEGORIAS() {
    return VALID_CATEGORIAS;
  }

  static ajustePastas() {
    return new DemandaCategoria(VALID_CATEGORIAS.AJUSTE_PASTAS);
  }

  static modeloFederado() {
    return new DemandaCategoria(VALID_CATEGORIAS.MODELO_FEDERADO);
  }

  static modelagem() {
    return new DemandaCategoria(VALID_CATEGORIAS.MODELAGEM);
  }
}

export { DemandaCategoria, VALID_CATEGORIAS as DemandaCategoriaEnum };
