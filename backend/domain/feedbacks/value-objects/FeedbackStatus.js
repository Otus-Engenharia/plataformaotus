/**
 * Value Object: FeedbackStatus
 * Representa os estados possíveis de um feedback no ciclo de vida
 */

const VALID_STATUSES = Object.freeze({
  PENDENTE: 'pendente',
  EM_ANALISE: 'em_analise',
  BACKLOG_DESENVOLVIMENTO: 'backlog_desenvolvimento',
  BACKLOG_TREINAMENTO: 'backlog_treinamento',
  ANALISE_FUNCIONALIDADE: 'analise_funcionalidade',
  FINALIZADO: 'finalizado',
  RECUSADO: 'recusado',
});

const STATUS_LABELS = Object.freeze({
  [VALID_STATUSES.PENDENTE]: 'Pendente',
  [VALID_STATUSES.EM_ANALISE]: 'Em Análise',
  [VALID_STATUSES.BACKLOG_DESENVOLVIMENTO]: 'Backlog Desenvolvimento',
  [VALID_STATUSES.BACKLOG_TREINAMENTO]: 'Backlog Treinamento',
  [VALID_STATUSES.ANALISE_FUNCIONALIDADE]: 'Análise de Funcionalidade',
  [VALID_STATUSES.FINALIZADO]: 'Finalizado',
  [VALID_STATUSES.RECUSADO]: 'Recusado',
});

// Status que indicam que o feedback está fechado
const CLOSED_STATUSES = Object.freeze([
  VALID_STATUSES.FINALIZADO,
  VALID_STATUSES.RECUSADO,
]);

class FeedbackStatus {
  #value;

  constructor(value) {
    const normalizedValue = String(value).toLowerCase().trim();

    if (!FeedbackStatus.isValid(normalizedValue)) {
      throw new Error(
        `Status inválido: "${value}". Valores permitidos: ${Object.values(VALID_STATUSES).join(', ')}`
      );
    }

    this.#value = normalizedValue;
    Object.freeze(this);
  }

  get value() {
    return this.#value;
  }

  get label() {
    return STATUS_LABELS[this.#value];
  }

  get isClosed() {
    return CLOSED_STATUSES.includes(this.#value);
  }

  get isOpen() {
    return !this.isClosed;
  }

  get isPending() {
    return this.#value === VALID_STATUSES.PENDENTE;
  }

  equals(other) {
    if (!(other instanceof FeedbackStatus)) {
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
    return Object.values(VALID_STATUSES).includes(value);
  }

  static fromString(value) {
    return new FeedbackStatus(value);
  }

  static get VALID_VALUES() {
    return Object.values(VALID_STATUSES);
  }

  static get STATUSES() {
    return VALID_STATUSES;
  }

  // Factory methods para status comuns
  static pendente() {
    return new FeedbackStatus(VALID_STATUSES.PENDENTE);
  }

  static emAnalise() {
    return new FeedbackStatus(VALID_STATUSES.EM_ANALISE);
  }

  static finalizado() {
    return new FeedbackStatus(VALID_STATUSES.FINALIZADO);
  }

  static recusado() {
    return new FeedbackStatus(VALID_STATUSES.RECUSADO);
  }
}

export { FeedbackStatus, VALID_STATUSES as FeedbackStatusEnum };
