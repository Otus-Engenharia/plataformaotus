const VALID_STATUSES = Object.freeze({
  NAO_VINCULADO: 'nao_vinculado',
  VINCULADO: 'vinculado',
});

const STATUS_LABELS = Object.freeze({
  [VALID_STATUSES.NAO_VINCULADO]: 'Nao Vinculado',
  [VALID_STATUSES.VINCULADO]: 'Vinculado',
});

const STATUS_COLORS = Object.freeze({
  [VALID_STATUSES.NAO_VINCULADO]: '#ff9800',
  [VALID_STATUSES.VINCULADO]: '#2196f3',
});

class StatusProjetos {
  #value;

  constructor(value) {
    const normalized = String(value).toLowerCase().trim();
    if (!StatusProjetos.isValid(normalized)) {
      throw new Error(
        `Status de projetos invalido: "${value}". Valores permitidos: ${Object.values(VALID_STATUSES).join(', ')}`
      );
    }
    this.#value = normalized;
    Object.freeze(this);
  }

  get value() { return this.#value; }
  get label() { return STATUS_LABELS[this.#value]; }
  get color() { return STATUS_COLORS[this.#value]; }
  get isVinculado() { return this.#value === VALID_STATUSES.VINCULADO; }

  equals(other) {
    if (!(other instanceof StatusProjetos)) return false;
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

  static naoVinculado() { return new StatusProjetos(VALID_STATUSES.NAO_VINCULADO); }
  static vinculado() { return new StatusProjetos(VALID_STATUSES.VINCULADO); }
}

export { StatusProjetos, VALID_STATUSES as StatusProjetosEnum };
