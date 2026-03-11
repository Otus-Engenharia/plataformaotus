/**
 * Value Object: PeriodoReferencia
 * Representa um mês/ano de referência. Imutável.
 */

class PeriodoReferencia {
  #mes;
  #ano;

  constructor(mes, ano) {
    const m = Number(mes);
    const a = Number(ano);

    if (!Number.isInteger(m) || m < 1 || m > 12) {
      throw new Error(`Mês inválido: "${mes}". Deve ser entre 1 e 12.`);
    }
    if (!Number.isInteger(a) || a < 2020 || a > 2099) {
      throw new Error(`Ano inválido: "${ano}". Deve ser entre 2020 e 2099.`);
    }

    this.#mes = m;
    this.#ano = a;
    Object.freeze(this);
  }

  get mes() {
    return this.#mes;
  }

  get ano() {
    return this.#ano;
  }

  /** "05/2025" */
  get label() {
    return `${String(this.#mes).padStart(2, '0')}/${this.#ano}`;
  }

  /** "2025-05" — útil para ordenação e agrupamento */
  get key() {
    return `${this.#ano}-${String(this.#mes).padStart(2, '0')}`;
  }

  equals(other) {
    if (!(other instanceof PeriodoReferencia)) return false;
    return this.#mes === other.mes && this.#ano === other.ano;
  }

  /** Retorna negativo se this < other, positivo se >, 0 se igual */
  compareTo(other) {
    if (this.#ano !== other.ano) return this.#ano - other.ano;
    return this.#mes - other.mes;
  }

  isBefore(other) {
    return this.compareTo(other) < 0;
  }

  isAfter(other) {
    return this.compareTo(other) > 0;
  }

  toString() {
    return this.label;
  }

  toJSON() {
    return { mes: this.#mes, ano: this.#ano };
  }
}

export { PeriodoReferencia };
