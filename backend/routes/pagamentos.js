import express from 'express';
import { SupabasePagamentoRepository } from '../infrastructure/repositories/SupabasePagamentoRepository.js';
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
  ListGlobalChangeLog,
} from '../application/use-cases/pagamentos/index.js';

const router = express.Router();

let pagamentoRepository = null;

function getRepository() {
  if (!pagamentoRepository) pagamentoRepository = new SupabasePagamentoRepository();
  return pagamentoRepository;
}

function createRoutes(requireAuth, isPrivileged, canManagePagamentos, logAction, withBqCache, bigqueryClient) {
  const repository = getRepository();

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

      const createParcela = new CreateParcela(repository);
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

  // POST /parcelas/batch - Create multiple parcelas at once
  router.post('/parcelas/batch', requireAuth, async (req, res) => {
    try {
      if (!canManagePagamentos(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const { project_code, company_id, parcelas } = req.body;

      if (!project_code || !Array.isArray(parcelas) || parcelas.length === 0) {
        return res.status(400).json({ success: false, error: 'project_code e array parcelas sao obrigatorios' });
      }

      if (parcelas.length > 50) {
        return res.status(400).json({ success: false, error: 'Maximo de 50 parcelas por vez' });
      }

      const createParcela = new CreateParcela(repository);
      const results = [];

      for (const item of parcelas) {
        const result = await createParcela.execute({
          projectCode: project_code,
          projectId: null,
          companyId: company_id || null,
          parcelaNumero: item.parcela_numero,
          descricao: item.descricao || null,
          valor: item.valor || null,
          origem: item.origem || 'Contrato',
          fase: null,
          gerenteEmail: null,
          tipoServico: item.tipo_servico || 'coordenacao',
          createdBy: req.user.email,
          parcelaSemCronograma: item.parcela_sem_cronograma || false,
        });
        results.push(result);

        if (logAction) {
          await logAction(req, 'create', 'parcela', result.id, 'Parcela criada (batch)', { project_code, parcela_numero: item.parcela_numero });
        }
      }

      res.status(201).json({ success: true, data: results, count: results.length });
    } catch (error) {
      console.error('Erro ao criar parcelas em batch:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /parcelas/batch - Update multiple parcelas at once
  router.put('/parcelas/batch', requireAuth, async (req, res) => {
    try {
      if (!canManagePagamentos(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const { parcelas } = req.body;

      if (!Array.isArray(parcelas) || parcelas.length === 0) {
        return res.status(400).json({ success: false, error: 'Array parcelas e obrigatorio' });
      }

      if (parcelas.length > 50) {
        return res.status(400).json({ success: false, error: 'Maximo de 50 parcelas por vez' });
      }

      const updateParcela = new UpdateParcela(repository);
      const results = [];

      for (const item of parcelas) {
        if (!item.id) continue;
        const result = await updateParcela.execute({
          id: item.id,
          descricao: item.descricao,
          valor: item.valor,
          origem: item.origem,
          tipoServico: item.tipo_servico,
          parcelaSemCronograma: item.parcela_sem_cronograma,
        });
        results.push(result);

        if (logAction) {
          await logAction(req, 'update', 'parcela', item.id, 'Parcela atualizada (batch)');
        }
      }

      res.json({ success: true, data: results, count: results.length });
    } catch (error) {
      console.error('Erro ao atualizar parcelas em batch:', error);
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
      const { descricao, valor, origem, fase, status_projetos, status_financeiro, comentario_financeiro, comentario_projetos, data_pagamento_manual, parcela_sem_cronograma, gerente_email, tipo_servico, dilatacao_dias } = req.body;

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
        dilatacaoDias: dilatacao_dias,
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

      // Handle solicitacao field inline
      if (field === 'solicitacao') {
        const parcela = await repository.findParcelaById(req.params.id);
        if (!parcela) return res.status(404).json({ success: false, error: 'Parcela nao encontrada' });
        if (value === 'solicitado') parcela.marcarSolicitado();
        const updated = await repository.updateParcela(parcela);
        return res.json({ success: true, data: updated.toResponse() });
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

  // PATCH /parcelas/:id/dilatacao - Update dilatacao dias
  router.patch('/parcelas/:id/dilatacao', requireAuth, async (req, res) => {
    try {
      const { dilatacao_dias } = req.body;
      if (dilatacao_dias === undefined || dilatacao_dias === null) {
        return res.status(400).json({ success: false, error: 'dilatacao_dias e obrigatorio' });
      }

      const parcela = await repository.findParcelaById(req.params.id);
      if (!parcela) {
        return res.status(404).json({ success: false, error: 'Parcela nao encontrada' });
      }

      parcela.updateFields({ dilatacaoDias: Number(dilatacao_dias) });

      // Recalculate payment date if there's a regra
      if (parcela.companyId) {
        const regra = await repository.findRegraByCompanyId(parcela.companyId);
        if (regra) {
          parcela.calcularDataPagamento(regra);
        }
      }

      const updated = await repository.updateParcela(parcela);

      if (logAction) {
        await logAction(req, 'update', 'parcela', req.params.id, `Dilatacao alterada para ${dilatacao_dias} dias`);
      }

      res.json({ success: true, data: updated.toResponse() });
    } catch (error) {
      console.error('Erro ao atualizar dilatacao:', error);
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

      const vincularParcela = new VincularParcela(repository);
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

      const enrich = new EnrichParcelasWithSmartsheet(repository);
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

  // GET /cronograma-financeiro - All parcelas for cronograma view
  router.get('/cronograma-financeiro', requireAuth, async (req, res) => {
    try {
      const { months, leader } = req.query;
      const allParcelas = leader
        ? await repository.findParcelasByGerente(leader)
        : await repository.findAllParcelas();

      const numMonths = months ? Number(months) : 12;
      const now = new Date();
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endMonth = new Date(now.getFullYear(), now.getMonth() + numMonths, 0);

      // Get project data for names
      const projectCodes = [...new Set(allParcelas.map(p => p.projectCode))];
      const projectDataMap = projectCodes.length > 0
        ? await repository.getProjectDataByProjectCodes(projectCodes)
        : {};

      // Filter parcelas within the selected period (or already overdue)
      const today = new Date();
      const filtered = allParcelas.filter(p => {
        const dateStr = p.dataPagamentoEfetiva || p.dataPagamentoCalculada || p.dataPagamentoManual;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        // Include if within range OR already overdue
        return (d >= startMonth && d <= endMonth) || d < today;
      });

      // Sort chronologically by payment date
      filtered.sort((a, b) => {
        const da = new Date(a.dataPagamentoEfetiva || a.dataPagamentoCalculada || a.dataPagamentoManual);
        const db = new Date(b.dataPagamentoEfetiva || b.dataPagamentoCalculada || b.dataPagamentoManual);
        return da - db;
      });

      const result = filtered.map(p => {
        const pd = projectDataMap[p.projectCode] || {};
        return {
          ...p.toResponse(),
          project_name: pd.project_name || '',
          project_status: pd.status || '',
        };
      });

      res.json({ success: true, data: result, months: numMonths });
    } catch (error) {
      console.error('Erro ao buscar cronograma financeiro:', error);
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

  // GET /updates-count - Count changelog entries since a given date (for badge)
  router.get('/updates-count', requireAuth, async (req, res) => {
    try {
      const { since, excludeEmail } = req.query;
      if (!since) return res.status(400).json({ success: false, error: 'since e obrigatorio' });

      const result = await repository.countChangeLogSince(since, excludeEmail || null);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao contar updates:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /global-change-log - Global audit history (all projects)
  router.get('/global-change-log', requireAuth, async (req, res) => {
    try {
      const { limit, offset, excludeEmail } = req.query;
      const listGlobalChangeLog = new ListGlobalChangeLog(repository);
      const result = await listGlobalChangeLog.execute({
        limit: Number(limit) || 100,
        offset: Number(offset) || 0,
        excludeEmail,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao buscar global change log:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /change-log - Audit history
  router.get('/change-log', requireAuth, async (req, res) => {
    try {
      const { projectCode, since, excludeEmail } = req.query;
      if (!projectCode) {
        return res.status(400).json({ success: false, error: 'projectCode e obrigatorio' });
      }

      const getChangeLog = new GetParcelaChangeLog(repository);
      const result = await getChangeLog.execute({ projectCode, since, excludeEmail });

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
