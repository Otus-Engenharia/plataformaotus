const VALID_STATUSES = Object.freeze({
  PENDENTE: 'pendente',
  FATURADO: 'faturado',
});

const STATUS_LABELS = Object.freeze({
  [VALID_STATUSES.PENDENTE]: 'Pendente',
  [VALID_STATUSES.FATURADO]: 'Faturado',
});

const STATUS_COLORS = Object.freeze({
  [VALID_STATUSES.PENDENTE]: '#9e9e9e',
  [VALID_STATUSES.FATURADO]: '#4caf50',
});

const CLOSED_STATUSES = Object.freeze([VALID_STATUSES.FATURADO]);

// Map old statuses to new ones for backward compatibility
const LEGACY_STATUS_MAP = Object.freeze({
  recebido: 'faturado',
  aguardando_medicao: 'pendente',
  medicao_solicitada: 'pendente',
  aguardando_faturamento: 'pendente',
  aguardando_recebimento: 'pendente',
});

class StatusFinanceiro {
  #value;

  constructor(value) {
    let normalized = String(value).toLowerCase().trim();
    // Map legacy statuses
    if (LEGACY_STATUS_MAP[normalized]) {
      normalized = LEGACY_STATUS_MAP[normalized];
    }
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
  static faturado() { return new StatusFinanceiro(VALID_STATUSES.FATURADO); }
}

export { StatusFinanceiro, VALID_STATUSES as StatusFinanceiroEnum };
