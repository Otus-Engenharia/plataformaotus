/**
 * Value Object: Classificacao
 * Representa a classificação de um cliente no Customer Success (A/B/C/D)
 */

const VALID_CLASSIFICACOES = Object.freeze({
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
});

const CLASSIFICACAO_LABELS = Object.freeze({
  [VALID_CLASSIFICACOES.A]: 'Cliente A',
  [VALID_CLASSIFICACOES.B]: 'Cliente B',
  [VALID_CLASSIFICACOES.C]: 'Cliente C',
  [VALID_CLASSIFICACOES.D]: 'Cliente D',
});

class Classificacao {
  #value;

  constructor(value) {
    const normalizedValue = String(value).toUpperCase().trim();

    if (!Classificacao.isValid(normalizedValue)) {
      throw new Error(
        `Classificação inválida: "${value}". Valores permitidos: ${Object.values(VALID_CLASSIFICACOES).join(', ')}`
      );
    }

    this.#value = normalizedValue;
    Object.freeze(this);
  }

  get value() {
    return this.#value;
  }

  get label() {
    return CLASSIFICACAO_LABELS[this.#value];
  }

  equals(other) {
    if (!(other instanceof Classificacao)) {
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
    return Object.values(VALID_CLASSIFICACOES).includes(value);
  }

  static fromString(value) {
    return new Classificacao(value);
  }

  static get VALID_VALUES() {
    return Object.values(VALID_CLASSIFICACOES);
  }

  static get CLASSIFICACOES() {
    return VALID_CLASSIFICACOES;
  }
}

export { Classificacao, VALID_CLASSIFICACOES as ClassificacaoEnum };
