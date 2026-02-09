/**
 * Value Object: DemandaStatus
 * Representa os estados possíveis de uma demanda no ciclo de vida
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
  [VALID_STATUSES.EM_ANALISE]: 'Em Análise',
  [VALID_STATUSES.EM_PROGRESSO]: 'Em Progresso',
  [VALID_STATUSES.AGUARDANDO_INFO]: 'Aguardando Informação',
  [VALID_STATUSES.FINALIZADO]: 'Finalizado',
  [VALID_STATUSES.RECUSADO]: 'Recusado',
});

const CLOSED_STATUSES = Object.freeze([
  VALID_STATUSES.FINALIZADO,
  VALID_STATUSES.RECUSADO,
]);

class DemandaStatus {
  #value;

  constructor(value) {
    const normalizedValue = String(value).toLowerCase().trim();

    if (!DemandaStatus.isValid(normalizedValue)) {
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

  get isInProgress() {
    return this.#value === VALID_STATUSES.EM_PROGRESSO;
  }

  equals(other) {
    if (!(other instanceof DemandaStatus)) {
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
    return new DemandaStatus(value);
  }

  static get VALID_VALUES() {
    return Object.values(VALID_STATUSES);
  }

  static get STATUSES() {
    return VALID_STATUSES;
  }

  static pendente() {
    return new DemandaStatus(VALID_STATUSES.PENDENTE);
  }

  static emAnalise() {
    return new DemandaStatus(VALID_STATUSES.EM_ANALISE);
  }

  static emProgresso() {
    return new DemandaStatus(VALID_STATUSES.EM_PROGRESSO);
  }

  static finalizado() {
    return new DemandaStatus(VALID_STATUSES.FINALIZADO);
  }

  static recusado() {
    return new DemandaStatus(VALID_STATUSES.RECUSADO);
  }
}

export { DemandaStatus, VALID_STATUSES as DemandaStatusEnum };
