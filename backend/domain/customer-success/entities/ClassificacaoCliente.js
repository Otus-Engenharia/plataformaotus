/**
 * Entidade: ClassificacaoCliente
 * Aggregate Root do domínio de Customer Success
 *
 * Representa a classificação A/B/C/D de um cliente para acompanhamento CS.
 */

import { Classificacao } from '../value-objects/Classificacao.js';

class ClassificacaoCliente {
  #id;
  #companyId;
  #cliente;
  #classificacao;
  #updatedById;
  #updatedByName;
  #createdAt;
  #updatedAt;

  constructor({
    id = null,
    companyId,
    cliente,
    classificacao,
    updatedById = null,
    updatedByName = null,
    createdAt = null,
    updatedAt = null,
  }) {
    if (!companyId) {
      throw new Error('O company_id é obrigatório');
    }

    if (!cliente || String(cliente).trim().length === 0) {
      throw new Error('O cliente é obrigatório');
    }

    if (!classificacao) {
      throw new Error('A classificação é obrigatória');
    }

    this.#id = id;
    this.#companyId = companyId;
    this.#cliente = String(cliente).trim();
    this.#classificacao = classificacao instanceof Classificacao
      ? classificacao
      : new Classificacao(classificacao);
    this.#updatedById = updatedById || null;
    this.#updatedByName = updatedByName || null;
    this.#createdAt = createdAt ? new Date(createdAt) : new Date();
    this.#updatedAt = updatedAt ? new Date(updatedAt) : new Date();
  }

  get id() { return this.#id; }
  get companyId() { return this.#companyId; }
  get cliente() { return this.#cliente; }
  get classificacao() { return this.#classificacao; }
  get updatedById() { return this.#updatedById; }
  get updatedByName() { return this.#updatedByName; }
  get createdAt() { return this.#createdAt; }
  get updatedAt() { return this.#updatedAt; }

  /**
   * Reclassifica o cliente, registrando quem fez a alteração
   * @param {string|Classificacao} newClassificacao - Nova classificação (A/B/C/D)
   * @param {string} userId - ID do usuário que reclassificou
   * @param {string} userName - Nome do usuário que reclassificou
   */
  reclassify(newClassificacao, userId, userName) {
    if (!userId) {
      throw new Error('O usuário responsável pela reclassificação é obrigatório');
    }

    this.#classificacao = newClassificacao instanceof Classificacao
      ? newClassificacao
      : new Classificacao(newClassificacao);
    this.#updatedById = userId;
    this.#updatedByName = userName || null;
    this.#updatedAt = new Date();
  }

  toPersistence() {
    return {
      id: this.#id,
      company_id: this.#companyId,
      cliente: this.#cliente,
      classificacao: this.#classificacao.value,
      updated_by_id: this.#updatedById,
      updated_by_name: this.#updatedByName,
      created_at: this.#createdAt.toISOString(),
      updated_at: this.#updatedAt.toISOString(),
    };
  }

  toResponse() {
    return {
      id: this.#id,
      company_id: this.#companyId,
      cliente: this.#cliente,
      classificacao: this.#classificacao.value,
      classificacao_label: this.#classificacao.label,
      updated_by_id: this.#updatedById,
      updated_by_name: this.#updatedByName,
      created_at: this.#createdAt.toISOString(),
      updated_at: this.#updatedAt.toISOString(),
    };
  }

  static fromPersistence(data) {
    return new ClassificacaoCliente({
      id: data.id,
      companyId: data.company_id,
      cliente: data.cliente,
      classificacao: data.classificacao,
      updatedById: data.updated_by_id,
      updatedByName: data.updated_by_name,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  }

  static create({ companyId, cliente, classificacao, updatedById, updatedByName }) {
    return new ClassificacaoCliente({ companyId, cliente, classificacao, updatedById, updatedByName });
  }
}

export { ClassificacaoCliente };
