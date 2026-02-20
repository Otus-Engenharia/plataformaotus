/**
 * Value Object: DisciplineWeight
 * Representa o fator de peso de uma disciplina
 */

class DisciplineWeight {
  #disciplineName;
  #factor;
  #standardDisciplineId;

  constructor(disciplineName, factor, standardDisciplineId = null) {
    if (!disciplineName || typeof disciplineName !== 'string' || disciplineName.trim().length === 0) {
      throw new Error('Nome da disciplina é obrigatório');
    }
    const f = Number(factor);
    if (isNaN(f) || f < 0) {
      throw new Error(`Fator de peso deve ser >= 0. Recebido: ${factor}`);
    }

    this.#disciplineName = disciplineName.trim();
    this.#factor = f;
    this.#standardDisciplineId = standardDisciplineId;
    Object.freeze(this);
  }

  get disciplineName() { return this.#disciplineName; }
  get factor() { return this.#factor; }
  get standardDisciplineId() { return this.#standardDisciplineId; }

  equals(other) {
    return other instanceof DisciplineWeight
      && other.disciplineName === this.#disciplineName
      && other.factor === this.#factor;
  }

  toJSON() {
    return {
      discipline_name: this.#disciplineName,
      weight_factor: this.#factor,
      standard_discipline_id: this.#standardDisciplineId,
    };
  }

  static fromPersistence(data) {
    return new DisciplineWeight(
      data.discipline_name,
      data.weight_factor,
      data.standard_discipline_id || null
    );
  }
}

export { DisciplineWeight };
