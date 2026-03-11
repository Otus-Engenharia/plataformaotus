/**
 * Rotas de NPS (DDD)
 *
 * Implementa as rotas de respostas NPS/CSAT/CES dos clientes.
 */

import express from 'express';
import { SupabaseNpsResponseRepository } from '../infrastructure/repositories/SupabaseNpsResponseRepository.js';
import { CreateNpsResponse } from '../application/use-cases/nps/CreateNpsResponse.js';
import { ListNpsResponses } from '../application/use-cases/nps/ListNpsResponses.js';
import { GetNpsStats } from '../application/use-cases/nps/GetNpsStats.js';
import { NpsScore } from '../domain/nps/value-objects/NpsScore.js';
import { NpsSource } from '../domain/nps/value-objects/NpsSource.js';

const router = express.Router();

let npsRepository = null;

function getRepository() {
  if (!npsRepository) {
    npsRepository = new SupabaseNpsResponseRepository();
  }
  return npsRepository;
}

function createRoutes(requireAuth, isPrivileged, logAction) {
  const repository = getRepository();

  /**
   * POST /api/nps
   * Submeter resposta NPS (auto-preenche email/nome do req.user)
   * Aceita campos opcionais: csat_score, ces_score, client_company, project_name, interviewed_person, decision_level
   */
  router.post('/', requireAuth, async (req, res) => {
    try {
      const {
        project_code, nps_score, feedback_text,
        csat_score, ces_score, client_company, project_name,
        interviewed_person, decision_level,
      } = req.body;

      if (!project_code) {
        return res.status(400).json({
          success: false,
          error: 'Código do projeto é obrigatório',
        });
      }

      if (!NpsScore.isValid(nps_score)) {
        return res.status(400).json({
          success: false,
          error: 'Nota NPS deve ser um inteiro entre 0 e 10 (ou nula)',
        });
      }

      const createNps = new CreateNpsResponse(repository);
      const response = await createNps.execute({
        project_code,
        nps_score: nps_score ?? null,
        feedback_text: feedback_text || null,
        respondentEmail: req.user.email,
        respondentName: req.user.displayName || req.user.name || null,
        csat_score: csat_score ?? null,
        ces_score: ces_score ?? null,
        client_company: client_company || null,
        project_name: project_name || null,
        interviewed_person: interviewed_person || null,
        decision_level: decision_level || null,
      });

      if (logAction) {
        await logAction(req, 'create', 'nps_response', response.id, 'Resposta NPS enviada', {
          project_code,
          nps_score,
        });
      }

      res.status(201).json({
        success: true,
        data: response,
      });
    } catch (error) {
      console.error('Erro ao criar resposta NPS:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao criar resposta NPS',
      });
    }
  });

  /**
   * GET /api/nps
   * Listar respostas NPS (query: project_code, project_codes, source, limit)
   */
  router.get('/', requireAuth, async (req, res) => {
    try {
      const { project_code, project_codes, source, limit } = req.query;

      if (source && !NpsSource.isValid(source)) {
        return res.status(400).json({
          success: false,
          error: `Fonte inválida. Valores permitidos: ${NpsSource.VALID_VALUES.join(', ')}`,
        });
      }

      const listNps = new ListNpsResponses(repository);
      const responses = await listNps.execute({
        projectCode: project_code || null,
        projectCodes: project_codes ? project_codes.split(',') : null,
        source: source || null,
        limit: limit ? parseInt(limit, 10) : null,
      });

      res.json({
        success: true,
        data: responses,
      });
    } catch (error) {
      console.error('Erro ao listar respostas NPS:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao listar respostas NPS',
      });
    }
  });

  /**
   * GET /api/nps/stats
   * Estatísticas agregadas de NPS/CSAT/CES (query: project_code, project_codes, source)
   */
  router.get('/stats', requireAuth, async (req, res) => {
    try {
      const { project_code, project_codes, source } = req.query;

      if (source && !NpsSource.isValid(source)) {
        return res.status(400).json({
          success: false,
          error: `Fonte inválida. Valores permitidos: ${NpsSource.VALID_VALUES.join(', ')}`,
        });
      }

      const getStats = new GetNpsStats(repository);
      const stats = await getStats.execute({
        projectCode: project_code || null,
        projectCodes: project_codes ? project_codes.split(',') : null,
        source: source || null,
      });

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas NPS:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar estatísticas NPS',
      });
    }
  });

  return router;
}

export { createRoutes };
export default router;
