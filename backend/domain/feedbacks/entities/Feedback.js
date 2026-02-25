/**
 * Entidade: Feedback
 * Aggregate Root do domínio de Feedbacks
 *
 * Representa um registro de feedback sobre processos, plataforma ou outros aspectos.
 */

import { FeedbackArea } from '../value-objects/FeedbackArea.js';
import { FeedbackStatus } from '../value-objects/FeedbackStatus.js';
import { FeedbackType } from '../value-objects/FeedbackType.js';

class Feedback {
  #id;
  #type;
  #status;
  #titulo;
  #feedbackText;
  #authorId;
  #pageUrl;
  #screenshotUrl;
  #category;
  #area;
  #authorRoleLevel;
  #adminAnalysis;
  #adminAction;
  #resolvedById;
  #resolvedAt;
  #feedbackId; // Auto-referência para menções
  #createdAt;
  #updatedAt;

  constructor({
    id = null,
    type,
    status = 'pendente',
    titulo = null,
    feedbackText,
    authorId,
    pageUrl = null,
    screenshotUrl = null,
    category = null,
    area = null,
    authorRoleLevel = 5,
    adminAnalysis = null,
    adminAction = null,
    resolvedById = null,
    resolvedAt = null,
    feedbackId = null,
    createdAt = null,
    updatedAt = null,
  }) {
    // Validações obrigatórias
    if (!feedbackText || feedbackText.trim().length === 0) {
      throw new Error('O texto do feedback é obrigatório');
    }

    if (!authorId) {
      throw new Error('O autor do feedback é obrigatório');
    }

    // Atribuições com Value Objects
    this.#id = id;
    this.#type = type instanceof FeedbackType ? type : new FeedbackType(type);
    this.#status = status instanceof FeedbackStatus ? status : new FeedbackStatus(status);
    this.#titulo = titulo?.trim() || null;
    this.#feedbackText = feedbackText.trim();
    this.#authorId = authorId;
    this.#pageUrl = pageUrl || null;
    this.#screenshotUrl = screenshotUrl || null;
    this.#category = category || null;
    this.#area = area instanceof FeedbackArea ? area : new FeedbackArea(area);
    this.#authorRoleLevel = typeof authorRoleLevel === 'number' ? authorRoleLevel : 5;
    this.#adminAnalysis = adminAnalysis || null;
    this.#adminAction = adminAction || null;
    this.#resolvedById = resolvedById || null;
    this.#resolvedAt = resolvedAt ? new Date(resolvedAt) : null;
    this.#feedbackId = feedbackId || null;
    this.#createdAt = createdAt ? new Date(createdAt) : new Date();
    this.#updatedAt = updatedAt ? new Date(updatedAt) : new Date();
  }

  // Getters
  get id() { return this.#id; }
  get type() { return this.#type; }
  get status() { return this.#status; }
  get titulo() { return this.#titulo; }
  get feedbackText() { return this.#feedbackText; }
  get authorId() { return this.#authorId; }
  get pageUrl() { return this.#pageUrl; }
  get screenshotUrl() { return this.#screenshotUrl; }
  get category() { return this.#category; }
  get area() { return this.#area; }
  get authorRoleLevel() { return this.#authorRoleLevel; }
  get adminAnalysis() { return this.#adminAnalysis; }
  get adminAction() { return this.#adminAction; }
  get resolvedById() { return this.#resolvedById; }
  get resolvedAt() { return this.#resolvedAt; }
  get feedbackId() { return this.#feedbackId; }
  get createdAt() { return this.#createdAt; }
  get updatedAt() { return this.#updatedAt; }

  // Código formatado para exibição (FB-123)
  get code() {
    return this.#id ? `FB-${this.#id}` : null;
  }

  // Verifica se o feedback está fechado
  get isClosed() {
    return this.#status.isClosed;
  }

  // Verifica se o feedback está pendente de análise
  get isPending() {
    return this.#status.isPending;
  }

  // Verifica se é um problema técnico (bug ou erro)
  get isTechnical() {
    return this.#type.isTechnical;
  }

  // Verifica se tem resposta do admin
  get hasAdminResponse() {
    return !!(this.#adminAnalysis || this.#adminAction);
  }

  // Verifica se pertence a um usuário específico
  belongsTo(userId) {
    return this.#authorId === userId;
  }

  /**
   * Verifica se o feedback é visível para um viewer com determinado nível de acesso.
   * admin (level <= 3): vê tudo. leader (4): vê de leaders e users. user (5): vê só de users.
   */
  isVisibleToRole(viewerRoleLevel) {
    if (viewerRoleLevel <= 3) return true;
    return this.#authorRoleLevel >= viewerRoleLevel;
  }

  /**
   * Verifica se o feedback pertence a uma área específica.
   * Feedbacks com área null são "globais" e pertencem a todas as áreas.
   */
  belongsToArea(areaValue) {
    if (this.#area.isNull) return true;
    return this.#area.value === areaValue;
  }

  // --- Comportamentos do domínio ---

  /**
   * Atualiza o status do feedback
   * @param {string|FeedbackStatus} newStatus - Novo status
   * @param {string} resolvedById - ID do usuário que está atualizando (para status finais)
   */
  updateStatus(newStatus, resolvedById = null) {
    const statusVO = newStatus instanceof FeedbackStatus
      ? newStatus
      : new FeedbackStatus(newStatus);

    // Se o status atual já está fechado, não permite reabrir
    if (this.#status.isClosed && statusVO.isOpen) {
      throw new Error('Não é possível reabrir um feedback finalizado ou recusado');
    }

    // Se está finalizando ou recusando, precisa do resolvedById
    if (statusVO.isClosed) {
      if (!resolvedById) {
        throw new Error('É necessário informar quem está finalizando o feedback');
      }
      this.#resolvedById = resolvedById;
      this.#resolvedAt = new Date();
    }

    this.#status = statusVO;
    this.#updatedAt = new Date();
  }

  /**
   * Adiciona análise e ação do admin
   * @param {string} analysis - Análise do feedback
   * @param {string} action - Ação a ser tomada
   */
  addAdminResponse(analysis, action) {
    if (!analysis && !action) {
      throw new Error('É necessário informar análise ou ação');
    }

    if (analysis) {
      this.#adminAnalysis = analysis.trim();
    }

    if (action) {
      this.#adminAction = action.trim();
    }

    this.#updatedAt = new Date();
  }

  /**
   * Define a categoria do feedback (classificação do dev)
   * @param {string} category - Categoria (ux, bug, performance, feature, etc.)
   */
  setCategory(category) {
    this.#category = category || null;
    this.#updatedAt = new Date();
  }

  /**
   * Vincula este feedback a outro (menção)
   * @param {number} feedbackId - ID do feedback relacionado
   */
  linkToFeedback(feedbackId) {
    if (feedbackId === this.#id) {
      throw new Error('Um feedback não pode referenciar a si mesmo');
    }
    this.#feedbackId = feedbackId;
    this.#updatedAt = new Date();
  }

  /**
   * Converte a entidade para objeto simples (para persistência)
   */
  toPersistence() {
    return {
      id: this.#id,
      type: this.#type.value,
      status: this.#status.value,
      titulo: this.#titulo,
      feedback_text: this.#feedbackText,
      author_id: this.#authorId,
      page_url: this.#pageUrl,
      screenshot_url: this.#screenshotUrl,
      category: this.#category,
      area: this.#area.value,
      author_role_level: this.#authorRoleLevel,
      admin_analysis: this.#adminAnalysis,
      admin_action: this.#adminAction,
      resolved_by_id: this.#resolvedById,
      resolved_at: this.#resolvedAt?.toISOString() || null,
      feedback_id: this.#feedbackId,
      created_at: this.#createdAt.toISOString(),
      updated_at: this.#updatedAt.toISOString(),
    };
  }

  /**
   * Converte para formato de resposta da API (inclui campos calculados)
   * @param {Object} authorData - Dados do autor { name, email }
   * @param {Object} resolvedByData - Dados de quem resolveu { name }
   */
  toResponse(authorData = null, resolvedByData = null) {
    return {
      id: this.#id,
      code: this.code,
      type: this.#type.value,
      status: this.#status.value,
      titulo: this.#titulo,
      feedback_text: this.#feedbackText,
      author_id: this.#authorId,
      author_name: authorData?.name || null,
      author_email: authorData?.email || null,
      page_url: this.#pageUrl,
      screenshot_url: this.#screenshotUrl,
      category: this.#category,
      area: this.#area.value,
      author_role_level: this.#authorRoleLevel,
      admin_analysis: this.#adminAnalysis,
      admin_action: this.#adminAction,
      resolved_by_id: this.#resolvedById,
      resolved_by: resolvedByData?.name || null,
      resolved_at: this.#resolvedAt?.toISOString() || null,
      feedback_id: this.#feedbackId,
      created_at: this.#createdAt.toISOString(),
      updated_at: this.#updatedAt.toISOString(),
      // Campos calculados
      is_closed: this.isClosed,
      is_technical: this.isTechnical,
      has_admin_response: this.hasAdminResponse,
    };
  }

  /**
   * Factory method: cria entidade a partir de dados do banco
   */
  static fromPersistence(data) {
    return new Feedback({
      id: data.id,
      type: data.type,
      status: data.status,
      titulo: data.titulo,
      feedbackText: data.feedback_text,
      authorId: data.author_id,
      pageUrl: data.page_url,
      screenshotUrl: data.screenshot_url,
      category: data.category,
      area: data.area || null,
      authorRoleLevel: data.author_role_level ?? 5,
      adminAnalysis: data.admin_analysis,
      adminAction: data.admin_action,
      resolvedById: data.resolved_by_id,
      resolvedAt: data.resolved_at,
      feedbackId: data.feedback_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  }

  /**
   * Factory method: cria novo feedback
   */
  static create({ type, titulo, feedbackText, authorId, pageUrl, screenshotUrl, area, authorRoleLevel }) {
    return new Feedback({
      type,
      titulo,
      feedbackText,
      authorId,
      pageUrl,
      screenshotUrl,
      area,
      authorRoleLevel,
    });
  }
}

export { Feedback };
