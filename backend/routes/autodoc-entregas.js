/**
 * Rotas: Autodoc Entregas
 *
 * Endpoints para entregas Autodoc e mapeamento de projetos.
 */

import crypto from 'node:crypto';
import express from 'express';
import { SupabaseAutodocEntregasRepository } from '../infrastructure/repositories/SupabaseAutodocEntregasRepository.js';
import { AutodocHttpClient } from '../infrastructure/services/AutodocHttpClient.js';
import {
  SyncAllCustomers,
  ListRecentEntregas,
  GetEntregasSummary,
  ManageProjectMappings,
  DiscoverAutodocProjects,
  GetDailyStats,
} from '../application/use-cases/acd/autodoc-entregas/index.js';

const router = express.Router();
let repository = null;
let autodocClient = null;

function getRepository() {
  if (!repository) repository = new SupabaseAutodocEntregasRepository();
  return repository;
}

function getAutodocClient() {
  if (!autodocClient) autodocClient = new AutodocHttpClient();
  return autodocClient;
}

function createRoutes(requireAuth, isPrivileged, logAction) {
  /**
   * GET /api/autodoc-entregas/recent
   * Entregas recentes com filtros.
   * Query: ?days=7&projectCode=X&classification=Y&page=1&limit=50
   */
  router.get('/recent', requireAuth, async (req, res) => {
    try {
      const { days = 7, projectCode, classification, page = 1, limit = 50 } = req.query;
      const useCase = new ListRecentEntregas(getRepository());
      const result = await useCase.execute({
        days: Number(days),
        projectCode: projectCode || undefined,
        classification: classification || undefined,
        page: Number(page),
        limit: Number(limit),
      });
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Erro ao buscar entregas recentes:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/autodoc-entregas/summary
   * Estatisticas agregadas.
   * Query: ?days=7
   */
  router.get('/summary', requireAuth, async (req, res) => {
    try {
      const { days = 7 } = req.query;
      const useCase = new GetEntregasSummary(getRepository());
      const result = await useCase.execute({ days: Number(days) });
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao buscar resumo Autodoc:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/autodoc-entregas/daily-stats
   * Estatísticas diárias de entregas por projeto.
   * Query: ?days=7
   */
  router.get('/daily-stats', requireAuth, async (req, res) => {
    try {
      const { days = 7 } = req.query;
      const useCase = new GetDailyStats(getRepository());
      const result = await useCase.execute({ days: Number(days) });
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao buscar daily stats:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/autodoc-entregas/sync-all
   * Inicia sync de todos os customers (fire-and-forget). Privileged only.
   */
  router.post('/sync-all', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const useCase = new SyncAllCustomers(getRepository(), getAutodocClient());
      const batchId = crypto.randomUUID();

      // Fire-and-forget: iniciar sync sem aguardar
      useCase.execute({ batchId })
        .then((result) => {
          if (logAction) {
            logAction(req, 'sync-all', 'autodoc-entregas', null, 'Sync all Autodoc customers', {
              totalCustomers: result.totalCustomers,
              totalDocuments: result.totalDocuments,
            }).catch(err => console.error('Erro ao logar acao sync-all:', err));
          }
          console.log(`[autodoc-entregas] Sync concluido: ${result.totalCustomers} contas, ${result.totalDocuments} docs`);
        })
        .catch((err) => {
          console.error('[autodoc-entregas] Erro no sync fire-and-forget:', err);
        });

      res.json({ success: true, message: 'Sync iniciado', batchId });
    } catch (error) {
      console.error('Erro ao iniciar sync Autodoc:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/autodoc-entregas/sync-status
   * Retorna status dos sync runs recentes (ultimas 2h).
   */
  router.get('/sync-status', requireAuth, async (req, res) => {
    try {
      const { batchId } = req.query;
      const repo = getRepository();
      const runs = await repo.getRecentSyncRuns(2, { batchId: batchId || undefined });

      const running = runs.filter(r => r.status === 'running').length;
      const completed = runs.filter(r => r.status === 'completed').length;
      const failed = runs.filter(r => r.status === 'error' || r.status === 'timeout').length;
      const total = runs.length;

      const totalProjectsAll = runs.reduce((sum, r) => sum + (r.total_projects || 0), 0);
      const projectsCompletedAll = runs.reduce((sum, r) => {
        if (r.status !== 'running') return sum + (r.total_projects || 0);
        return sum + (r.projects_completed || 0);
      }, 0);

      res.json({
        success: true,
        data: { running, completed, failed, total, totalProjectsAll, projectsCompletedAll, runs },
      });
    } catch (error) {
      console.error('Erro ao buscar sync status:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/autodoc-entregas/mappings
   * Lista mapeamentos. Privileged only.
   */
  router.get('/mappings', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const useCase = new ManageProjectMappings(getRepository());
      const data = await useCase.list({ activeOnly: false });
      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao buscar mapeamentos:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/autodoc-entregas/mappings
   * Criar/atualizar mapeamento. Privileged only.
   */
  router.post('/mappings', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const useCase = new ManageProjectMappings(getRepository());
      const data = await useCase.upsert(req.body);

      if (logAction) {
        await logAction(req, 'create-mapping', 'autodoc-entregas', req.body.portfolioProjectCode, 'Create Autodoc mapping');
      }

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao salvar mapeamento:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/autodoc-entregas/mappings/:id
   * Deletar mapeamento. Privileged only.
   */
  router.delete('/mappings/:id', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const useCase = new ManageProjectMappings(getRepository());
      await useCase.delete(req.params.id);

      if (logAction) {
        await logAction(req, 'delete-mapping', 'autodoc-entregas', req.params.id, 'Delete Autodoc mapping');
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao deletar mapeamento:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/autodoc-entregas/debug-customers
   * Retorna estrutura dos customers com products (para investigacao). Privileged only.
   */
  router.get('/debug-customers', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }
      const client = getAutodocClient();
      const customersResponse = await client.getCustomers();
      const customers = customersResponse?.data || customersResponse || [];
      const summary = (Array.isArray(customers) ? customers : []).map(c => ({
        id: c.id || c.customerId,
        name: c.name || c.customerName,
        products: c.products || [],
      }));
      res.json({ success: true, data: summary });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/autodoc-entregas/discover
   * Descobre projetos Autodoc e sugere matches. Privileged only.
   */
  router.post('/discover', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const { portfolioProjectCodes = [] } = req.body;
      const useCase = new DiscoverAutodocProjects(getRepository(), getAutodocClient());
      const result = await useCase.execute({ portfolioProjectCodes });

      res.json({ success: true, data: result.results, diagnostics: result.diagnostics });
    } catch (error) {
      console.error('Erro ao descobrir projetos Autodoc:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

export { createRoutes };
