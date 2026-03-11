/**
 * Rotas de Pesquisas CS (DDD)
 *
 * Implementa as rotas de percepção de equipe usando arquitetura DDD.
 */

import express from 'express';
import { SupabasePesquisaCSRepository } from '../infrastructure/repositories/SupabasePesquisaCSRepository.js';
import {
  CreatePercepcaoEquipe,
  ListPercepcoes,
  GetPercepcaoStats,
  GetComplianceReport,
  ImportPercepcoes,
} from '../application/use-cases/pesquisas-cs/index.js';
import { fetchActiveProjectsByTeam } from '../supabase.js';

const router = express.Router();

let repository = null;

function getRepository() {
  if (!repository) {
    repository = new SupabasePesquisaCSRepository();
  }
  return repository;
}

function createRoutes(requireAuth, isPrivileged, logAction) {
  const repo = getRepository();

  /**
   * POST /api/cs/percepcao-equipe
   * Submeter percepção
   */
  router.post('/', requireAuth, async (req, res) => {
    try {
      const {
        projeto_codigo, mes_referencia, ano_referencia,
        cronograma, qualidade, comunicacao, custos, parceria, confianca,
        oportunidade_revenda, comentarios,
      } = req.body;

      if (!projeto_codigo || !mes_referencia || !ano_referencia) {
        return res.status(400).json({
          success: false,
          error: 'Campos obrigatórios: projeto_codigo, mes_referencia, ano_referencia',
        });
      }

      const useCase = new CreatePercepcaoEquipe(repo);
      const result = await useCase.execute({
        projetoCodigo: projeto_codigo,
        mes: mes_referencia,
        ano: ano_referencia,
        respondenteEmail: req.user.email,
        respondenteNome: req.user.name || req.user.displayName || null,
        cronograma: cronograma ?? null,
        qualidade,
        comunicacao,
        custos,
        parceria,
        confianca,
        oportunidadeRevenda: oportunidade_revenda ?? null,
        comentarios: comentarios || null,
      });

      if (logAction) {
        await logAction(req, 'create', 'percepcao_equipe', result.id, 'Percepção criada', {
          projeto: projeto_codigo,
          periodo: `${mes_referencia}/${ano_referencia}`,
        });
      }

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao criar percepção:', error);
      const status = error.message.includes('Já existe') ? 409 : 500;
      res.status(status).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/cs/percepcao-equipe
   * Listar percepções (filtros via query params)
   */
  router.get('/', requireAuth, async (req, res) => {
    try {
      const { mes, ano, projeto, email } = req.query;

      const useCase = new ListPercepcoes(repo);
      const result = await useCase.execute({
        mes,
        ano,
        projetoCodigo: projeto,
        respondenteEmail: email,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao listar percepções:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/cs/percepcao-equipe/stats
   * Indicadores agregados (IP/IVE/ISP)
   */
  router.get('/stats', requireAuth, async (req, res) => {
    try {
      const { mes, ano } = req.query;

      const useCase = new GetPercepcaoStats(repo);
      const result = await useCase.execute({ mes, ano });

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao buscar stats:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/cs/percepcao-equipe/compliance
   * Relatório de compliance: projetos preenchidos vs pendentes
   */
  router.get('/compliance', requireAuth, async (req, res) => {
    try {
      const { mes, ano, team_id } = req.query;

      if (!mes || !ano) {
        return res.status(400).json({
          success: false,
          error: 'Parâmetros obrigatórios: mes, ano',
        });
      }

      const projetosAtivos = await fetchActiveProjectsByTeam(team_id ? Number(team_id) : null);

      const useCase = new GetComplianceReport(repo);
      const result = await useCase.execute({
        mes: Number(mes),
        ano: Number(ano),
        projetosAtivos,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao buscar compliance:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/cs/percepcao-equipe/import
   * Import CSV (admin)
   */
  router.post('/import', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const { records } = req.body;

      if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Campo "records" deve ser um array não vazio',
        });
      }

      const useCase = new ImportPercepcoes(repo);
      const result = await useCase.execute(records);

      if (logAction) {
        await logAction(req, 'import', 'percepcao_equipe', null, `Import: ${result.imported} registros`, {
          imported: result.imported,
          errors: result.errors.length,
        });
      }

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao importar percepções:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/cs/percepcao-equipe/:id
   * Deletar (admin)
   */
  router.delete('/:id', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      await repo.delete(req.params.id);

      if (logAction) {
        await logAction(req, 'delete', 'percepcao_equipe', req.params.id, 'Percepção removida');
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao remover percepção:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

export { createRoutes };
export default router;
