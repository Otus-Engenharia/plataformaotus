/**
 * Rotas de Baselines (DDD)
 *
 * CRUD de baselines com snapshot de tarefas.
 */

import express from 'express';
import { SupabaseBaselineRepository } from '../infrastructure/repositories/SupabaseBaselineRepository.js';
import { SupabaseCurvaSProgressoRepository } from '../infrastructure/repositories/SupabaseCurvaSProgressoRepository.js';
import {
  CreateBaseline,
  ListBaselines,
  GetBaseline,
  UpdateBaseline,
  DeleteBaseline,
  GetBaselineCurve,
} from '../application/use-cases/baselines/index.js';

const router = express.Router();

let baselineRepository = null;
let curvaSRepository = null;

function getBaselineRepository() {
  if (!baselineRepository) {
    baselineRepository = new SupabaseBaselineRepository();
  }
  return baselineRepository;
}

function getCurvaSRepository() {
  if (!curvaSRepository) {
    curvaSRepository = new SupabaseCurvaSProgressoRepository();
  }
  return curvaSRepository;
}

function createRoutes(requireAuth, isPrivileged, logAction) {
  const repo = getBaselineRepository();

  /**
   * GET /api/baselines/summary
   * Resumo: quantidade de baselines por projeto
   */
  router.get('/summary', requireAuth, async (req, res) => {
    try {
      const summary = await repo.getSummaryByProject();
      res.json({ success: true, data: summary });
    } catch (error) {
      console.error('Erro ao buscar resumo de baselines:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/baselines?project_code=XXX
   * Lista baselines de um projeto
   */
  router.get('/', requireAuth, async (req, res) => {
    try {
      const { project_code } = req.query;
      if (!project_code) {
        return res.status(400).json({ success: false, error: 'project_code é obrigatório' });
      }

      const listBaselines = new ListBaselines(repo);
      const data = await listBaselines.execute({ projectCode: project_code });

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao listar baselines:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/baselines/:id
   * Detalhes de uma baseline
   */
  router.get('/:id', requireAuth, async (req, res) => {
    try {
      const getBaseline = new GetBaseline(repo);
      const data = await getBaseline.execute({ id: Number(req.params.id) });

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao buscar baseline:', error);
      const status = error.message.includes('não encontrada') ? 404 : 500;
      res.status(status).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/baselines/:id/curve
   * Curva calculada da baseline
   */
  router.get('/:id/curve', requireAuth, async (req, res) => {
    try {
      const { start_date, end_date, project_code } = req.query;

      const getBaselineCurve = new GetBaselineCurve(repo, getCurvaSRepository());
      const data = await getBaselineCurve.execute({
        id: Number(req.params.id),
        projectCode: project_code,
        startDate: start_date,
        endDate: end_date,
      });

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao calcular curva da baseline:', error);
      const status = error.message.includes('não encontrada') ? 404 : 500;
      res.status(status).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/baselines
   * Cria nova baseline com snapshot das tarefas atuais
   */
  router.post('/', requireAuth, async (req, res) => {
    try {
      const { project_code, smartsheet_id, project_name, name, description } = req.body;
      if (!project_code) {
        return res.status(400).json({ success: false, error: 'project_code é obrigatório' });
      }

      const createBaseline = new CreateBaseline(repo);
      const data = await createBaseline.execute({
        projectCode: project_code,
        smartsheetId: smartsheet_id,
        projectName: project_name,
        name,
        description,
        createdByEmail: req.user?.email || null,
      });

      if (logAction) {
        await logAction(req, 'create', 'baseline', data.id, 'Baseline criada', {
          project_code, name: data.name, revision: data.revision_number,
        });
      }

      res.status(201).json({ success: true, data });
    } catch (error) {
      console.error('Erro ao criar baseline:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * PUT /api/baselines/:id
   * Atualiza metadados de uma baseline
   */
  router.put('/:id', requireAuth, async (req, res) => {
    try {
      const { name, description, is_active } = req.body;

      const updateBaseline = new UpdateBaseline(repo);
      const data = await updateBaseline.execute({
        id: Number(req.params.id),
        name,
        description,
        isActive: is_active,
      });

      if (logAction) {
        await logAction(req, 'update', 'baseline', data.id, 'Baseline atualizada', { name: data.name });
      }

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao atualizar baseline:', error);
      const status = error.message.includes('não encontrada') ? 404 : 500;
      res.status(status).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/baselines/:id
   * Remove baseline e snapshot
   */
  router.delete('/:id', requireAuth, async (req, res) => {
    try {
      const deleteBaseline = new DeleteBaseline(repo);
      const data = await deleteBaseline.execute({ id: Number(req.params.id) });

      if (logAction) {
        await logAction(req, 'delete', 'baseline', data.id, 'Baseline removida', { name: data.name });
      }

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao deletar baseline:', error);
      const status = error.message.includes('não encontrada') ? 404 : 500;
      res.status(status).json({ success: false, error: error.message });
    }
  });

  return router;
}

export { createRoutes };
