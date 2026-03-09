/**
 * Value Object: ChangeCategory
 * Categorias de mudança detectadas em pastas IFC
 */

const VALID_CATEGORIES = Object.freeze({
  NOVA_REVISAO: 'nova_revisao',
  MUDANCA_FASE: 'mudanca_fase',
  NOVO_ARQUIVO: 'novo_arquivo',
});

const CATEGORY_LABELS = Object.freeze({
  [VALID_CATEGORIES.NOVA_REVISAO]: 'Nova Revisão',
  [VALID_CATEGORIES.MUDANCA_FASE]: 'Mudança de Fase',
  [VALID_CATEGORIES.NOVO_ARQUIVO]: 'Novo Arquivo',
});

const CATEGORY_COLORS = Object.freeze({
  [VALID_CATEGORIES.NOVA_REVISAO]: '#22c55e',
  [VALID_CATEGORIES.MUDANCA_FASE]: '#3b82f6',
  [VALID_CATEGORIES.NOVO_ARQUIVO]: '#a855f7',
});

class ChangeCategory {
  #value;

  constructor(value) {
    const normalized = String(value).toLowerCase().trim();

    if (!ChangeCategory.isValid(normalized)) {
      throw new Error(
        `Categoria inválida: "${value}". Valores permitidos: ${Object.values(VALID_CATEGORIES).join(', ')}`
      );
    }

    this.#value = normalized;
    Object.freeze(this);
  }

  get value() { return this.#value; }
  get label() { return CATEGORY_LABELS[this.#value]; }
  get color() { return CATEGORY_COLORS[this.#value]; }

  equals(other) {
    if (!(other instanceof ChangeCategory)) return false;
    return this.#value === other.value;
  }

  toString() { return this.#value; }
  toJSON() { return this.#value; }

  static isValid(value) {
    return Object.values(VALID_CATEGORIES).includes(value);
  }

  static get VALID_VALUES() { return Object.values(VALID_CATEGORIES); }
  static get CATEGORIES() { return VALID_CATEGORIES; }
}

export { ChangeCategory, VALID_CATEGORIES as ChangeCategoryEnum };
