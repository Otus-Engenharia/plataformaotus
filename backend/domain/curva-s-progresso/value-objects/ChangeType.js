/**
 * Value Object: ChangeType
 * Identifica o tipo de alteração detectada entre snapshots mensais.
 */

const VALID_TYPES = Object.freeze({
  DESVIO_PRAZO: 'DESVIO_PRAZO',
  TAREFA_CRIADA: 'TAREFA_CRIADA',
  TAREFA_DELETADA: 'TAREFA_DELETADA',
  TAREFA_NAO_FEITA: 'TAREFA_NAO_FEITA',
});

const TYPE_LABELS = Object.freeze({
  [VALID_TYPES.DESVIO_PRAZO]: 'Desvio de Prazo',
  [VALID_TYPES.TAREFA_CRIADA]: 'Tarefa Adicionada',
  [VALID_TYPES.TAREFA_DELETADA]: 'Tarefa Removida',
  [VALID_TYPES.TAREFA_NAO_FEITA]: 'Não Feita',
});

const TYPE_COLORS = Object.freeze({
  [VALID_TYPES.DESVIO_PRAZO]: '#EF4444',
  [VALID_TYPES.TAREFA_CRIADA]: '#3B82F6',
  [VALID_TYPES.TAREFA_DELETADA]: '#F97316',
  [VALID_TYPES.TAREFA_NAO_FEITA]: '#8B5CF6',
});

class ChangeType {
  #value;

  constructor(value) {
    const normalized = String(value || '').toUpperCase().trim();
    if (!Object.values(VALID_TYPES).includes(normalized)) {
      throw new Error(`Tipo de alteração inválido: ${value}. Válidos: ${Object.values(VALID_TYPES).join(', ')}`);
    }
    this.#value = normalized;
    Object.freeze(this);
  }

  get value() { return this.#value; }
  get label() { return TYPE_LABELS[this.#value]; }
  get color() { return TYPE_COLORS[this.#value]; }

  get isDesvioPrazo() { return this.#value === VALID_TYPES.DESVIO_PRAZO; }
  get isTarefaCriada() { return this.#value === VALID_TYPES.TAREFA_CRIADA; }
  get isTarefaDeletada() { return this.#value === VALID_TYPES.TAREFA_DELETADA; }
  get isTarefaNaoFeita() { return this.#value === VALID_TYPES.TAREFA_NAO_FEITA; }

  get isScope() { return this.isTarefaCriada || this.isTarefaDeletada; }
  get isSchedule() { return this.isDesvioPrazo; }

  equals(other) {
    return other instanceof ChangeType && other.value === this.#value;
  }

  toString() { return this.#value; }

  static desvioPrazo() { return new ChangeType(VALID_TYPES.DESVIO_PRAZO); }
  static tarefaCriada() { return new ChangeType(VALID_TYPES.TAREFA_CRIADA); }
  static tarefaDeletada() { return new ChangeType(VALID_TYPES.TAREFA_DELETADA); }
  static tarefaNaoFeita() { return new ChangeType(VALID_TYPES.TAREFA_NAO_FEITA); }

  static isValid(value) {
    return Object.values(VALID_TYPES).includes(String(value || '').toUpperCase().trim());
  }

  static get VALID_VALUES() { return Object.values(VALID_TYPES); }
  static get LABELS() { return TYPE_LABELS; }
  static get COLORS() { return TYPE_COLORS; }
}

export { ChangeType };
