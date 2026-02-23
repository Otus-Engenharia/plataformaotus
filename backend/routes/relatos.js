/**
 * Rotas de Relatos (DDD)
 *
 * Implementa as rotas do domínio de Relatos (Diário de Projeto).
 */

import express from 'express';
import { SupabaseRelatoRepository } from '../infrastructure/repositories/SupabaseRelatoRepository.js';
import {
  CreateRelato,
  GetRelato,
  ListRelatos,
  UpdateRelato,
  DeleteRelato,
  GetRelatoStats,
  ListTipos,
  CreateTipo,
  UpdateTipo,
  ListPrioridades,
  CreatePrioridade,
  UpdatePrioridade,
} from '../application/use-cases/relatos/index.js';

const router = express.Router();

let relatoRepository = null;

function getRepository() {
  if (!relatoRepository) {
    relatoRepository = new SupabaseRelatoRepository();
  }
  return relatoRepository;
}

function createRoutes(requireAuth, isPrivileged, logAction) {
  const repository = getRepository();

  // =============================================
  // Lookup endpoints (ANTES de /:id)
  // =============================================

  /**
   * GET /api/relatos/tipos
   * Lista todos os tipos de relato ativos
   */
  router.get('/tipos', requireAuth, async (req, res) => {
    try {
      const listTipos = new ListTipos(repository);
      const tipos = await listTipos.execute();

      res.json({ success: true, data: tipos });
    } catch (error) {
      console.error('Erro ao buscar tipos de relato:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/relatos/tipos (admin)
   * Cria novo tipo de relato
   */
  router.post('/tipos', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const { slug, label, color, icon, sort_order } = req.body;
      const createTipo = new CreateTipo(repository);
      const tipo = await createTipo.execute({ slug, label, color, icon, sortOrder: sort_order });

      if (logAction) {
        await logAction(req, 'create', 'relato_tipo', tipo.id, `Tipo criado: ${label}`);
      }

      res.status(201).json({ success: true, data: tipo });
    } catch (error) {
      console.error('Erro ao criar tipo de relato:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * PUT /api/relatos/tipos/:id (admin)
   * Atualiza tipo de relato
   */
  router.put('/tipos/:id', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const { id } = req.params;
      const { label, color, icon, sort_order, is_active } = req.body;
      const updateTipo = new UpdateTipo(repository);
      const tipo = await updateTipo.execute({
        id: parseInt(id, 10),
        label,
        color,
        icon,
        sortOrder: sort_order,
        isActive: is_active,
      });

      if (logAction) {
        await logAction(req, 'update', 'relato_tipo', id, 'Tipo atualizado');
      }

      res.json({ success: true, data: tipo });
    } catch (error) {
      console.error('Erro ao atualizar tipo de relato:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/relatos/prioridades
   * Lista todas as prioridades ativas
   */
  router.get('/prioridades', requireAuth, async (req, res) => {
    try {
      const listPrioridades = new ListPrioridades(repository);
      const prioridades = await listPrioridades.execute();

      res.json({ success: true, data: prioridades });
    } catch (error) {
      console.error('Erro ao buscar prioridades:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/relatos/prioridades (admin)
   * Cria nova prioridade
   */
  router.post('/prioridades', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const { slug, label, color, sort_order } = req.body;
      const createPrioridade = new CreatePrioridade(repository);
      const prioridade = await createPrioridade.execute({ slug, label, color, sortOrder: sort_order });

      if (logAction) {
        await logAction(req, 'create', 'relato_prioridade', prioridade.id, `Prioridade criada: ${label}`);
      }

      res.status(201).json({ success: true, data: prioridade });
    } catch (error) {
      console.error('Erro ao criar prioridade:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * PUT /api/relatos/prioridades/:id (admin)
   * Atualiza prioridade
   */
  router.put('/prioridades/:id', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const { id } = req.params;
      const { label, color, sort_order, is_active } = req.body;
      const updatePrioridade = new UpdatePrioridade(repository);
      const prioridade = await updatePrioridade.execute({
        id: parseInt(id, 10),
        label,
        color,
        sortOrder: sort_order,
        isActive: is_active,
      });

      if (logAction) {
        await logAction(req, 'update', 'relato_prioridade', id, 'Prioridade atualizada');
      }

      res.json({ success: true, data: prioridade });
    } catch (error) {
      console.error('Erro ao atualizar prioridade:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // =============================================
  // Relatos CRUD (project-scoped)
  // =============================================

  /**
   * GET /api/relatos/project/:projectCode
   * Lista relatos de um projeto (com filtros opcionais)
   */
  router.get('/project/:projectCode', requireAuth, async (req, res) => {
    try {
      const { projectCode } = req.params;
      const { tipo, prioridade } = req.query;

      const listRelatos = new ListRelatos(repository);
      const relatos = await listRelatos.execute({ projectCode, tipo, prioridade });

      res.json({ success: true, data: relatos });
    } catch (error) {
      console.error('Erro ao buscar relatos:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/relatos/project/:projectCode/stats
   * Estatísticas de relatos de um projeto
   */
  router.get('/project/:projectCode/stats', requireAuth, async (req, res) => {
    try {
      const { projectCode } = req.params;
      const getStats = new GetRelatoStats(repository);
      const stats = await getStats.execute(projectCode);

      res.json({ success: true, data: stats });
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/relatos/:id
   * Busca um relato específico
   */
  router.get('/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const getRelato = new GetRelato(repository);
      const relato = await getRelato.execute(parseInt(id, 10));

      if (!relato) {
        return res.status(404).json({ success: false, error: 'Relato não encontrado' });
      }

      res.json({ success: true, data: relato });
    } catch (error) {
      console.error('Erro ao buscar relato:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/relatos
   * Cria novo relato
   */
  router.post('/', requireAuth, async (req, res) => {
    try {
      const { project_code, tipo, prioridade, titulo, descricao } = req.body;

      const createRelato = new CreateRelato(repository);
      const relato = await createRelato.execute({
        projectCode: project_code,
        tipo,
        prioridade,
        titulo,
        descricao,
        authorId: req.user.id,
        authorName: req.user.name || req.user.displayName || null,
      });

      if (logAction) {
        await logAction(req, 'create', 'relato', relato.id, `Relato criado: ${titulo}`, {
          project_code,
          tipo,
          prioridade,
        });
      }

      res.status(201).json({ success: true, data: relato });
    } catch (error) {
      console.error('Erro ao criar relato:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * PUT /api/relatos/:id
   * Atualiza relato (autor ou admin)
   */
  router.put('/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { titulo, descricao, tipo, prioridade, is_resolved } = req.body;

      // Verifica permissão: autor ou admin
      const getRelato = new GetRelato(repository);
      const existing = await getRelato.execute(parseInt(id, 10));
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Relato não encontrado' });
      }
      if (existing.author_id !== req.user.id && !isPrivileged(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const updateRelato = new UpdateRelato(repository);
      const relato = await updateRelato.execute({
        id: parseInt(id, 10),
        titulo,
        descricao,
        tipo,
        prioridade,
        isResolved: is_resolved,
        resolvedById: req.user.id,
      });

      if (logAction) {
        await logAction(req, 'update', 'relato', id, 'Relato atualizado');
      }

      res.json({ success: true, data: relato });
    } catch (error) {
      console.error('Erro ao atualizar relato:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/relatos/:id
   * Remove relato (autor ou admin)
   */
  router.delete('/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      // Verifica permissão: autor ou admin
      const getRelato = new GetRelato(repository);
      const existing = await getRelato.execute(parseInt(id, 10));
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Relato não encontrado' });
      }
      if (existing.author_id !== req.user.id && !isPrivileged(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const deleteRelato = new DeleteRelato(repository);
      await deleteRelato.execute(parseInt(id, 10));

      if (logAction) {
        await logAction(req, 'delete', 'relato', id, `Relato removido: ${existing.titulo}`);
      }

      res.json({ success: true, message: 'Relato removido com sucesso' });
    } catch (error) {
      console.error('Erro ao remover relato:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

export { createRoutes };
export default router;
