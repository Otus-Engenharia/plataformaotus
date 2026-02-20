/**
 * Value Object: ActivityType
 * Faz o parsing do tipo de etapa (Lançamento/Ajuste) a partir do nome da tarefa.
 * Tarefas sem etapa reconhecida retornam null (peso = 0, excluídas do cálculo).
 */

const VALID_TYPES = Object.freeze({
  LANCAMENTO: 'Lançamento',
  AJUSTE: 'Ajuste',
});

const KEYWORDS = Object.freeze([
  { pattern: /lan[cç]amento/i, type: VALID_TYPES.LANCAMENTO },
  { pattern: /ajuste/i, type: VALID_TYPES.AJUSTE },
]);

class ActivityType {
  #value;

  constructor(value) {
    if (!value || !Object.values(VALID_TYPES).includes(value)) {
      throw new Error(`Tipo de atividade inválido: ${value}. Válidos: ${Object.values(VALID_TYPES).join(', ')}`);
    }
    this.#value = value;
    Object.freeze(this);
  }

  get value() { return this.#value; }

  get isLancamento() { return this.#value === VALID_TYPES.LANCAMENTO; }
  get isAjuste() { return this.#value === VALID_TYPES.AJUSTE; }

  equals(other) {
    return other instanceof ActivityType && other.value === this.#value;
  }

  toString() { return this.#value; }

  /**
   * Faz parsing do nome de uma tarefa Level 5 para extrair o tipo de etapa.
   * @param {string} taskName - NomeDaTarefa do SmartSheet
   * @returns {ActivityType|null} - null se nenhum tipo reconhecido (peso = 0)
   */
  static parse(taskName) {
    if (!taskName || typeof taskName !== 'string') return null;

    for (const { pattern, type } of KEYWORDS) {
      if (pattern.test(taskName)) {
        return new ActivityType(type);
      }
    }

    return null;
  }

  static get LANCAMENTO() { return VALID_TYPES.LANCAMENTO; }
  static get AJUSTE() { return VALID_TYPES.AJUSTE; }
  static get VALID_VALUES() { return Object.values(VALID_TYPES); }
}

export { ActivityType };
