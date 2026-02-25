/**
 * Value Object: PlataformaComunicacao
 * Representa a plataforma de comunicação utilizada no projeto
 */

const VALID_TYPES = Object.freeze({
  CONSTRUFLOW: 'construflow',
  BIM360: 'bim360',
  BIMCOLLAB: 'bimcollab',
  TRIMBLE_CONNECT: 'trimble_connect',
  EXCEL: 'excel',
  CONSTRUCODE: 'construcode',
  QICLOUD: 'qicloud',
  OUTROS: 'outros',
});

const TYPE_LABELS = Object.freeze({
  [VALID_TYPES.CONSTRUFLOW]: 'Construflow',
  [VALID_TYPES.BIM360]: 'BIM360',
  [VALID_TYPES.BIMCOLLAB]: 'BIMCollab',
  [VALID_TYPES.TRIMBLE_CONNECT]: 'Trimble Connect',
  [VALID_TYPES.EXCEL]: 'Excel',
  [VALID_TYPES.CONSTRUCODE]: 'Construcode',
  [VALID_TYPES.QICLOUD]: 'QICloud',
  [VALID_TYPES.OUTROS]: 'Outros',
});

class PlataformaComunicacao {
  #value;

  constructor(value) {
    const normalizedValue = String(value).toLowerCase().trim();

    if (!PlataformaComunicacao.isValid(normalizedValue)) {
      throw new Error(
        `Plataforma de comunicação inválida: "${value}". Valores permitidos: ${Object.values(VALID_TYPES).join(', ')}`
      );
    }

    this.#value = normalizedValue;
    Object.freeze(this);
  }

  get value() {
    return this.#value;
  }

  get label() {
    return TYPE_LABELS[this.#value];
  }

  equals(other) {
    if (!(other instanceof PlataformaComunicacao)) return false;
    return this.#value === other.value;
  }

  toString() {
    return this.#value;
  }

  toJSON() {
    return this.#value;
  }

  static isValid(value) {
    return Object.values(VALID_TYPES).includes(value);
  }

  static get VALID_VALUES() {
    return Object.values(VALID_TYPES);
  }

  static allOptions() {
    return Object.values(VALID_TYPES).map(v => ({ value: v, label: TYPE_LABELS[v] }));
  }
}

export { PlataformaComunicacao, VALID_TYPES as PlataformaComunicacaoEnum };
