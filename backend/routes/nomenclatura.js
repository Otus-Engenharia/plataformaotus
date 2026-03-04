/**
 * Rotas: Nomenclatura de Arquivos
 *
 * Endpoints para configuração e validação de padrões de nomenclatura
 * de arquivos (modelos IFC/RVT e pranchas DWG/PDF) por projeto.
 */

import express from 'express';
import { getSupabaseServiceClient } from '../supabase.js';

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

/**
 * Valida um nome de arquivo contra o padrão de segmentos
 */
function validateFileName(fileName, segments) {
  const result = { fileName, conforme: false, erros: [] };

  // Remover extensão
  const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
  const name = extMatch ? fileName.slice(0, -extMatch[0].length) : fileName;

  // Separadores possíveis no padrão
  const separators = segments.map(s => s.separator).filter(Boolean);
  const allSeps = [...new Set(separators)];
  if (allSeps.length === 0) allSeps.push('-');

  // Build regex from segments
  const parts = splitBySegments(name, segments);

  if (!parts) {
    // Fallback: split genérico e comparar contagem
    const sepRegex = new RegExp(`[${allSeps.map(escapeRegex).join('')}]`);
    const fileParts = name.split(sepRegex);

    if (fileParts.length !== segments.length) {
      result.erros.push(
        `Esperado ${segments.length} segmentos, encontrado ${fileParts.length}`
      );
      return result;
    }

    // Verificar segmentos fixos
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.type === 'fixed') {
        if (fileParts[i].toUpperCase() !== seg.value.toUpperCase()) {
          result.erros.push(
            `Segmento ${i + 1}: esperado "${seg.value}", encontrado "${fileParts[i]}"`
          );
        }
      }
    }

    result.conforme = result.erros.length === 0;
    return result;
  }

  result.conforme = parts.valid;
  result.erros = parts.erros;
  return result;
}

/**
 * Tenta split estruturado baseado nos separadores definidos nos segmentos
 */
function splitBySegments(name, segments) {
  // Reconstruir regex a partir dos segmentos
  let remaining = name;
  const erros = [];
  let valid = true;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;

    // Encontrar o próximo separador (do segmento seguinte)
    const nextSep = !isLast && segments[i + 1]?.separator
      ? segments[i + 1].separator
      : null;

    let value;

    if (nextSep) {
      const sepIndex = remaining.indexOf(nextSep);
      if (sepIndex === -1) {
        // Separador não encontrado — pode ser último segmento real
        value = remaining;
        remaining = '';
      } else {
        value = remaining.slice(0, sepIndex);
        remaining = remaining.slice(sepIndex + nextSep.length);
      }
    } else {
      value = remaining;
      remaining = '';
    }

    // Remover separador do início se é o primeiro e tem separator
    if (i === 0 && seg.separator && value.startsWith(seg.separator)) {
      value = value.slice(seg.separator.length);
    }

    // Validar valor
    if (seg.type === 'fixed') {
      if (value.toUpperCase() !== seg.value.toUpperCase()) {
        erros.push(`Segmento "${seg.value}": encontrado "${value}"`);
        valid = false;
      }
    } else if (seg.type === 'revision') {
      if (!/^R\d{2,}$/i.test(value) && !/^REV[A-Z0-9]+$/i.test(value)) {
        erros.push(`Revisão: formato inválido "${value}" (esperado RXX)`);
        valid = false;
      }
    }
    // params não precisam de validação estrita
  }

  return { valid, erros };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export { createRoutes };
