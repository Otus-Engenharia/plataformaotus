/**
 * Rotas: Time Savings (Economia de Horas)
 *
 * Endpoints para dashboard, auditoria e gestão do catálogo de automações.
 */

import express from 'express';
import { SupabaseTimeSavingsRepository } from '../infrastructure/repositories/SupabaseTimeSavingsRepository.js';
import {
  GetTimeSavingsSummary,
  GetTimeSavingsDetails,
  ListAutomationCatalog,
  UpdateCatalogEstimate,
} from '../application/use-cases/time-savings/index.js';

const router = express.Router();
let repository = null;

function getRepository() {
  if (!repository) {
    repository = new SupabaseTimeSavingsRepository();
  }
  return repository;
}

function createRoutes(requireAuth, isPrivileged, logAction) {
  /**
   * GET /api/time-savings/summary
   * Retorna dados agregados para o dashboard
   * Query: ?period=all|month|week&area=projetos|lideres
   */
  router.get('/summary', requireAuth, async (req, res) => {
    try {
      const { period = 'all', area } = req.query;
      const useCase = new GetTimeSavingsSummary(getRepository());
      const data = await useCase.execute({ period, area });
      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao buscar sumário de economia:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/time-savings/events
   * Log de auditoria paginado e filtrável
   * Query: ?catalog_id=&user_email=&from=&to=&page=1&limit=50
   */
  router.get('/events', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado',
          message: 'Somente admin ou director podem ver o log de auditoria',
        });
      }

      const { catalog_id: catalogId, user_email: userEmail, from, to, page, limit } = req.query;
      const useCase = new GetTimeSavingsDetails(getRepository());
      const data = await useCase.execute({
        catalogId,
        userEmail,
        from,
        to,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 50,
      });
      res.json({ success: true, ...data });
    } catch (error) {
      console.error('Erro ao buscar eventos de economia:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/time-savings/catalog
   * Lista todas as automações do catálogo
   */
  router.get('/catalog', requireAuth, async (req, res) => {
    try {
      const useCase = new ListAutomationCatalog(getRepository());
      const activeOnly = req.query.all !== 'true';
      const data = await useCase.execute({ activeOnly });
      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao buscar catálogo:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * PUT /api/time-savings/catalog/:id
   * Atualiza estimativa de minutos ou ativa/desativa automação (admin)
   * Body: { default_minutes: number, is_active: boolean }
   */
  router.put('/catalog/:id', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado',
          message: 'Somente admin ou director podem alterar estimativas',
        });
      }

      const { id } = req.params;
      const { default_minutes: defaultMinutes, is_active: isActive } = req.body;

      const useCase = new UpdateCatalogEstimate(getRepository());
      const data = await useCase.execute({
        id,
        defaultMinutes: defaultMinutes !== undefined ? Number(defaultMinutes) : undefined,
        isActive,
      });

      if (logAction) {
        await logAction(req, 'update', 'time_savings_catalog', id, 'Atualizar estimativa', {
          default_minutes: defaultMinutes,
          is_active: isActive,
        });
      }

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao atualizar catálogo:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

export { createRoutes };
