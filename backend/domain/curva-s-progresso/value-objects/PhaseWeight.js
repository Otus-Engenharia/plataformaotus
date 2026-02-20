/**
 * Value Object: PhaseWeight
 * Representa o peso de uma fase de projeto (nome + percentual)
 */

class PhaseWeight {
  #phaseName;
  #percent;
  #sortOrder;

  constructor(phaseName, percent, sortOrder = 0) {
    if (!phaseName || typeof phaseName !== 'string' || phaseName.trim().length === 0) {
      throw new Error('Nome da fase é obrigatório');
    }
    const p = Number(percent);
    if (isNaN(p) || p < 0 || p > 100) {
      throw new Error(`Peso da fase deve estar entre 0 e 100. Recebido: ${percent}`);
    }

    this.#phaseName = phaseName.trim();
    this.#percent = p;
    this.#sortOrder = Number(sortOrder) || 0;
    Object.freeze(this);
  }

  get phaseName() { return this.#phaseName; }
  get percent() { return this.#percent; }
  get sortOrder() { return this.#sortOrder; }

  equals(other) {
    return other instanceof PhaseWeight
      && other.phaseName === this.#phaseName
      && other.percent === this.#percent;
  }

  toJSON() {
    return {
      phase_name: this.#phaseName,
      weight_percent: this.#percent,
      sort_order: this.#sortOrder,
    };
  }

  static fromPersistence(data) {
    return new PhaseWeight(
      data.phase_name,
      data.weight_percent,
      data.sort_order
    );
  }
}

export { PhaseWeight };
