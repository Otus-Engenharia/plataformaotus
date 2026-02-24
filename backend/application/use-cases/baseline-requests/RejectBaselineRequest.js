/**
 * Use Case: RejectBaselineRequest
 * Gerente rejeita solicitação → Gmail draft com justificativa.
 */

import { createGmailDraft } from '../../../gmail.js';

class RejectBaselineRequest {
  #requestRepository;

  constructor(requestRepository) {
    this.#requestRepository = requestRepository;
  }

  async execute({ requestId, reviewerId, reviewerEmail, reviewerName, reason }) {
    if (!reason || reason.trim().length === 0) {
      throw new Error('Justificativa é obrigatória para rejeição');
    }

    // 1. Buscar solicitação
    const request = await this.#requestRepository.findById(requestId);
    if (!request) {
      throw new Error('Solicitação não encontrada');
    }

    // 2. Rejeitar
    request.reject(reviewerId, reviewerEmail, reviewerName, reason);

    // 3. Tentar criar Gmail draft (graceful fallback)
    let gmailWarning = null;
    try {
      if (reviewerId) {
        const draft = await createGmailDraft(reviewerId, {
          to: [request.requestedByEmail],
          subject: `[Otus] Solicitação de Baseline Recusada - ${request.projectName || request.projectCode}`,
          body: buildRejectionEmailBody(request, reviewerName, reason),
        });
        request.setGmailDraftId(draft.draftId);
      }
    } catch (err) {
      console.error('Erro ao criar Gmail draft de rejeição:', err.message);
      gmailWarning = err.message === 'GMAIL_NOT_AUTHORIZED'
        ? 'Gmail não autorizado. Rascunho não criado.'
        : `Erro ao criar rascunho: ${err.message}`;
    }

    // 4. Salvar estado atualizado
    const updated = await this.#requestRepository.update(request);

    return {
      request: updated.toResponse(),
      gmail_warning: gmailWarning,
    };
  }
}

function buildRejectionEmailBody(request, reviewerName, reason) {
  return [
    `Prezado(a) ${request.requestedByName || 'Coordenador(a)'},`,
    ``,
    `A solicitação de nova Linha de Base para o projeto ${request.projectName || request.projectCode} foi recusada.`,
    ``,
    `Detalhes da solicitação:`,
    `- Título: ${request.title}`,
    `- Projeto: ${request.projectName || request.projectCode}`,
    `- Data da solicitação: ${new Date(request.createdAt).toLocaleDateString('pt-BR')}`,
    ``,
    `Justificativa da recusa:`,
    reason,
    ``,
    `Revisado por: ${reviewerName || 'Gerente'}`,
    ``,
    `Em caso de dúvidas, entre em contato com o gerente do projeto.`,
    ``,
    `Atenciosamente,`,
    `Equipe Otus Engenharia`,
  ].join('\n');
}

export { RejectBaselineRequest };
