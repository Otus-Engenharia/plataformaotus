/**
 * Rotas de Demandas (DDD)
 *
 * Implementa as rotas usando a arquitetura DDD com use cases.
 */

import express from 'express';
import { SupabaseDemandaRepository } from '../infrastructure/repositories/SupabaseDemandaRepository.js';
import {
  ListDemandas,
  GetDemanda,
  CreateDemanda,
  UpdateDemandaStatus,
  UpdateDemanda,
  GetDemandaStats,
  AddComentario,
} from '../application/use-cases/demandas/index.js';
import { DemandaCategoria } from '../domain/demandas/value-objects/DemandaCategoria.js';
import { DemandaStatus } from '../domain/demandas/value-objects/DemandaStatus.js';
import { TipoServico } from '../domain/demandas/value-objects/TipoServico.js';
import { Prioridade } from '../domain/demandas/value-objects/Prioridade.js';

const router = express.Router();

let demandaRepository = null;

function getRepository() {
  if (!demandaRepository) {
    demandaRepository = new SupabaseDemandaRepository();
  }
  return demandaRepository;
}

function createRoutes(requireAuth, isPrivileged, logAction) {
  const repository = getRepository();

  /**
   * GET /api/demandas
   */
  router.get('/', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id || null;
      const listDemandas = new ListDemandas(repository);
      const demandas = await listDemandas.execute({ userId });

      res.json({
        success: true,
        data: demandas,
      });
    } catch (error) {
      console.error('Erro ao buscar demandas:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar demandas',
      });
    }
  });

  /**
   * GET /api/demandas/stats
   */
  router.get('/stats', requireAuth, async (req, res) => {
    try {
      const getStats = new GetDemandaStats(repository);
      const stats = await getStats.execute();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar estatísticas',
      });
    }
  });

  /**
   * GET /api/demandas/:id
   */
  router.get('/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const getDemanda = new GetDemanda(repository);
      const demanda = await getDemanda.execute(parseInt(id, 10));

      if (!demanda) {
        return res.status(404).json({
          success: false,
          error: 'Demanda não encontrada',
        });
      }

      res.json({
        success: true,
        data: demanda,
      });
    } catch (error) {
      console.error('Erro ao buscar demanda:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar demanda',
      });
    }
  });

  /**
   * POST /api/demandas
   */
  router.post('/', requireAuth, async (req, res) => {
    try {
      const {
        categoria,
        tipo_servico,
        tipo_servico_outro,
        coordenador_projeto,
        cliente_projeto,
        acesso_cronograma,
        link_cronograma,
        acesso_drive,
        link_drive,
        descricao,
      } = req.body;

      // Valida categoria
      if (!categoria || !DemandaCategoria.isValid(categoria)) {
        return res.status(400).json({
          success: false,
          error: `Categoria deve ser: ${DemandaCategoria.VALID_VALUES.join(', ')}`,
        });
      }

      // Valida tipo_servico se categoria é modelagem
      if (categoria === 'modelagem' && tipo_servico && !TipoServico.isValid(tipo_servico)) {
        return res.status(400).json({
          success: false,
          error: `Tipo de serviço deve ser: ${TipoServico.VALID_VALUES.join(', ')}`,
        });
      }

      if (!descricao) {
        return res.status(400).json({
          success: false,
          error: 'Descrição é obrigatória',
        });
      }

      if (!coordenador_projeto) {
        return res.status(400).json({
          success: false,
          error: 'Coordenador do projeto é obrigatório',
        });
      }

      if (!cliente_projeto) {
        return res.status(400).json({
          success: false,
          error: 'Cliente/Projeto é obrigatório',
        });
      }

      const createDemanda = new CreateDemanda(repository);
      const demanda = await createDemanda.execute({
        categoria,
        tipoServico: tipo_servico || null,
        tipoServicoOutro: tipo_servico_outro || null,
        coordenadorProjeto: coordenador_projeto,
        clienteProjeto: cliente_projeto,
        acessoCronograma: acesso_cronograma || false,
        linkCronograma: link_cronograma || null,
        acessoDrive: acesso_drive || false,
        linkDrive: link_drive || null,
        descricao,
        authorId: req.user.id,
      });

      if (logAction) {
        await logAction(req, 'create', 'demanda', demanda.id, 'Demanda criada', {
          categoria,
          tipo_servico,
        });
      }

      res.status(201).json({
        success: true,
        data: demanda,
      });
    } catch (error) {
      console.error('Erro ao criar demanda:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao criar demanda',
      });
    }
  });

  /**
   * PUT /api/demandas/:id/status
   */
  router.put('/:id/status', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user.email)) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado',
        });
      }

      const { id } = req.params;
      const { status } = req.body;

      if (!status || !DemandaStatus.isValid(status)) {
        return res.status(400).json({
          success: false,
          error: `Status deve ser: ${DemandaStatus.VALID_VALUES.join(', ')}`,
        });
      }

      const updateStatus = new UpdateDemandaStatus(repository);
      const demanda = await updateStatus.execute({
        id: parseInt(id, 10),
        status,
        resolvedById: req.user.id,
      });

      if (logAction) {
        await logAction(req, 'update', 'demanda', id, `Status alterado para ${status}`, { status });
      }

      res.json({
        success: true,
        data: demanda,
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
   * PUT /api/demandas/:id
   */
  router.put('/:id', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user.email)) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado',
        });
      }

      const { id } = req.params;
      const { status, prioridade, assigned_to } = req.body;

      if (status && !DemandaStatus.isValid(status)) {
        return res.status(400).json({
          success: false,
          error: `Status deve ser: ${DemandaStatus.VALID_VALUES.join(', ')}`,
        });
      }

      if (prioridade && !Prioridade.isValid(prioridade)) {
        return res.status(400).json({
          success: false,
          error: `Prioridade deve ser: ${Prioridade.VALID_VALUES.join(', ')}`,
        });
      }

      if (status === undefined && prioridade === undefined && assigned_to === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum campo para atualizar',
        });
      }

      const updateDemanda = new UpdateDemanda(repository);
      const demanda = await updateDemanda.execute({
        id: parseInt(id, 10),
        status,
        prioridade,
        assignedTo: assigned_to,
        resolvedById: req.user.id,
      });

      if (logAction) {
        await logAction(req, 'update', 'demanda', id, 'Demanda atualizada', {
          status,
          prioridade,
          assigned_to,
        });
      }

      res.json({
        success: true,
        data: demanda,
      });
    } catch (error) {
      console.error('Erro ao atualizar demanda:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao atualizar demanda',
      });
    }
  });

  /**
   * POST /api/demandas/:id/comentarios
   * Qualquer usuário autenticado pode comentar
   */
  router.post('/:id/comentarios', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { texto } = req.body;

      if (!texto || texto.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Texto do comentário é obrigatório',
        });
      }

      const addComentario = new AddComentario(repository);
      const comentario = await addComentario.execute({
        demandaId: parseInt(id, 10),
        authorId: req.user.id,
        texto,
      });

      res.status(201).json({
        success: true,
        data: comentario,
      });
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao adicionar comentário',
      });
    }
  });

  return router;
}

export { createRoutes };
export default router;
