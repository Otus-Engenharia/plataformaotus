/**
 * Value Object: PipelineStep
 * Representa as etapas do pipeline de geração de relatório semanal
 */

const VALID_STEPS = Object.freeze({
  FETCHING_DATA: 'fetching_data',
  PROCESSING: 'processing',
  GENERATING_HTML: 'generating_html',
  UPLOADING_DRIVE: 'uploading_drive',
  CREATING_DRAFTS: 'creating_drafts',
});

const STEP_LABELS = Object.freeze({
  [VALID_STEPS.FETCHING_DATA]: 'Buscando dados',
  [VALID_STEPS.PROCESSING]: 'Processando',
  [VALID_STEPS.GENERATING_HTML]: 'Gerando relatórios',
  [VALID_STEPS.UPLOADING_DRIVE]: 'Salvando no Drive',
  [VALID_STEPS.CREATING_DRAFTS]: 'Criando rascunhos',
});

const STEP_ORDER = Object.freeze([
  VALID_STEPS.FETCHING_DATA,
  VALID_STEPS.PROCESSING,
  VALID_STEPS.GENERATING_HTML,
  VALID_STEPS.UPLOADING_DRIVE,
  VALID_STEPS.CREATING_DRAFTS,
]);

class PipelineStep {
  #value;

  constructor(value) {
    if (value === null || value === undefined) {
      this.#value = null;
      Object.freeze(this);
      return;
    }

    const normalizedValue = String(value).toLowerCase().trim();

    if (!PipelineStep.isValid(normalizedValue)) {
      throw new Error(
        `Step inválido: "${value}". Valores permitidos: ${STEP_ORDER.join(', ')}`
      );
    }

    this.#value = normalizedValue;
    Object.freeze(this);
  }

  get value() {
    return this.#value;
  }

  get label() {
    return this.#value ? STEP_LABELS[this.#value] : null;
  }

  get index() {
    return this.#value ? STEP_ORDER.indexOf(this.#value) : -1;
  }

  get isLast() {
    return this.#value === VALID_STEPS.CREATING_DRAFTS;
  }

  equals(other) {
    if (!(other instanceof PipelineStep)) return false;
    return this.#value === other.value;
  }

  toString() {
    return this.#value || '';
  }

  toJSON() {
    return this.#value;
  }

  static isValid(value) {
    return Object.values(VALID_STEPS).includes(value);
  }

  static get STEPS() {
    return VALID_STEPS;
  }

  static get ORDER() {
    return STEP_ORDER;
  }

  static get ALL_STEPS_WITH_LABELS() {
    return STEP_ORDER.map(step => ({
      value: step,
      label: STEP_LABELS[step],
    }));
  }
}

export { PipelineStep, VALID_STEPS as PipelineStepEnum };
