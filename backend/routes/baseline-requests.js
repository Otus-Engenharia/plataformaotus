/**
 * Rotas de Solicitações de Baseline (DDD)
 *
 * Workflow: Coordenador solicita → Gerente aprova/rejeita.
 */

import express from 'express';
import { SupabaseBaselineRequestRepository } from '../infrastructure/repositories/SupabaseBaselineRequestRepository.js';
import { SupabaseBaselineRepository } from '../infrastructure/repositories/SupabaseBaselineRepository.js';
import {
  CreateBaselineRequest,
  ListBaselineRequests,
  ApproveBaselineRequest,
  RejectBaselineRequest,
} from '../application/use-cases/baseline-requests/index.js';

const router = express.Router();

let requestRepository = null;
let baselineRepository = null;

function getRequestRepository() {
  if (!requestRepository) {
    requestRepository = new SupabaseBaselineRequestRepository();
  }
  return requestRepository;
}

function getBaselineRepository() {
  if (!baselineRepository) {
    baselineRepository = new SupabaseBaselineRepository();
  }
  return baselineRepository;
}

function createRoutes(requireAuth, isPrivileged, logAction) {
  const repo = getRequestRepository();

  /**
   * POST /api/baseline-requests
   * Coordenador cria solicitação de baseline
   */
  router.post('/', requireAuth, async (req, res) => {
    try {
      const { project_code, project_name, title, description, response_deadline } = req.body;

      const createRequest = new CreateBaselineRequest(repo);
      const data = await createRequest.execute({
        projectCode: project_code,
        projectName: project_name,
        title,
        description,
        responseDeadline: response_deadline,
        requestedById: req.user?.id || null,
        requestedByEmail: req.user?.email,
        requestedByName: req.user?.name || null,
      });

      if (logAction) {
        await logAction(req, 'create', 'baseline_request', data.id, 'Solicitação de baseline criada', {
          project_code, title,
        });
      }

      res.status(201).json({ success: true, data });
    } catch (error) {
      console.error('Erro ao criar solicitação de baseline:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/baseline-requests?project_code=X
   * Lista solicitações por projeto
   */
  router.get('/', requireAuth, async (req, res) => {
    try {
      const { project_code } = req.query;
      if (!project_code) {
        return res.status(400).json({ success: false, error: 'project_code é obrigatório' });
      }

      const listRequests = new ListBaselineRequests(repo);
      const data = await listRequests.execute({ projectCode: project_code });

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao listar solicitações:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/baseline-requests/pending
   * Lista solicitações pendentes (para gerentes)
   */
  router.get('/pending', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const listRequests = new ListBaselineRequests(repo);
      const data = await listRequests.execute({ pendingOnly: true });

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao listar solicitações pendentes:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/baseline-requests/:id/approve
   * Gerente aprova solicitação
   */
  router.post('/:id/approve', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const { smartsheet_id, project_name } = req.body;

      const approveRequest = new ApproveBaselineRequest(repo, getBaselineRepository());
      const data = await approveRequest.execute({
        requestId: Number(req.params.id),
        reviewerId: req.user?.id || null,
        reviewerEmail: req.user?.email,
        reviewerName: req.user?.name || null,
        smartsheetId: smartsheet_id,
        projectName: project_name,
      });

      if (logAction) {
        await logAction(req, 'approve', 'baseline_request', Number(req.params.id), 'Solicitação de baseline aprovada', {
          baseline_id: data.baseline?.id,
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
   * POST /api/baseline-requests/:id/reject
   * Gerente rejeita solicitação
   */
  router.post('/:id/reject', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const { reason } = req.body;

      const rejectRequest = new RejectBaselineRequest(repo);
      const data = await rejectRequest.execute({
        requestId: Number(req.params.id),
        reviewerId: req.user?.id || null,
        reviewerEmail: req.user?.email,
        reviewerName: req.user?.name || null,
        reason,
      });

      if (logAction) {
        await logAction(req, 'reject', 'baseline_request', Number(req.params.id), 'Solicitação de baseline rejeitada', {
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
