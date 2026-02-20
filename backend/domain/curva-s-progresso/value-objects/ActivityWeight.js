/**
 * Value Object: ActivityWeight
 * Representa o fator de peso de um tipo de etapa (atividade)
 */

class ActivityWeight {
  #activityType;
  #factor;

  constructor(activityType, factor) {
    if (!activityType || typeof activityType !== 'string' || activityType.trim().length === 0) {
      throw new Error('Tipo de atividade é obrigatório');
    }
    const f = Number(factor);
    if (isNaN(f) || f < 0) {
      throw new Error(`Fator de peso deve ser >= 0. Recebido: ${factor}`);
    }

    this.#activityType = activityType.trim();
    this.#factor = f;
    Object.freeze(this);
  }

  get activityType() { return this.#activityType; }
  get factor() { return this.#factor; }

  equals(other) {
    return other instanceof ActivityWeight
      && other.activityType === this.#activityType
      && other.factor === this.#factor;
  }

  toJSON() {
    return {
      activity_type: this.#activityType,
      weight_factor: this.#factor,
    };
  }

  static fromPersistence(data) {
    return new ActivityWeight(
      data.activity_type,
      data.weight_factor
    );
  }
}

export { ActivityWeight };
