/**
 * Entidade: Relato
 * Aggregate Root do domínio de Relatos (Diário de Projeto)
 *
 * Representa um registro no diário de projeto: riscos, decisões, bloqueios ou informativos.
 */

import { RelatoTipo } from '../value-objects/RelatoTipo.js';
import { RelatoPrioridade } from '../value-objects/RelatoPrioridade.js';

class Relato {
  #id;
  #projectCode;
  #tipo;
  #prioridade;
  #titulo;
  #descricao;
  #authorId;
  #authorName;
  #isResolved;
  #resolvedAt;
  #resolvedById;
  #createdAt;
  #updatedAt;

  constructor({
    id = null,
    projectCode,
    tipo,
    prioridade,
    titulo,
    descricao,
    authorId,
    authorName = null,
    isResolved = false,
    resolvedAt = null,
    resolvedById = null,
    createdAt = null,
    updatedAt = null,
  }) {
    // Validações obrigatórias
    if (!projectCode || String(projectCode).trim().length === 0) {
      throw new Error('O código do projeto é obrigatório');
    }
    if (!titulo || String(titulo).trim().length === 0) {
      throw new Error('O título do relato é obrigatório');
    }
    if (!descricao || String(descricao).trim().length === 0) {
      throw new Error('A descrição do relato é obrigatória');
    }
    if (!authorId) {
      throw new Error('O autor do relato é obrigatório');
    }

    // Atribuições com Value Objects
    this.#id = id;
    this.#projectCode = String(projectCode).trim();
    this.#tipo = tipo instanceof RelatoTipo ? tipo : new RelatoTipo(tipo);
    this.#prioridade = prioridade instanceof RelatoPrioridade ? prioridade : new RelatoPrioridade(prioridade);
    this.#titulo = titulo.trim();
    this.#descricao = descricao.trim();
    this.#authorId = authorId;
    this.#authorName = authorName || null;
    this.#isResolved = !!isResolved;
    this.#resolvedAt = resolvedAt ? new Date(resolvedAt) : null;
    this.#resolvedById = resolvedById || null;
    this.#createdAt = createdAt ? new Date(createdAt) : new Date();
    this.#updatedAt = updatedAt ? new Date(updatedAt) : new Date();
  }

  // Getters
  get id() { return this.#id; }
  get projectCode() { return this.#projectCode; }
  get tipo() { return this.#tipo; }
  get prioridade() { return this.#prioridade; }
  get titulo() { return this.#titulo; }
  get descricao() { return this.#descricao; }
  get authorId() { return this.#authorId; }
  get authorName() { return this.#authorName; }
  get isResolved() { return this.#isResolved; }
  get resolvedAt() { return this.#resolvedAt; }
  get resolvedById() { return this.#resolvedById; }
  get createdAt() { return this.#createdAt; }
  get updatedAt() { return this.#updatedAt; }

  get code() {
    return this.#id ? `RL-${this.#id}` : null;
  }

  // --- Comportamentos do domínio ---

  belongsTo(userId) {
    return this.#authorId === userId;
  }

  updateContent(titulo, descricao) {
    if (titulo !== undefined) {
      if (!titulo || titulo.trim().length === 0) {
        throw new Error('O título do relato é obrigatório');
      }
      this.#titulo = titulo.trim();
    }
    if (descricao !== undefined) {
      if (!descricao || descricao.trim().length === 0) {
        throw new Error('A descrição do relato é obrigatória');
      }
      this.#descricao = descricao.trim();
    }
    this.#updatedAt = new Date();
  }

  changeTipo(tipoSlug) {
    this.#tipo = tipoSlug instanceof RelatoTipo ? tipoSlug : new RelatoTipo(tipoSlug);
    this.#updatedAt = new Date();
  }

  changePrioridade(prioridadeSlug) {
    this.#prioridade = prioridadeSlug instanceof RelatoPrioridade
      ? prioridadeSlug : new RelatoPrioridade(prioridadeSlug);
    this.#updatedAt = new Date();
  }

  resolve(resolvedById) {
    if (!resolvedById) {
      throw new Error('É necessário informar quem está resolvendo o relato');
    }
    this.#isResolved = true;
    this.#resolvedAt = new Date();
    this.#resolvedById = resolvedById;
    this.#updatedAt = new Date();
  }

  reopen() {
    this.#isResolved = false;
    this.#resolvedAt = null;
    this.#resolvedById = null;
    this.#updatedAt = new Date();
  }

  toPersistence() {
    return {
      id: this.#id,
      project_code: this.#projectCode,
      tipo_slug: this.#tipo.value,
      prioridade_slug: this.#prioridade.value,
      titulo: this.#titulo,
      descricao: this.#descricao,
      author_id: this.#authorId,
      author_name: this.#authorName,
      is_resolved: this.#isResolved,
      resolved_at: this.#resolvedAt?.toISOString() || null,
      resolved_by_id: this.#resolvedById,
      created_at: this.#createdAt.toISOString(),
      updated_at: this.#updatedAt.toISOString(),
    };
  }

  toResponse(tipoMeta = null, prioridadeMeta = null, authorData = null) {
    return {
      id: this.#id,
      code: this.code,
      project_code: this.#projectCode,
      tipo_slug: this.#tipo.value,
      tipo_label: tipoMeta?.label || this.#tipo.label,
      tipo_color: tipoMeta?.color || this.#tipo.color,
      prioridade_slug: this.#prioridade.value,
      prioridade_label: prioridadeMeta?.label || this.#prioridade.label,
      prioridade_color: prioridadeMeta?.color || this.#prioridade.color,
      titulo: this.#titulo,
      descricao: this.#descricao,
      author_id: this.#authorId,
      author_name: authorData?.name || this.#authorName,
      is_resolved: this.#isResolved,
      resolved_at: this.#resolvedAt?.toISOString() || null,
      resolved_by_id: this.#resolvedById,
      created_at: this.#createdAt.toISOString(),
      updated_at: this.#updatedAt.toISOString(),
    };
  }

  static fromPersistence(data) {
    return new Relato({
      id: data.id,
      projectCode: data.project_code,
      tipo: data.tipo_slug,
      prioridade: data.prioridade_slug,
      titulo: data.titulo,
      descricao: data.descricao,
      authorId: data.author_id,
      authorName: data.author_name,
      isResolved: data.is_resolved,
      resolvedAt: data.resolved_at,
      resolvedById: data.resolved_by_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  }

  static create({ projectCode, tipo, prioridade, titulo, descricao, authorId, authorName }) {
    return new Relato({
      projectCode,
      tipo,
      prioridade,
      titulo,
      descricao,
      authorId,
      authorName,
    });
  }
}

export { Relato };
