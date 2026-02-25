/**
 * Value Object: PlataformaACD
 * Representa o repositório de arquivos (ACD) utilizado no projeto
 */

const VALID_TYPES = Object.freeze({
  GOOGLE_DRIVE: 'google_drive',
  BIM360: 'bim360',
  AUTODOC: 'autodoc',
  CONSTRUCODE: 'construcode',
  ONEDRIVE: 'onedrive',
  QICLOUD: 'qicloud',
  CONSTRUMANAGER: 'construmanager',
  DROPBOX: 'dropbox',
  OUTROS: 'outros',
});

const TYPE_LABELS = Object.freeze({
  [VALID_TYPES.GOOGLE_DRIVE]: 'Google Drive',
  [VALID_TYPES.BIM360]: 'BIM360',
  [VALID_TYPES.AUTODOC]: 'Autodoc',
  [VALID_TYPES.CONSTRUCODE]: 'Construcode',
  [VALID_TYPES.ONEDRIVE]: 'OneDrive',
  [VALID_TYPES.QICLOUD]: 'QICloud',
  [VALID_TYPES.CONSTRUMANAGER]: 'Construmanager',
  [VALID_TYPES.DROPBOX]: 'DropBox',
  [VALID_TYPES.OUTROS]: 'Outros',
});

class PlataformaACD {
  #value;

  constructor(value) {
    const normalizedValue = String(value).toLowerCase().trim();

    if (!PlataformaACD.isValid(normalizedValue)) {
      throw new Error(
        `Plataforma ACD inválida: "${value}". Valores permitidos: ${Object.values(VALID_TYPES).join(', ')}`
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
    if (!(other instanceof PlataformaACD)) return false;
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

export { PlataformaACD, VALID_TYPES as PlataformaACDEnum };
