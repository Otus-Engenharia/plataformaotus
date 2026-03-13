/**
 * Rotas do Portal do Cliente (DDD)
 *
 * Duas exportações:
 *   - createClientRoutes(requireClientAuth)  -> montado em /api/client
 *   - createAdminClientPortalRoutes(requireAuth) -> montado em /api/admin/client-portal
 *
 * As rotas de dados de projeto reutilizam os mesmos use cases da plataforma interna
 * (Curva S Progresso, Marcos, Relatos) mas com autenticação e autorização isoladas.
 */

import express from 'express';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { getClientPortalRepository } from '../infrastructure/repositories/SupabaseClientPortalRepository.js';
import { SupabaseCurvaSProgressoRepository } from '../infrastructure/repositories/SupabaseCurvaSProgressoRepository.js';
import { SupabaseBaselineRepository } from '../infrastructure/repositories/SupabaseBaselineRepository.js';
import {
  CalculateProgress,
  GetProgressTimeSeries,
  GetChangeLog,
} from '../application/use-cases/curva-s-progresso/index.js';
import { queryCurvaSProgressoTasks, queryCurvaSSnapshotTasks, queryPortfolio, queryIssues, queryCronograma } from '../bigquery.js';
import { fetchDisciplineMappings, getSupabaseServiceClient } from '../supabase.js';
import { ListRelatos, ListTipos, ListPrioridades } from '../application/use-cases/relatos/index.js';
import { SupabaseRelatoRepository } from '../infrastructure/repositories/SupabaseRelatoRepository.js';
import { SupabaseNpsResponseRepository } from '../infrastructure/repositories/SupabaseNpsResponseRepository.js';
import { CreateNpsResponse } from '../application/use-cases/nps/CreateNpsResponse.js';
import { ListNpsResponses } from '../application/use-cases/nps/ListNpsResponses.js';
import { NpsScore } from '../domain/nps/value-objects/NpsScore.js';
import { sanitizeDate, normalizeStatus } from './marcos-projeto.js';

// In-memory impersonation tokens: token -> { contact, createdBy, expiresAt }
export const impersonationTokens = new Map();

function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [token, data] of impersonationTokens) {
    if (data.expiresAt < now) impersonationTokens.delete(token);
  }
}

// Lazy singletons
let curvaSRepo = null;
let baselineRepo = null;
let relatoRepo = null;
let npsRepo = null;

// Simple in-memory cache for portfolio metadata (TTL 5min)
const metadataCache = new Map();
const METADATA_CACHE_TTL = 5 * 60 * 1000;

function getCurvaSRepo() {
  if (!curvaSRepo) curvaSRepo = new SupabaseCurvaSProgressoRepository();
  return curvaSRepo;
}

function getBaselineRepo() {
  if (!baselineRepo) baselineRepo = new SupabaseBaselineRepository();
  return baselineRepo;
}

function getRelatoRepo() {
  if (!relatoRepo) relatoRepo = new SupabaseRelatoRepository();
  return relatoRepo;
}

function getNpsRepo() {
  if (!npsRepo) npsRepo = new SupabaseNpsResponseRepository();
  return npsRepo;
}

// ============================================================================
// Client Routes (/api/client/*)
// ============================================================================

export function createClientRoutes(requireClientAuth) {
  const router = express.Router();
  const repo = getClientPortalRepository();

  // === PUBLIC ROUTES (no auth) ===

  // POST /api/client/auth/login - Proxy login via Supabase
  router.post('/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email e senha obrigatórios' });
      }

      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        return res.status(401).json({ success: false, error: 'Email ou senha incorretos' });
      }

      // Verify the user has portal access
      const contact = await repo.getContactByEmail(email);
      if (!contact || !contact.has_portal_access) {
        return res.status(403).json({ success: false, error: 'Acesso ao portal não autorizado' });
      }

      // Check if first login (must change password)
      const mustChangePassword = !data.user.last_sign_in_at;

      // Log audit
      await repo.logAuditAction({
        contactId: contact.id,
        action: 'login',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        data: {
          token: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at,
          user: {
            id: contact.id,
            name: contact.name,
            email: contact.email,
            companyName: contact.companies?.name || null,
          },
          mustChangePassword,
        },
      });
    } catch (err) {
      console.error('Client login error:', err);
      res.status(500).json({ success: false, error: 'Erro ao fazer login' });
    }
  });

  // POST /api/client/auth/refresh - Renew token
  router.post('/auth/refresh', async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ success: false, error: 'Refresh token obrigatório' });
      }

      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

      if (error) {
        return res.status(401).json({ success: false, error: 'Token expirado' });
      }

      res.json({
        success: true,
        data: {
          token: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Erro ao renovar token' });
    }
  });

  // POST /api/client/auth/reset-password
  router.post('/auth/reset-password', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, error: 'Email obrigatório' });
      }

      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.FRONTEND_URL || 'https://app.otusengenharia.com'}/portal/reset-password`,
      });

      if (error) {
        console.error('Reset password error:', error);
      }

      // Always return success to avoid email enumeration
      res.json({ success: true, message: 'Se o email estiver cadastrado, você receberá um link de recuperação.' });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Erro ao enviar email' });
    }
  });

  // === AUTHENTICATED CLIENT ROUTES ===

  // POST /api/client/auth/update-password
  router.post('/auth/update-password', requireClientAuth, async (req, res) => {
    try {
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, error: 'Senha deve ter pelo menos 6 caracteres' });
      }

      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      const { error } = await supabase.auth.admin.updateUserById(req.clientUser.supabaseUserId, {
        password: newPassword,
      });

      if (error) {
        return res.status(400).json({ success: false, error: 'Erro ao atualizar senha' });
      }

      await repo.logAuditAction({
        contactId: req.clientUser.id,
        action: 'password_change',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ success: true, message: 'Senha atualizada com sucesso' });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Erro ao atualizar senha' });
    }
  });

  // GET /api/client/me - Client user data
  router.get('/me', requireClientAuth, async (req, res) => {
    res.json({ success: true, data: req.clientUser });
  });

  // POST /api/client/feedbacks - Client bug/feedback report
  router.post('/feedbacks', requireClientAuth, async (req, res) => {
    try {
      const { type, titulo, feedback_text, screenshot_url, page_url } = req.body;

      // Only allow bug and feedback_plataforma from clients
      const ALLOWED_TYPES = ['bug', 'feedback_plataforma'];
      if (!ALLOWED_TYPES.includes(type)) {
        return res.status(400).json({ success: false, error: `Tipo inválido. Permitidos: ${ALLOWED_TYPES.join(', ')}` });
      }
      if (!titulo?.trim()) {
        return res.status(400).json({ success: false, error: 'Título obrigatório' });
      }
      if (!feedback_text?.trim()) {
        return res.status(400).json({ success: false, error: 'Descrição obrigatória' });
      }

      const client = req.clientUser;
      const supabase = getSupabaseServiceClient();

      const { data, error } = await supabase
        .from('feedbacks')
        .insert({
          type,
          titulo: titulo.trim(),
          feedback_text: feedback_text.trim(),
          screenshot_url: screenshot_url || null,
          author_id: null,
          area: 'portal_cliente',
          page_url: page_url || null,
          category: JSON.stringify({
            contactId: client.id,
            contactName: client.name,
            contactEmail: client.email,
            companyName: client.companyName,
          }),
          status: 'pendente',
          author_role_level: 6,
        })
        .select('id')
        .single();

      if (error) throw error;

      res.json({ success: true, data: { id: data.id } });
    } catch (err) {
      console.error('Client feedback error:', err);
      res.status(500).json({ success: false, error: 'Erro ao enviar feedback' });
    }
  });

  // GET /api/client/projects - List accessible projects
  router.get('/projects', requireClientAuth, async (req, res) => {
    try {
      const projects = req.clientUser.isCompanyImpersonation
        ? await repo.getCompanyProjects(req.clientUser.companyId)
        : await repo.getClientProjects(req.clientUser.id);

      // Fire-and-forget audit log
      repo.logAuditAction({
        contactId: req.clientUser.id,
        action: 'view_projects',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(console.error);

      res.json({ success: true, data: projects });
    } catch (err) {
      console.error('Error listing client projects:', err);
      res.status(500).json({ success: false, error: 'Erro ao listar projetos' });
    }
  });

  // === PROJECT DATA ROUTES (reuse existing logic) ===

  // Middleware to verify project access
  async function verifyProjectAccess(req, res, next) {
    try {
      const projectCode = req.params.code;
      const allowedCodes = req.clientUser.isCompanyImpersonation
        ? await repo.getCompanyProjectCodes(req.clientUser.companyId)
        : await repo.getClientProjectCodes(req.clientUser.id);

      if (!allowedCodes.includes(projectCode)) {
        return res.status(403).json({ success: false, error: 'Acesso negado a este projeto' });
      }

      req.clientProjectCode = projectCode;
      next();
    } catch (err) {
      res.status(500).json({ success: false, error: 'Erro ao verificar acesso' });
    }
  }

  // GET /api/client/projects/:code/cover-image - Proxy cover image from Google Drive
  // Supports ?token= query param for <img> tags that can't send Authorization headers
  router.get('/projects/:code/cover-image', (req, res, next) => {
    if (!req.headers.authorization && req.query.token) {
      req.headers.authorization = `Bearer ${req.query.token}`;
    }
    next();
  }, requireClientAuth, verifyProjectAccess, async (req, res) => {
    try {
      const supabase = getSupabaseServiceClient();
      const { data } = await supabase
        .from('project_features')
        .select('capa_email_url, projects!inner(project_code)')
        .eq('projects.project_code', req.clientProjectCode)
        .single();

      const capaUrl = data?.capa_email_url;
      if (!capaUrl) return res.status(404).json({ error: 'Sem imagem de capa' });

      // Extract Google Drive file ID
      const extractFileId = (url) => {
        if (!url) return null;
        const trimmed = url.trim();
        if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
        const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (fileMatch) return fileMatch[1];
        const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (idMatch) return idMatch[1];
        const dMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (dMatch) return dMatch[1];
        return null;
      };

      const fileId = extractFileId(capaUrl);
      if (!fileId) return res.status(404).json({ error: 'URL de capa inválida' });

      const { google } = await import('googleapis');
      const path = await import('path');
      const keyFile = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account-key.json');
      const auth = new google.auth.GoogleAuth({
        keyFile,
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      });
      const drive = google.drive({ version: 'v3', auth });

      const meta = await drive.files.get({ fileId, fields: 'mimeType,size', supportsAllDrives: true });
      const mimeType = meta.data.mimeType || 'image/png';

      const response = await drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream' },
      );

      res.set('Content-Type', mimeType);
      res.set('Cache-Control', 'public, max-age=3600');
      response.data.pipe(res);
    } catch (err) {
      console.error('[CoverImage] Erro:', err.message);
      res.status(500).json({ error: 'Erro ao buscar imagem de capa' });
    }
  });

  // GET /api/client/projects/:code/details - Get project features (smartsheetId, construflowId)
  router.get('/projects/:code/details', requireClientAuth, verifyProjectAccess, async (req, res) => {
    try {
      const supabase = getSupabaseServiceClient();

      const { data, error } = await supabase
        .from('project_features')
        .select('smartsheet_id, construflow_id, construflow_disciplinasclientes, projects!inner(project_code)')
        .eq('projects.project_code', req.clientProjectCode)
        .single();

      // No features row is not an error — just return nulls
      if (error && error.code === 'PGRST116') {
        return res.json({ success: true, data: { smartsheetId: null, construflowId: null, disciplinaCliente: null } });
      }
      if (error) throw error;

      res.json({
        success: true,
        data: {
          smartsheetId: data?.smartsheet_id || null,
          construflowId: data?.construflow_id || null,
          disciplinaCliente: data?.construflow_disciplinasclientes || null,
        },
      });
    } catch (err) {
      console.error('Client project details error:', err);
      res.status(500).json({ success: false, error: 'Erro ao buscar detalhes do projeto' });
    }
  });

  // GET /api/client/projects/:code/progress
  router.get('/projects/:code/progress', requireClientAuth, verifyProjectAccess, async (req, res) => {
    try {
      const { smartsheetId, projectName, projectId } = req.query;

      const calcProgress = new CalculateProgress(
        getCurvaSRepo(),
        queryCurvaSProgressoTasks,
        fetchDisciplineMappings
      );

      const result = await calcProgress.execute({
        projectCode: req.clientProjectCode,
        smartsheetId,
        projectName,
        projectId,
      });

      // Fire-and-forget audit log
      repo.logAuditAction({
        contactId: req.clientUser.id,
        action: 'view_progress',
        projectCode: req.clientProjectCode,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(console.error);

      res.json({ success: true, data: result });
    } catch (err) {
      console.error('Client progress error:', err);
      res.status(500).json({ success: false, error: 'Erro ao buscar progresso' });
    }
  });

  // GET /api/client/projects/:code/timeseries
  router.get('/projects/:code/timeseries', requireClientAuth, verifyProjectAccess, async (req, res) => {
    try {
      const { smartsheetId, projectName, projectId, startDate, endDate } = req.query;

      const getTimeSeries = new GetProgressTimeSeries(
        getCurvaSRepo(),
        queryCurvaSProgressoTasks,
        fetchDisciplineMappings,
        queryCurvaSSnapshotTasks,
        getBaselineRepo()
      );

      const result = await getTimeSeries.execute({
        projectCode: req.clientProjectCode,
        smartsheetId,
        projectName,
        projectId,
        startDate,
        endDate,
      });

      // Fire-and-forget audit log
      repo.logAuditAction({
        contactId: req.clientUser.id,
        action: 'view_timeseries',
        projectCode: req.clientProjectCode,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(console.error);

      res.json({ success: true, data: result });
    } catch (err) {
      console.error('Client timeseries error:', err);
      res.status(500).json({ success: false, error: 'Erro ao buscar timeseries' });
    }
  });

  // GET /api/client/projects/:code/changelog
  router.get('/projects/:code/changelog', requireClientAuth, verifyProjectAccess, async (req, res) => {
    try {
      const { smartsheetId, projectName } = req.query;

      const getChangeLog = new GetChangeLog(getCurvaSRepo(), queryCurvaSSnapshotTasks);
      const data = await getChangeLog.execute({
        projectCode: req.clientProjectCode,
        smartsheetId,
        projectName,
      });

      // Fire-and-forget audit log
      repo.logAuditAction({
        contactId: req.clientUser.id,
        action: 'view_changelog',
        projectCode: req.clientProjectCode,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(console.error);

      res.json({ success: true, data });
    } catch (err) {
      console.error('Client changelog error:', err);
      res.status(500).json({ success: false, error: 'Erro ao buscar changelog' });
    }
  });

  // GET /api/client/projects/:code/marcos (enriched with Smartsheet data)
  router.get('/projects/:code/marcos', requireClientAuth, verifyProjectAccess, async (req, res) => {
    try {
      const { smartsheetId, projectName } = req.query;
      const supabase = getSupabaseServiceClient();

      const { data: marcos, error } = await supabase
        .from('marcos_projeto')
        .select('*')
        .eq('project_code', req.clientProjectCode)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      let enrichedMarcos = marcos || [];

      // Auto-import from BigQuery if no marcos exist yet
      if (enrichedMarcos.length === 0 && (smartsheetId || projectName)) {
        try {
          const tasks = await queryCronograma(smartsheetId || null, projectName || null);

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
          if (marcosToImport.length > 0) {
            const rows = marcosToImport.map((m, idx) => ({
              project_code: req.clientProjectCode,
              nome: m.nome,
              status: m.status,
              prazo_baseline: m.prazo_baseline,
              prazo_atual: m.prazo_atual,
              variacao_dias: m.variacao_dias,
              source: 'smartsheet',
              sort_order: idx,
              updated_at: new Date().toISOString(),
            }));

            await supabase
              .from('marcos_projeto')
              .upsert(rows, { onConflict: 'project_code,nome' });

            // Re-fetch after import
            const { data: freshMarcos } = await supabase
              .from('marcos_projeto')
              .select('*')
              .eq('project_code', req.clientProjectCode)
              .order('sort_order', { ascending: true })
              .order('created_at', { ascending: true });

            enrichedMarcos = freshMarcos || [];
          }
        } catch (importErr) {
          console.error('Portal auto-import marcos failed (graceful):', importErr.message);
        }
      }

      // Enrich with live Smartsheet data if we have identifiers
      if (enrichedMarcos.length > 0 && (smartsheetId || projectName)) {
        try {
          const tasks = await queryCronograma(smartsheetId || null, projectName || null);

          // Build rowId lookup map
          const tasksByRowId = new Map();
          tasks.forEach(t => {
            if (t.rowId) tasksByRowId.set(String(t.rowId), t);
          });

          enrichedMarcos = enrichedMarcos.map(marco => {
            if (!marco.smartsheet_row_id) return marco;

            const task = tasksByRowId.get(String(marco.smartsheet_row_id));
            if (!task) return marco;

            return {
              ...marco,
              smartsheet_status: task.Status || null,
              smartsheet_data_termino: task.DataDeTermino || null,
              smartsheet_variancia: task.VarianciaBaselineOtus != null
                ? Number(task.VarianciaBaselineOtus)
                : null,
            };
          });
        } catch (bqErr) {
          console.error('Marcos enrichment failed (graceful):', bqErr.message);
          // Return unenriched marcos on BigQuery failure
        }
      }

      // Fire-and-forget audit log
      repo.logAuditAction({
        contactId: req.clientUser.id,
        action: 'view_marcos',
        projectCode: req.clientProjectCode,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(console.error);

      res.json({ success: true, data: enrichedMarcos });
    } catch (err) {
      console.error('Client marcos error:', err);
      res.status(500).json({ success: false, error: 'Erro ao buscar marcos' });
    }
  });

  // GET /api/client/projects/:code/relatos
  router.get('/projects/:code/relatos', requireClientAuth, verifyProjectAccess, async (req, res) => {
    try {
      const { tipo, prioridade } = req.query;

      const listRelatos = new ListRelatos(getRelatoRepo());
      const relatos = await listRelatos.execute({
        projectCode: req.clientProjectCode,
        tipo,
        prioridade,
      });

      // Fire-and-forget audit log
      repo.logAuditAction({
        contactId: req.clientUser.id,
        action: 'view_relatos',
        projectCode: req.clientProjectCode,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(console.error);

      res.json({ success: true, data: relatos });
    } catch (err) {
      console.error('Client relatos error:', err);
      res.status(500).json({ success: false, error: 'Erro ao buscar relatos' });
    }
  });

  // GET /api/client/projects/:code/metadata - BigQuery portfolio metadata for KpiStrip
  router.get('/projects/:code/metadata', requireClientAuth, verifyProjectAccess, async (req, res) => {
    try {
      const cacheKey = req.clientProjectCode;
      const cached = metadataCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < METADATA_CACHE_TTL) {
        return res.json({ success: true, data: cached.data });
      }

      const portfolio = await queryPortfolio();
      const project = portfolio.find(
        p => p.project_code_norm === req.clientProjectCode
      );

      if (!project) {
        return res.json({ success: true, data: null });
      }

      const metadata = {
        duracao_total_meses: project.duracao_total_meses || null,
        meta_duracao_meses: project.meta_duracao_meses || null,
        fase_atual: project.fase_atual || project.status || null,
        status: project.status || null,
        project_name: project.project_name || null,
        id: project.id || null,
      };

      metadataCache.set(cacheKey, { data: metadata, ts: Date.now() });
      res.json({ success: true, data: metadata });
    } catch (err) {
      console.error('Client metadata error:', err);
      res.status(500).json({ success: false, error: 'Erro ao buscar metadados do projeto' });
    }
  });

  // GET /api/client/projects/:code/apontamentos-count - Open issues count
  router.get('/projects/:code/apontamentos-count', requireClientAuth, verifyProjectAccess, async (req, res) => {
    try {
      const construflowId = req.query.construflowId;
      if (!construflowId) {
        return res.json({ success: true, data: { total: 0 } });
      }

      const issues = await queryIssues(construflowId);
      const closedStatuses = ['fechado', 'closed', 'resolvido', 'resolved', 'cancelado'];
      const open = (issues || []).filter(i => {
        const s = String(i.status || '').toLowerCase().trim();
        return !closedStatuses.some(c => s.includes(c));
      });

      res.json({ success: true, data: { total: open.length } });
    } catch (err) {
      console.error('Client apontamentos count error:', err);
      res.status(500).json({ success: false, error: 'Erro ao contar apontamentos' });
    }
  });

  // GET /api/client/relatos/tipos - List relato types (no project auth needed)
  router.get('/relatos/tipos', requireClientAuth, async (req, res) => {
    try {
      const listTipos = new ListTipos(getRelatoRepo());
      const tipos = await listTipos.execute();
      res.json({ success: true, data: tipos });
    } catch (err) {
      console.error('Client relatos tipos error:', err);
      res.status(500).json({ success: false, error: 'Erro ao buscar tipos' });
    }
  });

  // GET /api/client/relatos/prioridades - List relato priorities
  router.get('/relatos/prioridades', requireClientAuth, async (req, res) => {
    try {
      const listPrioridades = new ListPrioridades(getRelatoRepo());
      const prioridades = await listPrioridades.execute();
      res.json({ success: true, data: prioridades });
    } catch (err) {
      console.error('Client relatos prioridades error:', err);
      res.status(500).json({ success: false, error: 'Erro ao buscar prioridades' });
    }
  });

  // POST /api/client/nps - Submit NPS feedback
  router.post('/nps', requireClientAuth, async (req, res) => {
    try {
      const { project_code, nps_score, feedback_text } = req.body;

      if (!project_code) {
        return res.status(400).json({ success: false, error: 'Código do projeto é obrigatório' });
      }

      // Verify client has access to this project
      const allowedCodes = req.clientUser.isCompanyImpersonation
        ? await repo.getCompanyProjectCodes(req.clientUser.companyId)
        : await repo.getClientProjectCodes(req.clientUser.id);
      if (!allowedCodes.includes(project_code)) {
        return res.status(403).json({ success: false, error: 'Acesso negado a este projeto' });
      }

      if (!NpsScore.isValid(nps_score)) {
        return res.status(400).json({ success: false, error: 'Nota NPS deve ser um inteiro entre 0 e 10' });
      }

      const createNps = new CreateNpsResponse(getNpsRepo());
      const response = await createNps.execute({
        project_code,
        nps_score: nps_score ?? null,
        feedback_text: feedback_text || null,
        respondentEmail: req.clientUser.email,
        respondentName: req.clientUser.name || null,
      });

      repo.logAuditAction({
        contactId: req.clientUser.id,
        action: 'submit_nps',
        projectCode: project_code,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(console.error);

      res.status(201).json({ success: true, data: response });
    } catch (err) {
      console.error('Client NPS submit error:', err);
      res.status(500).json({ success: false, error: 'Erro ao enviar feedback' });
    }
  });

  // GET /api/client/nps - List NPS feedbacks for a project
  router.get('/nps', requireClientAuth, async (req, res) => {
    try {
      const { project_code, limit } = req.query;

      // Verify client has access to this project if specified
      if (project_code) {
        const allowedCodes = req.clientUser.isCompanyImpersonation
          ? await repo.getCompanyProjectCodes(req.clientUser.companyId)
          : await repo.getClientProjectCodes(req.clientUser.id);
        if (!allowedCodes.includes(project_code)) {
          return res.status(403).json({ success: false, error: 'Acesso negado a este projeto' });
        }
      }

      const listNps = new ListNpsResponses(getNpsRepo());
      const responses = await listNps.execute({
        projectCode: project_code || null,
        limit: limit ? parseInt(limit, 10) : 20,
      });
      res.json({ success: true, data: responses });
    } catch (err) {
      console.error('Client NPS list error:', err);
      res.status(500).json({ success: false, error: 'Erro ao listar feedbacks' });
    }
  });

  // GET /api/client/projects/:code/apontamentos
  router.get('/projects/:code/apontamentos', requireClientAuth, verifyProjectAccess, async (req, res) => {
    try {
      const construflowId = req.query.construflowId;

      if (!construflowId) {
        return res.status(400).json({ success: false, error: 'construflowId obrigatório' });
      }

      const data = await queryIssues(construflowId);

      repo.logAuditAction({
        contactId: req.clientUser.id,
        action: 'view_apontamentos',
        projectCode: req.clientProjectCode,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ success: true, data: data || [] });
    } catch (err) {
      console.error('Client apontamentos error:', err);
      res.status(500).json({ success: false, error: 'Erro ao buscar apontamentos' });
    }
  });

  // POST /api/client/projects/:code/marcos - Create marco
  router.post('/projects/:code/marcos', requireClientAuth, verifyProjectAccess, async (req, res) => {
    try {
      const { nome, descricao, cliente_expectativa_data } = req.body;
      if (!nome || !nome.trim()) {
        return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
      }

      const supabase = getSupabaseServiceClient();
      const { data, error } = await supabase
        .from('marcos_projeto')
        .insert({
          project_code: req.clientProjectCode,
          nome: nome.trim(),
          descricao: descricao || null,
          cliente_expectativa_data: cliente_expectativa_data || null,
          source: 'portal_cliente',
          status: 'pendente',
          sort_order: 0,
          created_by_email: req.clientUser.email,
          created_by_name: req.clientUser.name || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Audit log in edit_log
      await supabase.from('marco_edit_log').insert({
        marco_id: data.id,
        project_code: req.clientProjectCode,
        action: 'criar',
        field_changed: null,
        old_value: null,
        new_value: nome.trim(),
        edited_by_email: req.clientUser.email,
        edited_by_name: req.clientUser.name || null,
        seen_by_leader: false,
      });

      repo.logAuditAction({
        contactId: req.clientUser.id,
        action: 'create_marco',
        projectCode: req.clientProjectCode,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(console.error);

      res.status(201).json({ success: true, data });
    } catch (err) {
      console.error('Client create marco error:', err);
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/client/projects/:code/marcos/baseline-request - Request baseline
  router.post('/projects/:code/marcos/baseline-request', requireClientAuth, verifyProjectAccess, async (req, res) => {
    try {
      const { justificativa, marcos_snapshot } = req.body;
      const supabase = getSupabaseServiceClient();

      // If no snapshot provided, build from current marcos
      let snapshot = marcos_snapshot;
      if (!snapshot) {
        const { data: currentMarcos } = await supabase
          .from('marcos_projeto')
          .select('*')
          .eq('project_code', req.clientProjectCode)
          .order('sort_order', { ascending: true });
        snapshot = currentMarcos || [];
      }

      const { data, error } = await supabase
        .from('marco_baseline_requests')
        .insert({
          project_code: req.clientProjectCode,
          status: 'pendente',
          marcos_snapshot: snapshot,
          justificativa: justificativa || null,
          requested_by_email: req.clientUser.email,
          requested_by_name: req.clientUser.name || null,
        })
        .select()
        .single();

      if (error) throw error;

      repo.logAuditAction({
        contactId: req.clientUser.id,
        action: 'request_baseline',
        projectCode: req.clientProjectCode,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(console.error);

      res.status(201).json({ success: true, data });
    } catch (err) {
      console.error('Client baseline request error:', err);
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // GET /api/client/projects/:code/marcos/baseline-requests - Baseline history
  router.get('/projects/:code/marcos/baseline-requests', requireClientAuth, verifyProjectAccess, async (req, res) => {
    try {
      const supabase = getSupabaseServiceClient();
      const { data, error } = await supabase
        .from('marco_baseline_requests')
        .select('*')
        .eq('project_code', req.clientProjectCode)
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.json({ success: true, data: data || [] });
    } catch (err) {
      console.error('Client baseline requests error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // PUT /api/client/projects/:code/marcos/:id - Update marco
  router.put('/projects/:code/marcos/:id', requireClientAuth, verifyProjectAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { nome, descricao, cliente_expectativa_data } = req.body;

      const supabase = getSupabaseServiceClient();

      // Fetch current state
      const { data: current, error: fetchErr } = await supabase
        .from('marcos_projeto')
        .select('*')
        .eq('id', parseInt(id, 10))
        .eq('project_code', req.clientProjectCode)
        .single();

      if (fetchErr || !current) {
        return res.status(404).json({ success: false, error: 'Marco não encontrado' });
      }

      const updates = { updated_at: new Date().toISOString() };
      if (nome !== undefined) updates.nome = nome.trim();
      if (descricao !== undefined) updates.descricao = descricao;
      if (cliente_expectativa_data !== undefined) updates.cliente_expectativa_data = cliente_expectativa_data || null;

      const { data, error } = await supabase
        .from('marcos_projeto')
        .update(updates)
        .eq('id', parseInt(id, 10))
        .eq('project_code', req.clientProjectCode)
        .select()
        .single();

      if (error) throw error;

      // Audit log for changed fields
      const trackableFields = ['nome', 'descricao', 'cliente_expectativa_data'];
      const editLogEntries = [];
      for (const field of trackableFields) {
        if (req.body[field] === undefined) continue;
        const oldVal = current[field];
        const newVal = field === 'nome' ? req.body[field]?.trim() : req.body[field];
        if (String(oldVal ?? '') !== String(newVal ?? '')) {
          editLogEntries.push({
            marco_id: parseInt(id, 10),
            project_code: req.clientProjectCode,
            action: 'editar',
            field_changed: field,
            old_value: oldVal != null ? String(oldVal) : null,
            new_value: newVal != null ? String(newVal) : null,
            edited_by_email: req.clientUser.email,
            edited_by_name: req.clientUser.name || null,
            seen_by_leader: false,
          });
        }
      }
      if (editLogEntries.length > 0) {
        supabase.from('marco_edit_log').insert(editLogEntries).then(({ error: logErr }) => {
          if (logErr) console.error('Edit log insert error:', logErr);
        });
      }

      repo.logAuditAction({
        contactId: req.clientUser.id,
        action: 'update_marco',
        projectCode: req.clientProjectCode,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(console.error);

      res.json({ success: true, data });
    } catch (err) {
      console.error('Client update marco error:', err);
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // PUT /api/client/projects/:code/marcos/:id/date - Inline date edit
  router.put('/projects/:code/marcos/:id/date', requireClientAuth, verifyProjectAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { cliente_expectativa_data } = req.body;
      const supabase = getSupabaseServiceClient();

      const { data: current, error: fetchErr } = await supabase
        .from('marcos_projeto')
        .select('id, project_code, cliente_expectativa_data')
        .eq('id', parseInt(id, 10))
        .eq('project_code', req.clientProjectCode)
        .single();

      if (fetchErr || !current) {
        return res.status(404).json({ success: false, error: 'Marco não encontrado' });
      }

      const { data, error } = await supabase
        .from('marcos_projeto')
        .update({
          cliente_expectativa_data: cliente_expectativa_data || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', parseInt(id, 10))
        .eq('project_code', req.clientProjectCode)
        .select()
        .single();

      if (error) throw error;

      // Audit log
      if (String(current.cliente_expectativa_data ?? '') !== String(cliente_expectativa_data ?? '')) {
        supabase.from('marco_edit_log').insert({
          marco_id: parseInt(id, 10),
          project_code: req.clientProjectCode,
          action: 'editar',
          field_changed: 'cliente_expectativa_data',
          old_value: current.cliente_expectativa_data ? String(current.cliente_expectativa_data) : null,
          new_value: cliente_expectativa_data ? String(cliente_expectativa_data) : null,
          edited_by_email: req.clientUser.email,
          edited_by_name: req.clientUser.name || null,
          seen_by_leader: false,
        }).then(({ error: logErr }) => {
          if (logErr) console.error('Edit log insert error:', logErr);
        });
      }

      res.json({ success: true, data });
    } catch (err) {
      console.error('Client inline date edit error:', err);
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // DELETE /api/client/projects/:code/marcos/:id - Delete marco
  router.delete('/projects/:code/marcos/:id', requireClientAuth, verifyProjectAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const supabase = getSupabaseServiceClient();

      const { data: existing, error: fetchErr } = await supabase
        .from('marcos_projeto')
        .select('*')
        .eq('id', parseInt(id, 10))
        .eq('project_code', req.clientProjectCode)
        .single();

      if (fetchErr || !existing) {
        return res.status(404).json({ success: false, error: 'Marco não encontrado' });
      }

      // Log before delete (CASCADE will remove edit logs for this marco)
      await supabase.from('marco_edit_log').insert({
        marco_id: parseInt(id, 10),
        project_code: req.clientProjectCode,
        action: 'excluir',
        field_changed: null,
        old_value: existing.nome,
        new_value: null,
        edited_by_email: req.clientUser.email,
        edited_by_name: req.clientUser.name || null,
        seen_by_leader: false,
      });

      const { error } = await supabase
        .from('marcos_projeto')
        .delete()
        .eq('id', parseInt(id, 10))
        .eq('project_code', req.clientProjectCode);

      if (error) throw error;

      repo.logAuditAction({
        contactId: req.clientUser.id,
        action: 'delete_marco',
        projectCode: req.clientProjectCode,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(console.error);

      res.json({ success: true, message: 'Marco removido com sucesso' });
    } catch (err) {
      console.error('Client delete marco error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}

// ============================================================================
// Admin Routes (/api/admin/client-portal/*)
// ============================================================================

export function createAdminClientPortalRoutes(requireAuth) {
  const router = express.Router();
  const repo = getClientPortalRepository();

  // GET /api/admin/client-portal/analytics
  router.get('/analytics', requireAuth, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!['dev', 'director', 'admin'].includes(userRole)) {
        return res.status(403).json({ success: false, error: 'Sem permissão' });
      }

      const days = Math.min(parseInt(req.query.days) || 30, 90);
      const supabase = getSupabaseServiceClient();
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Run queries in parallel
      const [logsResult, todayResult] = await Promise.all([
        // All logs in period
        supabase
          .from('client_portal_audit_log')
          .select('id, contact_id, action, project_code, ip_address, created_at')
          .gte('created_at', sinceDate)
          .order('created_at', { ascending: false }),
        // Active today
        supabase
          .from('client_portal_audit_log')
          .select('contact_id')
          .eq('action', 'login')
          .gte('created_at', todayStart.toISOString()),
      ]);

      if (logsResult.error) throw logsResult.error;

      const logs = logsResult.data || [];
      const todayLogins = todayResult.data || [];

      // Compute summary
      const loginLogs = logs.filter(l => l.action === 'login');
      const pageViewActions = ['view_projects', 'view_progress', 'view_timeseries', 'view_changelog', 'view_marcos', 'view_relatos', 'view_apontamentos'];
      const pageViewLogs = logs.filter(l => pageViewActions.includes(l.action));
      const uniqueUsersToday = new Set(todayLogins.map(l => l.contact_id));

      const summary = {
        totalLogins: loginLogs.length,
        uniqueUsers: new Set(loginLogs.map(l => l.contact_id)).size,
        totalPageViews: pageViewLogs.length,
        activeToday: uniqueUsersToday.size,
      };

      // Logins by day
      const loginsByDayMap = {};
      loginLogs.forEach(l => {
        const date = l.created_at.substring(0, 10);
        loginsByDayMap[date] = (loginsByDayMap[date] || 0) + 1;
      });
      const loginsByDay = Object.entries(loginsByDayMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Top pages
      const pageCountMap = {};
      pageViewLogs.forEach(l => {
        pageCountMap[l.action] = (pageCountMap[l.action] || 0) + 1;
      });
      const topPages = Object.entries(pageCountMap)
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count);

      // Top users - get contact details
      const userStatsMap = {};
      logs.forEach(l => {
        if (!userStatsMap[l.contact_id]) {
          userStatsMap[l.contact_id] = { contactId: l.contact_id, loginCount: 0, lastAccess: l.created_at };
        }
        if (l.action === 'login') userStatsMap[l.contact_id].loginCount++;
        if (l.created_at > userStatsMap[l.contact_id].lastAccess) {
          userStatsMap[l.contact_id].lastAccess = l.created_at;
        }
      });

      const contactIds = Object.keys(userStatsMap).map(Number).filter(Boolean);
      let contactsMap = {};
      if (contactIds.length > 0) {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, name, companies(name)')
          .in('id', contactIds);
        (contacts || []).forEach(c => {
          contactsMap[c.id] = { name: c.name, company: c.companies?.name || '' };
        });
      }

      const topUsers = Object.values(userStatsMap)
        .map(u => ({
          ...u,
          name: contactsMap[u.contactId]?.name || `Contato #${u.contactId}`,
          company: contactsMap[u.contactId]?.company || '',
        }))
        .sort((a, b) => b.loginCount - a.loginCount)
        .slice(0, 20);

      // Recent actions (last 100) with contact names
      const recentActions = logs.slice(0, 100).map(l => ({
        id: l.id,
        contactName: contactsMap[l.contact_id]?.name || `Contato #${l.contact_id}`,
        action: l.action,
        projectCode: l.project_code,
        createdAt: l.created_at,
        ipAddress: l.ip_address,
      }));

      res.json({
        success: true,
        data: { summary, loginsByDay, topPages, topUsers, recentActions },
      });
    } catch (err) {
      console.error('Client portal analytics error:', err);
      res.status(500).json({ success: false, error: 'Erro ao buscar analytics' });
    }
  });

  // POST /api/admin/client-portal/toggle
  router.post('/toggle', requireAuth, async (req, res) => {
    try {
      // Check full access
      const userRole = req.user?.role;
      if (!['dev', 'director', 'admin'].includes(userRole)) {
        return res.status(403).json({ success: false, error: 'Sem permissão' });
      }

      const { contactId, enable } = req.body;
      if (!contactId) {
        return res.status(400).json({ success: false, error: 'contactId obrigatório' });
      }

      const contact = await repo.getContactById(contactId);
      if (!contact) {
        return res.status(404).json({ success: false, error: 'Contato não encontrado' });
      }

      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

      if (enable) {
        if (!contact.email) {
          return res.status(400).json({ success: false, error: 'Contato não possui email' });
        }

        // Create Supabase Auth user with default password
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: contact.email,
          password: '123456',
          email_confirm: true,
        });

        if (authError) {
          // If user already exists, try to find them by email
          if (authError.message?.includes('already been registered')) {
            // Use filtered listUsers to avoid pagination issues
            const { data: listData } = await supabase.auth.admin.listUsers({
              page: 1,
              perPage: 1,
            });
            // Search by email filter - fallback to direct query
            const { data: contactsWithEmail } = await supabase
              .from('auth.users')
              .select('id')
              .eq('email', contact.email)
              .single()
              .catch(() => ({ data: null }));

            // Try listing with a filter approach
            let existingUserId = contactsWithEmail?.id;
            if (!existingUserId && listData?.users) {
              // Paginate to find the user
              let page = 1;
              while (true) {
                const { data: pageData } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
                if (!pageData?.users?.length) break;
                const found = pageData.users.find(u => u.email === contact.email);
                if (found) { existingUserId = found.id; break; }
                if (pageData.users.length < 100) break;
                page++;
              }
            }

            if (existingUserId) {
              // Reset password to default for existing users
              await supabase.auth.admin.updateUserById(existingUserId, { password: '123456' });
              await repo.enablePortalAccess(contactId, existingUserId);
              return res.json({ success: true, message: 'Portal ativado (usuário existente, senha resetada)' });
            }
          }
          return res.status(400).json({ success: false, error: `Erro ao criar usuário: ${authError.message}` });
        }

        await repo.enablePortalAccess(contactId, authUser.user.id);

        await repo.logAuditAction({
          contactId,
          action: 'portal_enabled',
          metadata: { enabled_by: req.user.email },
        });

        res.json({ success: true, message: 'Portal ativado com sucesso', supabaseAuthId: authUser.user.id });
      } else {
        // Disable portal
        if (contact.supabase_auth_id) {
          try {
            await supabase.auth.admin.deleteUser(contact.supabase_auth_id);
          } catch (deleteErr) {
            console.error('Error deleting Supabase auth user:', deleteErr);
          }
        }

        await repo.disablePortalAccess(contactId);

        await repo.logAuditAction({
          contactId,
          action: 'portal_disabled',
          metadata: { disabled_by: req.user.email },
        });

        res.json({ success: true, message: 'Portal desativado' });
      }
    } catch (err) {
      console.error('Toggle portal error:', err);
      res.status(500).json({ success: false, error: 'Erro ao alterar acesso ao portal' });
    }
  });

  // POST /api/admin/client-portal/reset-all-passwords - Reset all portal users to default password
  router.post('/reset-all-passwords', requireAuth, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!['dev', 'director'].includes(userRole)) {
        return res.status(403).json({ success: false, error: 'Sem permissão' });
      }

      const supabaseService = getSupabaseServiceClient();
      const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

      const { data: contacts, error } = await supabaseService
        .from('contacts')
        .select('id, name, email, supabase_auth_id')
        .eq('has_portal_access', true)
        .not('supabase_auth_id', 'is', null);

      if (error) throw error;

      const results = [];
      for (const contact of contacts || []) {
        try {
          await supabaseAdmin.auth.admin.updateUserById(contact.supabase_auth_id, { password: '123456' });
          results.push({ email: contact.email, success: true });
        } catch (err) {
          results.push({ email: contact.email, success: false, error: err.message });
        }
      }

      res.json({
        success: true,
        total: results.length,
        reset: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success),
      });
    } catch (err) {
      console.error('Reset all passwords error:', err);
      res.status(500).json({ success: false, error: 'Erro ao resetar senhas' });
    }
  });

  // GET /api/admin/client-portal/contacts - List companies with portal contacts
  router.get('/contacts', requireAuth, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!['dev', 'director', 'admin'].includes(userRole)) {
        return res.status(403).json({ success: false, error: 'Sem permissão' });
      }

      const supabase = getSupabaseServiceClient();
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('id, name, email, company_id, companies(id, name)')
        .eq('has_portal_access', true)
        .order('name');

      if (error) throw error;

      // Group by company
      const companiesMap = {};
      (contacts || []).forEach(c => {
        const companyId = c.company_id;
        const companyName = c.companies?.name || 'Sem empresa';
        if (!companiesMap[companyId]) {
          companiesMap[companyId] = { companyId, companyName, contacts: [] };
        }
        companiesMap[companyId].contacts.push({
          id: c.id,
          name: c.name,
          email: c.email,
        });
      });

      const result = Object.values(companiesMap).sort((a, b) =>
        a.companyName.localeCompare(b.companyName)
      );

      res.json({ success: true, data: result });
    } catch (err) {
      console.error('List portal contacts error:', err);
      res.status(500).json({ success: false, error: 'Erro ao listar contatos' });
    }
  });

  // GET /api/admin/client-portal/projects-for-user - Projects with portal contacts, filtered by role
  router.get('/projects-for-user', requireAuth, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, error: 'Não autenticado' });
      }

      const supabase = getSupabaseServiceClient();

      // 1. Fetch projects based on user role/setor
      let projectsQuery = supabase
        .from('projects')
        .select('id, project_code, name, status, company_id, team_id, project_manager_id, companies(id, name)')
        .order('name');

      const role = user.role;
      const setorName = user.setor_name;

      if (role === 'user') {
        // Chimes: only projects from their team
        if (user.team_id) {
          projectsQuery = projectsQuery.eq('team_id', user.team_id);
        } else {
          return res.json({ success: true, data: [] });
        }
      } else if (role === 'leader' && setorName === 'Operação') {
        // Leader Operação: only projects where they are project manager
        projectsQuery = projectsQuery.eq('project_manager_id', user.id);
      }
      // dev, ceo, director, admin, leader (other sectors): all projects

      const { data: projects, error: projError } = await projectsQuery;
      if (projError) throw projError;
      if (!projects || projects.length === 0) {
        return res.json({ success: true, data: [] });
      }

      // 2. Fetch all active portal contact assignments
      const projectCodes = projects.map(p => p.project_code);
      const { data: assignments, error: assignError } = await supabase
        .from('project_client_contacts')
        .select('project_code, contact_id')
        .in('project_code', projectCodes)
        .eq('is_active', true);
      if (assignError) throw assignError;

      // 3. Fetch contact details for all assigned contacts
      const contactIds = [...new Set((assignments || []).map(a => a.contact_id))];
      let contactsMap = {};
      if (contactIds.length > 0) {
        const { data: contacts, error: contactError } = await supabase
          .from('contacts')
          .select('id, name, email')
          .in('id', contactIds)
          .eq('has_portal_access', true);
        if (contactError) throw contactError;
        (contacts || []).forEach(c => { contactsMap[c.id] = c; });
      }

      // 4. Build assignments map: project_code -> contacts[]
      const projectContactsMap = {};
      (assignments || []).forEach(a => {
        const contact = contactsMap[a.contact_id];
        if (!contact) return;
        if (!projectContactsMap[a.project_code]) projectContactsMap[a.project_code] = [];
        projectContactsMap[a.project_code].push({
          id: contact.id,
          name: contact.name,
          email: contact.email,
        });
      });

      // 5. Build result
      const result = projects.map(p => ({
        projectCode: p.project_code,
        projectName: p.name,
        status: p.status,
        companyName: p.companies?.name || 'Sem empresa',
        contacts: projectContactsMap[p.project_code] || [],
      }));

      res.json({ success: true, data: result });
    } catch (err) {
      console.error('Projects for user error:', err);
      res.status(500).json({ success: false, error: 'Erro ao listar projetos' });
    }
  });

  // GET /api/admin/client-portal/companies - List all client companies
  router.get('/companies', requireAuth, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!['dev', 'director', 'admin', 'leader', 'ceo'].includes(userRole)) {
        return res.status(403).json({ success: false, error: 'Sem permissão' });
      }

      const supabase = getSupabaseServiceClient();

      // Fetch ALL client companies
      const { data: allCompanies, error: compError } = await supabase
        .from('companies')
        .select('id, name')
        .eq('company_type', 'client')
        .order('name')
        .limit(5000);

      if (compError) throw compError;

      // Fetch project counts per company, filtering by portal visibility
      const ACTIVE_STATUSES = ['planejamento', 'fase 01', 'fase 02', 'fase 03', 'fase 04'];

      const { data: allProjects } = await supabase
        .from('projects')
        .select('project_code, company_id, status')
        .not('company_id', 'is', null)
        .limit(10000);

      const allProjectCodes = (allProjects || []).map(p => p.project_code);
      const { data: allFeatures } = allProjectCodes.length > 0
        ? await supabase
            .from('project_features')
            .select('portal_cliente_status, projects!inner(project_code)')
            .in('projects.project_code', allProjectCodes)
        : { data: [] };

      const portalStatusMap = new Map((allFeatures || []).map(f => [f.projects?.project_code, f.portal_cliente_status]));

      const projectsByCompany = {};
      (allProjects || []).forEach(p => {
        if (!p.company_id) return;
        const portalStatus = portalStatusMap.get(p.project_code);
        const visible = portalStatus === 'ativo' || (portalStatus !== 'desativado' && portalStatus == null && ACTIVE_STATUSES.includes((p.status || '').toLowerCase()));
        if (!visible) return;
        if (!projectsByCompany[p.company_id]) projectsByCompany[p.company_id] = new Set();
        projectsByCompany[p.company_id].add(p.project_code);
      });

      const result = (allCompanies || []).map(c => ({
        companyId: c.id,
        companyName: c.name,
        projectCount: projectsByCompany[c.id]?.size || 0,
        hasPortal: true,
      }));

      res.json({ success: true, data: result });
    } catch (err) {
      console.error('List companies error:', err);
      res.status(500).json({ success: false, error: 'Erro ao listar empresas' });
    }
  });

  // POST /api/admin/client-portal/impersonate-company - Generate impersonation token for entire company
  router.post('/impersonate-company', requireAuth, async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (!userRole) {
        return res.status(403).json({ success: false, error: 'Sem permissão' });
      }

      const { companyId } = req.body;
      if (!companyId) {
        return res.status(400).json({ success: false, error: 'companyId obrigatório' });
      }

      const supabase = getSupabaseServiceClient();
      const { data: company, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', companyId)
        .single();

      if (error || !company) {
        return res.status(404).json({ success: false, error: 'Empresa não encontrada' });
      }

      cleanupExpiredTokens();

      const token = crypto.randomUUID();
      impersonationTokens.set(token, {
        contact: {
          id: `company-${companyId}`,
          name: `Admin Vista - ${company.name}`,
          email: req.user.email,
          companyId: companyId,
          companyName: company.name,
          isCompanyImpersonation: true,
        },
        createdBy: req.user.email,
        expiresAt: Date.now() + 30 * 60 * 1000,
      });

      res.json({
        success: true,
        data: {
          token,
          company: { id: company.id, name: company.name },
        },
      });
    } catch (err) {
      console.error('Impersonate company error:', err);
      res.status(500).json({ success: false, error: 'Erro ao gerar token de impersonação' });
    }
  });

  // POST /api/admin/client-portal/impersonate - Generate impersonation token
  router.post('/impersonate', requireAuth, async (req, res) => {
    try {
      // Any authenticated user with vista_cliente access can impersonate
      const userRole = req.user?.role;
      if (!userRole) {
        return res.status(403).json({ success: false, error: 'Sem permissão' });
      }

      const { contactId } = req.body;
      if (!contactId) {
        return res.status(400).json({ success: false, error: 'contactId obrigatório' });
      }

      const supabase = getSupabaseServiceClient();
      const { data: contact, error } = await supabase
        .from('contacts')
        .select('id, name, email, phone, position, company_id, companies(id, name)')
        .eq('id', contactId)
        .eq('has_portal_access', true)
        .single();

      if (error || !contact) {
        return res.status(404).json({ success: false, error: 'Contato não encontrado ou sem acesso ao portal' });
      }

      // Cleanup expired tokens
      cleanupExpiredTokens();

      // Generate token
      const token = crypto.randomUUID();
      impersonationTokens.set(token, {
        contact: {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          position: contact.position,
          companyId: contact.company_id,
          companyName: contact.companies?.name || null,
        },
        createdBy: req.user.email,
        expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
      });

      res.json({
        success: true,
        data: {
          token,
          contact: {
            name: contact.name,
            email: contact.email,
            companyName: contact.companies?.name || null,
          },
        },
      });
    } catch (err) {
      console.error('Impersonate error:', err);
      res.status(500).json({ success: false, error: 'Erro ao gerar token de impersonação' });
    }
  });

  return router;
}
