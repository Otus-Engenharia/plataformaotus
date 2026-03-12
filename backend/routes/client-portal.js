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
import { createClient } from '@supabase/supabase-js';
import { getClientPortalRepository } from '../infrastructure/repositories/SupabaseClientPortalRepository.js';
import { SupabaseCurvaSProgressoRepository } from '../infrastructure/repositories/SupabaseCurvaSProgressoRepository.js';
import { SupabaseBaselineRepository } from '../infrastructure/repositories/SupabaseBaselineRepository.js';
import {
  CalculateProgress,
  GetProgressTimeSeries,
  GetChangeLog,
} from '../application/use-cases/curva-s-progresso/index.js';
import { queryCurvaSProgressoTasks, queryCurvaSSnapshotTasks } from '../bigquery.js';
import { fetchDisciplineMappings, getSupabaseServiceClient } from '../supabase.js';
import { ListRelatos } from '../application/use-cases/relatos/index.js';
import { SupabaseRelatoRepository } from '../infrastructure/repositories/SupabaseRelatoRepository.js';

// Lazy singletons
let curvaSRepo = null;
let baselineRepo = null;
let relatoRepo = null;

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

  // GET /api/client/projects - List accessible projects
  router.get('/projects', requireClientAuth, async (req, res) => {
    try {
      const projects = await repo.getClientProjects(req.clientUser.id);
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
      const allowedCodes = await repo.getClientProjectCodes(req.clientUser.id);

      if (!allowedCodes.includes(projectCode)) {
        return res.status(403).json({ success: false, error: 'Acesso negado a este projeto' });
      }

      req.clientProjectCode = projectCode;
      next();
    } catch (err) {
      res.status(500).json({ success: false, error: 'Erro ao verificar acesso' });
    }
  }

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

      res.json({ success: true, data });
    } catch (err) {
      console.error('Client changelog error:', err);
      res.status(500).json({ success: false, error: 'Erro ao buscar changelog' });
    }
  });

  // GET /api/client/projects/:code/marcos
  router.get('/projects/:code/marcos', requireClientAuth, verifyProjectAccess, async (req, res) => {
    try {
      const supabase = getSupabaseServiceClient();

      const { data: marcosData, error } = await supabase
        .from('marcos_projeto')
        .select('*')
        .eq('project_code', req.clientProjectCode)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      res.json({ success: true, data: marcosData || [] });
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

      res.json({ success: true, data: relatos });
    } catch (err) {
      console.error('Client relatos error:', err);
      res.status(500).json({ success: false, error: 'Erro ao buscar relatos' });
    }
  });

  // GET /api/client/projects/:code/apontamentos
  router.get('/projects/:code/apontamentos', requireClientAuth, verifyProjectAccess, async (req, res) => {
    try {
      const { queryIssues } = await import('../bigquery.js');
      const construflowId = req.query.construflowId;

      if (!construflowId) {
        return res.status(400).json({ success: false, error: 'construflowId obrigatório' });
      }

      const data = await queryIssues(construflowId);

      // Log audit
      await repo.logAuditAction({
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

  return router;
}

// ============================================================================
// Admin Routes (/api/admin/client-portal/*)
// ============================================================================

export function createAdminClientPortalRoutes(requireAuth) {
  const router = express.Router();
  const repo = getClientPortalRepository();

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
          password: '1234',
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
              await repo.enablePortalAccess(contactId, existingUserId);
              return res.json({ success: true, message: 'Portal ativado (usuário existente)' });
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

  return router;
}
