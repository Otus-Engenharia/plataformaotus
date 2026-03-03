/**
 * Value Object: ContactRequestType
 * Tipo de solicitação de alteração: novo_contato, editar_contato ou nova_empresa.
 */

const VALID_TYPES = Object.freeze({
  NOVO_CONTATO: 'novo_contato',
  EDITAR_CONTATO: 'editar_contato',
  NOVA_EMPRESA: 'nova_empresa',
  NOVA_DISCIPLINA: 'nova_disciplina',
});

class ContactRequestType {
  #value;

  constructor(value) {
    const normalized = String(value || '').toLowerCase().trim();
    if (!Object.values(VALID_TYPES).includes(normalized)) {
      throw new Error(`Tipo de solicitação inválido: ${value}. Válidos: ${Object.values(VALID_TYPES).join(', ')}`);
    }
    this.#value = normalized;
    Object.freeze(this);
  }

  get value() { return this.#value; }
  get isNovoContato() { return this.#value === VALID_TYPES.NOVO_CONTATO; }
  get isEditarContato() { return this.#value === VALID_TYPES.EDITAR_CONTATO; }
  get isNovaEmpresa() { return this.#value === VALID_TYPES.NOVA_EMPRESA; }
  get isNovaDisciplina() { return this.#value === VALID_TYPES.NOVA_DISCIPLINA; }

  get label() {
    switch (this.#value) {
      case VALID_TYPES.NOVO_CONTATO: return 'Novo Contato';
      case VALID_TYPES.EDITAR_CONTATO: return 'Editar Contato';
      case VALID_TYPES.NOVA_EMPRESA: return 'Nova Empresa';
      case VALID_TYPES.NOVA_DISCIPLINA: return 'Nova Disciplina';
      default: return this.#value;
    }
  }

  equals(other) {
    return other instanceof ContactRequestType && other.value === this.#value;
  }

  toString() { return this.#value; }

  static novoContato() { return new ContactRequestType(VALID_TYPES.NOVO_CONTATO); }
  static editarContato() { return new ContactRequestType(VALID_TYPES.EDITAR_CONTATO); }
  static novaEmpresa() { return new ContactRequestType(VALID_TYPES.NOVA_EMPRESA); }
  static novaDisciplina() { return new ContactRequestType(VALID_TYPES.NOVA_DISCIPLINA); }
  static get VALID_VALUES() { return Object.values(VALID_TYPES); }
}

export { ContactRequestType };
