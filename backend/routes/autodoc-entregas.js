/**
 * Rotas: Autodoc Entregas
 *
 * Endpoints para entregas Autodoc e mapeamento de projetos.
 */

import express from 'express';
import { SupabaseAutodocEntregasRepository } from '../infrastructure/repositories/SupabaseAutodocEntregasRepository.js';
import { AutodocHttpClient } from '../infrastructure/services/AutodocHttpClient.js';
import {
  SyncAllCustomers,
  ListRecentEntregas,
  GetEntregasSummary,
  ManageProjectMappings,
  DiscoverAutodocProjects,
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
   * POST /api/autodoc-entregas/sync-all
   * Sincroniza todos os customers. Privileged only.
   */
  router.post('/sync-all', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const useCase = new SyncAllCustomers(getRepository(), getAutodocClient());
      const result = await useCase.execute();

      if (logAction) {
        await logAction(req, 'sync-all', 'autodoc-entregas', null, 'Sync all Autodoc customers', {
          totalCustomers: result.totalCustomers,
          totalDocuments: result.totalDocuments,
        });
      }

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao sincronizar Autodoc:', error);
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

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao descobrir projetos Autodoc:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

export { createRoutes };
