/**
 * Value Object: RelatoTipo
 * Representa o tipo/categoria de um relato.
 * Valores válidos são carregados do banco (admin-configurável).
 */

class RelatoTipo {
  #slug;
  #label;
  #color;

  constructor(slug, label = null, color = null) {
    if (!slug || String(slug).trim().length === 0) {
      throw new Error('Tipo do relato é obrigatório');
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
    if (!(other instanceof RelatoTipo)) return false;
    return this.#slug === other.slug;
  }

  toString() { return this.#slug; }
  toJSON() { return this.#slug; }

  static fromString(slug) {
    return new RelatoTipo(slug);
  }
}

export { RelatoTipo };
