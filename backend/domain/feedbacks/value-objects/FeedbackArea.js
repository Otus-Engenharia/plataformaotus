/**
 * Value Object: FeedbackArea
 * Representa a área da plataforma onde o feedback foi registrado
 */

const VALID_AREAS = Object.freeze({
  PROJETOS: 'projetos',
  LIDERES: 'lideres',
  CS: 'cs',
  APOIO: 'apoio',
  ADMIN_FINANCEIRO: 'admin_financeiro',
  VENDAS: 'vendas',
  WORKSPACE: 'workspace',
  VISTA_CLIENTE: 'vista_cliente',
  INDICADORES: 'indicadores',
  OKRS: 'okrs',
  CONFIGURACOES: 'configuracoes',
});

const AREA_LABELS = Object.freeze({
  [VALID_AREAS.PROJETOS]: 'Projetos',
  [VALID_AREAS.LIDERES]: 'Líderes de Projeto',
  [VALID_AREAS.CS]: 'CS',
  [VALID_AREAS.APOIO]: 'Apoio de Projetos',
  [VALID_AREAS.ADMIN_FINANCEIRO]: 'Admin & Financeiro',
  [VALID_AREAS.VENDAS]: 'Vendas',
  [VALID_AREAS.WORKSPACE]: 'Workspace',
  [VALID_AREAS.VISTA_CLIENTE]: 'Vista do Cliente',
  [VALID_AREAS.INDICADORES]: 'Indicadores',
  [VALID_AREAS.OKRS]: 'OKRs',
  [VALID_AREAS.CONFIGURACOES]: 'Configurações',
});

class FeedbackArea {
  #value;

  constructor(value) {
    // Permitir null para feedbacks legados sem área
    if (value === null || value === undefined) {
      this.#value = null;
      Object.freeze(this);
      return;
    }

    const normalizedValue = String(value).toLowerCase().trim();

    if (!FeedbackArea.isValid(normalizedValue)) {
      throw new Error(
        `Área inválida: "${value}". Valores permitidos: ${Object.values(VALID_AREAS).join(', ')}`
      );
    }

    this.#value = normalizedValue;
    Object.freeze(this);
  }

  get value() {
    return this.#value;
  }

  get label() {
    return this.#value ? AREA_LABELS[this.#value] : null;
  }

  get isNull() {
    return this.#value === null;
  }

  equals(other) {
    if (!(other instanceof FeedbackArea)) {
      return false;
    }
    return this.#value === other.value;
  }

  toString() {
    return this.#value || '';
  }

  toJSON() {
    return this.#value;
  }

  static isValid(value) {
    return Object.values(VALID_AREAS).includes(value);
  }

  static fromString(value) {
    return new FeedbackArea(value);
  }

  static nullable() {
    return new FeedbackArea(null);
  }

  static get VALID_VALUES() {
    return Object.values(VALID_AREAS);
  }

  static get AREAS() {
    return VALID_AREAS;
  }
}

export { FeedbackArea, VALID_AREAS as FeedbackAreaEnum };
