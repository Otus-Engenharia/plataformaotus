// @deprecated Use StatusProjetos and StatusFinanceiro instead.
// Kept for backward compatibility with change log entries.
const VALID_STATUSES = Object.freeze({
  NAO_FINALIZADO: 'nao_finalizado',
  AGUARDANDO_VINCULACAO: 'aguardando_vinculacao',
  VINCULADO: 'vinculado',
  AGUARDANDO_MEDICAO: 'aguardando_medicao',
  MEDICAO_SOLICITADA: 'medicao_solicitada',
  AGUARDANDO_RECEBIMENTO: 'aguardando_recebimento',
  RECEBIDO: 'recebido',
});

const STATUS_LABELS = Object.freeze({
  [VALID_STATUSES.NAO_FINALIZADO]: 'Nao Finalizado',
  [VALID_STATUSES.AGUARDANDO_VINCULACAO]: 'Aguardando Vinculacao',
  [VALID_STATUSES.VINCULADO]: 'Vinculado',
  [VALID_STATUSES.AGUARDANDO_MEDICAO]: 'Aguardando Medicao',
  [VALID_STATUSES.MEDICAO_SOLICITADA]: 'Medicao Solicitada',
  [VALID_STATUSES.AGUARDANDO_RECEBIMENTO]: 'Aguardando Recebimento',
  [VALID_STATUSES.RECEBIDO]: 'Pago',
});

const STATUS_COLORS = Object.freeze({
  [VALID_STATUSES.NAO_FINALIZADO]: '#9e9e9e',
  [VALID_STATUSES.AGUARDANDO_VINCULACAO]: '#ff9800',
  [VALID_STATUSES.VINCULADO]: '#2196f3',
  [VALID_STATUSES.AGUARDANDO_MEDICAO]: '#ff5722',
  [VALID_STATUSES.MEDICAO_SOLICITADA]: '#9c27b0',
  [VALID_STATUSES.AGUARDANDO_RECEBIMENTO]: '#ffc107',
  [VALID_STATUSES.RECEBIDO]: '#4caf50',
});

const CLOSED_STATUSES = Object.freeze([VALID_STATUSES.RECEBIDO]);

class StatusParcela {
  #value;

  constructor(value) {
    const normalized = String(value).toLowerCase().trim();
    if (!StatusParcela.isValid(normalized)) {
      throw new Error(
        `Status de parcela invalido: "${value}". Valores permitidos: ${Object.values(VALID_STATUSES).join(', ')}`
      );
    }
    this.#value = normalized;
    Object.freeze(this);
  }

  get value() { return this.#value; }
  get label() { return STATUS_LABELS[this.#value]; }
  get color() { return STATUS_COLORS[this.#value]; }
  get isClosed() { return CLOSED_STATUSES.includes(this.#value); }
  get isOpen() { return !this.isClosed; }
  get isPendingVinculacao() { return this.#value === VALID_STATUSES.AGUARDANDO_VINCULACAO; }
  get isVinculado() { return this.#value === VALID_STATUSES.VINCULADO; }

  equals(other) {
    if (!(other instanceof StatusParcela)) return false;
    return this.#value === other.value;
  }

  toString() { return this.#value; }
  toJSON() { return this.#value; }

  static isValid(value) {
    return Object.values(VALID_STATUSES).includes(value);
  }

  static get VALID_VALUES() { return Object.values(VALID_STATUSES); }
  static get STATUSES() { return VALID_STATUSES; }
  static get LABELS() { return STATUS_LABELS; }
  static get COLORS() { return STATUS_COLORS; }

  static naoFinalizado() { return new StatusParcela(VALID_STATUSES.NAO_FINALIZADO); }
  static aguardandoVinculacao() { return new StatusParcela(VALID_STATUSES.AGUARDANDO_VINCULACAO); }
  static vinculado() { return new StatusParcela(VALID_STATUSES.VINCULADO); }
  static recebido() { return new StatusParcela(VALID_STATUSES.RECEBIDO); }
}

export { StatusParcela, VALID_STATUSES as StatusParcelaEnum };
