/**
 * Entidade: EstudoCusto
 * Aggregate Root do dominio de Estudos de Custos (CS)
 *
 * Representa uma solicitacao de estudo de custos para a equipe de CS.
 */

import { EstudoCustoStatus } from '../value-objects/EstudoCustoStatus.js';
import { Prioridade } from '../../demandas/value-objects/Prioridade.js';

class EstudoCusto {
  #id;
  #projeto;
  #nomeTime;
  #statusFase;
  #construflowId;
  #linkConstruflow;
  #linkEstudoCustos;
  #dataPrevistaApresentacao;
  #descricao;
  #status;
  #prioridade;
  #authorId;
  #assignedTo;
  #resolvedById;
  #resolvedAt;
  #createdAt;
  #updatedAt;

  constructor({
    id = null,
    projeto,
    nomeTime = null,
    statusFase = null,
    construflowId = null,
    linkConstruflow = null,
    linkEstudoCustos = null,
    dataPrevistaApresentacao = null,
    descricao = null,
    status = 'pendente',
    prioridade = 'normal',
    authorId,
    assignedTo = null,
    resolvedById = null,
    resolvedAt = null,
    createdAt = null,
    updatedAt = null,
  }) {
    if (!projeto || projeto.trim().length === 0) {
      throw new Error('O projeto e obrigatorio');
    }

    if (!authorId) {
      throw new Error('O autor da solicitacao e obrigatorio');
    }

    this.#id = id;
    this.#projeto = projeto.trim();
    this.#nomeTime = nomeTime?.trim() || null;
    this.#statusFase = statusFase?.trim() || null;
    this.#construflowId = construflowId || null;
    this.#linkConstruflow = linkConstruflow || null;
    this.#linkEstudoCustos = linkEstudoCustos || null;
    this.#dataPrevistaApresentacao = dataPrevistaApresentacao || null;
    this.#descricao = descricao?.trim() || null;
    this.#status = status instanceof EstudoCustoStatus ? status : new EstudoCustoStatus(status);
    this.#prioridade = prioridade instanceof Prioridade ? prioridade : new Prioridade(prioridade);
    this.#authorId = authorId;
    this.#assignedTo = assignedTo || null;
    this.#resolvedById = resolvedById || null;
    this.#resolvedAt = resolvedAt ? new Date(resolvedAt) : null;
    this.#createdAt = createdAt ? new Date(createdAt) : new Date();
    this.#updatedAt = updatedAt ? new Date(updatedAt) : new Date();
  }

  // Getters
  get id() { return this.#id; }
  get projeto() { return this.#projeto; }
  get nomeTime() { return this.#nomeTime; }
  get statusFase() { return this.#statusFase; }
  get construflowId() { return this.#construflowId; }
  get linkConstruflow() { return this.#linkConstruflow; }
  get linkEstudoCustos() { return this.#linkEstudoCustos; }
  get dataPrevistaApresentacao() { return this.#dataPrevistaApresentacao; }
  get descricao() { return this.#descricao; }
  get status() { return this.#status; }
  get prioridade() { return this.#prioridade; }
  get authorId() { return this.#authorId; }
  get assignedTo() { return this.#assignedTo; }
  get resolvedById() { return this.#resolvedById; }
  get resolvedAt() { return this.#resolvedAt; }
  get createdAt() { return this.#createdAt; }
  get updatedAt() { return this.#updatedAt; }

  get code() {
    return this.#id ? `EC-${this.#id}` : null;
  }

  get isClosed() {
    return this.#status.isClosed;
  }

  get isPending() {
    return this.#status.isPending;
  }

  belongsTo(userId) {
    return this.#authorId === userId;
  }

  // --- Comportamentos do dominio ---

  updateStatus(newStatus, resolvedById = null) {
    const statusVO = newStatus instanceof EstudoCustoStatus
      ? newStatus
      : new EstudoCustoStatus(newStatus);

    if (this.#status.isClosed && statusVO.isOpen) {
      this.#resolvedById = null;
      this.#resolvedAt = null;
    }

    if (statusVO.isClosed) {
      if (!resolvedById) {
        throw new Error('E necessario informar quem esta finalizando a solicitacao');
      }
      this.#resolvedById = resolvedById;
      this.#resolvedAt = new Date();
    }

    this.#status = statusVO;
    this.#updatedAt = new Date();
  }

  assignTo(userId) {
    this.#assignedTo = userId || null;
    this.#updatedAt = new Date();
  }

  updateContent({
    projeto,
    nomeTime,
    statusFase,
    construflowId,
    linkConstruflow,
    dataPrevistaApresentacao,
    descricao,
  }) {
    if (projeto !== undefined) {
      if (!projeto || projeto.trim().length === 0) {
        throw new Error('O projeto e obrigatorio');
      }
      this.#projeto = projeto.trim();
    }
    if (nomeTime !== undefined) this.#nomeTime = nomeTime?.trim() || null;
    if (statusFase !== undefined) this.#statusFase = statusFase?.trim() || null;
    if (construflowId !== undefined) this.#construflowId = construflowId || null;
    if (linkConstruflow !== undefined) this.#linkConstruflow = linkConstruflow || null;
    if (dataPrevistaApresentacao !== undefined) this.#dataPrevistaApresentacao = dataPrevistaApresentacao || null;
    if (descricao !== undefined) this.#descricao = descricao?.trim() || null;
    this.#updatedAt = new Date();
  }

  updateLinkEstudoCustos(link) {
    this.#linkEstudoCustos = link || null;
    this.#updatedAt = new Date();
  }

  setPrioridade(newPrioridade) {
    this.#prioridade = newPrioridade instanceof Prioridade
      ? newPrioridade
      : new Prioridade(newPrioridade);
    this.#updatedAt = new Date();
  }

  toPersistence() {
    return {
      id: this.#id,
      projeto: this.#projeto,
      nome_time: this.#nomeTime,
      status_fase: this.#statusFase,
      construflow_id: this.#construflowId,
      link_construflow: this.#linkConstruflow,
      link_estudo_custos: this.#linkEstudoCustos,
      data_prevista_apresentacao: this.#dataPrevistaApresentacao,
      descricao: this.#descricao,
      status: this.#status.value,
      prioridade: this.#prioridade.value,
      author_id: this.#authorId,
      assigned_to: this.#assignedTo,
      resolved_by_id: this.#resolvedById,
      resolved_at: this.#resolvedAt?.toISOString() || null,
      created_at: this.#createdAt.toISOString(),
      updated_at: this.#updatedAt.toISOString(),
    };
  }

  toResponse(authorData = null, assignedData = null, resolvedByData = null) {
    return {
      id: this.#id,
      code: this.code,
      projeto: this.#projeto,
      nome_time: this.#nomeTime,
      status_fase: this.#statusFase,
      construflow_id: this.#construflowId,
      link_construflow: this.#linkConstruflow,
      link_estudo_custos: this.#linkEstudoCustos,
      data_prevista_apresentacao: this.#dataPrevistaApresentacao,
      descricao: this.#descricao,
      status: this.#status.value,
      prioridade: this.#prioridade.value,
      author_id: this.#authorId,
      author_name: authorData?.name || null,
      author_email: authorData?.email || null,
      assigned_to: this.#assignedTo,
      assigned_name: assignedData?.name || null,
      resolved_by_id: this.#resolvedById,
      resolved_by: resolvedByData?.name || null,
      resolved_at: this.#resolvedAt?.toISOString() || null,
      created_at: this.#createdAt.toISOString(),
      updated_at: this.#updatedAt.toISOString(),
      is_closed: this.isClosed,
    };
  }

  static fromPersistence(data) {
    return new EstudoCusto({
      id: data.id,
      projeto: data.projeto,
      nomeTime: data.nome_time,
      statusFase: data.status_fase,
      construflowId: data.construflow_id,
      linkConstruflow: data.link_construflow,
      linkEstudoCustos: data.link_estudo_custos,
      dataPrevistaApresentacao: data.data_prevista_apresentacao,
      descricao: data.descricao,
      status: data.status,
      prioridade: data.prioridade,
      authorId: data.author_id,
      assignedTo: data.assigned_to,
      resolvedById: data.resolved_by_id,
      resolvedAt: data.resolved_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  }

  static create({
    projeto,
    nomeTime,
    statusFase,
    construflowId,
    linkConstruflow,
    dataPrevistaApresentacao,
    descricao,
    authorId,
  }) {
    return new EstudoCusto({
      projeto,
      nomeTime,
      statusFase,
      construflowId,
      linkConstruflow,
      dataPrevistaApresentacao,
      descricao,
      authorId,
    });
  }
}

export { EstudoCusto };
