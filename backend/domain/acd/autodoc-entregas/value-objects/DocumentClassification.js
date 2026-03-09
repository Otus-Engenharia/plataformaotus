/**
 * Value Object: DocumentClassification
 * Classificacao de documentos Autodoc entregues
 */

const VALID_CLASSIFICATIONS = Object.freeze({
  NOVO_ARQUIVO: 'novo_arquivo',
  NOVA_REVISAO: 'nova_revisao',
  MUDANCA_FASE: 'mudanca_fase',
});

const CLASSIFICATION_LABELS = Object.freeze({
  [VALID_CLASSIFICATIONS.NOVO_ARQUIVO]: 'Novo Arquivo',
  [VALID_CLASSIFICATIONS.NOVA_REVISAO]: 'Nova Revisao',
  [VALID_CLASSIFICATIONS.MUDANCA_FASE]: 'Mudanca de Fase',
});

const CLASSIFICATION_COLORS = Object.freeze({
  [VALID_CLASSIFICATIONS.NOVO_ARQUIVO]: '#22c55e',
  [VALID_CLASSIFICATIONS.NOVA_REVISAO]: '#3b82f6',
  [VALID_CLASSIFICATIONS.MUDANCA_FASE]: '#a855f7',
});

class DocumentClassification {
  #value;

  constructor(value) {
    const normalized = String(value).toLowerCase().trim();

    if (!DocumentClassification.isValid(normalized)) {
      throw new Error(
        `Classificacao invalida: "${value}". Valores permitidos: ${Object.values(VALID_CLASSIFICATIONS).join(', ')}`
      );
    }

    this.#value = normalized;
    Object.freeze(this);
  }

  get value() { return this.#value; }
  get label() { return CLASSIFICATION_LABELS[this.#value]; }
  get color() { return CLASSIFICATION_COLORS[this.#value]; }

  equals(other) {
    if (!(other instanceof DocumentClassification)) return false;
    return this.#value === other.value;
  }

  toString() { return this.#value; }
  toJSON() { return this.#value; }

  static isValid(value) {
    return Object.values(VALID_CLASSIFICATIONS).includes(value);
  }

  static get VALID_VALUES() { return Object.values(VALID_CLASSIFICATIONS); }
  static get CLASSIFICATIONS() { return VALID_CLASSIFICATIONS; }
}

export { DocumentClassification, VALID_CLASSIFICATIONS as DocumentClassificationEnum };
