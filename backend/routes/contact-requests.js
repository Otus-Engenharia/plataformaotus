/**
 * Rotas de Solicitações de Alteração de Contato (DDD)
 *
 * Workflow: Equipe de operação solicita → Equipe de dados aprova/rejeita.
 */

import express from 'express';
import { hasFullAccess } from '../auth-config.js';
import { SupabaseContactChangeRequestRepository } from '../infrastructure/repositories/SupabaseContactChangeRequestRepository.js';
import { createContact, updateContact, createCompany } from '../supabase.js';
import {
  CreateContactChangeRequest,
  ListContactChangeRequests,
  ApproveContactChangeRequest,
  RejectContactChangeRequest,
  GetPendingContactRequestCount,
} from '../application/use-cases/contact-requests/index.js';

const router = express.Router();

let repository = null;

function getRepository() {
  if (!repository) {
    repository = new SupabaseContactChangeRequestRepository();
  }
  return repository;
}

const contactService = {
  createContact,
  updateContact,
  createCompany,
};

function createRoutes(requireAuth, isPrivileged, logAction, withBqCache) {
  const repo = getRepository();
  const badgeCacheMiddleware = withBqCache ? withBqCache(60) : (req, res, next) => next();

  /**
   * POST /api/contact-requests
   * Qualquer usuário autenticado cria uma solicitação
   */
  router.post('/', requireAuth, async (req, res) => {
    try {
      const { request_type, payload, target_contact_id, target_company_id, project_code } = req.body;

      const createRequest = new CreateContactChangeRequest(repo);
      const data = await createRequest.execute({
        requestType: request_type,
        payload,
        targetContactId: target_contact_id,
        targetCompanyId: target_company_id,
        projectCode: project_code,
        requestedById: req.user?.id || null,
        requestedByEmail: req.user?.email,
        requestedByName: req.user?.name || null,
      });

      if (logAction) {
        await logAction(req, 'create', 'contact_change_request', data.id, `Solicitação de ${data.request_type_label} criada`, {
          request_type: data.request_type,
          project_code: data.project_code,
        });
      }

      res.status(201).json({ success: true, data });
    } catch (error) {
      console.error('Erro ao criar solicitação de contato:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/contact-requests
   * Lista solicitações (por requester_email, project_code, status, request_type)
   */
  router.get('/', requireAuth, async (req, res) => {
    try {
      const { requester_email, project_code, status, request_type } = req.query;

      const listRequests = new ListContactChangeRequests(repo);
      const data = await listRequests.execute({
        requesterEmail: requester_email,
        projectCode: project_code,
        status,
        requestType: request_type,
      });

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao listar solicitações:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/contact-requests/pending
   * Lista solicitações pendentes (equipe de dados)
   */
  router.get('/pending', requireAuth, badgeCacheMiddleware, async (req, res) => {
    try {
      if (!hasFullAccess(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const listRequests = new ListContactChangeRequests(repo);
      const data = await listRequests.execute({ pendingOnly: true });

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao listar solicitações pendentes:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/contact-requests/pending-count
   * Contagem de pendentes (para badge)
   */
  router.get('/pending-count', requireAuth, badgeCacheMiddleware, async (req, res) => {
    try {
      if (!hasFullAccess(req.user)) {
        return res.json({ success: true, data: { count: 0 } });
      }

      const getCount = new GetPendingContactRequestCount(repo);
      const count = await getCount.execute();

      res.json({ success: true, data: { count } });
    } catch (error) {
      console.error('Erro ao contar solicitações pendentes:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/contact-requests/:id/approve
   * Equipe de dados aprova a solicitação
   */
  router.post('/:id/approve', requireAuth, async (req, res) => {
    try {
      if (!hasFullAccess(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const approveRequest = new ApproveContactChangeRequest(repo, contactService);
      const data = await approveRequest.execute({
        requestId: Number(req.params.id),
        reviewerId: req.user?.id || null,
        reviewerEmail: req.user?.email,
        reviewerName: req.user?.name || null,
      });

      if (logAction) {
        await logAction(req, 'approve', 'contact_change_request', Number(req.params.id), 'Solicitação de contato aprovada', {
          result_contact_id: data.resultContactId,
          result_company_id: data.resultCompanyId,
        });
      }

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao aprovar solicitação:', error);
      const status = error.message.includes('não encontrada') ? 404 : 400;
      res.status(status).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/contact-requests/:id/reject
   * Equipe de dados rejeita a solicitação
   */
  router.post('/:id/reject', requireAuth, async (req, res) => {
    try {
      if (!hasFullAccess(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const { reason } = req.body;

      const rejectRequest = new RejectContactChangeRequest(repo);
      const data = await rejectRequest.execute({
        requestId: Number(req.params.id),
        reviewerId: req.user?.id || null,
        reviewerEmail: req.user?.email,
        reviewerName: req.user?.name || null,
        reason,
      });

      if (logAction) {
        await logAction(req, 'reject', 'contact_change_request', Number(req.params.id), 'Solicitação de contato rejeitada', {
          reason,
        });
      }

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao rejeitar solicitação:', error);
      const status = error.message.includes('não encontrada') ? 404 : 400;
      res.status(status).json({ success: false, error: error.message });
    }
  });

  return router;
}

export { createRoutes };
