/**
 * Rotas de Customer Success (DDD)
 *
 * Implementa as rotas usando a arquitetura DDD com use cases.
 */

import express from 'express';
import { SupabaseCustomerSuccessRepository } from '../infrastructure/repositories/SupabaseCustomerSuccessRepository.js';
import {
  ListClassificacoes,
  UpdateClassificacao,
  GenerateSnapshot,
  ListSnapshots,
  GetClienteChurnStats,
  ImportHistoricalSnapshots,
  GetClienteStatusMap,
} from '../application/use-cases/customer-success/index.js';
import { Classificacao } from '../domain/customer-success/value-objects/Classificacao.js';
import { ClassificacaoCliente } from '../domain/customer-success/entities/ClassificacaoCliente.js';
import { queryPortfolio } from '../bigquery.js';

const router = express.Router();

let _repository = null;

function getRepository() {
  if (!_repository) _repository = new SupabaseCustomerSuccessRepository();
  return _repository;
}

/**
 * @param {Function} requireAuth - Middleware de autenticação
 * @param {Function} isPrivileged - Verifica se é admin/director
 * @param {Function} logAction - Registra ação de auditoria
 */
function createRoutes(requireAuth, isPrivileged, logAction) {
  const repository = getRepository();

  /**
   * GET /api/customer-success
   * Lista todas as classificações de clientes
   */
  router.get('/', requireAuth, async (req, res) => {
    try {
      const data = await new ListClassificacoes(repository).execute();
      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao listar classificações:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao listar classificações' });
    }
  });

  /**
   * GET /api/customer-success/companies
   * Lista companies do tipo client para popular dropdown
   */
  router.get('/companies', requireAuth, async (req, res) => {
    try {
      const data = await repository.findAllCompaniesClient();
      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao listar companies:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao listar companies' });
    }
  });

  /**
   * GET /api/customer-success/status-clientes
   * Retorna status (ATIVO/CHURN) de cada cliente baseado nos projetos
   */
  router.get('/status-clientes', requireAuth, async (req, res) => {
    try {
      const data = await new GetClienteStatusMap(repository, { queryPortfolio }).execute();
      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao buscar status dos clientes:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao buscar status dos clientes' });
    }
  });

  /**
   * PUT /api/customer-success/:companyId
   * Atualiza a classificação de um cliente por company_id (CS/admin)
   */
  router.put('/:companyId', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado',
          message: 'Somente CS ou admin podem classificar clientes',
        });
      }

      const { classificacao, clienteNome } = req.body;
      const companyId = Number(req.params.companyId);

      if (!companyId || isNaN(companyId)) {
        return res.status(400).json({ success: false, error: 'companyId inválido' });
      }

      if (!classificacao || !Classificacao.isValid(String(classificacao).toUpperCase().trim())) {
        return res.status(400).json({
          success: false,
          error: `Classificação deve ser um dos seguintes: ${Classificacao.VALID_VALUES.join(', ')}`,
        });
      }

      if (!clienteNome) {
        return res.status(400).json({ success: false, error: 'clienteNome é obrigatório' });
      }

      const data = await new UpdateClassificacao(repository).execute({
        companyId,
        clienteNome,
        classificacao,
        userId: req.user.id,
        userName: req.user.name,
      });

      if (logAction) {
        await logAction(req, 'update', 'classificacao_cliente', String(companyId), `Classificação alterada para ${classificacao}`, { classificacao, companyId });
      }

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao atualizar classificação:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao atualizar classificação' });
    }
  });

  /**
   * POST /api/customer-success/import
   * Importa classificações em lote via CSV
   * Body: { rows: Array<{ company_id, cliente, classificacao }> }
   */
  router.post('/import', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado',
          message: 'Somente CS ou admin podem importar classificações',
        });
      }

      const { rows } = req.body;

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ success: false, error: 'Campo "rows" deve ser um array não vazio' });
      }

      const invalidRows = rows.filter(
        (row) => !row.company_id || !row.cliente || !Classificacao.isValid(String(row.classificacao || '').toUpperCase().trim())
      );

      if (invalidRows.length > 0) {
        return res.status(400).json({
          success: false,
          error: `${invalidRows.length} linha(s) inválida(s). Verifique os campos "company_id", "cliente" e "classificacao" (A/B/C/D)`,
        });
      }

      const entities = rows.map((row) =>
        ClassificacaoCliente.create({
          companyId: Number(row.company_id),
          cliente: row.cliente,
          classificacao: row.classificacao,
          updatedById: req.user.id,
          updatedByName: req.user.name,
        })
      );

      await repository.upsertClassificacoes(entities);

      res.json({ success: true, imported: entities.length });
    } catch (error) {
      console.error('Erro ao importar classificações:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao importar classificações' });
    }
  });

  /**
   * POST /api/customer-success/snapshots/generate
   * Gera um snapshot do portfolio para a data informada
   * Body: { snapshotDate?: string }
   */
  router.post('/snapshots/generate', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado',
          message: 'Somente CS ou admin podem gerar snapshots',
        });
      }

      const data = await new GenerateSnapshot(repository, { queryPortfolio }).execute({
        snapshotDate: req.body.snapshotDate,
      });

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao gerar snapshot:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao gerar snapshot' });
    }
  });

  /**
   * GET /api/customer-success/snapshots/stats
   * Retorna indicadores de churn por mês/ano
   * Query params: month, year
   */
  router.get('/snapshots/stats', requireAuth, async (req, res) => {
    try {
      const { month, year } = req.query;
      const data = await new GetClienteChurnStats(repository).execute({ month, year });
      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao buscar stats de churn:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao buscar stats' });
    }
  });

  /**
   * POST /api/customer-success/snapshots/import
   * Importa snapshots históricos
   * Body: { rows }
   */
  router.post('/snapshots/import', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado',
          message: 'Somente CS ou admin podem importar snapshots históricos',
        });
      }

      const { rows } = req.body;

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ success: false, error: 'Campo "rows" deve ser um array não vazio' });
      }

      const data = await new ImportHistoricalSnapshots(repository).execute({ rows });

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao importar snapshots históricos:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao importar snapshots históricos' });
    }
  });

  /**
   * GET /api/customer-success/snapshots
   * Lista snapshots com filtros opcionais
   * Query params: month, year, cliente, statusProjeto
   */
  router.get('/snapshots', requireAuth, async (req, res) => {
    try {
      const { month, year, cliente, statusProjeto } = req.query;
      const data = await new ListSnapshots(repository).execute({ month, year, cliente, statusProjeto });
      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao listar snapshots:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao listar snapshots' });
    }
  });

  return router;
}

export { createRoutes };
export default router;
