/**
 * Value Object: FeedbackType
 * Representa os tipos de feedback que podem ser registrados
 */

const VALID_TYPES = Object.freeze({
  BUG: 'bug',
  FEEDBACK_PROCESSO: 'feedback_processo',
  FEEDBACK_PLATAFORMA: 'feedback_plataforma',
  ERRO: 'erro',
  OUTRO: 'outro',
});

const TYPE_LABELS = Object.freeze({
  [VALID_TYPES.BUG]: 'Bug',
  [VALID_TYPES.FEEDBACK_PROCESSO]: 'Feedback de Processo',
  [VALID_TYPES.FEEDBACK_PLATAFORMA]: 'Feedback da Plataforma',
  [VALID_TYPES.ERRO]: 'Erro',
  [VALID_TYPES.OUTRO]: 'Outro',
});

const TYPE_ICONS = Object.freeze({
  [VALID_TYPES.BUG]: '🐛',
  [VALID_TYPES.FEEDBACK_PROCESSO]: '⚙️',
  [VALID_TYPES.FEEDBACK_PLATAFORMA]: '💻',
  [VALID_TYPES.ERRO]: '❌',
  [VALID_TYPES.OUTRO]: '📝',
});

// Tipos que indicam problemas técnicos (para priorização)
const TECHNICAL_TYPES = Object.freeze([
  VALID_TYPES.BUG,
  VALID_TYPES.ERRO,
]);

class FeedbackType {
  #value;

  constructor(value) {
    const normalizedValue = String(value).toLowerCase().trim();

    if (!FeedbackType.isValid(normalizedValue)) {
      throw new Error(
        `Tipo inválido: "${value}". Valores permitidos: ${Object.values(VALID_TYPES).join(', ')}`
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

  get icon() {
    return TYPE_ICONS[this.#value];
  }

  get isTechnical() {
    return TECHNICAL_TYPES.includes(this.#value);
  }

  get isBug() {
    return this.#value === VALID_TYPES.BUG;
  }

  equals(other) {
    if (!(other instanceof FeedbackType)) {
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
    return Object.values(VALID_TYPES).includes(value);
  }

  static fromString(value) {
    return new FeedbackType(value);
  }

  static get VALID_VALUES() {
    return Object.values(VALID_TYPES);
  }

  static get TYPES() {
    return VALID_TYPES;
  }

  // Factory methods
  static bug() {
    return new FeedbackType(VALID_TYPES.BUG);
  }

  static feedbackProcesso() {
    return new FeedbackType(VALID_TYPES.FEEDBACK_PROCESSO);
  }

  static feedbackPlataforma() {
    return new FeedbackType(VALID_TYPES.FEEDBACK_PLATAFORMA);
  }

  static erro() {
    return new FeedbackType(VALID_TYPES.ERRO);
  }

  static outro() {
    return new FeedbackType(VALID_TYPES.OUTRO);
  }
}

export { FeedbackType, VALID_TYPES as FeedbackTypeEnum };
