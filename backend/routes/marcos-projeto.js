/**
 * Rotas de Marcos do Projeto
 *
 * Sistema completo de marcos (milestones) por projeto.
 * Suporta: CRUD, importação Smartsheet, enriquecimento com BigQuery,
 * log de auditoria, e solicitações de baseline.
 *
 * Tabelas: marcos_projeto, marco_edit_log, marco_baseline_requests
 */

import express from 'express';
import { getSupabaseServiceClient } from '../supabase.js';

const router = express.Router();
const TABLE = 'marcos_projeto';
const EDIT_LOG_TABLE = 'marco_edit_log';
const BASELINE_TABLE = 'marco_baseline_requests';

function createRoutes(requireAuth, isPrivileged, logAction, withBqCache, bigqueryClient) {
  const supabase = () => getSupabaseServiceClient();
  const badgeCacheMiddleware = withBqCache ? withBqCache(60) : (req, res, next) => next();

  /**
   * Auto-importa marcos do Smartsheet/BigQuery para o Supabase.
   * Reutilizado por GET /enriched (fallback) e POST /import.
   * Retorna o número de marcos importados.
   */
  async function autoImportMarcos(projectCode, smartsheetId, projectName, userId) {
    if (!bigqueryClient?.queryCronograma) return 0;
    if (!smartsheetId && !projectName) return 0;

    const tasks = await bigqueryClient.queryCronograma(smartsheetId || null, projectName || null);

    const marcosMap = new Map();
    tasks.forEach(t => {
      const marco = t.CaminhoCriticoMarco;
      if (!marco || !String(marco).trim()) return;
      if (String(marco).trim().toUpperCase().startsWith('INT')) return;

      const nome = String(marco).trim();
      const variancia = t.VarianciaBaselineOtus;
      const dataTermino = t.DataDeTermino;

      const entry = {
        nome,
        status: normalizeStatus(t.Status, variancia),
        prazo_atual: sanitizeDate(dataTermino),
        prazo_baseline: sanitizeDate(t.DataDeFimBaselineOtus),
        variacao_dias: variancia != null ? Number(variancia) : 0,
      };

      if (marcosMap.has(nome)) {
        const existing = marcosMap.get(nome);
        const existingDate = existing.prazo_atual ? new Date(existing.prazo_atual) : null;
        const newDate = entry.prazo_atual ? new Date(entry.prazo_atual) : null;
        if (newDate && (!existingDate || newDate > existingDate)) {
          marcosMap.set(nome, entry);
        }
      } else {
        marcosMap.set(nome, entry);
      }
    });

    const marcosToImport = Array.from(marcosMap.values());
    if (marcosToImport.length === 0) return 0;

    const rows = marcosToImport.map((m, idx) => ({
      project_code: projectCode,
      nome: m.nome,
      status: m.status,
      prazo_baseline: m.prazo_baseline,
      prazo_atual: m.prazo_atual,
      variacao_dias: m.variacao_dias,
      source: 'smartsheet',
      sort_order: idx,
      created_by: userId || null,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase()
      .from(TABLE)
      .upsert(rows, { onConflict: 'project_code,nome' })
      .select();

    if (error) throw error;
    return data?.length || 0;
  }

  // ============================================================================
  // STATIC ROUTES (must be defined BEFORE parameterized routes like /:id)
  // ============================================================================

  /**
   * GET /api/marcos-projeto/pending-count
   * Contagem de edições não vistas + baselines pendentes (para badge)
   */
  router.get('/pending-count', requireAuth, badgeCacheMiddleware, async (req, res) => {
    try {
      const { projectCode } = req.query;

      // Contagem de edições não vistas pelo líder
      let editQuery = supabase()
        .from(EDIT_LOG_TABLE)
        .select('id', { count: 'exact', head: true })
        .eq('seen_by_leader', false);
      if (projectCode) editQuery = editQuery.eq('project_code', projectCode);

      const { count: editsUnseen, error: editErr } = await editQuery;
      if (editErr) throw editErr;

      // Contagem de solicitações de baseline pendentes
      let baselineQuery = supabase()
        .from(BASELINE_TABLE)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente');
      if (projectCode) baselineQuery = baselineQuery.eq('project_code', projectCode);

      const { count: baselinesPending, error: baselineErr } = await baselineQuery;
      if (baselineErr) throw baselineErr;

      res.json({
        success: true,
        data: {
          edits_unseen: editsUnseen || 0,
          baselines_pending: baselinesPending || 0,
          total: (editsUnseen || 0) + (baselinesPending || 0),
        },
      });
    } catch (error) {
      console.error('Erro ao contar pendências de marcos:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/marcos-projeto/enriched?projectCode=X&smartsheetId=Y&projectName=Z
   * Retorna marcos enriquecidos com dados do Smartsheet/BigQuery.
   * Detecta mudanças no cronograma e registra no log de auditoria.
   */
  router.get('/enriched', requireAuth, async (req, res) => {
    try {
      const { projectCode, smartsheetId, projectName } = req.query;
      if (!projectCode) {
        return res.status(400).json({ success: false, error: 'projectCode é obrigatório' });
      }

      // 1. Busca marcos do Supabase
      const { data: marcos, error: marcosErr } = await supabase()
        .from(TABLE)
        .select('*')
        .eq('project_code', projectCode)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (marcosErr) throw marcosErr;

      if (!marcos || marcos.length === 0) {
        // Auto-import: tenta importar do Smartsheet/BigQuery
        if (smartsheetId || projectName) {
          try {
            const imported = await autoImportMarcos(projectCode, smartsheetId, projectName, req.user?.id);
            if (imported > 0) {
              // Re-busca marcos recém-importados para continuar o fluxo de enrichment
              const { data: freshMarcos, error: freshErr } = await supabase()
                .from(TABLE)
                .select('*')
                .eq('project_code', projectCode)
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: true });

              if (!freshErr && freshMarcos && freshMarcos.length > 0) {
                // Continua o fluxo normal de enrichment com os marcos importados
                // (reatribui para a variável e deixa o código abaixo processar)
                marcos.push(...freshMarcos);
              } else {
                return res.json({ success: true, data: [] });
              }
            } else {
              return res.json({ success: true, data: [] });
            }
          } catch (importErr) {
            console.error('Auto-import marcos falhou (graceful):', importErr.message);
            return res.json({ success: true, data: [] });
          }
        } else {
          return res.json({ success: true, data: [] });
        }
      }

      // 2. Se não temos smartsheetId/projectName ou bigqueryClient, retorna marcos simples
      if ((!smartsheetId && !projectName) || !bigqueryClient?.queryCronograma) {
        return res.json({ success: true, data: marcos });
      }

      // 3. Busca tarefas do cronograma via BigQuery
      let tasks = [];
      try {
        tasks = await bigqueryClient.queryCronograma(smartsheetId || null, projectName || null);
      } catch (bqErr) {
        console.error('Erro ao buscar cronograma para enriquecimento:', bqErr);
        // Retorna marcos sem enriquecimento se BigQuery falhar
        return res.json({ success: true, data: marcos });
      }

      // 4. Cria mapa de tarefas por rowId para lookup rápido
      const tasksByRowId = new Map();
      tasks.forEach(t => {
        if (t.rowId) {
          tasksByRowId.set(String(t.rowId), t);
        }
      });

      // 5. Enriquece cada marco vinculado ao Smartsheet
      const enrichedMarcos = [];
      const editLogEntries = [];
      const marcoUpdates = [];

      for (const marco of marcos) {
        const enriched = { ...marco };

        if (marco.smartsheet_row_id) {
          const task = tasksByRowId.get(String(marco.smartsheet_row_id));

          if (task) {
            const currentDataTermino = task.DataDeTermino || null;
            const currentStatus = task.Status || null;

            enriched.smartsheet_status = currentStatus;
            enriched.smartsheet_data_termino = currentDataTermino;
            enriched.smartsheet_variancia = task.VarianciaBaselineOtus != null
              ? Number(task.VarianciaBaselineOtus)
              : null;

            // Detecta mudanças em data de término
            const lastTermino = marco.last_smartsheet_data_termino || null;
            const newTermino = currentDataTermino || null;
            if (String(lastTermino) !== String(newTermino)) {
              editLogEntries.push({
                marco_id: marco.id,
                project_code: projectCode,
                action: 'smartsheet_change',
                field_changed: 'data_termino',
                old_value: lastTermino ? String(lastTermino) : null,
                new_value: newTermino ? String(newTermino) : null,
                edited_by_email: 'sistema',
                edited_by_name: 'Smartsheet Sync',
                seen_by_leader: false,
              });
            }

            // Detecta mudanças em status
            const lastStatus = marco.last_smartsheet_status || null;
            if (String(lastStatus) !== String(currentStatus)) {
              editLogEntries.push({
                marco_id: marco.id,
                project_code: projectCode,
                action: 'smartsheet_change',
                field_changed: 'status',
                old_value: lastStatus ? String(lastStatus) : null,
                new_value: currentStatus ? String(currentStatus) : null,
                edited_by_email: 'sistema',
                edited_by_name: 'Smartsheet Sync',
                seen_by_leader: false,
              });
            }

            // Se houve qualquer mudança, atualiza snapshot no marco
            if (String(lastTermino) !== String(newTermino) || String(lastStatus) !== String(currentStatus)) {
              marcoUpdates.push({
                id: marco.id,
                last_smartsheet_data_termino: currentDataTermino,
                last_smartsheet_status: currentStatus,
              });
            }
          } else {
            // Tarefa não encontrada no BigQuery
            enriched.smartsheet_status = null;
            enriched.smartsheet_data_termino = null;
            enriched.smartsheet_variancia = null;

            // Só registra log se já tinha snapshot anterior (evita log na primeira vez)
            if (marco.last_smartsheet_data_termino || marco.last_smartsheet_status) {
              editLogEntries.push({
                marco_id: marco.id,
                project_code: projectCode,
                action: 'smartsheet_change',
                field_changed: 'tarefa',
                old_value: marco.smartsheet_task_name || marco.smartsheet_row_id,
                new_value: 'Tarefa removida do cronograma',
                edited_by_email: 'sistema',
                edited_by_name: 'Smartsheet Sync',
                seen_by_leader: false,
              });

              marcoUpdates.push({
                id: marco.id,
                last_smartsheet_data_termino: null,
                last_smartsheet_status: null,
              });
            }
          }
        }

        enrichedMarcos.push(enriched);
      }

      // 6. Salva logs e atualizações em batch (não bloqueia resposta)
      if (editLogEntries.length > 0) {
        supabase()
          .from(EDIT_LOG_TABLE)
          .insert(editLogEntries)
          .then(({ error }) => {
            if (error) console.error('Erro ao inserir edit_log (enriched):', error);
          });
      }

      for (const upd of marcoUpdates) {
        supabase()
          .from(TABLE)
          .update({
            last_smartsheet_data_termino: upd.last_smartsheet_data_termino,
            last_smartsheet_status: upd.last_smartsheet_status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', upd.id)
          .then(({ error }) => {
            if (error) console.error('Erro ao atualizar marco (enriched):', error);
          });
      }

      res.json({ success: true, data: enrichedMarcos });
    } catch (error) {
      console.error('Erro ao buscar marcos enriquecidos:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/marcos-projeto/edit-log?projectCode=X&unseen_only=true
   * Lista log de edições de um projeto
   */
  router.get('/edit-log', requireAuth, async (req, res) => {
    try {
      const { projectCode, unseen_only } = req.query;
      if (!projectCode) {
        return res.status(400).json({ success: false, error: 'projectCode é obrigatório' });
      }

      let query = supabase()
        .from(EDIT_LOG_TABLE)
        .select('*')
        .eq('project_code', projectCode)
        .order('created_at', { ascending: false });

      if (unseen_only === 'true') {
        query = query.eq('seen_by_leader', false);
      }

      const { data, error } = await query;
      if (error) throw error;

      res.json({ success: true, data: data || [] });
    } catch (error) {
      console.error('Erro ao buscar edit log:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * PUT /api/marcos-projeto/edit-log/mark-seen
   * Marca entradas do edit log como vistas pelo líder
   * Body: { projectCode?: string, ids?: number[] }
   */
  router.put('/edit-log/mark-seen', requireAuth, async (req, res) => {
    try {
      const { projectCode, ids } = req.body;

      if (!projectCode && (!ids || !Array.isArray(ids) || ids.length === 0)) {
        return res.status(400).json({
          success: false,
          error: 'projectCode ou ids (array) é obrigatório',
        });
      }

      let query = supabase()
        .from(EDIT_LOG_TABLE)
        .update({ seen_by_leader: true })
        .eq('seen_by_leader', false);

      if (ids && Array.isArray(ids) && ids.length > 0) {
        query = query.in('id', ids);
      } else if (projectCode) {
        query = query.eq('project_code', projectCode);
      }

      const { data, error } = await query.select();
      if (error) throw error;

      res.json({ success: true, data: data || [], updated: data?.length || 0 });
    } catch (error) {
      console.error('Erro ao marcar edit log como visto:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/marcos-projeto/import?projectCode=X
   * Importa marcos do Smartsheet/BigQuery para o Supabase
   * Faz upsert (insere ou atualiza) baseado em (project_code, nome)
   */
  router.post('/import', requireAuth, async (req, res) => {
    try {
      const { projectCode, smartsheetId, projectName } = req.body;

      if (!projectCode) {
        return res.status(400).json({ success: false, error: 'projectCode é obrigatório' });
      }
      if (!smartsheetId && !projectName) {
        return res.status(400).json({ success: false, error: 'smartsheetId ou projectName é obrigatório' });
      }
      if (!bigqueryClient?.queryCronograma) {
        return res.status(500).json({ success: false, error: 'BigQuery client não disponível' });
      }

      const imported = await autoImportMarcos(projectCode, smartsheetId, projectName, req.user?.id);

      if (imported === 0) {
        return res.json({ success: true, imported: 0, message: 'Nenhum marco encontrado no Smartsheet' });
      }

      // Busca marcos recém-importados para retornar
      const { data, error } = await supabase()
        .from(TABLE)
        .select('*')
        .eq('project_code', projectCode)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      if (logAction) {
        await logAction(req, 'import', 'marco_projeto', null, `${imported} marcos importados para ${projectCode}`);
      }

      res.json({ success: true, imported, data: data || [] });
    } catch (error) {
      console.error('Erro ao importar marcos:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/marcos-projeto/import-all
   * Importa marcos de TODOS os projetos do portfólio de uma vez.
   * Requer privilégio de admin/director.
   */
  router.post('/import-all', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      if (!bigqueryClient?.queryPortfolio || !bigqueryClient?.queryCronograma) {
        return res.status(500).json({ success: false, error: 'BigQuery client não disponível' });
      }

      const portfolio = await bigqueryClient.queryPortfolio();
      const projects = portfolio.filter(p => p.project_code_norm && (p.smartsheet_id || p.project_name));

      const results = { total: projects.length, imported: 0, skipped: 0, errors: [], details: [] };

      for (const project of projects) {
        const pc = project.project_code_norm;
        const ssId = project.smartsheet_id || null;
        const pName = project.project_name || pc;

        try {
          const tasks = await bigqueryClient.queryCronograma(ssId, pName);

          const marcosMap = new Map();
          tasks.forEach(t => {
            const marco = t.CaminhoCriticoMarco;
            if (!marco || !String(marco).trim()) return;
            if (String(marco).trim().toUpperCase().startsWith('INT')) return;

            const nome = String(marco).trim();
            const variancia = t.VarianciaBaselineOtus;
            const dataTermino = t.DataDeTermino;

            const entry = {
              nome,
              status: normalizeStatus(t.Status, variancia),
              prazo_atual: sanitizeDate(dataTermino),
              prazo_baseline: sanitizeDate(t.DataDeFimBaselineOtus),
              variacao_dias: variancia != null ? Number(variancia) : 0,
            };

            if (marcosMap.has(nome)) {
              const existing = marcosMap.get(nome);
              const existingDate = existing.prazo_atual ? new Date(existing.prazo_atual) : null;
              const newDate = entry.prazo_atual ? new Date(entry.prazo_atual) : null;
              if (newDate && (!existingDate || newDate > existingDate)) {
                marcosMap.set(nome, entry);
              }
            } else {
              marcosMap.set(nome, entry);
            }
          });

          const marcosToImport = Array.from(marcosMap.values());
          if (marcosToImport.length === 0) {
            results.skipped++;
            results.details.push({ project: pc, imported: 0, message: 'Nenhum marco encontrado' });
            continue;
          }

          const rows = marcosToImport.map((m, idx) => ({
            project_code: pc,
            nome: m.nome,
            status: m.status,
            prazo_baseline: m.prazo_baseline,
            prazo_atual: m.prazo_atual,
            variacao_dias: m.variacao_dias,
            source: 'smartsheet',
            sort_order: idx,
            created_by: req.user?.id || null,
            updated_at: new Date().toISOString(),
          }));

          const { data, error } = await supabase()
            .from(TABLE)
            .upsert(rows, { onConflict: 'project_code,nome' })
            .select();

          if (error) throw error;

          const count = data?.length || 0;
          results.imported += count;
          results.details.push({ project: pc, imported: count });
        } catch (err) {
          results.errors.push({ project: pc, error: err.message });
        }
      }

      if (logAction) {
        await logAction(req, 'import-all', 'marco_projeto', null, `Importação em massa: ${results.imported} marcos de ${results.total} projetos`);
      }

      res.json({ success: true, ...results });
    } catch (error) {
      console.error('Erro ao importar marcos em massa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * PUT /api/marcos-projeto/reorder
   * Reordena marcos (batch update de sort_order)
   */
  router.put('/reorder', requireAuth, async (req, res) => {
    try {
      const { items } = req.body; // [{ id, sort_order }]
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ success: false, error: 'items é obrigatório (array de {id, sort_order})' });
      }

      for (const item of items) {
        const { error } = await supabase()
          .from(TABLE)
          .update({ sort_order: item.sort_order, updated_at: new Date().toISOString() })
          .eq('id', item.id);
        if (error) throw error;
      }

      res.json({ success: true, message: 'Ordem atualizada' });
    } catch (error) {
      console.error('Erro ao reordenar marcos:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/marcos-projeto/baseline-request
   * Cria uma solicitação de nova baseline com snapshot dos marcos atuais
   */
  router.post('/baseline-request', requireAuth, async (req, res) => {
    try {
      const { projectCode, justificativa } = req.body;

      if (!projectCode) {
        return res.status(400).json({ success: false, error: 'projectCode é obrigatório' });
      }

      // Busca marcos atuais para snapshot
      const { data: currentMarcos, error: fetchErr } = await supabase()
        .from(TABLE)
        .select('*')
        .eq('project_code', projectCode)
        .order('sort_order', { ascending: true });

      if (fetchErr) throw fetchErr;

      const { data, error } = await supabase()
        .from(BASELINE_TABLE)
        .insert({
          project_code: projectCode,
          status: 'pendente',
          marcos_snapshot: currentMarcos || [],
          justificativa: justificativa || null,
          requested_by_email: req.user?.email || 'desconhecido',
          requested_by_name: req.user?.name || null,
        })
        .select()
        .single();

      if (error) throw error;

      if (logAction) {
        await logAction(req, 'create', 'marco_baseline_request', data.id, `Solicitação de baseline criada para ${projectCode}`);
      }

      res.status(201).json({ success: true, data });
    } catch (error) {
      console.error('Erro ao criar solicitação de baseline:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/marcos-projeto/baseline-requests?projectCode=X
   * Lista solicitações de baseline de um projeto
   */
  router.get('/baseline-requests', requireAuth, async (req, res) => {
    try {
      const { projectCode } = req.query;

      let query = supabase()
        .from(BASELINE_TABLE)
        .select('*')
        .order('created_at', { ascending: false });

      if (projectCode) {
        query = query.eq('project_code', projectCode);
      }

      const { data, error } = await query;
      if (error) throw error;

      res.json({ success: true, data: data || [] });
    } catch (error) {
      console.error('Erro ao listar solicitações de baseline:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/marcos-projeto/baseline-requests/:id/approve
   * Aprova uma solicitação de baseline
   */
  router.post('/baseline-requests/:id/approve', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      // Busca a solicitação
      const { data: existing, error: fetchErr } = await supabase()
        .from(BASELINE_TABLE)
        .select('*')
        .eq('id', parseInt(id, 10))
        .single();

      if (fetchErr || !existing) {
        return res.status(404).json({ success: false, error: 'Solicitação de baseline não encontrada' });
      }

      if (existing.status !== 'pendente') {
        return res.status(400).json({ success: false, error: `Solicitação já foi ${existing.status}` });
      }

      const { data, error } = await supabase()
        .from(BASELINE_TABLE)
        .update({
          status: 'aprovada',
          reviewed_by_email: req.user?.email || null,
          reviewed_by_name: req.user?.name || null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', parseInt(id, 10))
        .select()
        .single();

      if (error) throw error;

      if (logAction) {
        await logAction(req, 'approve', 'marco_baseline_request', parseInt(id, 10), 'Solicitação de baseline aprovada');
      }

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao aprovar solicitação de baseline:', error);
      const status = error.message.includes('não encontrada') ? 404 : 400;
      res.status(status).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/marcos-projeto/baseline-requests/:id/reject
   * Rejeita uma solicitação de baseline
   */
  router.post('/baseline-requests/:id/reject', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { rejection_reason } = req.body;

      // Busca a solicitação
      const { data: existing, error: fetchErr } = await supabase()
        .from(BASELINE_TABLE)
        .select('*')
        .eq('id', parseInt(id, 10))
        .single();

      if (fetchErr || !existing) {
        return res.status(404).json({ success: false, error: 'Solicitação de baseline não encontrada' });
      }

      if (existing.status !== 'pendente') {
        return res.status(400).json({ success: false, error: `Solicitação já foi ${existing.status}` });
      }

      const { data, error } = await supabase()
        .from(BASELINE_TABLE)
        .update({
          status: 'rejeitada',
          reviewed_by_email: req.user?.email || null,
          reviewed_by_name: req.user?.name || null,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejection_reason || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', parseInt(id, 10))
        .select()
        .single();

      if (error) throw error;

      if (logAction) {
        await logAction(req, 'reject', 'marco_baseline_request', parseInt(id, 10), 'Solicitação de baseline rejeitada', {
          rejection_reason,
        });
      }

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao rejeitar solicitação de baseline:', error);
      const status = error.message.includes('não encontrada') ? 404 : 400;
      res.status(status).json({ success: false, error: error.message });
    }
  });

  // ============================================================================
  // MAIN CRUD ROUTES (GET /, POST /, and parameterized routes)
  // ============================================================================

  /**
   * GET /api/marcos-projeto?projectCode=X
   * Lista marcos de um projeto ordenados por sort_order
   */
  router.get('/', requireAuth, async (req, res) => {
    try {
      const { projectCode } = req.query;
      if (!projectCode) {
        return res.status(400).json({ success: false, error: 'projectCode é obrigatório' });
      }

      const { data, error } = await supabase()
        .from(TABLE)
        .select('*')
        .eq('project_code', projectCode)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      res.json({ success: true, data: data || [] });
    } catch (error) {
      console.error('Erro ao buscar marcos:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/marcos-projeto
   * Cria um novo marco e registra no log de auditoria
   */
  router.post('/', requireAuth, async (req, res) => {
    try {
      const {
        project_code, nome, status, prazo_baseline, prazo_atual,
        variacao_dias, descricao, sort_order, cliente_expectativa_data,
      } = req.body;

      if (!project_code || !nome) {
        return res.status(400).json({ success: false, error: 'project_code e nome são obrigatórios' });
      }

      const { data, error } = await supabase()
        .from(TABLE)
        .insert({
          project_code,
          nome: nome.trim(),
          status: status || 'pendente',
          prazo_baseline: prazo_baseline || null,
          prazo_atual: prazo_atual || null,
          variacao_dias: variacao_dias || 0,
          descricao: descricao || null,
          cliente_expectativa_data: cliente_expectativa_data || null,
          source: 'manual',
          sort_order: sort_order || 0,
          created_by: req.user?.id || null,
          created_by_email: req.user?.email || null,
          created_by_name: req.user?.name || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Registra no log de auditoria
      await supabase()
        .from(EDIT_LOG_TABLE)
        .insert({
          marco_id: data.id,
          project_code,
          action: 'criar',
          field_changed: null,
          old_value: null,
          new_value: nome.trim(),
          edited_by_email: req.user?.email || 'desconhecido',
          edited_by_name: req.user?.name || null,
          seen_by_leader: false,
        });

      if (logAction) {
        await logAction(req, 'create', 'marco_projeto', data.id, `Marco criado: ${nome}`);
      }

      res.status(201).json({ success: true, data });
    } catch (error) {
      console.error('Erro ao criar marco:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // ============================================================================
  // PARAMETERIZED ROUTES (/:id) - must be AFTER all static routes
  // ============================================================================

  /**
   * PUT /api/marcos-projeto/:id/link
   * Vincula um marco a uma tarefa do Smartsheet
   */
  router.put('/:id/link', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { smartsheet_row_id, smartsheet_task_name, vinculado_baseline } = req.body;

      if (!smartsheet_row_id) {
        return res.status(400).json({ success: false, error: 'smartsheet_row_id é obrigatório' });
      }

      const updates = {
        smartsheet_row_id,
        smartsheet_task_name: smartsheet_task_name || null,
        updated_at: new Date().toISOString(),
      };
      if (vinculado_baseline !== undefined) {
        updates.vinculado_baseline = vinculado_baseline;
      }

      const { data, error } = await supabase()
        .from(TABLE)
        .update(updates)
        .eq('id', parseInt(id, 10))
        .select()
        .single();

      if (error) throw error;

      if (logAction) {
        await logAction(req, 'link', 'marco_projeto', id, `Marco vinculado ao Smartsheet: ${smartsheet_task_name || smartsheet_row_id}`);
      }

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao vincular marco ao Smartsheet:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * PUT /api/marcos-projeto/:id
   * Atualiza um marco existente e registra mudanças no log de auditoria
   */
  router.put('/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const {
        nome, status, prazo_baseline, prazo_atual,
        variacao_dias, descricao, sort_order, cliente_expectativa_data,
      } = req.body;

      // Busca estado atual do marco para comparação
      const { data: current, error: fetchErr } = await supabase()
        .from(TABLE)
        .select('*')
        .eq('id', parseInt(id, 10))
        .single();

      if (fetchErr || !current) {
        return res.status(404).json({ success: false, error: 'Marco não encontrado' });
      }

      const updates = { updated_at: new Date().toISOString() };
      if (nome !== undefined) updates.nome = nome.trim();
      if (status !== undefined) updates.status = status;
      if (prazo_baseline !== undefined) updates.prazo_baseline = prazo_baseline;
      if (prazo_atual !== undefined) updates.prazo_atual = prazo_atual;
      if (variacao_dias !== undefined) updates.variacao_dias = variacao_dias;
      if (descricao !== undefined) updates.descricao = descricao;
      if (sort_order !== undefined) updates.sort_order = sort_order;
      if (cliente_expectativa_data !== undefined) updates.cliente_expectativa_data = cliente_expectativa_data;

      const { data, error } = await supabase()
        .from(TABLE)
        .update(updates)
        .eq('id', parseInt(id, 10))
        .select()
        .single();

      if (error) throw error;

      // Registra cada campo alterado no log de auditoria
      const trackableFields = [
        'nome', 'status', 'prazo_baseline', 'prazo_atual',
        'variacao_dias', 'descricao', 'cliente_expectativa_data',
      ];

      const editLogEntries = [];
      for (const field of trackableFields) {
        if (req.body[field] === undefined) continue;

        const oldVal = current[field];
        const newVal = field === 'nome' ? req.body[field]?.trim() : req.body[field];

        // Compara como strings para detectar mudanças de forma consistente
        if (String(oldVal ?? '') !== String(newVal ?? '')) {
          editLogEntries.push({
            marco_id: parseInt(id, 10),
            project_code: current.project_code,
            action: 'editar',
            field_changed: field,
            old_value: oldVal != null ? String(oldVal) : null,
            new_value: newVal != null ? String(newVal) : null,
            edited_by_email: req.user?.email || 'desconhecido',
            edited_by_name: req.user?.name || null,
            seen_by_leader: false,
          });
        }
      }

      if (editLogEntries.length > 0) {
        const { error: logErr } = await supabase()
          .from(EDIT_LOG_TABLE)
          .insert(editLogEntries);
        if (logErr) console.error('Erro ao inserir edit_log:', logErr);
      }

      if (logAction) {
        await logAction(req, 'update', 'marco_projeto', id, `Marco atualizado: ${data.nome}`);
      }

      res.json({ success: true, data });
    } catch (error) {
      console.error('Erro ao atualizar marco:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/marcos-projeto/:id
   * Remove um marco e registra no log de auditoria
   */
  router.delete('/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      const { data: existing, error: fetchErr } = await supabase()
        .from(TABLE)
        .select('*')
        .eq('id', parseInt(id, 10))
        .single();

      if (fetchErr || !existing) {
        return res.status(404).json({ success: false, error: 'Marco não encontrado' });
      }

      // Registra exclusão no log ANTES de deletar (marco_id referencia a FK)
      // Note: a tabela marco_edit_log tem ON DELETE CASCADE, mas registramos
      // com project_code para manter rastreabilidade
      await supabase()
        .from(EDIT_LOG_TABLE)
        .insert({
          marco_id: parseInt(id, 10),
          project_code: existing.project_code,
          action: 'excluir',
          field_changed: null,
          old_value: existing.nome,
          new_value: null,
          edited_by_email: req.user?.email || 'desconhecido',
          edited_by_name: req.user?.name || null,
          seen_by_leader: false,
        });

      const { error } = await supabase()
        .from(TABLE)
        .delete()
        .eq('id', parseInt(id, 10));

      if (error) throw error;

      if (logAction) {
        await logAction(req, 'delete', 'marco_projeto', id, `Marco removido: ${existing.nome}`);
      }

      res.json({ success: true, message: 'Marco removido com sucesso' });
    } catch (error) {
      console.error('Erro ao remover marco:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

/**
 * Extrai data de valores BigQuery que podem vir como JSON objeto {"value":"2024-01-15"}
 */
function sanitizeDate(val) {
  if (!val) return null;
  if (typeof val === 'object' && val.value) return val.value;
  const s = String(val).trim();
  if (s.startsWith('{')) {
    try { return JSON.parse(s).value || null; } catch { return null; }
  }
  return s || null;
}

/**
 * Normaliza status do Smartsheet para o padrão interno
 */
function normalizeStatus(status, variacaoDias) {
  if (!status) return 'pendente';
  const s = String(status).toLowerCase().trim();

  if (s === 'complete' || s === 'completo' || s === 'concluído' || s === 'concluido') {
    return 'feito';
  }
  if (s === 'in progress' || s === 'em andamento' || s === 'em progresso') {
    if (variacaoDias != null && Number(variacaoDias) > 0) return 'atrasado';
    return 'andamento';
  }
  if (s === 'not started' || s === 'não iniciado' || s === 'nao iniciado') {
    return 'pendente';
  }
  return 'pendente';
}

export { createRoutes };
export default router;
