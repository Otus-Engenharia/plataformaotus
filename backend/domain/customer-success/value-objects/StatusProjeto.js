/**
 * Value Object: StatusProjeto
 * Mapeia o status bruto do portfólio para ATIVO/INATIVO/ENCERRADO
 */

const VALID_STATUS_PROJETO = Object.freeze({
  ATIVO: 'ATIVO',
  INATIVO: 'INATIVO',
  ENCERRADO: 'ENCERRADO',
});

// Status do portfólio que indicam projeto ativo (case insensitive)
const STATUS_ATIVO = Object.freeze([
  'planejamento',
  'fase 01',
  'fase 02',
  'fase 03',
  'fase 04',
]);

// Status do portfólio que indicam projeto inativo (case insensitive)
const STATUS_INATIVO = Object.freeze([
  'pausado - f01',
  'pausado - f02',
  'pausado - f03',
  'pausado - f04',
  'a iniciar',
]);

class StatusProjeto {
  #value;

  constructor(value) {
    if (!StatusProjeto.isValid(value)) {
      throw new Error(
        `StatusProjeto inválido: "${value}". Valores permitidos: ${Object.values(VALID_STATUS_PROJETO).join(', ')}`
      );
    }

    this.#value = value;
    Object.freeze(this);
  }

  get value() {
    return this.#value;
  }

  get isAtivo() {
    return this.#value === VALID_STATUS_PROJETO.ATIVO;
  }

  get isInativo() {
    return this.#value === VALID_STATUS_PROJETO.INATIVO;
  }

  get isEncerrado() {
    return this.#value === VALID_STATUS_PROJETO.ENCERRADO;
  }

  equals(other) {
    if (!(other instanceof StatusProjeto)) {
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
    return Object.values(VALID_STATUS_PROJETO).includes(value);
  }

  /**
   * Mapeia um status bruto do portfólio para ATIVO/INATIVO/ENCERRADO
   * @param {string} rawStatus - Status bruto vindo do portfólio
   * @returns {StatusProjeto}
   */
  static fromPortfolioStatus(rawStatus) {
    const normalized = String(rawStatus || '').toLowerCase().trim();

    if (STATUS_ATIVO.includes(normalized)) {
      return new StatusProjeto(VALID_STATUS_PROJETO.ATIVO);
    }

    if (STATUS_INATIVO.includes(normalized)) {
      return new StatusProjeto(VALID_STATUS_PROJETO.INATIVO);
    }

    return new StatusProjeto(VALID_STATUS_PROJETO.ENCERRADO);
  }

  static get VALID_VALUES() {
    return Object.values(VALID_STATUS_PROJETO);
  }

  static get STATUS() {
    return VALID_STATUS_PROJETO;
  }
}

export { StatusProjeto, VALID_STATUS_PROJETO as StatusProjetoEnum };
