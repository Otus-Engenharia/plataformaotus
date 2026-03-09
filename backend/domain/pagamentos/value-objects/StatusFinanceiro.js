const VALID_STATUSES = Object.freeze({
  PENDENTE: 'pendente',
  AGUARDANDO_MEDICAO: 'aguardando_medicao',
  MEDICAO_SOLICITADA: 'medicao_solicitada',
  AGUARDANDO_FATURAMENTO: 'aguardando_faturamento',
  FATURADO: 'faturado',
  AGUARDANDO_RECEBIMENTO: 'aguardando_recebimento',
  RECEBIDO: 'recebido',
});

const STATUS_LABELS = Object.freeze({
  [VALID_STATUSES.PENDENTE]: 'Pendente',
  [VALID_STATUSES.AGUARDANDO_MEDICAO]: 'Aguardando Medicao',
  [VALID_STATUSES.MEDICAO_SOLICITADA]: 'Medicao Solicitada',
  [VALID_STATUSES.AGUARDANDO_FATURAMENTO]: 'Aguardando Faturamento',
  [VALID_STATUSES.FATURADO]: 'Faturado',
  [VALID_STATUSES.AGUARDANDO_RECEBIMENTO]: 'Aguardando Recebimento',
  [VALID_STATUSES.RECEBIDO]: 'Pago',
});

const STATUS_COLORS = Object.freeze({
  [VALID_STATUSES.PENDENTE]: '#9e9e9e',
  [VALID_STATUSES.AGUARDANDO_MEDICAO]: '#ff5722',
  [VALID_STATUSES.MEDICAO_SOLICITADA]: '#9c27b0',
  [VALID_STATUSES.AGUARDANDO_FATURAMENTO]: '#ff9800',
  [VALID_STATUSES.FATURADO]: '#2196f3',
  [VALID_STATUSES.AGUARDANDO_RECEBIMENTO]: '#ffc107',
  [VALID_STATUSES.RECEBIDO]: '#4caf50',
});

const CLOSED_STATUSES = Object.freeze([VALID_STATUSES.RECEBIDO]);

class StatusFinanceiro {
  #value;

  constructor(value) {
    const normalized = String(value).toLowerCase().trim();
    if (!StatusFinanceiro.isValid(normalized)) {
      throw new Error(
        `Status financeiro invalido: "${value}". Valores permitidos: ${Object.values(VALID_STATUSES).join(', ')}`
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

  equals(other) {
    if (!(other instanceof StatusFinanceiro)) return false;
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

  static pendente() { return new StatusFinanceiro(VALID_STATUSES.PENDENTE); }
  static recebido() { return new StatusFinanceiro(VALID_STATUSES.RECEBIDO); }
}

export { StatusFinanceiro, VALID_STATUSES as StatusFinanceiroEnum };
