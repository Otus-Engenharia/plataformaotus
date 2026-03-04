/**
 * Rotas: Nomenclatura de Arquivos
 *
 * Endpoints para configuração e validação de padrões de nomenclatura
 * de arquivos (modelos IFC/RVT e pranchas DWG/PDF) por projeto.
 */

import express from 'express';
import { getSupabaseServiceClient } from '../supabase.js';
import { validateFileName } from '../shared/nomenclatura-validator.js';

const router = express.Router();
const TABLE = 'project_nomenclatura';

/**
 * GET /api/nomenclatura/:projectCode
 * Busca padrões de nomenclatura do projeto
 */
function createRoutes(requireAuth, isPrivileged, logAction) {

  router.get('/:projectCode/validate', requireAuth, async (req, res) => {
    try {
      const { projectCode } = req.params;
      const supabase = getSupabaseServiceClient();

      const { data: nomenclatura, error: nomError } = await supabase
        .from(TABLE)
        .select('segments, padrao_template')
        .eq('project_code', projectCode)
        .eq('tipo', 'modelos')
        .single();

      if (nomError && nomError.code !== 'PGRST116') throw nomError;

      if (!nomenclatura) {
        return res.json({
          success: true,
          data: { configured: false, message: 'Padrão de modelos não configurado' },
        });
      }

      const { data: files, error: filesError } = await supabase
        .from('ifc_file_snapshots')
        .select('file_name, drive_modified_time')
        .eq('project_code', projectCode)
        .eq('is_deleted', false)
        .order('file_name');

      if (filesError) throw filesError;

      if (!files || files.length === 0) {
        return res.json({
          success: true,
          data: { configured: true, total: 0, conformes: 0, naoConformes: 0, arquivos: [] },
        });
      }

      const arquivos = files.map(f => validateFileName(f.file_name, nomenclatura.segments));
      const conformes = arquivos.filter(a => a.conforme).length;

      res.json({
        success: true,
        data: {
          configured: true,
          padrao_template: nomenclatura.padrao_template,
          total: arquivos.length,
          conformes,
          naoConformes: arquivos.length - conformes,
          arquivos,
        },
      });
    } catch (error) {
      console.error('Erro ao validar nomenclatura:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/:projectCode', requireAuth, async (req, res) => {
    try {
      const { projectCode } = req.params;
      const supabase = getSupabaseServiceClient();

      const { data, error } = await supabase
        .from(TABLE)
        .select('tipo, padrao_template, segments')
        .eq('project_code', projectCode);

      if (error) throw error;

      const result = { modelos: null, pranchas: null };
      for (const row of (data || [])) {
        result[row.tipo] = {
          padrao_template: row.padrao_template,
          segments: row.segments,
        };
      }

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erro ao buscar nomenclatura:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * PUT /api/nomenclatura/:projectCode
   * Salva/atualiza padrões de nomenclatura (modelos + pranchas)
   * Body: { modelos: { padrao_template, segments }, pranchas: { padrao_template, segments } }
   */
  router.put('/:projectCode', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const { projectCode } = req.params;
      const { modelos, pranchas } = req.body;
      const supabase = getSupabaseServiceClient();

      const upserts = [];

      for (const [tipo, data] of [['modelos', modelos], ['pranchas', pranchas]]) {
        if (!data) continue;

        if (!data.padrao_template || !Array.isArray(data.segments)) {
          return res.status(400).json({
            success: false,
            error: `Dados inválidos para ${tipo}: padrao_template e segments são obrigatórios`,
          });
        }

        upserts.push({
          project_code: projectCode,
          tipo,
          padrao_template: data.padrao_template,
          segments: data.segments,
          updated_at: new Date().toISOString(),
        });
      }

      if (upserts.length === 0) {
        return res.status(400).json({ success: false, error: 'Nenhum dado para salvar' });
      }

      const { error } = await supabase
        .from(TABLE)
        .upsert(upserts, { onConflict: 'project_code,tipo' });

      if (error) throw error;

      if (logAction) {
        await logAction(req, 'update', 'nomenclatura', projectCode, 'nomenclatura', {
          tipos: upserts.map(u => u.tipo),
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao salvar nomenclatura:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/nomenclatura/:projectCode/:tipo
   * Remove um padrão de nomenclatura
   */
  router.delete('/:projectCode/:tipo', requireAuth, async (req, res) => {
    try {
      if (!isPrivileged(req.user)) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }

      const { projectCode, tipo } = req.params;
      if (!['modelos', 'pranchas'].includes(tipo)) {
        return res.status(400).json({ success: false, error: 'Tipo inválido' });
      }

      const supabase = getSupabaseServiceClient();
      const { error } = await supabase
        .from(TABLE)
        .delete()
        .eq('project_code', projectCode)
        .eq('tipo', tipo);

      if (error) throw error;

      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao deletar nomenclatura:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

export { createRoutes };
