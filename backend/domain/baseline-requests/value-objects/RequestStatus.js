/**
 * Value Object: RequestStatus
 * Status de uma solicitação de baseline: pendente, aprovada ou rejeitada.
 */

const VALID_STATUSES = Object.freeze({
  PENDENTE: 'pendente',
  APROVADA: 'aprovada',
  REJEITADA: 'rejeitada',
});

class RequestStatus {
  #value;

  constructor(value) {
    const normalized = String(value || '').toLowerCase().trim();
    if (!Object.values(VALID_STATUSES).includes(normalized)) {
      throw new Error(`Status de solicitação inválido: ${value}. Válidos: ${Object.values(VALID_STATUSES).join(', ')}`);
    }
    this.#value = normalized;
    Object.freeze(this);
  }

  get value() { return this.#value; }
  get isPendente() { return this.#value === VALID_STATUSES.PENDENTE; }
  get isAprovada() { return this.#value === VALID_STATUSES.APROVADA; }
  get isRejeitada() { return this.#value === VALID_STATUSES.REJEITADA; }
  get isResolved() { return this.isAprovada || this.isRejeitada; }

  equals(other) {
    return other instanceof RequestStatus && other.value === this.#value;
  }

  toString() { return this.#value; }

  static pendente() { return new RequestStatus(VALID_STATUSES.PENDENTE); }
  static aprovada() { return new RequestStatus(VALID_STATUSES.APROVADA); }
  static rejeitada() { return new RequestStatus(VALID_STATUSES.REJEITADA); }
  static get VALID_VALUES() { return Object.values(VALID_STATUSES); }
}

export { RequestStatus };
