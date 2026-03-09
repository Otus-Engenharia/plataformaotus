const VALID_ORIGENS = Object.freeze({
  CONTRATO: 'Contrato',
  ADITIVO: 'Aditivo',
  REAJUSTE: 'Reajuste',
  OUTRO: 'Outro',
});

const ORIGEM_LABELS = Object.freeze({
  [VALID_ORIGENS.CONTRATO]: 'Contrato',
  [VALID_ORIGENS.ADITIVO]: 'Aditivo',
  [VALID_ORIGENS.REAJUSTE]: 'Reajuste',
  [VALID_ORIGENS.OUTRO]: 'Outro',
});

class OrigemParcela {
  #value;

  constructor(value) {
    if (!value) {
      this.#value = VALID_ORIGENS.CONTRATO;
      Object.freeze(this);
      return;
    }
    const normalized = String(value).trim();
    const match = Object.values(VALID_ORIGENS).find(
      v => v.toLowerCase() === normalized.toLowerCase()
    );
    if (!match) {
      throw new Error(
        `Origem de parcela invalida: "${value}". Valores permitidos: ${Object.values(VALID_ORIGENS).join(', ')}`
      );
    }
    this.#value = match;
    Object.freeze(this);
  }

  get value() { return this.#value; }
  get label() { return ORIGEM_LABELS[this.#value]; }

  equals(other) {
    if (!(other instanceof OrigemParcela)) return false;
    return this.#value === other.value;
  }

  toString() { return this.#value; }
  toJSON() { return this.#value; }

  static isValid(value) {
    return Object.values(VALID_ORIGENS).some(
      v => v.toLowerCase() === String(value).toLowerCase().trim()
    );
  }

  static get VALID_VALUES() { return Object.values(VALID_ORIGENS); }
  static get ORIGENS() { return VALID_ORIGENS; }
}

export { OrigemParcela, VALID_ORIGENS as OrigemParcelaEnum };
