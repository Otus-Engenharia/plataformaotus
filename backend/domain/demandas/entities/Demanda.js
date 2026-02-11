/**
 * Entidade: Demanda
 * Aggregate Root do domínio de Demandas (Apoio de Projetos)
 *
 * Representa uma solicitação de serviço para a equipe de modelagem/BIM.
 */

import { DemandaStatus } from '../value-objects/DemandaStatus.js';
import { DemandaCategoria } from '../value-objects/DemandaCategoria.js';
import { TipoServico } from '../value-objects/TipoServico.js';
import { Prioridade } from '../value-objects/Prioridade.js';

class Demanda {
  #id;
  #categoria;
  #tipoServico;
  #tipoServicoOutro;
  #coordenadorProjeto;
  #clienteProjeto;
  #acessoCronograma;
  #linkCronograma;
  #acessoDrive;
  #linkDrive;
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
    categoria,
    tipoServico = null,
    tipoServicoOutro = null,
    coordenadorProjeto,
    clienteProjeto,
    acessoCronograma = false,
    linkCronograma = null,
    acessoDrive = false,
    linkDrive = null,
    descricao,
    status = 'pendente',
    prioridade = 'normal',
    authorId,
    assignedTo = null,
    resolvedById = null,
    resolvedAt = null,
    createdAt = null,
    updatedAt = null,
  }) {
    // Validações obrigatórias
    if (!descricao || descricao.trim().length === 0) {
      throw new Error('A descrição da demanda é obrigatória');
    }

    if (!authorId) {
      throw new Error('O autor da demanda é obrigatório');
    }

    if (!coordenadorProjeto || coordenadorProjeto.trim().length === 0) {
      throw new Error('O coordenador do projeto é obrigatório');
    }

    if (!clienteProjeto || clienteProjeto.trim().length === 0) {
      throw new Error('O cliente/projeto é obrigatório');
    }

    // Atribuições com Value Objects
    this.#id = id;
    this.#categoria = categoria instanceof DemandaCategoria ? categoria : new DemandaCategoria(categoria);
    this.#status = status instanceof DemandaStatus ? status : new DemandaStatus(status);
    this.#prioridade = prioridade instanceof Prioridade ? prioridade : new Prioridade(prioridade);

    // TipoServico é obrigatório apenas para categoria 'modelagem'
    if (this.#categoria.isModelagem) {
      if (!tipoServico) {
        throw new Error('O tipo de serviço é obrigatório para categoria Modelagem');
      }
      this.#tipoServico = tipoServico instanceof TipoServico ? tipoServico : new TipoServico(tipoServico);
    } else {
      this.#tipoServico = tipoServico
        ? (tipoServico instanceof TipoServico ? tipoServico : new TipoServico(tipoServico))
        : null;
    }

    this.#tipoServicoOutro = tipoServicoOutro?.trim() || null;
    this.#coordenadorProjeto = coordenadorProjeto.trim();
    this.#clienteProjeto = clienteProjeto.trim();
    this.#acessoCronograma = !!acessoCronograma;
    this.#linkCronograma = linkCronograma || null;
    this.#acessoDrive = !!acessoDrive;
    this.#linkDrive = linkDrive || null;
    this.#descricao = descricao.trim();
    this.#authorId = authorId;
    this.#assignedTo = assignedTo || null;
    this.#resolvedById = resolvedById || null;
    this.#resolvedAt = resolvedAt ? new Date(resolvedAt) : null;
    this.#createdAt = createdAt ? new Date(createdAt) : new Date();
    this.#updatedAt = updatedAt ? new Date(updatedAt) : new Date();
  }

  // Getters
  get id() { return this.#id; }
  get categoria() { return this.#categoria; }
  get tipoServico() { return this.#tipoServico; }
  get tipoServicoOutro() { return this.#tipoServicoOutro; }
  get coordenadorProjeto() { return this.#coordenadorProjeto; }
  get clienteProjeto() { return this.#clienteProjeto; }
  get acessoCronograma() { return this.#acessoCronograma; }
  get linkCronograma() { return this.#linkCronograma; }
  get acessoDrive() { return this.#acessoDrive; }
  get linkDrive() { return this.#linkDrive; }
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
    return this.#id ? `DM-${this.#id}` : null;
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

  // --- Comportamentos do domínio ---

  /**
   * Atualiza o status da demanda
   */
  updateStatus(newStatus, resolvedById = null) {
    const statusVO = newStatus instanceof DemandaStatus
      ? newStatus
      : new DemandaStatus(newStatus);

    if (this.#status.isClosed && statusVO.isOpen) {
      this.#resolvedById = null;
      this.#resolvedAt = null;
    }

    if (statusVO.isClosed) {
      if (!resolvedById) {
        throw new Error('É necessário informar quem está finalizando a demanda');
      }
      this.#resolvedById = resolvedById;
      this.#resolvedAt = new Date();
    }

    this.#status = statusVO;
    this.#updatedAt = new Date();
  }

  /**
   * Atribui a demanda a um responsável
   */
  assignTo(userId) {
    this.#assignedTo = userId || null;
    this.#updatedAt = new Date();
  }

  /**
   * Atualiza campos de conteúdo da demanda
   */
  updateContent({
    descricao,
    coordenadorProjeto,
    clienteProjeto,
    categoria,
    tipoServico,
    tipoServicoOutro,
    acessoCronograma,
    linkCronograma,
    acessoDrive,
    linkDrive,
  }) {
    if (descricao !== undefined) {
      if (!descricao || descricao.trim().length === 0) {
        throw new Error('A descrição da demanda é obrigatória');
      }
      this.#descricao = descricao.trim();
    }
    if (coordenadorProjeto !== undefined) {
      if (!coordenadorProjeto || coordenadorProjeto.trim().length === 0) {
        throw new Error('O coordenador do projeto é obrigatório');
      }
      this.#coordenadorProjeto = coordenadorProjeto.trim();
    }
    if (clienteProjeto !== undefined) {
      if (!clienteProjeto || clienteProjeto.trim().length === 0) {
        throw new Error('O cliente/projeto é obrigatório');
      }
      this.#clienteProjeto = clienteProjeto.trim();
    }
    if (categoria !== undefined) {
      this.#categoria = new DemandaCategoria(categoria);
    }
    if (tipoServico !== undefined) {
      this.#tipoServico = tipoServico ? new TipoServico(tipoServico) : null;
    }
    if (tipoServicoOutro !== undefined) {
      this.#tipoServicoOutro = tipoServicoOutro?.trim() || null;
    }
    if (acessoCronograma !== undefined) {
      this.#acessoCronograma = !!acessoCronograma;
    }
    if (linkCronograma !== undefined) {
      this.#linkCronograma = linkCronograma || null;
    }
    if (acessoDrive !== undefined) {
      this.#acessoDrive = !!acessoDrive;
    }
    if (linkDrive !== undefined) {
      this.#linkDrive = linkDrive || null;
    }
    this.#updatedAt = new Date();
  }

  /**
   * Atualiza a prioridade
   */
  setPrioridade(newPrioridade) {
    this.#prioridade = newPrioridade instanceof Prioridade
      ? newPrioridade
      : new Prioridade(newPrioridade);
    this.#updatedAt = new Date();
  }

  /**
   * Converte para objeto de persistência (snake_case)
   */
  toPersistence() {
    return {
      id: this.#id,
      categoria: this.#categoria.value,
      tipo_servico: this.#tipoServico?.value || null,
      tipo_servico_outro: this.#tipoServicoOutro,
      coordenador_projeto: this.#coordenadorProjeto,
      cliente_projeto: this.#clienteProjeto,
      acesso_cronograma: this.#acessoCronograma,
      link_cronograma: this.#linkCronograma,
      acesso_drive: this.#acessoDrive,
      link_drive: this.#linkDrive,
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

  /**
   * Converte para formato de resposta da API
   */
  toResponse(authorData = null, assignedData = null, resolvedByData = null) {
    return {
      id: this.#id,
      code: this.code,
      categoria: this.#categoria.value,
      tipo_servico: this.#tipoServico?.value || null,
      tipo_servico_outro: this.#tipoServicoOutro,
      coordenador_projeto: this.#coordenadorProjeto,
      cliente_projeto: this.#clienteProjeto,
      acesso_cronograma: this.#acessoCronograma,
      link_cronograma: this.#linkCronograma,
      acesso_drive: this.#acessoDrive,
      link_drive: this.#linkDrive,
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

  /**
   * Factory: cria entidade a partir de dados do banco
   */
  static fromPersistence(data) {
    return new Demanda({
      id: data.id,
      categoria: data.categoria,
      tipoServico: data.tipo_servico,
      tipoServicoOutro: data.tipo_servico_outro,
      coordenadorProjeto: data.coordenador_projeto,
      clienteProjeto: data.cliente_projeto,
      acessoCronograma: data.acesso_cronograma,
      linkCronograma: data.link_cronograma,
      acessoDrive: data.acesso_drive,
      linkDrive: data.link_drive,
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

  /**
   * Factory: cria nova demanda
   */
  static create({
    categoria,
    tipoServico,
    tipoServicoOutro,
    coordenadorProjeto,
    clienteProjeto,
    acessoCronograma,
    linkCronograma,
    acessoDrive,
    linkDrive,
    descricao,
    authorId,
  }) {
    return new Demanda({
      categoria,
      tipoServico,
      tipoServicoOutro,
      coordenadorProjeto,
      clienteProjeto,
      acessoCronograma,
      linkCronograma,
      acessoDrive,
      linkDrive,
      descricao,
      authorId,
    });
  }
}

export { Demanda };
