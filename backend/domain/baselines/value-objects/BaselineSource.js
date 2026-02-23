/**
 * Value Object: BaselineSource
 * Identifica a origem de uma baseline: plataforma ou SmartSheet.
 */

const VALID_SOURCES = Object.freeze({
  PLATFORM: 'platform',
  SMARTSHEET: 'smartsheet',
});

class BaselineSource {
  #value;

  constructor(value) {
    const normalized = String(value || '').toLowerCase().trim();
    if (!Object.values(VALID_SOURCES).includes(normalized)) {
      throw new Error(`Fonte de baseline inválida: ${value}. Válidas: ${Object.values(VALID_SOURCES).join(', ')}`);
    }
    this.#value = normalized;
    Object.freeze(this);
  }

  get value() { return this.#value; }
  get isPlatform() { return this.#value === VALID_SOURCES.PLATFORM; }
  get isSmartsheet() { return this.#value === VALID_SOURCES.SMARTSHEET; }

  equals(other) {
    return other instanceof BaselineSource && other.value === this.#value;
  }

  toString() { return this.#value; }

  static platform() { return new BaselineSource(VALID_SOURCES.PLATFORM); }
  static smartsheet() { return new BaselineSource(VALID_SOURCES.SMARTSHEET); }
  static get VALID_VALUES() { return Object.values(VALID_SOURCES); }
}

export { BaselineSource };
