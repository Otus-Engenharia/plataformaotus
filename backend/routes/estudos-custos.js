/**
 * Rotas de Estudos de Custos (DDD)
 *
 * Implementa as rotas usando a arquitetura DDD com use cases.
 */

import express from 'express';
import { SupabaseEstudoCustoRepository } from '../infrastructure/repositories/SupabaseEstudoCustoRepository.js';
import {
  ListEstudosCustos,
  GetEstudoCusto,
  CreateEstudoCusto,
  UpdateEstudoCustoStatus,
  UpdateEstudoCusto,
  DeleteEstudoCusto,
  GetEstudoCustoStats,
  AddComentarioEstudoCusto,
} from '../application/use-cases/estudos-custos/index.js';
import { EstudoCustoStatus } from '../domain/estudos-custos/value-objects/EstudoCustoStatus.js';
import { Prioridade } from '../domain/demandas/value-objects/Prioridade.js';

const router = express.Router();

let estudoCustoRepository = null;

function getRepository() {
  if (!estudoCustoRepository) {
    estudoCustoRepository = new SupabaseEstudoCustoRepository();
  }
  return estudoCustoRepository;
}

function createRoutes(requireAuth, isPrivileged, logAction, canManageEstudosCustos) {
  const repository = getRepository();

  async function checkManagePermission(req, estudoCustoId) {
    if (canManageEstudosCustos && canManageEstudosCustos(req.user)) return { allowed: true };

    const estudo = await repository.findById(estudoCustoId);
    if (!estudo) return { allowed: false, notFound: true };
    if (estudo.authorId === req.user.id) return { allowed: true, estudo };

    return { allowed: false, estudo };
  }

  /**
   * GET /api/estudos-custos
   */
  router.get('/', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id || null;
      const listEstudos = new ListEstudosCustos(repository);
      const estudos = await listEstudos.execute({ userId });

      res.json({
        success: true,
        data: estudos,
      });
    } catch (error) {
      console.error('Erro ao buscar estudos de custos:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar estudos de custos',
      });
    }
  });

  /**
   * GET /api/estudos-custos/stats
   */
  router.get('/stats', requireAuth, async (req, res) => {
    try {
      const getStats = new GetEstudoCustoStats(repository);
      const stats = await getStats.execute();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Erro ao buscar estatisticas:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar estatisticas',
      });
    }
  });

  /**
   * GET /api/estudos-custos/:id
   */
  router.get('/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const getEstudo = new GetEstudoCusto(repository);
      const estudo = await getEstudo.execute(parseInt(id, 10));

      if (!estudo) {
        return res.status(404).json({
          success: false,
          error: 'Solicitacao nao encontrada',
        });
      }

      res.json({
        success: true,
        data: estudo,
      });
    } catch (error) {
      console.error('Erro ao buscar estudo de custo:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar estudo de custo',
      });
    }
  });

  /**
   * POST /api/estudos-custos
   */
  router.post('/', requireAuth, async (req, res) => {
    try {
      const {
        projeto,
        nome_time,
        status_fase,
        construflow_id,
        link_construflow,
        data_prevista_apresentacao,
        descricao,
      } = req.body;

      if (!projeto) {
        return res.status(400).json({
          success: false,
          error: 'Projeto e obrigatorio',
        });
      }

      const createEstudo = new CreateEstudoCusto(repository);
      const estudo = await createEstudo.execute({
        projeto,
        nomeTime: nome_time || null,
        statusFase: status_fase || null,
        construflowId: construflow_id || null,
        linkConstruflow: link_construflow || null,
        dataPrevistaApresentacao: data_prevista_apresentacao || null,
        descricao: descricao || null,
        authorId: req.user.id,
      });

      if (logAction) {
        await logAction(req, 'create', 'estudo_custo', estudo.id, 'Solicitacao criada', {
          projeto,
        });
      }

      res.status(201).json({
        success: true,
        data: estudo,
      });
    } catch (error) {
      console.error('Erro ao criar estudo de custo:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao criar estudo de custo',
      });
    }
  });

  /**
   * PUT /api/estudos-custos/:id/status
   */
  router.put('/:id/status', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const parsedId = parseInt(id, 10);

      const perm = await checkManagePermission(req, parsedId);
      if (perm.notFound) {
        return res.status(404).json({ success: false, error: 'Solicitacao nao encontrada' });
      }
      if (!perm.allowed) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const { status } = req.body;

      if (!status || !EstudoCustoStatus.isValid(status)) {
        return res.status(400).json({
          success: false,
          error: `Status deve ser: ${EstudoCustoStatus.VALID_VALUES.join(', ')}`,
        });
      }

      const updateStatus = new UpdateEstudoCustoStatus(repository);
      const estudo = await updateStatus.execute({
        id: parsedId,
        status,
        resolvedById: req.user.id,
      });

      if (logAction) {
        await logAction(req, 'update', 'estudo_custo', id, `Status alterado para ${status}`, { status });
      }

      res.json({
        success: true,
        data: estudo,
      });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao atualizar status',
      });
    }
  });

  /**
   * PUT /api/estudos-custos/:id
   */
  router.put('/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const parsedId = parseInt(id, 10);

      const perm = await checkManagePermission(req, parsedId);
      if (perm.notFound) {
        return res.status(404).json({ success: false, error: 'Solicitacao nao encontrada' });
      }
      if (!perm.allowed) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const {
        status, prioridade, assigned_to,
        link_estudo_custos,
        projeto, nome_time, status_fase,
        construflow_id, link_construflow,
        data_prevista_apresentacao, descricao,
      } = req.body;

      if (status && !EstudoCustoStatus.isValid(status)) {
        return res.status(400).json({
          success: false,
          error: `Status deve ser: ${EstudoCustoStatus.VALID_VALUES.join(', ')}`,
        });
      }

      if (prioridade && !Prioridade.isValid(prioridade)) {
        return res.status(400).json({
          success: false,
          error: `Prioridade deve ser: ${Prioridade.VALID_VALUES.join(', ')}`,
        });
      }

      const contentFields = {};
      if (projeto !== undefined) contentFields.projeto = projeto;
      if (nome_time !== undefined) contentFields.nomeTime = nome_time;
      if (status_fase !== undefined) contentFields.statusFase = status_fase;
      if (construflow_id !== undefined) contentFields.construflowId = construflow_id;
      if (link_construflow !== undefined) contentFields.linkConstruflow = link_construflow;
      if (data_prevista_apresentacao !== undefined) contentFields.dataPrevistaApresentacao = data_prevista_apresentacao;
      if (descricao !== undefined) contentFields.descricao = descricao;

      const hasAdmin = status !== undefined || prioridade !== undefined || assigned_to !== undefined;
      const hasContent = Object.keys(contentFields).length > 0;
      const hasLink = link_estudo_custos !== undefined;

      if (!hasAdmin && !hasContent && !hasLink) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum campo para atualizar',
        });
      }

      const updateEstudo = new UpdateEstudoCusto(repository);
      const estudo = await updateEstudo.execute({
        id: parsedId,
        status,
        prioridade,
        assignedTo: assigned_to,
        resolvedById: req.user.id,
        linkEstudoCustos: link_estudo_custos,
        contentFields: hasContent ? contentFields : undefined,
      });

      if (logAction) {
        await logAction(req, 'update', 'estudo_custo', id, 'Solicitacao atualizada', {
          status,
          prioridade,
          assigned_to,
          ...(hasContent ? { content_updated: true } : {}),
          ...(hasLink ? { link_updated: true } : {}),
        });
      }

      res.json({
        success: true,
        data: estudo,
      });
    } catch (error) {
      console.error('Erro ao atualizar estudo de custo:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao atualizar estudo de custo',
      });
    }
  });

  /**
   * DELETE /api/estudos-custos/:id
   */
  router.delete('/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const parsedId = parseInt(id, 10);

      const perm = await checkManagePermission(req, parsedId);
      if (perm.notFound) {
        return res.status(404).json({ success: false, error: 'Solicitacao nao encontrada' });
      }
      if (!perm.allowed) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const deleteEstudo = new DeleteEstudoCusto(repository);
      await deleteEstudo.execute({ id: parsedId });

      if (logAction) {
        await logAction(req, 'delete', 'estudo_custo', id, 'Solicitacao deletada');
      }

      res.json({
        success: true,
        data: { id: parsedId, deleted: true },
      });
    } catch (error) {
      console.error('Erro ao deletar estudo de custo:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao deletar estudo de custo',
      });
    }
  });

  /**
   * POST /api/estudos-custos/:id/comentarios
   */
  router.post('/:id/comentarios', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { texto } = req.body;

      if (!texto || texto.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Texto do comentario e obrigatorio',
        });
      }

      const addComentario = new AddComentarioEstudoCusto(repository);
      const comentario = await addComentario.execute({
        estudoCustoId: parseInt(id, 10),
        authorId: req.user.id,
        texto,
      });

      res.status(201).json({
        success: true,
        data: comentario,
      });
    } catch (error) {
      console.error('Erro ao adicionar comentario:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao adicionar comentario',
      });
    }
  });

  return router;
}

export { createRoutes };
export default router;
