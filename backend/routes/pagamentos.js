import express from 'express';
import { SupabasePagamentoRepository } from '../infrastructure/repositories/SupabasePagamentoRepository.js';
import { NotificationService } from '../infrastructure/services/NotificationService.js';
import {
  CreateParcela,
  UpdateParcela,
  UpdateParcelaStatus,
  VincularParcela,
  ListParcelasByProject,
  EnrichParcelasWithSmartsheet,
  GetUpcomingParcelas,
  CreateRegraCliente,
  UpdateRegraCliente,
  ListRegrasCliente,
  GetParcelaChangeLog,
  GetDashboardKpis,
  ListAllProjectsSummary,
  ListParcelasByGerente,
} from '../application/use-cases/pagamentos/index.js';

const router = express.Router();

let pagamentoRepository = null;
let notificationService = null;

function getRepository() {
  if (!pagamentoRepository) pagamentoRepository = new SupabasePagamentoRepository();
  return pagamentoRepository;
}

function getNotificationService() {
  if (!notificationService) notificationService = new NotificationService();
  return notificationService;
}

function createRoutes(requireAuth, isPrivileged, canManagePagamentos, logAction, withBqCache, bigqueryClient) {
  const repository = getRepository();
  const notifications = getNotificationService();

  // GET /dashboard-kpis
  router.get('/dashboard-kpis', requireAuth, async (req, res) => {
    try {
      const getDashboardKpis = new GetDashboardKpis(repository);
      const result = await getDashboardKpis.execute();
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao buscar dashboard KPIs:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /all-projects
  router.get('/all-projects', requireAuth, async (req, res) => {
    try {
      const listAll = new ListAllProjectsSummary(repository);
      const result = await listAll.execute();
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao listar projetos:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /meus-projetos
  router.get('/meus-projetos', requireAuth, async (req, res) => {
    try {
      // Admin/DEV sees all projects; leaders see only their own
      if (isPrivileged(req.user) || canManagePagamentos(req.user)) {
        const listAll = new ListAllProjectsSummary(repository);
        const result = await listAll.execute();
        res.json({ success: true, data: result });
      } else {
        const listMeus = new ListParcelasByGerente(repository);
        const result = await listMeus.execute({ email: req.user.email });
        res.json({ success: true, data: result });
      }
    } catch (error) {
      console.error('Erro ao listar meus projetos:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /parcelas - Create parcela
  router.post('/parcelas', requireAuth, async (req, res) => {
    try {
      if (!canManagePagamentos(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const { project_code, project_id, company_id, parcela_numero, descricao, valor, origem, fase, gerente_email, tipo_servico } = req.body;

      if (!project_code || !parcela_numero) {
        return res.status(400).json({ success: false, error: 'project_code e parcela_numero sao obrigatorios' });
      }

      const createParcela = new CreateParcela(repository, notifications);
      const result = await createParcela.execute({
        projectCode: project_code,
        projectId: project_id || null,
        companyId: company_id || null,
        parcelaNumero: parcela_numero,
        descricao: descricao || null,
        valor: valor || null,
        origem: origem || 'Contrato',
        fase: fase || null,
        gerenteEmail: gerente_email || null,
        tipoServico: tipo_servico || 'coordenacao',
        createdBy: req.user.email,
      });

      if (logAction) {
        await logAction(req, 'create', 'parcela', result.id, 'Parcela criada', { project_code, parcela_numero });
      }

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao criar parcela:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /parcelas - List by project
  router.get('/parcelas', requireAuth, async (req, res) => {
    try {
      const { projectCode } = req.query;
      if (!projectCode) {
        return res.status(400).json({ success: false, error: 'projectCode e obrigatorio' });
      }

      const listParcelas = new ListParcelasByProject(repository);
      const result = await listParcelas.execute({ projectCode });

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao listar parcelas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /parcelas/:id - Get one
  router.get('/parcelas/:id', requireAuth, async (req, res) => {
    try {
      const parcela = await repository.findParcelaById(req.params.id);
      if (!parcela) {
        return res.status(404).json({ success: false, error: 'Parcela nao encontrada' });
      }

      res.json({ success: true, data: parcela.toResponse() });
    } catch (error) {
      console.error('Erro ao buscar parcela:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /parcelas/:id - Update
  router.put('/parcelas/:id', requireAuth, async (req, res) => {
    try {
      const { descricao, valor, origem, fase, status_projetos, status_financeiro, comentario_financeiro, comentario_projetos, data_pagamento_manual, parcela_sem_cronograma, gerente_email, tipo_servico } = req.body;

      // Financial fields require canManagePagamentos; comments allowed for leaders
      const isFinancialUpdate = valor !== undefined || origem !== undefined || status_financeiro !== undefined || data_pagamento_manual !== undefined;
      if (isFinancialUpdate && !canManagePagamentos(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado para campos financeiros' });
      }

      const updateParcela = new UpdateParcela(repository);
      const result = await updateParcela.execute({
        id: req.params.id,
        descricao,
        valor,
        origem,
        fase,
        statusProjetos: status_projetos,
        statusFinanceiro: status_financeiro,
        comentarioFinanceiro: comentario_financeiro,
        comentarioProjetos: comentario_projetos,
        dataPagamentoManual: data_pagamento_manual,
        parcelaSemCronograma: parcela_sem_cronograma,
        gerenteEmail: gerente_email,
        tipoServico: tipo_servico,
      });

      if (logAction) {
        await logAction(req, 'update', 'parcela', req.params.id, 'Parcela atualizada');
      }

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao atualizar parcela:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // PATCH /parcelas/:id/status - Inline status change
  router.patch('/parcelas/:id/status', requireAuth, async (req, res) => {
    try {
      const { field, value } = req.body;

      if (!field || !value) {
        return res.status(400).json({ success: false, error: 'field e value sao obrigatorios' });
      }

      if (field === 'financeiro' && !canManagePagamentos(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado para status financeiro' });
      }

      const updateStatus = new UpdateParcelaStatus(repository);
      const result = await updateStatus.execute({
        id: req.params.id,
        field,
        value,
        editedByEmail: req.user.email,
        editedByName: req.user.displayName || req.user.name || req.user.email,
      });

      if (logAction) {
        await logAction(req, 'update', 'parcela', req.params.id, `Status ${field} alterado para ${value}`);
      }

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao atualizar status da parcela:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // PATCH /parcelas/:id/limpar-alerta - Clear cronograma alert
  router.patch('/parcelas/:id/limpar-alerta', requireAuth, async (req, res) => {
    try {
      const parcela = await repository.clearAlertaCronograma(req.params.id);
      res.json({ success: true, data: parcela.toResponse() });
    } catch (error) {
      console.error('Erro ao limpar alerta:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /parcelas/:id/vincular - Link to SmartSheet task
  router.put('/parcelas/:id/vincular', requireAuth, async (req, res) => {
    try {
      const { row_id, task_name, data_termino } = req.body;

      if (!row_id || !task_name) {
        return res.status(400).json({ success: false, error: 'row_id e task_name sao obrigatorios' });
      }

      const vincularParcela = new VincularParcela(repository, notifications);
      const result = await vincularParcela.execute({
        id: req.params.id,
        rowId: row_id,
        taskName: task_name,
        dataTermino: data_termino || null,
      });

      if (logAction) {
        await logAction(req, 'update', 'parcela', req.params.id, 'Parcela vinculada ao cronograma', { row_id, task_name });
      }

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao vincular parcela:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /parcelas/:id
  router.delete('/parcelas/:id', requireAuth, async (req, res) => {
    try {
      if (!canManagePagamentos(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      await repository.deleteParcela(req.params.id);

      if (logAction) {
        await logAction(req, 'delete', 'parcela', req.params.id, 'Parcela removida');
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao remover parcela:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /enriched - Enriched with BigQuery
  router.get('/enriched', requireAuth, async (req, res) => {
    try {
      const { projectCode, smartsheetId, projectName } = req.query;
      if (!projectCode) {
        return res.status(400).json({ success: false, error: 'projectCode e obrigatorio' });
      }

      const enrich = new EnrichParcelasWithSmartsheet(repository, notifications);
      const result = await enrich.execute({
        projectCode,
        smartsheetId: smartsheetId || null,
        projectName: projectName || null,
        bigqueryClient,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao enriquecer parcelas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /upcoming - Calendar view
  router.get('/upcoming', requireAuth, async (req, res) => {
    try {
      const { months, leader } = req.query;

      const getUpcoming = new GetUpcomingParcelas(repository);
      const result = await getUpcoming.execute({
        months: months ? Number(months) : 2,
        leader: leader || null,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao buscar parcelas futuras:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /pending-count - Badge count
  router.get('/pending-count', requireAuth, async (req, res) => {
    try {
      const count = await repository.countPendingParcelas(req.user.email);

      res.json({ success: true, data: { count } });
    } catch (error) {
      console.error('Erro ao contar parcelas pendentes:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /regras-cliente - Create rule
  router.post('/regras-cliente', requireAuth, async (req, res) => {
    try {
      if (!canManagePagamentos(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const { company_id, company_name, precisa_medicao, dias_solicitar_medicao, dias_aprovacao_medicao, dias_antecedencia_faturamento, observacao_financeiro } = req.body;

      if (!company_id || !company_name) {
        return res.status(400).json({ success: false, error: 'company_id e company_name sao obrigatorios' });
      }

      const createRegra = new CreateRegraCliente(repository);
      const result = await createRegra.execute({
        companyId: company_id,
        companyName: company_name,
        precisaMedicao: precisa_medicao || false,
        diasSolicitarMedicao: dias_solicitar_medicao || 0,
        diasAprovacaoMedicao: dias_aprovacao_medicao || 0,
        diasAntecedenciaFaturamento: dias_antecedencia_faturamento || 0,
        observacaoFinanceiro: observacao_financeiro || null,
        createdBy: req.user.email,
      });

      if (logAction) {
        await logAction(req, 'create', 'regra_pagamento', result.id, 'Regra de pagamento criada', { company_id, company_name });
      }

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao criar regra:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /regras-cliente - List rules
  router.get('/regras-cliente', requireAuth, async (req, res) => {
    try {
      const listRegras = new ListRegrasCliente(repository);
      const result = await listRegras.execute();

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao listar regras:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /regras-cliente/:companyId - Get by company
  router.get('/regras-cliente/:companyId', requireAuth, async (req, res) => {
    try {
      const regra = await repository.findRegraByCompanyId(req.params.companyId);
      if (!regra) {
        return res.status(404).json({ success: false, error: 'Regra nao encontrada' });
      }

      res.json({ success: true, data: regra.toResponse() });
    } catch (error) {
      console.error('Erro ao buscar regra:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /regras-cliente/:companyId - Update rule
  router.put('/regras-cliente/:companyId', requireAuth, async (req, res) => {
    try {
      if (!canManagePagamentos(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const { precisa_medicao, dias_solicitar_medicao, dias_aprovacao_medicao, dias_antecedencia_faturamento, observacao_financeiro } = req.body;

      const updateRegra = new UpdateRegraCliente(repository);
      const result = await updateRegra.execute({
        companyId: req.params.companyId,
        precisaMedicao: precisa_medicao,
        diasSolicitarMedicao: dias_solicitar_medicao,
        diasAprovacaoMedicao: dias_aprovacao_medicao,
        diasAntecedenciaFaturamento: dias_antecedencia_faturamento,
        observacaoFinanceiro: observacao_financeiro,
      });

      if (logAction) {
        await logAction(req, 'update', 'regra_pagamento', req.params.companyId, 'Regra de pagamento atualizada');
      }

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao atualizar regra:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /change-log - Audit history
  router.get('/change-log', requireAuth, async (req, res) => {
    try {
      const { projectCode } = req.query;
      if (!projectCode) {
        return res.status(400).json({ success: false, error: 'projectCode e obrigatorio' });
      }

      const getChangeLog = new GetParcelaChangeLog(repository);
      const result = await getChangeLog.execute({ projectCode });

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao buscar change log:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

export { createRoutes };
export default router;
