/**
 * Rotas de Marcos do Projeto
 *
 * CRUD para gerenciamento de marcos (milestones) por projeto.
 * Suporta importação de marcos do Smartsheet/BigQuery.
 */

import express from 'express';
import { getSupabaseServiceClient } from '../supabase.js';

const router = express.Router();
const TABLE = 'marcos_projeto';

function createRoutes(requireAuth, isPrivileged, logAction, withBqCache, bigqueryClient) {
  const supabase = () => getSupabaseServiceClient();

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
   * Cria um novo marco
   */
  router.post('/', requireAuth, async (req, res) => {
    try {
      const { project_code, nome, status, prazo_baseline, prazo_atual, variacao_dias, descricao, sort_order } = req.body;

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
          source: 'manual',
          sort_order: sort_order || 0,
          created_by: req.user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;

      if (logAction) {
        await logAction(req, 'create', 'marco_projeto', data.id, `Marco criado: ${nome}`);
      }

      res.status(201).json({ success: true, data });
    } catch (error) {
      console.error('Erro ao criar marco:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * PUT /api/marcos-projeto/:id
   * Atualiza um marco existente
   */
  router.put('/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { nome, status, prazo_baseline, prazo_atual, variacao_dias, descricao, sort_order } = req.body;

      const updates = { updated_at: new Date().toISOString() };
      if (nome !== undefined) updates.nome = nome.trim();
      if (status !== undefined) updates.status = status;
      if (prazo_baseline !== undefined) updates.prazo_baseline = prazo_baseline;
      if (prazo_atual !== undefined) updates.prazo_atual = prazo_atual;
      if (variacao_dias !== undefined) updates.variacao_dias = variacao_dias;
      if (descricao !== undefined) updates.descricao = descricao;
      if (sort_order !== undefined) updates.sort_order = sort_order;

      const { data, error } = await supabase()
        .from(TABLE)
        .update(updates)
        .eq('id', parseInt(id, 10))
        .select()
        .single();

      if (error) throw error;

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
   * Remove um marco
   */
  router.delete('/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      const { data: existing, error: fetchErr } = await supabase()
        .from(TABLE)
        .select('id, nome')
        .eq('id', parseInt(id, 10))
        .single();

      if (fetchErr || !existing) {
        return res.status(404).json({ success: false, error: 'Marco não encontrado' });
      }

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

      // Busca dados do cronograma via BigQuery
      if (!bigqueryClient?.queryCronograma) {
        return res.status(500).json({ success: false, error: 'BigQuery client não disponível' });
      }

      const tasks = await bigqueryClient.queryCronograma(smartsheetId || null, projectName || null);

      // Extrai marcos (mesma lógica do frontend VistaClienteInicioView)
      const marcosMap = new Map();
      tasks.forEach(t => {
        const marco = t.CaminhoCriticoMarco;
        if (!marco || !String(marco).trim()) return;
        if (String(marco).trim().toUpperCase().startsWith('INT')) return;

        const nome = String(marco).trim();
        const variancia = t.VarianciaBaselineOtus;
        const dataTermino = t.DataDeTermino;

        if (marcosMap.has(nome)) {
          const existing = marcosMap.get(nome);
          const existingDate = existing.prazo_atual ? new Date(existing.prazo_atual) : null;
          const newDate = dataTermino ? new Date(dataTermino) : null;
          if (newDate && (!existingDate || newDate > existingDate)) {
            marcosMap.set(nome, {
              nome,
              status: normalizeStatus(t.Status, variancia),
              prazo_atual: dataTermino || null,
              prazo_baseline: t.DataDeFimBaselineOtus || null,
              variacao_dias: variancia != null ? Number(variancia) : 0,
            });
          }
        } else {
          marcosMap.set(nome, {
            nome,
            status: normalizeStatus(t.Status, variancia),
            prazo_atual: dataTermino || null,
            prazo_baseline: t.DataDeFimBaselineOtus || null,
            variacao_dias: variancia != null ? Number(variancia) : 0,
          });
        }
      });

      const marcosToImport = Array.from(marcosMap.values());
      if (marcosToImport.length === 0) {
        return res.json({ success: true, imported: 0, message: 'Nenhum marco encontrado no Smartsheet' });
      }

      // Upsert no Supabase
      const rows = marcosToImport.map((m, idx) => ({
        project_code: projectCode,
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

      if (logAction) {
        await logAction(req, 'import', 'marco_projeto', null, `${marcosToImport.length} marcos importados para ${projectCode}`);
      }

      res.json({ success: true, imported: data?.length || 0, data: data || [] });
    } catch (error) {
      console.error('Erro ao importar marcos:', error);
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

  return router;
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
