/**
 * Value Object: EstudoCustoStatus
 * Representa os estados possiveis de uma solicitacao de estudo de custos
 */

const VALID_STATUSES = Object.freeze({
  PENDENTE: 'pendente',
  EM_ANALISE: 'em_analise',
  EM_PROGRESSO: 'em_progresso',
  AGUARDANDO_INFO: 'aguardando_info',
  FINALIZADO: 'finalizado',
  RECUSADO: 'recusado',
});

const STATUS_LABELS = Object.freeze({
  [VALID_STATUSES.PENDENTE]: 'Pendente',
  [VALID_STATUSES.EM_ANALISE]: 'Em Analise',
  [VALID_STATUSES.EM_PROGRESSO]: 'Em Progresso',
  [VALID_STATUSES.AGUARDANDO_INFO]: 'Aguardando Informacao',
  [VALID_STATUSES.FINALIZADO]: 'Finalizado',
  [VALID_STATUSES.RECUSADO]: 'Recusado',
});

const CLOSED_STATUSES = Object.freeze([
  VALID_STATUSES.FINALIZADO,
  VALID_STATUSES.RECUSADO,
]);

class EstudoCustoStatus {
  #value;

  constructor(value) {
    const normalizedValue = String(value).toLowerCase().trim();

    if (!EstudoCustoStatus.isValid(normalizedValue)) {
      throw new Error(
        `Status invalido: "${value}". Valores permitidos: ${Object.values(VALID_STATUSES).join(', ')}`
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

  get isInProgress() {
    return this.#value === VALID_STATUSES.EM_PROGRESSO;
  }

  equals(other) {
    if (!(other instanceof EstudoCustoStatus)) {
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
    return new EstudoCustoStatus(value);
  }

  static get VALID_VALUES() {
    return Object.values(VALID_STATUSES);
  }

  static get STATUSES() {
    return VALID_STATUSES;
  }

  static pendente() {
    return new EstudoCustoStatus(VALID_STATUSES.PENDENTE);
  }

  static emAnalise() {
    return new EstudoCustoStatus(VALID_STATUSES.EM_ANALISE);
  }

  static emProgresso() {
    return new EstudoCustoStatus(VALID_STATUSES.EM_PROGRESSO);
  }

  static finalizado() {
    return new EstudoCustoStatus(VALID_STATUSES.FINALIZADO);
  }

  static recusado() {
    return new EstudoCustoStatus(VALID_STATUSES.RECUSADO);
  }
}

export { EstudoCustoStatus, VALID_STATUSES as EstudoCustoStatusEnum };
