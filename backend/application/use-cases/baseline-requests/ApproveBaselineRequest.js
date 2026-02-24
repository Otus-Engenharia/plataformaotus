/**
 * Use Case: ApproveBaselineRequest
 * Gerente aprova solicitação → cria baseline real + Gmail draft.
 */

import { CreateBaseline } from '../../use-cases/baselines/CreateBaseline.js';
import { createGmailDraft } from '../../../gmail.js';

class ApproveBaselineRequest {
  #requestRepository;
  #baselineRepository;

  constructor(requestRepository, baselineRepository) {
    this.#requestRepository = requestRepository;
    this.#baselineRepository = baselineRepository;
  }

  async execute({ requestId, reviewerId, reviewerEmail, reviewerName, smartsheetId, projectName }) {
    // 1. Buscar solicitação
    const request = await this.#requestRepository.findById(requestId);
    if (!request) {
      throw new Error('Solicitação não encontrada');
    }

    // 2. Criar baseline real via use case existente
    const createBaseline = new CreateBaseline(this.#baselineRepository);
    const baseline = await createBaseline.execute({
      projectCode: request.projectCode,
      smartsheetId,
      projectName: projectName || request.projectName,
      name: request.title,
      description: request.description,
      createdByEmail: request.requestedByEmail,
    });

    // 3. Aprovar solicitação
    request.approve(reviewerId, reviewerEmail, reviewerName, baseline.id);

    // 4. Tentar criar Gmail draft (graceful fallback)
    let gmailWarning = null;
    try {
      if (reviewerId) {
        const draft = await createGmailDraft(reviewerId, {
          to: [request.requestedByEmail],
          subject: `[Otus] Nova Baseline Registrada - ${request.projectName || request.projectCode} - ${baseline.name}`,
          body: buildApprovalEmailBody(request, baseline, reviewerName),
        });
        request.setGmailDraftId(draft.draftId);
      }
    } catch (err) {
      console.error('Erro ao criar Gmail draft de aprovação:', err.message);
      gmailWarning = err.message === 'GMAIL_NOT_AUTHORIZED'
        ? 'Gmail não autorizado. Rascunho não criado.'
        : `Erro ao criar rascunho: ${err.message}`;
    }

    // 5. Salvar estado atualizado
    const updated = await this.#requestRepository.update(request);

    return {
      request: updated.toResponse(),
      baseline,
      gmail_warning: gmailWarning,
    };
  }
}

function buildApprovalEmailBody(request, baseline, reviewerName) {
  return [
    `Prezados,`,
    ``,
    `Informamos que uma nova Linha de Base foi registrada para o projeto ${request.projectName || request.projectCode}.`,
    ``,
    `Detalhes:`,
    `- Projeto: ${request.projectName || request.projectCode}`,
    `- Nome da Baseline: ${baseline.name}`,
    `- Data do Snapshot: ${baseline.snapshot_date}`,
    `- Tarefas capturadas: ${baseline.task_count}`,
    `- Solicitado por: ${request.requestedByName || request.requestedByEmail}`,
    `- Aprovado por: ${reviewerName || 'Gerente'}`,
    ``,
    `Descrição da solicitação:`,
    request.description || '(sem descrição)',
    ``,
    `Atenciosamente,`,
    `Equipe Otus Engenharia`,
  ].join('\n');
}

export { ApproveBaselineRequest };
