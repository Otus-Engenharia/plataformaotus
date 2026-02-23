/**
 * Value Object: RelatoPrioridade
 * Representa a prioridade de um relato.
 * Valores válidos são carregados do banco (admin-configurável).
 */

class RelatoPrioridade {
  #slug;
  #label;
  #color;

  constructor(slug, label = null, color = null) {
    if (!slug || String(slug).trim().length === 0) {
      throw new Error('Prioridade do relato é obrigatória');
    }

    this.#slug = String(slug).toLowerCase().trim();
    this.#label = label || this.#slug;
    this.#color = color || '#6B7280';
    Object.freeze(this);
  }

  get slug() { return this.#slug; }
  get value() { return this.#slug; }
  get label() { return this.#label; }
  get color() { return this.#color; }

  equals(other) {
    if (!(other instanceof RelatoPrioridade)) return false;
    return this.#slug === other.slug;
  }

  toString() { return this.#slug; }
  toJSON() { return this.#slug; }

  static fromString(slug) {
    return new RelatoPrioridade(slug);
  }
}

export { RelatoPrioridade };
