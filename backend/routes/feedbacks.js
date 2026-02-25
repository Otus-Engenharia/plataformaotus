/**
 * Rotas de Feedbacks (DDD)
 *
 * Implementa as rotas usando a arquitetura DDD com use cases.
 */

import express from 'express';
import { SupabaseFeedbackRepository } from '../infrastructure/repositories/SupabaseFeedbackRepository.js';
import {
  ListFeedbacks,
  GetFeedback,
  CreateFeedback,
  UpdateFeedbackStatus,
  UpdateFeedback,
  GetFeedbackStats,
} from '../application/use-cases/feedbacks/index.js';
import { FeedbackArea } from '../domain/feedbacks/value-objects/FeedbackArea.js';
import { FeedbackType } from '../domain/feedbacks/value-objects/FeedbackType.js';
import { FeedbackStatus } from '../domain/feedbacks/value-objects/FeedbackStatus.js';
import { getUserAccessLevel } from '../supabase.js';

const router = express.Router();

// Repositório será instanciado quando as rotas forem configuradas
let feedbackRepository = null;

function getRepository() {
  if (!feedbackRepository) {
    feedbackRepository = new SupabaseFeedbackRepository();
  }
  return feedbackRepository;
}

/**
 * Middleware de autenticação
 * @param {Function} isPrivileged - Função para verificar se é admin/director
 */
function createRoutes(requireAuth, isPrivileged, logAction) {
  // Garante que o repositório seja instanciado quando as rotas são criadas
  const repository = getRepository();

  /**
   * GET /api/feedbacks
   * Lista todos os feedbacks
   */
  router.get('/', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id || null;
      const area = req.query.area || null;
      const adminMode = req.query.admin === 'true';

      // Nível de acesso do viewer
      const viewerRoleLevel = getUserAccessLevel(req.user?.role);

      // Modo admin: só para users com full access (level <= 3)
      if (adminMode && viewerRoleLevel > 3) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado ao modo admin',
        });
      }

      const listFeedbacks = new ListFeedbacks(repository);
      const feedbacks = await listFeedbacks.execute({
        userId,
        area: adminMode ? null : area,
        viewerRoleLevel: adminMode ? null : viewerRoleLevel,
      });

      res.json({
        success: true,
        data: feedbacks,
      });
    } catch (error) {
      console.error('❌ Erro ao buscar feedbacks:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar feedbacks',
      });
    }
  });

  /**
   * GET /api/feedbacks/stats
   * Retorna estatísticas de feedbacks
   */
  router.get('/stats', requireAuth, async (req, res) => {
    try {
      const getStats = new GetFeedbackStats(repository);
      const stats = await getStats.execute();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar estatísticas',
      });
    }
  });

  /**
   * GET /api/feedbacks/:id
   * Busca um feedback específico
   */
  router.get('/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const getFeedback = new GetFeedback(repository);
      const feedback = await getFeedback.execute(parseInt(id, 10));

      if (!feedback) {
        return res.status(404).json({
          success: false,
          error: 'Feedback não encontrado',
        });
      }

      res.json({
        success: true,
        data: feedback,
      });
    } catch (error) {
      console.error('❌ Erro ao buscar feedback:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar feedback',
      });
    }
  });

  /**
   * POST /api/feedbacks
   * Cria um novo feedback
   */
  router.post('/', requireAuth, async (req, res) => {
    try {
      const { type, titulo, descricao, feedback_text, page_url, screenshot_url, area } = req.body;

      // Aceita tanto 'descricao' (legacy) quanto 'feedback_text' (novo)
      const text = feedback_text || descricao;

      // Valida tipo usando Value Object
      if (!type || !FeedbackType.isValid(type)) {
        return res.status(400).json({
          success: false,
          error: `Tipo deve ser um dos seguintes: ${FeedbackType.VALID_VALUES.join(', ')}`,
        });
      }

      if (!text) {
        return res.status(400).json({
          success: false,
          error: 'Texto do feedback é obrigatório',
        });
      }

      // Valida área se fornecida
      if (area && !FeedbackArea.isValid(area)) {
        return res.status(400).json({
          success: false,
          error: `Área inválida. Valores permitidos: ${FeedbackArea.VALID_VALUES.join(', ')}`,
        });
      }

      // Nível de acesso do autor no momento da criação
      const authorRoleLevel = getUserAccessLevel(req.user?.role);

      const createFeedback = new CreateFeedback(repository);
      const feedback = await createFeedback.execute({
        type,
        titulo: titulo || null,
        feedbackText: text,
        authorId: req.user.id,
        pageUrl: page_url || null,
        screenshotUrl: screenshot_url || null,
        area: area || null,
        authorRoleLevel,
      });

      // Registra a criação do feedback
      if (logAction) {
        await logAction(req, 'create', 'feedback', feedback.id, 'Feedback criado', {
          type,
          hasTitle: !!titulo,
        });
      }

      res.status(201).json({
        success: true,
        data: feedback,
      });
    } catch (error) {
      console.error('❌ Erro ao criar feedback:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao criar feedback',
      });
    }
  });

  /**
   * PUT /api/feedbacks/:id/status
   * Atualiza o status de um feedback (admin/director)
   */
  router.put('/:id/status', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado',
          message: 'Somente admin ou director podem alterar o status',
        });
      }

      const { id } = req.params;
      const { status } = req.body;

      // Valida status usando Value Object
      if (!status || !FeedbackStatus.isValid(status)) {
        return res.status(400).json({
          success: false,
          error: `Status deve ser um dos seguintes: ${FeedbackStatus.VALID_VALUES.join(', ')}`,
        });
      }

      const updateStatus = new UpdateFeedbackStatus(repository);
      const feedback = await updateStatus.execute({
        id: parseInt(id, 10),
        status,
        resolvedById: req.user.id,
      });

      // Registra a ação
      if (logAction) {
        await logAction(req, 'update', 'feedback', id, `Status alterado para ${status}`, { status });
      }

      res.json({
        success: true,
        data: feedback,
      });
    } catch (error) {
      console.error('❌ Erro ao atualizar status:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao atualizar status',
      });
    }
  });

  /**
   * PUT /api/feedbacks/:id/parecer
   * Adiciona parecer ao feedback (admin/director)
   */
  router.put('/:id/parecer', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado',
          message: 'Somente admin ou director podem adicionar parecer',
        });
      }

      const { id } = req.params;
      const { parecer, admin_analysis, admin_action } = req.body;

      // Suporte legacy: 'parecer' vai para admin_analysis se não houver admin_analysis
      const analysis = admin_analysis || parecer || null;
      const action = admin_action || null;

      if (!analysis && !action) {
        return res.status(400).json({
          success: false,
          error: 'Análise ou ação a tomar é obrigatória',
        });
      }

      const updateFeedback = new UpdateFeedback(repository);
      const feedback = await updateFeedback.execute({
        id: parseInt(id, 10),
        adminAnalysis: analysis,
        adminAction: action,
        resolvedById: req.user.id,
      });

      // Registra a ação
      if (logAction) {
        await logAction(req, 'update', 'feedback', id, 'Parecer atualizado', {
          hasAnalysis: !!analysis,
          hasAction: !!action,
        });
      }

      res.json({
        success: true,
        data: feedback,
      });
    } catch (error) {
      console.error('❌ Erro ao atualizar parecer:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao atualizar parecer',
      });
    }
  });

  /**
   * PUT /api/feedbacks/:id
   * Atualiza um feedback (admin/director)
   */
  router.put('/:id', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado',
          message: 'Somente admin ou director podem atualizar feedbacks',
        });
      }

      const { id } = req.params;
      const { status, admin_analysis, admin_action, category } = req.body;

      // Validar status se fornecido
      if (status && !FeedbackStatus.isValid(status)) {
        return res.status(400).json({
          success: false,
          error: `Status deve ser um dos seguintes: ${FeedbackStatus.VALID_VALUES.join(', ')}`,
        });
      }

      if (status === undefined && admin_analysis === undefined && admin_action === undefined && category === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum campo para atualizar foi fornecido',
        });
      }

      const updateFeedback = new UpdateFeedback(repository);
      const feedback = await updateFeedback.execute({
        id: parseInt(id, 10),
        status,
        adminAnalysis: admin_analysis,
        adminAction: admin_action,
        category,
        resolvedById: req.user.id,
      });

      // Registra a ação
      if (logAction) {
        await logAction(req, 'update', 'feedback', id, 'Feedback atualizado', {
          status,
          hasAnalysis: !!admin_analysis,
          hasAction: !!admin_action,
          category,
        });
      }

      res.json({
        success: true,
        data: feedback,
      });
    } catch (error) {
      console.error('❌ Erro ao atualizar feedback:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao atualizar feedback',
      });
    }
  });

  return router;
}

export { createRoutes };
export default router;
