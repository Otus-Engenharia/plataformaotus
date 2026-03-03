/**
 * Rotas de Preferências do Usuário (DDD)
 *
 * Gerencia projetos favoritos e outras preferências do usuário.
 */

import express from 'express';
import { SupabaseUserPreferencesRepository } from '../infrastructure/repositories/SupabaseUserPreferencesRepository.js';
import {
  ListFavoriteProjects,
  AddFavoriteProject,
  AddFavoriteProjectsByTeam,
  RemoveFavoriteProject,
  RemoveFavoriteProjectsByTeam,
  AddFavoriteProjectsBatch,
  RemoveFavoriteProjectsBatch,
} from '../application/use-cases/user-preferences/index.js';

const router = express.Router();

let repository = null;

function getRepository() {
  if (!repository) {
    repository = new SupabaseUserPreferencesRepository();
  }
  return repository;
}

function createRoutes(requireAuth, logAction) {
  const repo = getRepository();

  /**
   * GET /api/user-preferences/favorite-projects
   * Lista projetos favoritos do usuário
   */
  router.get('/favorite-projects', requireAuth, async (req, res) => {
    try {
      const listFavorites = new ListFavoriteProjects(repo);
      const projects = await listFavorites.execute({ userId: req.user?.id });

      res.json({ success: true, data: projects });
    } catch (error) {
      console.error('Erro ao buscar projetos favoritos:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao buscar projetos favoritos' });
    }
  });

  /**
   * GET /api/user-preferences/projects
   * Lista todos os projetos disponíveis (para seleção)
   */
  router.get('/projects', requireAuth, async (req, res) => {
    try {
      const projects = await repo.getAllProjects();
      res.json({ success: true, data: projects });
    } catch (error) {
      console.error('Erro ao buscar projetos:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao buscar projetos' });
    }
  });

  /**
   * GET /api/user-preferences/teams
   * Lista todos os times
   */
  router.get('/teams', requireAuth, async (req, res) => {
    try {
      const teams = await repo.getTeams();
      res.json({ success: true, data: teams });
    } catch (error) {
      console.error('Erro ao buscar times:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao buscar times' });
    }
  });

  /**
   * POST /api/user-preferences/favorite-projects
   * Adiciona um projeto aos favoritos
   */
  router.post('/favorite-projects', requireAuth, async (req, res) => {
    try {
      const { project_id } = req.body;
      const addFavorite = new AddFavoriteProject(repo);
      const project = await addFavorite.execute({ userId: req.user?.id, projectId: project_id });

      if (logAction) {
        await logAction(req, 'create', 'favorite_project', project_id, 'Projeto favoritado');
      }

      res.status(201).json({ success: true, data: project });
    } catch (error) {
      console.error('Erro ao adicionar favorito:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao adicionar favorito' });
    }
  });

  /**
   * POST /api/user-preferences/favorite-projects/team
   * Adiciona todos os projetos de um time aos favoritos
   */
  router.post('/favorite-projects/team', requireAuth, async (req, res) => {
    try {
      const { team_id } = req.body;
      const addByTeam = new AddFavoriteProjectsByTeam(repo);
      const result = await addByTeam.execute({ userId: req.user?.id, teamId: team_id });

      if (logAction) {
        await logAction(req, 'create', 'favorite_projects_team', team_id, `${result.count} projetos favoritados via time`);
      }

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao adicionar favoritos do time:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao adicionar favoritos do time' });
    }
  });

  /**
   * POST /api/user-preferences/favorite-projects/batch
   * Adiciona multiplos projetos aos favoritos de uma vez
   */
  router.post('/favorite-projects/batch', requireAuth, async (req, res) => {
    try {
      const { project_ids } = req.body;
      const addBatch = new AddFavoriteProjectsBatch(repo);
      const result = await addBatch.execute({ userId: req.user?.id, projectIds: project_ids });

      if (logAction) {
        await logAction(req, 'create', 'favorite_projects_batch', null, `${result.count} projetos favoritados em lote`);
      }

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao adicionar favoritos em lote:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao adicionar favoritos em lote' });
    }
  });

  /**
   * POST /api/user-preferences/favorite-projects/batch-remove
   * Remove multiplos projetos dos favoritos de uma vez
   */
  router.post('/favorite-projects/batch-remove', requireAuth, async (req, res) => {
    try {
      const { project_ids } = req.body;
      const removeBatch = new RemoveFavoriteProjectsBatch(repo);
      const result = await removeBatch.execute({ userId: req.user?.id, projectIds: project_ids });

      if (logAction) {
        await logAction(req, 'delete', 'favorite_projects_batch', null, `${result.count} projetos removidos em lote`);
      }

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao remover favoritos em lote:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao remover favoritos em lote' });
    }
  });

  /**
   * DELETE /api/user-preferences/favorite-projects/team/:teamId
   * Remove todos os projetos de um time dos favoritos
   */
  router.delete('/favorite-projects/team/:teamId', requireAuth, async (req, res) => {
    try {
      const { teamId } = req.params;
      const removeByTeam = new RemoveFavoriteProjectsByTeam(repo);
      const result = await removeByTeam.execute({ userId: req.user?.id, teamId });

      if (logAction) {
        await logAction(req, 'delete', 'favorite_projects_team', teamId, `${result.count} projetos removidos do time`);
      }

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao remover favoritos do time:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao remover favoritos do time' });
    }
  });

  /**
   * DELETE /api/user-preferences/favorite-projects/:projectId
   * Remove um projeto dos favoritos
   */
  router.delete('/favorite-projects/:projectId', requireAuth, async (req, res) => {
    try {
      const { projectId } = req.params;
      const removeFavorite = new RemoveFavoriteProject(repo);
      await removeFavorite.execute({ userId: req.user?.id, projectId });

      if (logAction) {
        await logAction(req, 'delete', 'favorite_project', projectId, 'Projeto desfavoritado');
      }

      res.json({ success: true, message: 'Favorito removido com sucesso' });
    } catch (error) {
      console.error('Erro ao remover favorito:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao remover favorito' });
    }
  });

  return router;
}

export { createRoutes };
export default router;
