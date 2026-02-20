/**
 * Rotas de Curva S Progresso (DDD)
 *
 * Implementa as rotas para gerenciamento de pesos da Curva S de progresso físico.
 */

import express from 'express';
import { SupabaseCurvaSProgressoRepository } from '../infrastructure/repositories/SupabaseCurvaSProgressoRepository.js';
import {
  GetDefaultWeights,
  UpdateDefaultWeights,
  GetProjectWeights,
  UpdateProjectWeights,
  CalculateProgress,
  GetProgressTimeSeries,
} from '../application/use-cases/curva-s-progresso/index.js';
import { queryCurvaSProgressoTasks } from '../bigquery.js';
import { fetchDisciplineMappings } from '../supabase.js';

const router = express.Router();

let curvaSRepository = null;

function getRepository() {
  if (!curvaSRepository) {
    curvaSRepository = new SupabaseCurvaSProgressoRepository();
  }
  return curvaSRepository;
}

function createRoutes(requireAuth, isPrivileged, logAction, withBqCache) {
  const repository = getRepository();

  /**
   * GET /api/curva-s-progresso/defaults
   * Busca pesos padrão globais
   */
  router.get('/defaults', requireAuth, async (req, res) => {
    try {
      const getDefaults = new GetDefaultWeights(repository);
      const data = await getDefaults.execute();

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao buscar pesos padrão:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar pesos padrão',
      });
    }
  });

  /**
   * PUT /api/curva-s-progresso/defaults
   * Atualiza pesos padrão globais (requer privilégio)
   */
  router.put('/defaults', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado. Somente admin ou director podem alterar pesos padrão.',
        });
      }

      const { phase_weights, discipline_weights, activity_weights } = req.body;

      const updateDefaults = new UpdateDefaultWeights(repository);
      const data = await updateDefaults.execute({
        phaseWeights: phase_weights,
        disciplineWeights: discipline_weights,
        activityWeights: activity_weights,
      });

      if (logAction) {
        await logAction(req, 'update', 'curva_s_defaults', null, 'Pesos padrão da Curva S atualizados');
      }

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao atualizar pesos padrão:', error);
      const status = error.message.includes('inválida') ? 400 : 500;
      res.status(status).json({
        success: false,
        error: error.message || 'Erro ao atualizar pesos padrão',
      });
    }
  });

  /**
   * GET /api/curva-s-progresso/project/:projectCode/weights
   * Busca pesos merged de um projeto (defaults + overrides)
   */
  router.get('/project/:projectCode/weights', requireAuth, async (req, res) => {
    try {
      const { projectCode } = req.params;

      const getWeights = new GetProjectWeights(repository);
      const data = await getWeights.execute(projectCode);

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao buscar pesos do projeto:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar pesos do projeto',
      });
    }
  });

  /**
   * PUT /api/curva-s-progresso/project/:projectCode/weights
   * Salva overrides de pesos para um projeto
   */
  router.put('/project/:projectCode/weights', requireAuth, async (req, res) => {
    try {
      const { projectCode } = req.params;
      const { phase_weights, discipline_weights, activity_weights } = req.body;

      const updateWeights = new UpdateProjectWeights(repository);
      const data = await updateWeights.execute({
        projectCode,
        phaseWeights: phase_weights,
        disciplineWeights: discipline_weights,
        activityWeights: activity_weights,
      });

      if (logAction) {
        await logAction(req, 'update', 'curva_s_project_weights', projectCode,
          `Pesos da Curva S personalizados para projeto ${projectCode}`);
      }

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao salvar pesos do projeto:', error);
      const status = error.message.includes('inválida') ? 400 : 500;
      res.status(status).json({
        success: false,
        error: error.message || 'Erro ao salvar pesos do projeto',
      });
    }
  });

  /**
   * DELETE /api/curva-s-progresso/project/:projectCode/weights
   * Remove overrides do projeto (reseta para padrão)
   */
  router.delete('/project/:projectCode/weights', requireAuth, async (req, res) => {
    try {
      const { projectCode } = req.params;

      await repository.deleteProjectOverrides(projectCode);

      if (logAction) {
        await logAction(req, 'delete', 'curva_s_project_weights', projectCode,
          `Pesos da Curva S resetados para padrão - projeto ${projectCode}`);
      }

      res.json({
        success: true,
        message: `Pesos do projeto ${projectCode} resetados para padrão`,
      });
    } catch (error) {
      console.error('Erro ao resetar pesos do projeto:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao resetar pesos do projeto',
      });
    }
  });

  /**
   * GET /api/curva-s-progresso/project/:projectCode/progress
   * Calcula o progresso atual do projeto com breakdown por tarefa e fase
   */
  const cacheMiddleware = withBqCache ? withBqCache(900) : (req, res, next) => next();

  router.get('/project/:projectCode/progress', requireAuth, cacheMiddleware, async (req, res) => {
    try {
      const { projectCode } = req.params;
      const { smartsheetId, projectName, projectId } = req.query;

      if (!smartsheetId && !projectName) {
        return res.status(400).json({
          success: false,
          error: 'smartsheetId ou projectName é obrigatório',
        });
      }

      const calcProgress = new CalculateProgress(
        repository,
        queryCurvaSProgressoTasks,
        fetchDisciplineMappings
      );

      const data = await calcProgress.execute({
        projectCode,
        smartsheetId,
        projectName,
        projectId,
      });

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao calcular progresso:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao calcular progresso',
      });
    }
  });

  /**
   * GET /api/curva-s-progresso/project/:projectCode/tasks
   * Retorna breakdown detalhado de tarefas com seus pesos
   */
  router.get('/project/:projectCode/tasks', requireAuth, cacheMiddleware, async (req, res) => {
    try {
      const { projectCode } = req.params;
      const { smartsheetId, projectName, projectId } = req.query;

      if (!smartsheetId && !projectName) {
        return res.status(400).json({
          success: false,
          error: 'smartsheetId ou projectName é obrigatório',
        });
      }

      const calcProgress = new CalculateProgress(
        repository,
        queryCurvaSProgressoTasks,
        fetchDisciplineMappings
      );

      const result = await calcProgress.execute({
        projectCode,
        smartsheetId,
        projectName,
        projectId,
      });

      res.json({
        success: true,
        data: {
          tasks: result.tasks,
          progress: result.progress,
          phase_breakdown: result.phase_breakdown,
        },
      });
    } catch (error) {
      console.error('Erro ao buscar tarefas com pesos:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar tarefas com pesos',
      });
    }
  });

  /**
   * GET /api/curva-s-progresso/project/:projectCode/timeseries
   * Retorna série temporal mensal para o gráfico da Curva S
   */
  router.get('/project/:projectCode/timeseries', requireAuth, cacheMiddleware, async (req, res) => {
    try {
      const { projectCode } = req.params;
      const { smartsheetId, projectName, projectId, startDate, endDate } = req.query;

      if (!smartsheetId && !projectName) {
        return res.status(400).json({
          success: false,
          error: 'smartsheetId ou projectName é obrigatório',
        });
      }

      const getTimeSeries = new GetProgressTimeSeries(
        repository,
        queryCurvaSProgressoTasks,
        fetchDisciplineMappings
      );

      const data = await getTimeSeries.execute({
        projectCode,
        smartsheetId,
        projectName,
        projectId,
        startDate,
        endDate,
      });

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao calcular série temporal:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao calcular série temporal',
      });
    }
  });

  return router;
}

export { createRoutes };
export default router;
