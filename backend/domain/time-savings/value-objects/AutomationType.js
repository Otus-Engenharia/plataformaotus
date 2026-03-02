/**
 * Value Object: AutomationType
 * Representa os tipos de automação rastreados para economia de horas
 */

const VALID_TYPES = Object.freeze({
  WEEKLY_REPORT_GENERATION: 'weekly_report_generation',
  COBRANCA_GMAIL_DRAFT: 'cobranca_gmail_draft',
  COBRANCA_MARK_DONE: 'cobranca_mark_done',
  BASELINE_REQUEST_SUBMIT: 'baseline_request_submit',
  BASELINE_APPROVAL: 'baseline_approval',
  RECURRING_TASK_MATERIALIZATION: 'recurring_task_materialization',
  PORTFOLIO_FIELD_UPDATE: 'portfolio_field_update',
  FEEDBACK_SUBMISSION: 'feedback_submission',
  DEMANDA_SUBMISSION: 'demanda_submission',
});

const TYPE_LABELS = Object.freeze({
  [VALID_TYPES.WEEKLY_REPORT_GENERATION]: 'Geração de Relatório Semanal',
  [VALID_TYPES.COBRANCA_GMAIL_DRAFT]: 'Cobrança via Gmail',
  [VALID_TYPES.COBRANCA_MARK_DONE]: 'Marcar Cobrança Feita',
  [VALID_TYPES.BASELINE_REQUEST_SUBMIT]: 'Solicitar Baseline',
  [VALID_TYPES.BASELINE_APPROVAL]: 'Aprovar Baseline',
  [VALID_TYPES.RECURRING_TASK_MATERIALIZATION]: 'Materializar Tarefas Recorrentes',
  [VALID_TYPES.PORTFOLIO_FIELD_UPDATE]: 'Atualizar Campo do Portfólio',
  [VALID_TYPES.FEEDBACK_SUBMISSION]: 'Enviar Feedback',
  [VALID_TYPES.DEMANDA_SUBMISSION]: 'Enviar Demanda',
});

class AutomationType {
  #value;

  constructor(value) {
    const normalizedValue = String(value).toLowerCase().trim();

    if (!AutomationType.isValid(normalizedValue)) {
      throw new Error(
        `Tipo de automação inválido: "${value}". Valores permitidos: ${Object.values(VALID_TYPES).join(', ')}`
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
    if (!(other instanceof AutomationType)) {
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
    return new AutomationType(value);
  }

  static get VALID_VALUES() {
    return Object.values(VALID_TYPES);
  }

  static get TYPES() {
    return VALID_TYPES;
  }
}

export { AutomationType, VALID_TYPES as AutomationTypeEnum };
