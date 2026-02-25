/**
 * Servidor Express - API REST
 * 
 * Este servidor cria endpoints para:
 * - GET /api/portfolio - Retorna dados do portfólio
 * - GET /api/curva-s - Retorna dados da Curva S
 */

// IMPORTANTE: Carrega variáveis de ambiente ANTES de importar outros módulos
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { existsSync } from 'fs';
import cors from 'cors';
import session from 'express-session';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';
import passport from './auth.js';
import { queryPortfolio, queryCurvaS, queryCurvaSColaboradores, queryCustosPorUsuarioProjeto, queryReconciliacaoMensal, queryReconciliacaoUsuarios, queryReconciliacaoProjetos, queryIssues, queryCronograma, getTableSchema, queryNPSRaw, queryPortClientes, queryNPSFilterOptions, queryEstudoCustos, queryHorasRaw, queryProximasTarefasAll, queryControlePassivo, queryCustosAgregadosProjeto, queryDisciplinesCrossReference, queryDisciplinesCrossReferenceBatch } from './bigquery.js';
import { isDirector, isAdmin, isPrivileged, isDev, hasFullAccess, getLeaderNameFromEmail, getUserRole, getUltimoTimeForLeader, canAccessFormularioPassagem, canAccessVendas, getRealEmailForIndicadores, canManageDemandas, canManageEstudosCustos, canManageApoioProjetos } from './auth-config.js';
import { setupDDDRoutes } from './routes/index.js';
import {
  getSupabaseClient, getSupabaseServiceClient, fetchPortfolioRealtime, fetchCurvaSRealtime, fetchCurvaSColaboradoresRealtime,
  fetchCobrancasFeitas, upsertCobranca, fetchTimesList, fetchUsuarioToTime,
  fetchUserViews, updateUserViews, getUserViews, createLog, fetchLogs, countLogsByAction, countViewUsage,
  fetchOKRs, fetchOKRById, createOKR, updateOKR, deleteOKR, createKeyResult, updateKeyResult,
  fetchOKRCheckIns, createOKRCheckIn, updateOKRCheckIn, deleteOKRCheckIn, recalculateKRConsolidatedValue,
  fetchOKRInitiatives, createOKRInitiative, updateOKRInitiative, deleteOKRInitiative,
  fetchInitiativeComments, fetchCommentsForInitiatives, createInitiativeComment, deleteInitiativeComment,
  fetchIndicadores, createIndicador, updateIndicador, deleteIndicador,
  // Novo sistema de indicadores
  fetchSectors, getSectorById, createSector, updateSector, deleteSector,
  fetchPositions, getPositionById, createPosition, updatePosition, deletePosition,
  fetchPositionIndicators, createPositionIndicator, updatePositionIndicator, deletePositionIndicator, syncPositionIndicators,
  fetchIndicadoresIndividuais, getIndicadorById, createIndicadorFromTemplate, updateIndicadorIndividual,
  fetchCheckIns, getCheckInById, createCheckIn, updateCheckIn, deleteCheckIn,
  fetchRecoveryPlans, createRecoveryPlan, updateRecoveryPlan, deleteRecoveryPlan,
  fetchPeopleWithScores, getPersonById, fetchTeam,
  fetchUsersWithRoles, updateUserPosition, updateUserSector, updateUserRole, updateUserStatus, updateUserLeader, getUserSectorByEmail, getUserByEmail, createUser,
  fetchSectorsOverview, fetchHistoryComparison,
  // Views & Access Control
  fetchViews, createView, deleteView,
  fetchAccessDefaults, createAccessDefault, updateAccessDefault, deleteAccessDefault,
  getUserViewOverrides, setUserViewOverride, removeUserViewOverride, getEffectiveViews,
  // Workspace Management (usa sectors existente)
  fetchWorkspaceProjects, getWorkspaceProjectById, createWorkspaceProject, updateWorkspaceProject, deleteWorkspaceProject,
  fetchWorkspaceTasks, getWorkspaceTaskById, createWorkspaceTask, updateWorkspaceTask, deleteWorkspaceTask, reorderWorkspaceTasks,
  fetchProjectMembers, addProjectMember, updateProjectMemberRole, removeProjectMember,
  fetchProjectMessages, createProjectMessage, deleteProjectMessage,
  // Home Modules (legacy)
  fetchHomeModules, updateHomeModule, createHomeModule, deleteHomeModule,
  // Unified Modules System
  ACCESS_LEVELS, ACCESS_LEVEL_LABELS, ACCESS_LEVEL_COLORS, getUserAccessLevel,
  fetchAllModules, fetchModulesForUser, fetchHomeModulesForUser, getUserOtusByEmail, getUserOtusById,
  updateModuleUnified, createModuleUnified, deleteModuleUnified,
  getAccessMatrix, fetchModuleOverrides, createModuleOverride, deleteModuleOverride,
  // Equipe do projeto
  fetchProjectDisciplines, fetchStandardDisciplines, fetchCompanies, fetchContacts,
  createProjectDiscipline, updateProjectDiscipline, deleteProjectDiscipline,
  getProjectIdByConstruflow,
  // Mapeamentos de disciplinas
  fetchDisciplineMappings, createOrUpdateDisciplineMapping, deleteDisciplineMapping,
  // Batch para cobertura de disciplinas (portfolio)
  fetchProjectIdsByConstruflowBatch, fetchProjectDisciplinesBatch, fetchDisciplineMappingsBatch,
  // Vista de Contatos
  fetchAllDisciplines, fetchAllCompanies, fetchAllProjects,
  fetchDisciplineCompanyAggregation, fetchDisciplineCompanyDetails,
  // Apoio de Projetos - Portfolio
  fetchProjectFeaturesForPortfolio, updateControleApoio, updateLinkIfc, updatePlataformaAcd,
  // Portfolio - Edicao inline
  fetchPortfolioEditOptions, updateProjectField,
  // OAuth tokens (Gmail Draft)
  getUserOAuthTokens, resolveRecipientEmails,
  // Whiteboard
  fetchWhiteboard, saveWhiteboard
} from './supabase.js';
import { createGmailDraft } from './gmail.js';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.otusengenharia.com';

// Confia no proxy reverso (Nginx) para obter IP real do cliente
app.set('trust proxy', 1);

// Segurança: Headers HTTP com Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Desabilita CSP para não quebrar o app (pode ser configurado depois)
  crossOriginEmbedderPolicy: false, // Permite embedar recursos externos
}));

// Rate Limiting: Proteção contra ataques DDoS
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 500, // Máximo 500 requisições por IP
  message: 'Muitas requisições deste IP, tente novamente em 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/auth/google'),
});
app.use('/api/', limiter);

// ============================================================
// Cache de queries BigQuery (node-cache)
// Dados financeiros são atualizados 1x/dia pelas scheduled queries,
// então cache de 15-60 min reduz ~90% das queries ao BigQuery.
// ============================================================
const bqCache = new NodeCache({ stdTTL: 900, checkperiod: 120, useClones: false });

/**
 * Middleware factory para cache de endpoints BigQuery.
 * Intercepta res.json() para cachear respostas com sucesso.
 * @param {number} ttlSeconds - TTL do cache em segundos
 */
function withBqCache(ttlSeconds) {
  return (req, res, next) => {
    const sortedQuery = Object.keys(req.query || {}).sort().reduce((acc, k) => { acc[k] = req.query[k]; return acc; }, {});
    const effectiveEmail = req.session?.impersonating?.email || req.user?.email || 'anon';
    const key = `bq:${req.path}:${effectiveEmail}:${JSON.stringify(sortedQuery)}`;
    const cached = bqCache.get(key);
    if (cached) {
      console.log(`📦 Cache HIT: ${req.path} (${ttlSeconds}s TTL)`);
      return res.json(cached);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200 && body?.success !== false) {
        bqCache.set(key, body, ttlSeconds);
        console.log(`💾 Cache SET: ${req.path} (TTL: ${ttlSeconds}s)`);
      }
      return originalJson(body);
    };
    next();
  };
}

// Configuração de sessão
const isProduction = process.env.NODE_ENV === 'production';
const isDevMode = process.env.DEV_MODE === 'true';

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'otus-engenharia-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    proxy: true, // Necessário quando está atrás de proxy (Nginx/Vite)
    cookie: {
      secure: isProduction, // HTTPS em produção
      httpOnly: true,
      sameSite: isDevMode ? false : 'lax', // Mais permissivo em dev mode
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
    },
  })
);

// Inicializa Passport
app.use(passport.initialize());
app.use(passport.session());

// Middlewares
// CORS permite que o frontend (rodando em outra porta) acesse esta API
const allowedOrigins = [FRONTEND_URL].filter(Boolean); // Remove valores undefined/null

// Em dev mode, permite localhost
if (process.env.DEV_MODE === 'true') {
  allowedOrigins.push('http://localhost:5173');
  allowedOrigins.push('http://127.0.0.1:5173');
}

app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições sem origin (ex: Postman, mobile apps)
    if (!origin) return callback(null, true);
    
    // Verifica se a origin está na lista permitida
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return origin === allowed;
      }
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });
    
    callback(null, isAllowed);
  },
  credentials: true, // Permite cookies/sessões
}));

// Permite receber JSON no body das requisições
app.use(express.json());

// Rota de teste para verificar se o servidor está funcionando
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Servidor funcionando!',
    timestamp: new Date().toISOString()
  });
});

/**
 * Rota: GET /api/debug/modules
 * Debug: Lista todos os módulos e mostra quais o usuário atual pode ver
 * APENAS em DEV_MODE
 */
app.get('/api/debug/modules', requireAuth, async (req, res) => {
  if (process.env.DEV_MODE !== 'true') {
    return res.status(403).json({ success: false, error: 'Apenas em DEV_MODE' });
  }

  try {
    const userRole = getUserRole(req.user) || 'user';
    const accessLevel = getUserAccessLevel(userRole);
    const userOtus = await getUserOtusByEmail(req.user.email);
    const sectorId = userOtus?.setor_id || null;

    // Buscar TODOS os módulos (sem filtro)
    const allModules = await fetchAllModules();

    // Buscar módulos que o usuário tem acesso
    const userModules = await fetchHomeModulesForUser(req.user.email, accessLevel, sectorId);
    const userModuleIds = new Set(userModules.map(m => m.id));

    // Mapear com info de acesso
    const modulesWithAccess = allModules.map(m => ({
      id: m.id,
      name: m.name,
      path: m.path,
      area: m.area,
      min_access_level: m.min_access_level,
      show_on_home: m.show_on_home,
      visible: m.visible,
      has_access: userModuleIds.has(m.id),
      reason: !m.visible ? 'invisible' :
              !m.show_on_home ? 'not_on_home' :
              !userModuleIds.has(m.id) ? 'access_denied' : 'ok'
    }));

    res.json({
      success: true,
      user: {
        email: req.user.email,
        role: userRole,
        accessLevel,
        sectorId,
        hasUserOtus: !!userOtus
      },
      accessLevels: ACCESS_LEVELS,
      modules: {
        total: allModules.length,
        accessible: userModules.length,
        list: modulesWithAccess
      }
    });
  } catch (error) {
    console.error('❌ Erro no debug de módulos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/schema
 * Descobre a estrutura (colunas) da tabela do portfólio
 * Use esta rota para entender quais colunas existem na tabela
 */
app.get('/api/schema', async (req, res) => {
  try {
    console.log('🔍 Descobrindo estrutura da tabela...');
    const schema = await getTableSchema();
    
    res.json({
      success: true,
      message: 'Estrutura da tabela portifolio_plataforma_enriched',
      columns: schema,
      count: schema.length
    });
  } catch (error) {
    console.error('❌ Erro ao buscar schema:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      details: 'Verifique se a tabela existe e se as credenciais estão corretas'
    });
  }
});

/**
 * Middleware de autenticação
 * Verifica se o usuário está autenticado
 */
function requireAuth(req, res, next) {
  // Dev mode: reconhece sessão dev
  if (process.env.DEV_MODE === 'true' && req.session?.devUser) {
    req.user = req.session.devUser;
    req.isAuthenticated = () => true;
    return next();
  }
  // Produção: Passport normal
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({
    success: false,
    error: 'Não autenticado',
    message: 'Por favor, faça login para acessar este recurso'
  });
}

/**
 * Helper: Determina filtro de líder para rotas de dados (portfolio, curva-s, etc.)
 *
 * Regra de negócio:
 * - dev/director/admin → sem filtro (veem tudo)
 * - leader de Operação → filtrado pelo nome do líder (só vê seus projetos)
 * - leader de outros setores (ex: Líderes de Projeto) → sem filtro (veem tudo)
 * - user/outros → sem acesso
 *
 * @param {Object} req - Express request (com req.user populado)
 * @returns {{ leaderName: string|null, hasAccess: boolean }}
 */
function getLeaderDataFilter(req) {
  // Se impersonação ativa, usar dados do usuário impersonado
  const effectiveUser = req.session?.impersonating || req.user;
  const role = effectiveUser.role;

  // dev/ceo/director/admin - acesso total sem filtro
  if (['dev', 'ceo', 'director', 'admin'].includes(role)) {
    return { leaderName: null, hasAccess: true };
  }

  // leader - apenas Operação tem filtro por líder
  if (role === 'leader') {
    if (effectiveUser.setor_name === 'Operação') {
      const leaderName = effectiveUser.name || getLeaderNameFromEmail(effectiveUser.email);
      return { leaderName, hasAccess: true };
    }
    // Líderes de outros setores veem tudo
    return { leaderName: null, hasAccess: true };
  }

  // Fallback legado: tenta mapping do auth-config
  const legacyName = getLeaderNameFromEmail(effectiveUser.email);
  if (legacyName) {
    return { leaderName: legacyName, hasAccess: true };
  }

  // user/unknown - sem acesso aos dados
  return { leaderName: null, hasAccess: false };
}

/**
 * Retorna o usuário efetivo para controle de acesso.
 * Se impersonação ativa, retorna dados do usuário impersonado.
 * @param {Object} req - Express request
 * @returns {{ email: string, role: string, name: string, setor_name: string|null }}
 */
function getEffectiveUser(req) {
  return req.session?.impersonating || req.user;
}

/**
 * Middleware de logging
 * Registra ações dos usuários automaticamente
 */
async function logAction(req, actionType, resourceType = null, resourceId = null, resourceName = null, details = null) {
  if (!req.isAuthenticated() || !req.user) {
    return;
  }

  try {
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    await createLog({
      user_email: req.user.email,
      user_name: req.user.name,
      action_type: actionType,
      resource_type: resourceType,
      resource_id: resourceId,
      resource_name: resourceName,
      details: details,
      ip_address: ip,
      user_agent: userAgent,
    });
  } catch (error) {
    console.error('Erro ao registrar log:', error);
  }
}

/**
 * Rota: GET /api/auth/dev-mode
 * Retorna se o modo dev está ativo e quais usuários estão disponíveis
 */
app.get('/api/auth/dev-mode', (req, res) => {
  res.json({
    enabled: process.env.DEV_MODE === 'true',
    // Operação não tem acesso à plataforma por enquanto
    availableUsers: process.env.DEV_MODE === 'true' ? [
      { email: 'dev-dev@otus.dev', name: 'Dev (Full Access)', role: 'dev' },
      { email: 'dev-director@otus.dev', name: 'Dev Director', role: 'director' },
      { email: 'dev-admin@otus.dev', name: 'Dev Admin', role: 'admin' },
      { email: 'dev-leader@otus.dev', name: 'Dev Leader', role: 'leader' }
    ] : []
  });
});

/**
 * Rota: POST /api/auth/dev-login
 * Cria sessão com usuário fake (apenas em dev mode)
 */
app.post('/api/auth/dev-login', (req, res) => {
  if (process.env.DEV_MODE !== 'true') {
    return res.status(403).json({
      success: false,
      error: 'Dev mode não habilitado'
    });
  }

  const { role } = req.body;

  // Operação não tem acesso à plataforma por enquanto
  if (role === 'user') {
    return res.status(403).json({
      success: false,
      error: 'Acesso restrito. A plataforma está disponível apenas para líderes, admins e diretores.'
    });
  }

  // Usa um ID real existente no banco para evitar erros de FK
  // Diego Duarte (dev) - ID real do banco users_otus
  const DEV_USER_ID = '895103f1-e355-467d-b7bf-38d4b581d4aa';

  const devUsers = {
    dev: { id: DEV_USER_ID, email: 'dev-dev@otus.dev', name: 'Dev (Full Access)', role: 'dev' },
    director: { id: DEV_USER_ID, email: 'dev-director@otus.dev', name: 'Dev Director', role: 'director' },
    admin: { id: DEV_USER_ID, email: 'dev-admin@otus.dev', name: 'Dev Admin', role: 'admin' },
    leader: { id: DEV_USER_ID, email: 'dev-leader@otus.dev', name: 'Dev Leader', role: 'leader' }
  };

  const user = devUsers[role];
  if (!user) {
    return res.status(400).json({
      success: false,
      error: 'Role inválido'
    });
  }

  req.session.devUser = user;
  req.session.save((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar sessão'
      });
    }
    res.json({ success: true, user });
  });
});

/**
 * Rota: POST /api/auth/dev-impersonate
 * Ativa impersonação de um usuário real (apenas para devs)
 */
app.post('/api/auth/dev-impersonate', requireAuth, async (req, res) => {
  // Usa o role original (não o impersonado) para verificação de segurança
  const realRole = req.session?.impersonating
    ? req.session.realUser?.role
    : req.user.role;

  if (realRole !== 'dev') {
    return res.status(403).json({
      success: false,
      error: 'Apenas desenvolvedores podem usar impersonação'
    });
  }

  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'userId é obrigatório'
    });
  }

  try {
    const target = await getUserOtusById(userId);
    if (!target) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    // Preserva o usuário real na sessão (para poder restaurar)
    if (!req.session.realUser) {
      req.session.realUser = {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
        picture: req.user.picture,
        setor_name: req.user.setor_name,
      };
    }

    // Armazena dados de impersonação
    req.session.impersonating = {
      id: target.id,
      email: target.email,
      name: target.name,
      role: target.role,
      setor_name: target.setor?.name || null,
    };

    req.session.save((err) => {
      if (err) {
        return res.status(500).json({ success: false, error: 'Erro ao salvar sessão' });
      }
      logAction(req, 'dev_impersonate', 'auth', target.id, target.name,
        `Impersonando: ${target.name} (${target.role})`);
      res.json({
        success: true,
        impersonating: req.session.impersonating,
        realUser: req.session.realUser,
      });
    });
  } catch (err) {
    console.error('Erro ao impersonar:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Rota: DELETE /api/auth/dev-impersonate
 * Desativa impersonação, restaura sessão original
 */
app.delete('/api/auth/dev-impersonate', requireAuth, (req, res) => {
  if (!req.session.impersonating) {
    return res.json({ success: true, message: 'Nenhuma impersonação ativa' });
  }

  const impersonatedName = req.session.impersonating.name;
  delete req.session.impersonating;
  delete req.session.realUser;

  req.session.save((err) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Erro ao salvar sessão' });
    }
    res.json({ success: true, message: `Impersonação de ${impersonatedName} desativada` });
  });
});

/**
 * Rota: GET /api/auth/dev-impersonate
 * Retorna status atual da impersonação
 */
app.get('/api/auth/dev-impersonate', requireAuth, (req, res) => {
  if (req.session.impersonating && req.session.realUser) {
    return res.json({
      success: true,
      active: true,
      impersonating: req.session.impersonating,
      realUser: req.session.realUser,
    });
  }
  res.json({ success: true, active: false });
});

/**
 * Rota: GET /api/auth/user
 * Retorna informações do usuário logado
 */
app.get('/api/auth/user', requireAuth, async (req, res) => {
  try {
    // Busca dados do usuário na tabela users_otus para obter setor_id e userId interno
    const userOtus = await getUserOtusByEmail(req.user.email);

    // Sincroniza role e setor do banco para a sessão (caso tenha mudado no admin)
    if (userOtus?.role && userOtus.role !== req.user.role) {
      req.user.role = userOtus.role;
    }
    if (userOtus?.setor?.name) {
      req.user.setor_name = userOtus.setor.name;
    }

    const setorName = req.user.setor_name || null;
    res.json({
      success: true,
      user: {
        id: req.user.id, // ID do Google/OAuth
        email: req.user.email,
        name: req.user.name,
        picture: req.user.picture,
        role: req.user.role,
        canAccessFormularioPassagem: canAccessFormularioPassagem(req.user),
        canAccessVendas: canAccessVendas(req.user),
        canManageDemandas: canManageDemandas(req.user),
        canManageEstudosCustos: canManageEstudosCustos(req.user),
        canManageApoioProjetos: canManageApoioProjetos(req.user),
        // Dados do users_otus para controle de acesso por setor/responsável
        userId: userOtus?.id || null, // ID interno na tabela users_otus
        setor_id: userOtus?.setor_id || null,
        setor_name: setorName,
        // Dados de impersonação (apenas para devs)
        impersonation: req.session?.impersonating ? {
          active: true,
          target: req.session.impersonating,
          realUser: req.session.realUser,
        } : null,
      }
    });
  } catch (error) {
    console.error('Erro ao buscar dados do usuário:', error);
    // Retorna dados básicos mesmo com erro
    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        picture: req.user.picture,
        role: req.user.role,
        canAccessFormularioPassagem: canAccessFormularioPassagem(req.user),
        canAccessVendas: canAccessVendas(req.user),
        canManageDemandas: canManageDemandas(req.user),
        canManageEstudosCustos: canManageEstudosCustos(req.user),
        canManageApoioProjetos: canManageApoioProjetos(req.user),
        userId: null,
        setor_id: null,
        setor_name: req.user.setor_name || null,
      }
    });
  }
});

/**
 * Rota: GET /api/user/me
 * Retorna dados completos do usuario logado incluindo setor
 */
app.get('/api/user/me', requireAuth, async (req, res) => {
  try {
    const userData = await getUserByEmail(req.user.email);
    res.json({
      success: true,
      data: {
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
        setor_id: userData?.setor?.id || null,
        setor_name: userData?.setor?.name || null,
        cargo_id: userData?.cargo?.id || null,
        cargo_name: userData?.cargo?.name || null,
      }
    });
  } catch (error) {
    console.error('Erro ao buscar dados do usuario:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: POST /api/auth/logout
 * Faz logout do usuário
 */
app.post('/api/auth/logout', async (req, res) => {
  // Registra o logout antes de fazer logout
  if (req.user) {
    await logAction(req, 'logout', 'auth', null, 'Logout do sistema');
  }

  // Limpa sessão dev se existir
  if (req.session?.devUser) {
    delete req.session.devUser;
  }

  // Limpa impersonação se existir
  if (req.session?.impersonating) {
    delete req.session.impersonating;
    delete req.session.realUser;
  }

  req.logout((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao fazer logout'
      });
    }
    res.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });
  });
});

/**
 * Rota: GET /api/debug/env (TEMPORÁRIO - REMOVER EM PRODUÇÃO)
 * Verifica se as variáveis de ambiente estão carregadas
 */
app.get('/api/debug/env', (_req, res) => {
  res.json({
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? `Presente (${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...)` : 'AUSENTE',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? `Presente (${process.env.GOOGLE_CLIENT_SECRET.substring(0, 10)}...)` : 'AUSENTE',
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || 'AUSENTE',
    FRONTEND_URL: process.env.FRONTEND_URL || 'AUSENTE',
    SUPABASE_URL: process.env.SUPABASE_URL ? 'Presente' : 'AUSENTE',
    NODE_ENV: process.env.NODE_ENV || 'AUSENTE',
    env_file_check: 'Se todas as variáveis estão AUSENTE, o .env não foi carregado'
  });
});

/**
 * Rota: GET /api/auth/google
 * Inicia o fluxo de autenticação Google OAuth
 */
app.get(
  '/api/auth/google',
  (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(503).json({
        success: false,
        error: 'Autenticação não configurada',
        message: 'Google OAuth não está configurado. Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no arquivo .env'
      });
    }
    const authOptions = {
      scope: ['profile', 'email', 'https://www.googleapis.com/auth/gmail.compose'],
      accessType: 'offline',
    };
    // Força re-consent quando solicitado (ex: botão "Autorizar Gmail")
    if (req.query.reauthorize === 'true') {
      authOptions.prompt = 'consent';
    }
    passport.authenticate('google', authOptions)(req, res, next);
  }
);

/**
 * Rota: GET /api/auth/google/callback
 * Callback do Google OAuth após autenticação
 */
app.get(
  '/api/auth/google/callback',
  (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.redirect(`${FRONTEND_URL}/login?error=not_configured`);
    }
    passport.authenticate('google', {
      failureRedirect: `${FRONTEND_URL}/login?error=auth_failed`,
      session: true
    })(req, res, next);
  },
  async (req, res) => {
    console.log('✅ [OAuth Callback] Autenticação bem-sucedida!');
    console.log('   Usuário:', req.user?.email || 'N/A');
    console.log('   Sessão ID:', req.sessionID);
    console.log('   Sessão salva?', req.session ? 'Sim' : 'Não');
    
    // Registra o login
    if (req.user) {
      await logAction(req, 'login', 'auth', null, 'Login no sistema');
    }
    
    // Força salvar a sessão antes de redirecionar
    req.session.save((err) => {
      if (err) {
        console.error('❌ Erro ao salvar sessão:', err);
      }
      console.log('✅ Sessão salva! Redirecionando para:', FRONTEND_URL);
      res.redirect(FRONTEND_URL);
    });
  }
);

/**
 * Rota: GET /api/portfolio
 * Retorna os dados do portfólio de projetos
 * Filtra por líder apenas quando ?leaderFilter=true (usado na vista Portfolio)
 */
app.get('/api/portfolio', requireAuth, withBqCache(900), async (req, res) => {
  try {
    console.log('📊 Buscando dados do portfólio...');

    // Filtro por líder: só aplica quando explicitamente solicitado (vista Portfolio)
    let leaderName = null;
    if (req.query.leaderFilter === 'true') {
      const { leaderName: name, hasAccess } = getLeaderDataFilter(req);
      if (!hasAccess) {
        return res.json({ success: true, count: 0, data: [] });
      }
      leaderName = name;
    }
    
    let data = [];

    try {
      data = await fetchPortfolioRealtime(leaderName);

      // Valida se dados críticos de cronograma estão presentes no Supabase
      if (data.length > 0) {
        const hasDateData = data.some(row =>
          row.data_inicio_cronograma != null || row.data_termino_cronograma != null
        );
        if (!hasDateData) {
          console.warn('⚠️ Supabase sem dados de cronograma, usando BigQuery...');
          data = await queryPortfolio(leaderName);
        }
      }
    } catch (supabaseError) {
      console.warn('⚠️ Supabase falhou, usando BigQuery:', supabaseError.message);
      data = await queryPortfolio(leaderName);
    }
    
    // Registra o acesso
    await logAction(req, 'view', 'portfolio', null, 'Portfólio', { count: data.length });
    
    res.json({
      success: true,
      count: data.length,
      data: data
    });
  } catch (error) {
    console.error('❌ Erro ao buscar portfólio:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      details: 'Verifique Supabase/BigQuery e a view de portfolio'
    });
  }
});

/**
 * Rota: GET /api/portfolio/edit-options
 * Retorna opcoes para dropdowns de edicao (times, empresas, lideres)
 */
app.get('/api/portfolio/edit-options', requireAuth, async (req, res) => {
  try {
    if (!hasFullAccess(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }
    const data = await fetchPortfolioEditOptions();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Erro ao buscar opcoes de edicao:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: PUT /api/portfolio/:projectCode
 * Atualiza campo editavel de um projeto no Supabase
 * Body: { field, value, oldValue }
 */
app.put('/api/portfolio/:projectCode', requireAuth, async (req, res) => {
  try {
    if (!hasFullAccess(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const { projectCode } = req.params;
    const { field, value, oldValue } = req.body;

    const allowedFields = ['comercial_name', 'status', 'client', 'nome_time', 'lider'];
    if (!allowedFields.includes(field)) {
      return res.status(400).json({ success: false, error: `Campo '${field}' nao permitido` });
    }

    const result = await updateProjectField(projectCode, field, value);
    await logAction(req, 'update', 'portfolio', projectCode, field, { value, oldValue });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Erro ao atualizar portfolio:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// HELPER: Classificação cruzada de disciplinas (reutilizável)
// ============================================

/**
 * Classifica disciplinas em 7 sub-grupos e calcula estatísticas de cobertura.
 * Reutilizado pelo endpoint individual e pelo endpoint batch.
 * @param {string[]} smartsheetNames - Nomes de disciplinas do Smartsheet
 * @param {string[]} construflowNames - Nomes de disciplinas do ConstruFlow
 * @param {string[]} otusNames - Nomes de disciplinas da Otus
 * @param {Array} customMappings - Mapeamentos personalizados do Supabase
 * @returns {{ groups, analysis }}
 */
function classifyDisciplines(smartsheetNames, construflowNames, otusNames, customMappings = []) {
  function normalize(name) {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  // Mapas de mapeamento customizado
  const customMap = new Map();
  customMappings.forEach(m => {
    const normKey = normalize(m.external_discipline_name);
    customMap.set(`${m.external_source}:${normKey}`, {
      standardName: m.standard_discipline?.discipline_name,
      mappingId: m.id,
      standardDisciplineId: m.standard_discipline_id
    });
  });

  const normalizedSmartsheet = new Map(smartsheetNames.map(n => [normalize(n), n]));
  const normalizedConstruflow = new Map(construflowNames.map(n => [normalize(n), n]));
  const normalizedOtus = new Map(otusNames.map(n => [normalize(n), n]));

  const checkOtusMatch = (normKey, source) => {
    const custom = customMap.get(`${source}:${normKey}`);
    if (custom && custom.standardName) {
      return normalizedOtus.has(normalize(custom.standardName));
    }
    return normalizedOtus.has(normKey);
  };

  const getCustomMapping = (normKey, source) => {
    return customMap.get(`${source}:${normKey}`) || null;
  };

  const allExternalNormalized = new Set([...normalizedSmartsheet.keys(), ...normalizedConstruflow.keys()]);
  const sort = arr => arr.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const groups = {
    completeInAll3: [],
    notInOtus: [],
    onlySmartsheet: [],
    onlyConstruflow: [],
    onlyOtus: [],
    missingConstruflow: [],
    missingSmartsheet: []
  };

  for (const normKey of allExternalNormalized) {
    const inSmartsheet = normalizedSmartsheet.has(normKey);
    const inConstruflow = normalizedConstruflow.has(normKey);
    const originalName = normalizedSmartsheet.get(normKey) || normalizedConstruflow.get(normKey);

    let inOtus = false;
    let mapping = null;
    if (inSmartsheet) {
      if (checkOtusMatch(normKey, 'smartsheet')) inOtus = true;
      mapping = mapping || getCustomMapping(normKey, 'smartsheet');
    }
    if (inConstruflow) {
      if (checkOtusMatch(normKey, 'construflow')) inOtus = true;
      mapping = mapping || getCustomMapping(normKey, 'construflow');
    }
    if (!inOtus && normalizedOtus.has(normKey)) inOtus = true;

    const entry = {
      name: originalName, normKey, inSmartsheet, inConstruflow, inOtus,
      hasCustomMapping: !!mapping,
      mappingId: mapping?.mappingId || null,
      mappedToName: mapping?.standardName || null
    };

    if (inSmartsheet && inConstruflow && inOtus) groups.completeInAll3.push(entry);
    else if (inSmartsheet && inConstruflow && !inOtus) groups.notInOtus.push(entry);
    else if (inSmartsheet && !inConstruflow && inOtus) groups.missingConstruflow.push(entry);
    else if (!inSmartsheet && inConstruflow && inOtus) groups.missingSmartsheet.push(entry);
    else if (inSmartsheet && !inConstruflow && !inOtus) groups.onlySmartsheet.push(entry);
    else if (!inSmartsheet && inConstruflow && !inOtus) groups.onlyConstruflow.push(entry);
  }

  for (const [normKey, original] of normalizedOtus) {
    if (!allExternalNormalized.has(normKey)) {
      groups.onlyOtus.push({ name: original, normKey, inSmartsheet: false, inConstruflow: false, inOtus: true });
    }
  }

  Object.values(groups).forEach(sort);

  const totalAll = new Set([...allExternalNormalized, ...normalizedOtus.keys()]).size;
  const pendingCount = totalAll - groups.completeInAll3.length;
  const completionPercentage = totalAll > 0
    ? Math.round((groups.completeInAll3.length / totalAll) * 1000) / 10
    : 0;

  return {
    groups,
    analysis: {
      totalUnique: totalAll,
      completeInAll3: groups.completeInAll3.length,
      pendingCount,
      completionPercentage,
      hasCustomMappings: customMappings.length > 0
    }
  };
}

/**
 * Rota: POST /api/portfolio/cobertura-disciplinas
 * Calcula cobertura de disciplinas para múltiplos projetos (batch).
 * Eficiente: apenas 2 queries BigQuery + 3 queries Supabase.
 */
app.post('/api/portfolio/cobertura-disciplinas', requireAuth, async (req, res) => {
  try {
    const { projects } = req.body;
    if (!Array.isArray(projects) || projects.length === 0) {
      return res.status(400).json({ success: false, error: 'Array projects é obrigatório' });
    }

    console.log(`📊 [cobertura-batch] Calculando cobertura para ${projects.length} projetos...`);

    // 1. Batch BigQuery (2 queries)
    const { smartsheetByProject, construflowByProject } = await queryDisciplinesCrossReferenceBatch(projects);

    // 2. Batch Supabase: construflow_id -> project_id
    const construflowIds = projects.map(p => p.construflowId).filter(Boolean);
    const projectIdMap = await fetchProjectIdsByConstruflowBatch(construflowIds);

    // 3. Batch Supabase: project_disciplines + discipline_mappings
    const allProjectIds = [...new Set(Object.values(projectIdMap).filter(Boolean))];
    const [disciplinesByProject, mappingsByProject] = await Promise.all([
      fetchProjectDisciplinesBatch(allProjectIds),
      fetchDisciplineMappingsBatch(allProjectIds)
    ]);

    // 4. Classificar por projeto
    const results = projects.map(p => {
      const ssId = p.smartsheetId ? String(p.smartsheetId) : null;
      const cfId = p.construflowId ? String(p.construflowId) : null;
      const smartsheetNames = (ssId && smartsheetByProject[ssId]) || [];
      const construflowNames = (cfId && construflowByProject[cfId]) || [];

      const internalId = cfId ? projectIdMap[cfId] : null;
      const otusTeam = internalId ? (disciplinesByProject[internalId] || []) : [];
      const otusNames = otusTeam.map(d => d.discipline?.discipline_name).filter(Boolean);
      const customMappings = internalId ? (mappingsByProject[internalId] || []) : [];

      const { groups, analysis } = classifyDisciplines(smartsheetNames, construflowNames, otusNames, customMappings);

      // Sem ConstruFlow: considerar Smartsheet + Otus como completo
      if (!cfId) {
        const adjustedComplete = groups.completeInAll3.length + groups.missingConstruflow.length;
        analysis.completeInAll3 = adjustedComplete;
        analysis.pendingCount = analysis.totalUnique - adjustedComplete;
        analysis.completionPercentage = analysis.totalUnique > 0
          ? Math.round((adjustedComplete / analysis.totalUnique) * 1000) / 10
          : 0;
      }

      return {
        construflowId: p.construflowId,
        smartsheetId: p.smartsheetId,
        projectName: p.projectName,
        projectCode: p.projectCode,
        status: p.status,
        lider: p.lider,
        nomeTime: p.nomeTime,
        smartsheet: smartsheetNames,
        construflow: construflowNames,
        otus: otusNames,
        analysis,
        groups
      };
    });

    console.log(`📊 [cobertura-batch] Concluído. ${results.length} projetos processados.`);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('❌ Erro na cobertura batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/controle-passivo
 * Retorna dados consolidados de controle passivo (valor contratado vs receita recebida)
 * Combina portfólio com financeiro.entradas
 */
app.get('/api/controle-passivo', requireAuth, withBqCache(1800), async (req, res) => {
  try {
    console.log('💰 Buscando dados do controle passivo...');

    const { leaderName, hasAccess } = getLeaderDataFilter(req);
    if (!hasAccess) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const data = await queryControlePassivo(leaderName);

    await logAction(req, 'view', 'controle-passivo', null, 'Controle Passivo', { count: data.length });

    res.json({
      success: true,
      count: data.length,
      data: data
    });
  } catch (error) {
    console.error('❌ Erro ao buscar controle passivo:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Verifique BigQuery e as tabelas de portfólio/entradas'
    });
  }
});

/**
 * Rota: GET /api/indicadores-vendas
 * Retorna dados de indicadores de vendas (portfolio Supabase + custos BigQuery)
 */
app.get('/api/indicadores-vendas', requireAuth, withBqCache(900), async (req, res) => {
  try {
    console.log('📊 Buscando dados de indicadores de vendas...');

    const { leaderName, hasAccess } = getLeaderDataFilter(req);
    if (!hasAccess) {
      return res.json({ success: true, count: 0, data: [] });
    }

    // Buscar portfolio (BigQuery), custos (BigQuery), area_efetiva (Supabase projects) e data_venda (Supabase comercial_infos) em paralelo
    const supabase = getSupabaseClient();
    const [portfolioData, custosData, projectsResult, comercialResult] = await Promise.all([
      queryPortfolio(leaderName),
      queryCustosAgregadosProjeto(),
      supabase.from('projects').select('project_code, area_efetiva, area_construida'),
      supabase.from('project_comercial_infos').select('data_venda, projects!inner(project_code)')
    ]);

    // Indexar custos por project_code
    const custosMap = {};
    for (const c of custosData) {
      custosMap[c.project_code] = c;
    }

    // Indexar area_efetiva por project_code (Supabase projects)
    const projectsMap = {};
    if (projectsResult.data) {
      for (const p of projectsResult.data) {
        if (p.project_code) projectsMap[String(p.project_code)] = p;
      }
    }

    // Indexar data_venda por project_code (Supabase comercial_infos → projects)
    const comercialMap = {};
    if (comercialResult.data) {
      for (const c of comercialResult.data) {
        const code = c.projects?.project_code;
        if (code) comercialMap[String(code)] = c;
      }
    }

    // Merge e calcular derivados
    const merged = portfolioData
      .filter(p => p.project_code_norm || p.project_code)
      .map(p => {
        const code = String(p.project_code_norm || p.project_code);
        const custos = custosMap[code] || {};
        const proj = projectsMap[code] || {};
        const comercial = comercialMap[code] || {};
        const ticket = Number(p.valor_total_contrato_mais_aditivos) || 0;
        const tempoTotal = Number(p.duracao_total_meses) || 0;
        const custoTotal = Number(custos.custo_total) || 0;
        const mesesComCusto = Number(custos.meses_com_custo) || 0;

        return {
          project_name: p.project_name,
          project_code_norm: code,
          client: p.client,
          lider: p.lider,
          nome_time: p.nome_time,
          status: p.status,
          data_venda: comercial.data_venda || null,
          area_efetiva: proj.area_efetiva != null ? Number(proj.area_efetiva) : null,
          area_total: proj.area_construida != null ? Number(proj.area_construida) : null,
          custo_total: custoTotal,
          meses_com_custo: mesesComCusto,
          custo_mensal: mesesComCusto > 0 ? Math.round((custoTotal / mesesComCusto) * 100) / 100 : 0,
          ticket_vendas: ticket,
          tempo_total_projeto: tempoTotal,
          ticket_por_mes: tempoTotal > 0 ? Math.round((ticket / tempoTotal) * 100) / 100 : 0,
          complexidade: p.complexidade != null ? Number(p.complexidade) : null,
        };
      });

    await logAction(req, 'view', 'indicadores-vendas', null, 'Indicadores Vendas', { count: merged.length });

    res.json({
      success: true,
      count: merged.length,
      data: merged
    });
  } catch (error) {
    console.error('❌ Erro ao buscar indicadores de vendas:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Verifique Supabase/BigQuery e as tabelas de portfólio/custos'
    });
  }
});

/**
 * Rota: GET /api/admin/colaboradores
 * Retorna lista de colaboradores ativos para conferência de acessos
 * Apenas diretoria/admin
 */

// Cache management endpoints (admin only)
app.get('/api/admin/cache/stats', requireAuth, (req, res) => {
  if (!isPrivileged(req.user)) {
    return res.status(403).json({ success: false, error: 'Acesso negado' });
  }
  const stats = bqCache.getStats();
  res.json({ success: true, data: { ...stats, keys: bqCache.keys().length } });
});

app.post('/api/admin/cache/clear', requireAuth, (req, res) => {
  if (!isPrivileged(req.user)) {
    return res.status(403).json({ success: false, error: 'Acesso negado' });
  }
  bqCache.flushAll();
  console.log('🗑️ Cache BigQuery limpo manualmente');
  res.json({ success: true, message: 'Cache limpo com sucesso' });
});

app.get('/api/admin/colaboradores', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        message: 'Somente diretoria ou admin podem acessar este recurso',
      });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users_otus')
      .select(`
        id,
        name,
        role,
        position_type,
        phone,
        email,
        construflow_user_id,
        discord_user_id,
        leader:leader_id(name),
        padrinho:onboarding_buddy_id(name),
        team:team_id(team_number, team_name),
        setor:setor_id(id, name),
        status
      `)
      .eq('status', 'ativo')
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ Erro ao buscar colaboradores no Supabase:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar colaboradores',
        details: error.message,
      });
    }

    const mapped = (data || []).map((row) => ({
      colaborador_id: row.id ?? null,
      colaborador: row.name ?? null,
      setor: row.setor?.name ?? null,
      setor_id: row.setor?.id ?? null,
      telefone: row.phone ?? null,
      email: row.email ?? null,
      nivel_acesso: row.role || 'sem_acesso',
      construflow_id: row.construflow_user_id ?? null,
      discord_id: row.discord_user_id ?? null,
    }));

    res.json({
      success: true,
      count: mapped.length,
      data: mapped,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar colaboradores:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Verifique SUPABASE_URL, SUPABASE_ANON_KEY e relacoes',
    });
  }
});

/**
 * Rota: GET /api/curva-s
 * Retorna os dados da Curva S (evolução de custos e receitas)
 * Suporta filtros: projectCode (query param)
 */
app.get('/api/curva-s', requireAuth, withBqCache(1800), async (req, res) => {
  try {
    console.log('📈 Buscando dados da Curva S...');
    
    // Filtro por líder: apenas líderes de Operação veem só seus projetos
    const { leaderName, hasAccess } = getLeaderDataFilter(req);
    if (!hasAccess) {
      return res.json({ success: true, count: 0, data: [] });
    }

    // Filtro opcional por projeto específico
    const projectCode = req.query.projectCode || null;
    
    let data = [];

    try {
      data = await fetchCurvaSRealtime(leaderName, projectCode);
    } catch (supabaseError) {
      console.warn('⚠️ Supabase falhou, usando BigQuery:', supabaseError.message);
      data = await queryCurvaS(leaderName, projectCode);
    }
    
    res.json({
      success: true,
      count: data.length,
      data: data
    });
  } catch (error) {
    console.error('❌ Erro ao buscar Curva S:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      details: 'Verifique Supabase/BigQuery e a view da Curva S'
    });
  }
});

/**
 * Rota: GET /api/curva-s/colaboradores
 * Retorna detalhamento de custos por colaborador para um projeto
 * Query param obrigatório: projectCode
 */
app.get('/api/curva-s/colaboradores', requireAuth, withBqCache(900), async (req, res) => {
  try {
    const projectCode = req.query.projectCode;
    
    if (!projectCode) {
      return res.status(400).json({
        success: false,
        error: 'projectCode é obrigatório'
      });
    }
    
    // Filtro por líder: apenas líderes de Operação veem só seus projetos
    const { leaderName, hasAccess } = getLeaderDataFilter(req);
    if (!hasAccess) {
      return res.json({ success: true, count: 0, data: [] });
    }

    console.log(`📊 Buscando colaboradores do projeto: ${projectCode}`);
    let data = [];

    try {
      data = await fetchCurvaSColaboradoresRealtime(projectCode, leaderName);
    } catch (supabaseError) {
      console.warn('⚠️ Supabase falhou, usando BigQuery:', supabaseError.message);
      data = await queryCurvaSColaboradores(projectCode, leaderName);
    }
    
    res.json({
      success: true,
      count: data.length,
      data: data
    });
  } catch (error) {
    console.error('❌ Erro ao buscar colaboradores:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      details: 'Verifique Supabase/BigQuery e a view de colaboradores'
    });
  }
});

/**
 * Rota: GET /api/curva-s/custos-por-cargo
 * Retorna custos e horas por usuário enriquecidos com cargo (position) do Supabase
 * Usado para gráficos empilhados por cargo e tabela cargo→pessoa
 */
app.get('/api/curva-s/custos-por-cargo', requireAuth, withBqCache(900), async (req, res) => {
  try {
    // Filtro por líder: apenas líderes de Operação veem só seus projetos
    const { leaderName, hasAccess } = getLeaderDataFilter(req);
    if (!hasAccess) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const projectCode = req.query.projectCode || null;

    // 1. Busca dados per-user per-project per-month do BigQuery
    const custosPorUsuario = await queryCustosPorUsuarioProjeto(leaderName, projectCode);

    // 2. Busca todos os usuarios (ativos e inativos) com cargo do Supabase
    const supabase = getSupabaseClient();
    const { data: usersWithPositions, error: usersError } = await supabase
      .from('users_otus')
      .select('name, cargo:position_id(id, name)');

    if (usersError) {
      console.warn('⚠️ Erro ao buscar cargos dos usuários:', usersError.message);
    }

    // 3. Monta mapa nome normalizado -> cargo
    const cargoMap = new Map();
    if (usersWithPositions) {
      usersWithPositions.forEach(user => {
        const normalizedName = (user.name || '').toLowerCase().trim();
        const cargoName = user.cargo?.name || 'Sem cargo';
        if (normalizedName) {
          cargoMap.set(normalizedName, cargoName);
        }
      });
    }

    // 4. Enriquece dados do BigQuery com cargo
    const enrichedData = custosPorUsuario.map(row => ({
      usuario: row.usuario,
      cargo: cargoMap.get((row.usuario || '').toLowerCase().trim()) || 'Sem cargo',
      project_code: row.project_code,
      mes: row.mes,
      custo_direto: parseFloat(row.custo_direto) || 0,
      custo_indireto: parseFloat(row.custo_indireto) || 0,
      custo_total: parseFloat(row.custo_total) || 0,
      horas: parseFloat(row.horas) || 0,
      horas_totais_mes: parseFloat(row.horas_totais_mes) || 0,
    }));

    res.json({
      success: true,
      count: enrichedData.length,
      data: enrichedData
    });
  } catch (error) {
    console.error('❌ Erro ao buscar custos por cargo:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Verifique BigQuery e Supabase'
    });
  }
});

/**
 * Rota: GET /api/curva-s/reconciliacao-custos
 * Reconciliação: compara totais da fonte financeira vs custos distribuídos, mês a mês
 * Apenas para usuários privilegiados (admin/director)
 */
app.get('/api/curva-s/reconciliacao-custos', requireAuth, withBqCache(1800), async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso restrito a administradores' });
    }

    const rows = await queryReconciliacaoMensal();

    const parseMes = (m) => m?.value ? String(m.value) : String(m || '');
    const parseNum = (v) => parseFloat(v) || 0;

    res.json({
      success: true,
      data: rows.map(r => ({
        mes: parseMes(r.mes),
        total_direto_fonte: parseNum(r.total_direto_fonte),
        total_indireto_fonte: parseNum(r.total_indireto_fonte),
        total_fonte: parseNum(r.total_fonte),
        total_direto_dist: parseNum(r.total_direto_dist),
        total_indireto_dist: parseNum(r.total_indireto_dist),
        total_dist: parseNum(r.total_dist),
        diferenca: parseNum(r.diferenca),
      })),
    });
  } catch (error) {
    console.error('❌ Erro na reconciliação mensal:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/curva-s/reconciliacao-custos/:mes
 * Drill-down: para um mês, compara custo-fonte vs distribuído por usuário
 */
app.get('/api/curva-s/reconciliacao-custos/:mes', requireAuth, withBqCache(1800), async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso restrito a administradores' });
    }

    const rows = await queryReconciliacaoUsuarios(req.params.mes);

    const parseNum = (v) => parseFloat(v) || 0;

    res.json({
      success: true,
      data: rows.map(r => ({
        usuario: r.usuario || '',
        salario_fonte: parseNum(r.salario_fonte),
        indireto_fonte: parseNum(r.indireto_fonte),
        total_fonte_usuario: parseNum(r.total_fonte_usuario),
        direto_dist: parseNum(r.direto_dist),
        indireto_dist: parseNum(r.indireto_dist),
        total_dist: parseNum(r.total_dist),
        qtd_projetos: parseInt(r.qtd_projetos) || 0,
        diferenca: parseNum(r.diferenca),
        status: r.status || 'ok',
      })),
    });
  } catch (error) {
    console.error('❌ Erro na reconciliação por usuário:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/curva-s/reconciliacao-custos/:mes/:usuario
 * Drill-down: para um usuário num mês, mostra distribuição por projeto
 */
app.get('/api/curva-s/reconciliacao-custos/:mes/:usuario', requireAuth, withBqCache(1800), async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso restrito a administradores' });
    }

    const rows = await queryReconciliacaoProjetos(req.params.mes, req.params.usuario);

    const parseNum = (v) => parseFloat(v) || 0;

    res.json({
      success: true,
      data: rows.map(r => ({
        project_code: r.project_code || '',
        projeto: r.projeto || '',
        horas: parseNum(r.horas),
        horas_totais: parseNum(r.horas_totais),
        peso: parseNum(r.peso),
        custo_direto: parseNum(r.custo_direto),
        custo_indireto: parseNum(r.custo_indireto),
        custo_total: parseNum(r.custo_total),
      })),
    });
  } catch (error) {
    console.error('❌ Erro na reconciliação por projeto:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/projetos/cronograma
 * Retorna os dados de cronograma (smartsheet_data_projetos) de um projeto específico
 * Filtra por smartsheet_id do portfólio
 */
app.get('/api/projetos/cronograma', requireAuth, withBqCache(900), async (req, res) => {
  try {
    const smartsheetId = req.query.smartsheetId;
    const projectName = req.query.projectName; // Novo parâmetro para match normalizado

    console.log(`📅 [API] Recebida requisição para buscar cronograma`);
    console.log(`   Query params:`, req.query);
    console.log(`   SmartSheet ID recebido: ${smartsheetId}`);
    console.log(`   Project Name recebido: ${projectName}`);
    console.log(`   Usuário: ${req.user?.email || 'N/A'}`);

    if (!smartsheetId && !projectName) {
      console.warn(`⚠️ SmartSheet ID e Project Name não fornecidos`);
      return res.status(400).json({
        success: false,
        error: 'smartsheetId ou projectName é obrigatório'
      });
    }

    // Filtro por líder: apenas líderes de Operação veem só seus projetos
    const { leaderName, hasAccess } = getLeaderDataFilter(req);
    if (!hasAccess) {
      return res.json({ success: true, count: 0, data: [] });
    }

    console.log(`📅 Chamando queryCronograma(${smartsheetId}, ${projectName})...`);
    const data = await queryCronograma(smartsheetId, projectName);
    console.log(`✅ queryCronograma retornou ${data.length} resultados`);
    
    res.json({
      success: true,
      count: data.length,
      data: data
    });
  } catch (error) {
    console.error('❌ Erro ao buscar cronograma:');
    console.error('   Mensagem:', error.message);
    console.error('   Tipo:', error.constructor.name);
    console.error('   Stack trace:', error.stack);
    if (error.code) {
      console.error('   Código de erro:', error.code);
    }
    if (error.errors) {
      console.error('   Erros detalhados:', JSON.stringify(error.errors, null, 2));
    }
    
    res.status(500).json({ 
      success: false,
      error: error.message || 'Erro ao carregar cronograma',
      details: process.env.NODE_ENV === 'development' 
        ? error.stack 
        : 'Verifique o BigQuery e a tabela smartsheet_data_projetos',
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

/**
 * Rota: GET /api/projetos/cronograma/cobrancas
 * Retorna os row_ids marcados como "cobrança feita" para um projeto.
 */
app.get('/api/projetos/cronograma/cobrancas', requireAuth, async (req, res) => {
  try {
    const smartsheetId = req.query.smartsheetId;
    if (!smartsheetId) {
      return res.status(400).json({ success: false, error: 'smartsheetId é obrigatório' });
    }
    const rowIds = await fetchCobrancasFeitas(smartsheetId);
    res.json({ success: true, rowIds });
  } catch (err) {
    console.error('Erro ao buscar cobranças:', err);
    res.status(500).json({ success: false, error: err.message || 'Erro ao buscar cobranças' });
  }
});

/**
 * Rota: PUT /api/projetos/cronograma/cobrancas
 * Marca ou desmarca "cobrança feita" para uma tarefa.
 * Body: { smartsheetId, rowId, cobrancaFeita }
 */
app.put('/api/projetos/cronograma/cobrancas', requireAuth, async (req, res) => {
  try {
    const { smartsheetId, rowId, cobrancaFeita } = req.body;
    if (!smartsheetId || !rowId || typeof cobrancaFeita !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'smartsheetId, rowId e cobrancaFeita (boolean) são obrigatórios',
      });
    }
    await upsertCobranca(smartsheetId, rowId, cobrancaFeita, req.user?.email);
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao salvar cobrança:', err);
    res.status(500).json({ success: false, error: err.message || 'Erro ao salvar cobrança' });
  }
});

/**
 * Rota: GET /api/auth/gmail-status
 * Retorna se o usuário tem tokens Gmail válidos armazenados
 */
app.get('/api/auth/gmail-status', requireAuth, async (req, res) => {
  try {
    const tokens = await getUserOAuthTokens(req.user.id);
    const hasGmailScope = tokens?.scopes?.includes(
      'https://www.googleapis.com/auth/gmail.compose'
    );
    res.json({
      success: true,
      authorized: !!tokens && !!hasGmailScope,
      hasRefreshToken: !!tokens?.refresh_token,
    });
  } catch (error) {
    res.json({ success: true, authorized: false });
  }
});

/**
 * Rota: POST /api/projetos/cronograma/gmail-draft
 * Cria um rascunho no Gmail do usuário com a cobrança
 * Body: { construflowId, disciplinaName, subject, body }
 */
app.post('/api/projetos/cronograma/gmail-draft', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { to, subject, body, construflowId, disciplinaName } = req.body;

    if (!subject || !body) {
      return res.status(400).json({
        success: false,
        error: 'subject e body são obrigatórios',
      });
    }

    // Resolve emails se não fornecidos diretamente
    let recipients = to;
    if (!recipients && construflowId && disciplinaName) {
      recipients = await resolveRecipientEmails(construflowId, disciplinaName);
    }

    if (!recipients || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum email de destinatário encontrado para esta disciplina',
        code: 'NO_RECIPIENTS',
      });
    }

    const draft = await createGmailDraft(userId, {
      to: recipients,
      subject,
      body,
    });

    res.json({
      success: true,
      draftId: draft.draftId,
      message: 'Rascunho criado com sucesso no Gmail',
    });
  } catch (error) {
    if (error.message === 'GMAIL_NOT_AUTHORIZED') {
      return res.status(403).json({
        success: false,
        error: 'Gmail não autorizado. Faça login novamente com permissão de Gmail.',
        code: 'GMAIL_NOT_AUTHORIZED',
      });
    }
    console.error('Erro ao criar rascunho Gmail:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao criar rascunho no Gmail',
    });
  }
});

const META_RESPOSTAS_NPS = Number(process.env.META_RESPOSTAS_NPS) || 80;

function parseNPS(val) {
  if (val == null || val === '') {
    return null;
  }
  const n = parseInt(String(val).trim(), 10);
  if (Number.isNaN(n) || n < 0 || n > 10) {
    return null;
  }
  return n;
}

function aggregateNPS(npsRows, portRows) {
  const porNota = Array.from({ length: 11 }, (_, i) => ({ nota: i, count: 0 }));
  const porOrg = new Map();
  const porTimeRespostas = new Map();
  let promotores = 0, neutros = 0, detratores = 0;
  let totalValid = 0;

  for (const r of npsRows) {
    const nota = parseNPS(r.NPS);
    if (nota != null) {
      totalValid++;
      if (nota >= 9) promotores++;
      else if (nota >= 7) neutros++;
      else detratores++;
      if (nota >= 0 && nota <= 10) porNota[nota].count++;
    }
    const org = String(r.Organiza___o ?? '').trim() || 'Sem organização';
    porOrg.set(org, (porOrg.get(org) ?? 0) + 1);
    const time = String(r.Ultimo_Time ?? '').trim() || 'Sem time';
    const set = porTimeRespostas.get(time) ?? new Set();
    const prt = String(r.Prt___Cliente ?? '').trim();
    if (prt) set.add(prt);
    porTimeRespostas.set(time, set);
  }

  const clientesPorTime = new Map();
  for (const r of portRows) {
    const time = String(r.Ultimo_Time ?? '').trim() || 'Sem time';
    const set = clientesPorTime.get(time) ?? new Set();
    const cli = String(r.Cliente ?? '').trim();
    if (cli) set.add(cli);
    clientesPorTime.set(time, set);
  }

  const npsScore = totalValid > 0
    ? Math.round(((promotores - detratores) / totalValid) * 100 * 100) / 100
    : 0;

  const totalRespostas = npsRows.length;
  const respostasMetaPct = META_RESPOSTAS_NPS > 0
    ? Math.round((totalRespostas / META_RESPOSTAS_NPS) * 100 * 100) / 100
    : 0;

  const porOrganizacao = Array.from(porOrg.entries())
    .map(([organizacao, totalRespostas]) => ({ organizacao, totalRespostas }))
    .sort((a, b) => b.totalRespostas - a.totalRespostas);

  const times = new Set([...porTimeRespostas.keys(), ...clientesPorTime.keys()]);
  const porTime = Array.from(times).sort().map((time) => {
    const ativos = (clientesPorTime.get(time) ?? new Set()).size;
    const responderam = (porTimeRespostas.get(time) ?? new Set()).size;
    const pct = ativos > 0 ? Math.round((responderam / ativos) * 10000) / 100 : 0;
    return { time, clientesAtivos: ativos, clientesResponderam: responderam, pctResponderam: pct };
  });

  return {
    npsScore,
    promotores,
    neutros,
    detratores,
    totalRespostas,
    metaRespostas: META_RESPOSTAS_NPS,
    respostasMetaPct,
    porNota: porNota.slice(1, 11),
    porOrganizacao,
    porTime,
  };
}

/**
 * Rota: GET /api/apoio-projetos/proximas-tarefas
 * Retorna tarefas do SmartSheet com início nas próximas N semanas.
 * Sem filtro por líder - usado pelo setor de Tecnologia (Apoio de Projetos).
 * Query: weeksAhead (padrão: 2)
 */
app.get('/api/apoio-projetos/proximas-tarefas', requireAuth, withBqCache(900), async (req, res) => {
  try {
    const weeksAhead = parseInt(req.query.weeksAhead) || 2;

    const data = await queryProximasTarefasAll(null, { weeksAhead });

    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    console.error('❌ Erro ao buscar próximas tarefas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Rota: GET /api/apoio-projetos/portfolio
 * Retorna dados do portfolio enriquecidos com plataforma_acd e controle_apoio
 * Sem filtro por lider - usado pelo setor de Tecnologia (Apoio de Projetos)
 */
app.get('/api/apoio-projetos/portfolio', requireAuth, withBqCache(900), async (req, res) => {
  try {
    let portfolioData = [];
    try {
      portfolioData = await fetchPortfolioRealtime(null);
    } catch (supabaseError) {
      console.warn('⚠️ Supabase falhou no apoio-projetos, usando BigQuery:', supabaseError.message);
      portfolioData = await queryPortfolio(null);
    }

    const featuresMap = await fetchProjectFeaturesForPortfolio();

    const enrichedData = portfolioData.map(row => ({
      ...row,
      plataforma_acd: featuresMap[row.project_code_norm]?.plataforma_acd || null,
      controle_apoio: featuresMap[row.project_code_norm]?.controle_apoio || null,
      link_ifc: featuresMap[row.project_code_norm]?.link_ifc || null,
    }));

    res.json({
      success: true,
      count: enrichedData.length,
      data: enrichedData
    });
  } catch (error) {
    console.error('Erro ao buscar portfolio do apoio:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Rota: PUT /api/apoio-projetos/portfolio/:projectCode/controle
 * Atualiza o controle_apoio de um projeto
 * Body: { controle_apoio: "Controlando" | "Não controlando" | "Dispensado" | null }
 */
app.put('/api/apoio-projetos/portfolio/:projectCode/controle', requireAuth, async (req, res) => {
  try {
    if (!canManageApoioProjetos(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const { projectCode } = req.params;
    const { controle_apoio } = req.body;

    const validValues = ['Controlando', 'Não controlando', 'Dispensado', null];
    if (!validValues.includes(controle_apoio)) {
      return res.status(400).json({
        success: false,
        error: 'Valor invalido. Use: Controlando, Não controlando, Dispensado ou null'
      });
    }

    const result = await updateControleApoio(projectCode, controle_apoio);

    await logAction(req, 'update', 'apoio-portfolio', projectCode, 'Controle Apoio', { controle_apoio });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Erro ao atualizar controle_apoio:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: PUT /api/apoio-projetos/portfolio/:projectCode/link-ifc
 * Atualiza o link da pasta de IFCs atualizados de um projeto
 * Body: { link_ifc: "https://..." | null }
 */
app.put('/api/apoio-projetos/portfolio/:projectCode/link-ifc', requireAuth, async (req, res) => {
  try {
    if (!canManageApoioProjetos(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const { projectCode } = req.params;
    const { link_ifc } = req.body;

    if (link_ifc !== null && typeof link_ifc !== 'string') {
      return res.status(400).json({ success: false, error: 'link_ifc deve ser uma URL ou null' });
    }

    const result = await updateLinkIfc(projectCode, link_ifc || null);

    await logAction(req, 'update', 'apoio-portfolio', projectCode, 'Link IFC', { link_ifc });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Erro ao atualizar link_ifc:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: PUT /api/apoio-projetos/portfolio/:projectCode/plataforma-acd
 * Atualiza a plataforma ACD de um projeto
 * Body: { plataforma_acd: "google_drive" | "bim360" | ... | null }
 */
app.put('/api/apoio-projetos/portfolio/:projectCode/plataforma-acd', requireAuth, async (req, res) => {
  try {
    if (!canManageApoioProjetos(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const { projectCode } = req.params;
    const { plataforma_acd } = req.body;

    const validValues = ['google_drive', 'bim360', 'autodoc', 'construcode', 'onedrive', 'qicloud', 'construmanager', 'dropbox', null];
    if (!validValues.includes(plataforma_acd)) {
      return res.status(400).json({
        success: false,
        error: `Valor invalido. Use: ${validValues.filter(Boolean).join(', ')} ou null`
      });
    }

    const result = await updatePlataformaAcd(projectCode, plataforma_acd);

    await logAction(req, 'update', 'apoio-portfolio', projectCode, 'Plataforma ACD', { plataforma_acd });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Erro ao atualizar plataforma_acd:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/cs/nps
 * NPS do setor de sucesso do cliente, vinculado a port_clientes.
 * Líderes veem apenas o time (Ultimo_Time); privilegiados veem todos.
 * Query: campanha, organizacao, cargo
 */
app.get('/api/cs/nps', requireAuth, withBqCache(3600), async (req, res) => {
  try {
    const campanha = req.query.campanha ?? '';
    const organizacao = req.query.organizacao ?? '';
    const cargo = req.query.cargo ?? '';

    // Filtro por líder: apenas líderes de Operação veem só seus dados
    const { leaderName: npsLeaderName, hasAccess } = getLeaderDataFilter(req);
    let ultimoTime = null;
    if (!hasAccess) {
      return res.json({
        success: true,
        data: {
          npsScore: 0, promotores: 0, neutros: 0, detratores: 0,
          totalRespostas: 0, metaRespostas: META_RESPOSTAS_NPS,
          respostasMetaPct: 0, porNota: [], porOrganizacao: [], porTime: [],
        },
        filters: { campanhas: [], organizacoes: [], cargos: [] },
        applied: { campanha: '', organizacao: '', cargo: '' },
      });
    }
    if (npsLeaderName) {
      ultimoTime = getUltimoTimeForLeader(npsLeaderName);
    }

    const [npsRows, portRows, filterRows] = await Promise.all([
      queryNPSRaw(ultimoTime, { campanha, organizacao, cargo }),
      queryPortClientes(ultimoTime),
      queryNPSFilterOptions(ultimoTime),
    ]);

    const campanhas = [...new Set((filterRows || []).map((r) => String(r.Campanha ?? '').trim()).filter(Boolean))].sort();
    const organizacoes = [...new Set((filterRows || []).map((r) => String(r.Organiza___o ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const cargos = [...new Set((filterRows || []).map((r) => String(r.Cargo ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const data = aggregateNPS(npsRows, portRows);

    // Registra o acesso
    await logAction(req, 'view', 'cs', null, 'CS - NPS', { 
      campanha, 
      organizacao, 
      cargo,
      npsScore: data.npsScore 
    });

    res.json({
      success: true,
      data,
      filters: { campanhas, organizacoes, cargos },
      applied: { campanha, organizacao, cargo },
    });
  } catch (err) {
    console.error('Erro ao buscar NPS:', err);
    res.status(500).json({ success: false, error: err.message || 'Erro ao buscar NPS' });
  }
});

/**
 * Rota: GET /api/estudo-custos
 * Estudo de custos (estudo_custos_pbi). Todos os autenticados têm acesso.
 */
app.get('/api/estudo-custos', requireAuth, withBqCache(1800), async (req, res) => {
  try {
    const data = await queryEstudoCustos();
    res.json({ success: true, data });
  } catch (err) {
    console.error('Erro ao buscar estudo de custos:', err);
    res.status(500).json({ success: false, error: err.message || 'Erro ao buscar estudo de custos' });
  }
});

function parseDuracaoHoras(duracao) {
  if (duracao == null || String(duracao).trim() === '') {
    return 0;
  }

  const s = String(duracao).trim();
  const n = parseFloat(s.replace(',', '.'));

  if (!Number.isNaN(n)) {
    return n;
  }

  const hMatch = s.match(/(\d+)\s*h/i);
  const mMatch = s.match(/(\d+)\s*m/i);
  const h = hMatch ? parseInt(hMatch[1], 10) : 0;
  const m = mMatch ? parseInt(mMatch[1], 10) : 0;

  return h + m / 60;
}

function toDateString(v) {
  if (v == null) {
    return null;
  }

  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    return v.slice(0, 10);
  }

  if (typeof v === 'object' && v && typeof v.value === 'string') {
    return v.value.slice(0, 10);
  }

  try {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  } catch (_) {
    // Ignore parse errors
  }

  return null;
}

/** Agrega horas por time (Colaboradores: "N - Time Nome"). Ordena apontamentos por data DESC. */
function aggregateHorasByTime(rows) {
  const byTime = new Map();
  for (const r of rows) {
    const time = String(r.time ?? '').trim() || 'Sem time';
    const horas = parseDuracaoHoras(r.duracao);
    const dataStr = toDateString(r.data_de_apontamento);
    if (!byTime.has(time)) {
      byTime.set(time, { time, totalHoras: 0, apontamentos: [] });
    }
    const g = byTime.get(time);
    g.totalHoras += horas;
    g.apontamentos.push({
      task_name: r.task_name,
      fase: r.fase,
      projeto: r.projeto,
      usuario: r.usuario,
      duracao: r.duracao,
      data_de_apontamento: dataStr,
      horas: parseDuracaoHoras(r.duracao),
    });
  }
  return Array.from(byTime.values())
    .sort((a, b) => a.time.localeCompare(b.time, 'pt-BR'))
    .map((g) => {
      g.apontamentos.sort((x, y) => {
        const dx = x.data_de_apontamento || '';
        const dy = y.data_de_apontamento || '';
        return dy.localeCompare(dx);
      });
      return {
        ...g,
        totalHoras: Math.round(g.totalHoras * 100) / 100,
      };
    });
}

/** Agrega horas por projeto. Mesma estrutura, chave = projeto. */
function aggregateHorasByProjeto(rows) {
  const byProj = new Map();
  for (const r of rows) {
    const projeto = String(r.projeto ?? '').trim() || 'Sem projeto';
    const horas = parseDuracaoHoras(r.duracao);
    const dataStr = toDateString(r.data_de_apontamento);
    if (!byProj.has(projeto)) {
      byProj.set(projeto, { projeto, totalHoras: 0, apontamentos: [] });
    }
    const g = byProj.get(projeto);
    g.totalHoras += horas;
    g.apontamentos.push({
      task_name: r.task_name,
      fase: r.fase,
      projeto: r.projeto,
      usuario: r.usuario,
      duracao: r.duracao,
      data_de_apontamento: dataStr,
      horas: parseDuracaoHoras(r.duracao),
    });
  }
  return Array.from(byProj.values())
    .sort((a, b) => a.projeto.localeCompare(b.projeto, 'pt-BR'))
    .map((g) => {
      g.apontamentos.sort((x, y) => {
        const dx = x.data_de_apontamento || '';
        const dy = y.data_de_apontamento || '';
        return dy.localeCompare(dx);
      });
      return {
        ...g,
        totalHoras: Math.round(g.totalHoras * 100) / 100,
      };
    });
}

function toISODate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function defaultHorasDateRange() {
  const dataFim = new Date();
  const dataInicio = new Date();
  dataInicio.setFullYear(dataInicio.getFullYear() - 1);
  return {
    dataInicio: toISODate(dataInicio),
    dataFim: toISODate(dataFim)
  };
}

/**
 * Rota: GET /api/times
 * Lista de times (Colaboradores) para filtro na vista Horas.
 * Formato "N - Time Nome" (ex.: "5 - Time Eliane"). Acesso: qualquer usuário autenticado.
 */
app.get('/api/times', requireAuth, async (req, res) => {
  try {
    const list = await fetchTimesList();
    res.json({ success: true, data: list });
  } catch (err) {
    console.error('Erro ao buscar times:', err);
    res.status(500).json({ success: false, error: err.message || 'Erro ao buscar times' });
  }
});

// ============================================
// ROTAS: OPERACAO - TIMES CRUD
// ============================================

/**
 * Rota: GET /api/operacao/teams
 * Lista todos os times para gerenciamento
 * Acesso: usuarios privilegiados
 */
app.get('/api/operacao/teams', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('teams')
      .select('id, team_number, team_name, created_at')
      .order('team_number', { ascending: true });

    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('Erro ao buscar teams:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Rota: POST /api/operacao/teams
 * Cria um novo time
 */
app.post('/api/operacao/teams', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const { team_number, team_name } = req.body;
    if (!team_name?.trim()) {
      return res.status(400).json({ success: false, error: 'Nome do time e obrigatorio' });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('teams')
      .insert([{
        team_number: team_number || null,
        team_name: team_name.trim()
      }])
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    console.error('Erro ao criar team:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Rota: PUT /api/operacao/teams/:id
 * Atualiza um time existente
 */
app.put('/api/operacao/teams/:id', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const { id } = req.params;
    const { team_number, team_name } = req.body;

    if (!team_name?.trim()) {
      return res.status(400).json({ success: false, error: 'Nome do time e obrigatorio' });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('teams')
      .update({
        team_number: team_number || null,
        team_name: team_name.trim()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    console.error('Erro ao atualizar team:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Rota: DELETE /api/operacao/teams/:id
 * Exclui um time (verifica se nao ha usuarios alocados)
 */
app.delete('/api/operacao/teams/:id', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const { id } = req.params;
    const supabase = getSupabaseClient();

    // Verifica se ha usuarios alocados
    const { data: usersInTeam, error: checkError } = await supabase
      .from('users_otus')
      .select('id')
      .eq('team_id', id)
      .limit(1);

    if (checkError) throw checkError;

    if (usersInTeam?.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Nao e possivel excluir: existem usuarios alocados neste time'
      });
    }

    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: 'Time excluido com sucesso' });
  } catch (err) {
    console.error('Erro ao excluir team:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Rota: PUT /api/operacao/users/:id/team
 * Atualiza o time de um usuario
 */
app.put('/api/operacao/users/:id/team', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const { id } = req.params;
    const { team_id } = req.body;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users_otus')
      .update({ team_id: team_id || null })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    console.error('Erro ao atualizar team do usuario:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Rota: GET /api/horas
 * Horas (timetracker) agrupadas por time (Colaboradores). Líderes veem só o seu time.
 * Sempre filtra por data (últimos 12 meses) para evitar carregamento lento.
 * Query: dataInicio, dataFim (YYYY-MM-DD, opcional) — senão usa último ano.
 */
app.get('/api/horas', requireAuth, withBqCache(900), async (req, res) => {
  try {
    // Filtro por líder: apenas líderes de Operação veem só seus dados
    const { leaderName, hasAccess } = getLeaderDataFilter(req);
    if (!hasAccess) {
      const def = defaultHorasDateRange();
      return res.json({ success: true, porTime: [], porProjeto: [], dataInicio: def.dataInicio, dataFim: def.dataFim });
    }
    let dataInicio = req.query.dataInicio;
    let dataFim = req.query.dataFim;
    if (!dataInicio || !dataFim) {
      const def = defaultHorasDateRange();
      dataInicio = dataInicio || def.dataInicio;
      dataFim = dataFim || def.dataFim;
    }
    const rows = await queryHorasRaw(leaderName, { dataInicio, dataFim });
    const usuarioToTime = await fetchUsuarioToTime();
    for (const r of rows) {
      const u = typeof r.usuario === 'string' ? r.usuario.trim() : (r.usuario ?? '');
      r.time = usuarioToTime.get(u) ?? usuarioToTime.get(r.usuario) ?? 'Sem time';
    }
    const porTime = aggregateHorasByTime(rows);
    const porProjeto = aggregateHorasByProjeto(rows);
    
    // Registra o acesso
    await logAction(req, 'view', 'horas', null, 'Horas', { 
      dataInicio, 
      dataFim,
      totalApontamentos: rows.length 
    });
    
    res.json({ success: true, porTime, porProjeto, dataInicio, dataFim });
  } catch (err) {
    console.error('Erro ao buscar horas:', err);
    res.status(500).json({ success: false, error: err.message || 'Erro ao buscar horas' });
  }
});

/**
 * Rota: GET /api/projetos/apontamentos
 * Retorna os apontamentos (issues) de um projeto específico
 * Filtra por construflow_id do portfólio
 */
app.get('/api/projetos/apontamentos', requireAuth, withBqCache(900), async (req, res) => {
  try {
    const construflowId = req.query.construflowId;
    
    console.log(`📋 [API] Recebida requisição para buscar apontamentos`);
    console.log(`   Query params:`, req.query);
    console.log(`   Construflow ID recebido: ${construflowId}`);
    console.log(`   Usuário: ${req.user?.email || 'N/A'}`);
    
    if (!construflowId) {
      console.warn(`⚠️ Construflow ID não fornecido`);
      return res.status(400).json({
        success: false,
        error: 'construflowId é obrigatório'
      });
    }
    
    // Se o usuário for líder, valida se o projeto pertence a ele
    let leaderName = null;
    if (!isPrivileged(req.user)) {
      leaderName = req.user.name || getLeaderNameFromEmail(req.user.email);
      if (!leaderName) {
        console.warn(`⚠️ Nome do líder não encontrado para: ${req.user.email}`);
        return res.json({
          success: true,
          count: 0,
          data: []
        });
      }
      // TODO: Validar se o projeto pertence ao líder
      // Por enquanto, apenas busca os apontamentos
    }
    
    console.log(`📋 Chamando queryIssues(${construflowId})...`);
    const data = await queryIssues(construflowId);
    console.log(`✅ queryIssues retornou ${data.length} resultados`);
    
    res.json({
      success: true,
      count: data.length,
      data: data
    });
  } catch (error) {
    console.error('❌ Erro ao buscar apontamentos:');
    console.error('   Mensagem:', error.message);
    console.error('   Tipo:', error.constructor.name);
    console.error('   Stack trace:', error.stack);
    if (error.code) {
      console.error('   Código de erro:', error.code);
    }
    if (error.errors) {
      console.error('   Erros detalhados:', JSON.stringify(error.errors, null, 2));
    }
    
    // Retorna erro detalhado para o frontend
    res.status(500).json({ 
      success: false,
      error: error.message || 'Erro ao carregar apontamentos',
      details: process.env.NODE_ENV === 'development' 
        ? error.stack 
        : 'Verifique o BigQuery e a tabela de issues',
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

// ============================================
// ROTAS DE FEEDBACKS (DDD)
// Migrado para arquitetura Domain Driven Design
// Ver: backend/routes/feedbacks.js
// ============================================
setupDDDRoutes(app, { requireAuth, isPrivileged, canManageDemandas, canManageEstudosCustos, canAccessFormularioPassagem, logAction, withBqCache });

/**
 * Rota: GET /api/admin/user-views
 * Retorna todas as permissões de vistas dos usuários
 * Apenas admin/director
 */
app.get('/api/admin/user-views', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        message: 'Somente admin ou director podem acessar este recurso',
      });
    }

    const views = await fetchUserViews();
    res.json({
      success: true,
      data: views,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar permissões de vistas:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar permissões de vistas',
    });
  }
});

/**
 * Rota: PUT /api/admin/user-views
 * Atualiza as permissões de vistas de um usuário
 * Body: { email, views: [viewIds] }
 * Apenas admin/director
 */
app.put('/api/admin/user-views', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        message: 'Somente admin ou director podem acessar este recurso',
      });
    }

    const { email, views } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Email é obrigatório',
      });
    }

    if (!Array.isArray(views)) {
      return res.status(400).json({
        success: false,
        error: 'Views deve ser um array',
      });
    }

    await updateUserViews(email, views);

    // Registra a atualização de permissões
    await logAction(req, 'update', 'user_views', email, `Permissões de ${email}`, { views_count: views.length, views });

    res.json({
      success: true,
      message: 'Permissões de vistas atualizadas com sucesso',
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar permissões de vistas:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar permissões de vistas',
    });
  }
});

/**
 * Rota: GET /api/user/my-views
 * Retorna as vistas permitidas para o usuário logado
 */
app.get('/api/user/my-views', requireAuth, async (req, res) => {
  try {
    const views = await getUserViews(req.user.email);
    res.json({
      success: true,
      data: views,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar vistas do usuário:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar vistas do usuário',
    });
  }
});

// ============================================================================
// VIEWS & ACCESS CONTROL ENDPOINTS
// ============================================================================

/**
 * Rota: GET /api/user/effective-views
 * Retorna as vistas efetivas que o usuário pode acessar
 * Considera: role, setor, cargo e overrides específicos
 */
app.get('/api/user/effective-views', requireAuth, async (req, res) => {
  try {
    const effectiveUser = getEffectiveUser(req);
    const userInfo = await getUserByEmail(effectiveUser.email);

    const user = {
      email: effectiveUser.email,
      role: effectiveUser.role || getUserRole(effectiveUser),
      sector_id: userInfo?.setor_id || null,
      position_id: userInfo?.cargo?.id || null,
    };

    const views = await getEffectiveViews(user);

    res.json({
      success: true,
      views,
      user: {
        email: user.email,
        role: user.role,
        sector_id: user.sector_id,
        position_id: user.position_id,
      },
    });
  } catch (error) {
    console.error('❌ Erro ao buscar vistas efetivas:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar vistas efetivas',
    });
  }
});

/**
 * Rota: GET /api/admin/views
 * Retorna todas as vistas cadastradas
 * Apenas admin/director/dev
 */
app.get('/api/admin/views', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
      });
    }

    const views = await fetchViews();
    res.json({
      success: true,
      data: views,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar vistas:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar vistas',
    });
  }
});

/**
 * Rota: POST /api/admin/views
 * Cria uma nova vista
 * Apenas dev
 */
app.post('/api/admin/views', requireAuth, async (req, res) => {
  try {
    if (!isDev(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        message: 'Apenas desenvolvedores podem criar vistas',
      });
    }

    const { id, name, area, route, description, sort_order } = req.body;

    if (!id || !name || !area || !route) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: id, name, area, route',
      });
    }

    const view = await createView({ id, name, area, route, description, sort_order });

    await createLog({
      user_email: req.user.email,
      user_name: req.user.name,
      action_type: 'create',
      resource_type: 'view',
      resource_id: id,
      resource_name: name,
    });

    res.json({
      success: true,
      data: view,
    });
  } catch (error) {
    console.error('❌ Erro ao criar vista:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao criar vista',
    });
  }
});

/**
 * Rota: DELETE /api/admin/views/:id
 * Remove uma vista
 * Apenas dev
 */
app.delete('/api/admin/views/:id', requireAuth, async (req, res) => {
  try {
    if (!isDev(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        message: 'Apenas desenvolvedores podem remover vistas',
      });
    }

    const { id } = req.params;
    await deleteView(id);

    await createLog({
      user_email: req.user.email,
      user_name: req.user.name,
      action_type: 'delete',
      resource_type: 'view',
      resource_id: id,
    });

    res.json({
      success: true,
      message: 'Vista removida com sucesso',
    });
  } catch (error) {
    console.error('❌ Erro ao remover vista:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao remover vista',
    });
  }
});

/**
 * Rota: GET /api/admin/access-defaults
 * Retorna todas as regras de acesso padrão
 * Apenas admin/director/dev
 */
app.get('/api/admin/access-defaults', requireAuth, async (req, res) => {
  try {
    if (!hasFullAccess(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
      });
    }

    const filters = {
      view_id: req.query.view_id || null,
      role: req.query.role || null,
      sector_id: req.query.sector_id || null,
      position_id: req.query.position_id || null,
    };

    const rules = await fetchAccessDefaults(filters);
    res.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar regras de acesso:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar regras de acesso',
    });
  }
});

/**
 * Rota: POST /api/admin/access-defaults
 * Cria uma nova regra de acesso padrão
 * Apenas admin/director/dev
 */
app.post('/api/admin/access-defaults', requireAuth, async (req, res) => {
  try {
    if (!hasFullAccess(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
      });
    }

    const { view_id, role, sector_id, position_id, has_access } = req.body;

    if (!view_id) {
      return res.status(400).json({
        success: false,
        error: 'Campo obrigatório: view_id',
      });
    }

    const rule = await createAccessDefault({ view_id, role, sector_id, position_id, has_access });

    await createLog({
      user_email: req.user.email,
      user_name: req.user.name,
      action_type: 'create',
      resource_type: 'access_default',
      resource_id: String(rule.id),
      details: { view_id, role, sector_id, position_id, has_access },
    });

    res.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.error('❌ Erro ao criar regra de acesso:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao criar regra de acesso',
    });
  }
});

/**
 * Rota: PUT /api/admin/access-defaults/:id
 * Atualiza uma regra de acesso padrão
 * Apenas admin/director/dev
 */
app.put('/api/admin/access-defaults/:id', requireAuth, async (req, res) => {
  try {
    if (!hasFullAccess(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
      });
    }

    const { id } = req.params;
    const { view_id, role, sector_id, position_id, has_access } = req.body;

    const rule = await updateAccessDefault(parseInt(id, 10), { view_id, role, sector_id, position_id, has_access });

    await createLog({
      user_email: req.user.email,
      user_name: req.user.name,
      action_type: 'update',
      resource_type: 'access_default',
      resource_id: id,
      details: { view_id, role, sector_id, position_id, has_access },
    });

    res.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar regra de acesso:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar regra de acesso',
    });
  }
});

/**
 * Rota: DELETE /api/admin/access-defaults/:id
 * Remove uma regra de acesso padrão
 * Apenas admin/director/dev
 */
app.delete('/api/admin/access-defaults/:id', requireAuth, async (req, res) => {
  try {
    if (!hasFullAccess(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
      });
    }

    const { id } = req.params;
    await deleteAccessDefault(parseInt(id, 10));

    await createLog({
      user_email: req.user.email,
      user_name: req.user.name,
      action_type: 'delete',
      resource_type: 'access_default',
      resource_id: id,
    });

    res.json({
      success: true,
      message: 'Regra de acesso removida com sucesso',
    });
  } catch (error) {
    console.error('❌ Erro ao remover regra de acesso:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao remover regra de acesso',
    });
  }
});

/**
 * Rota: PUT /api/admin/user-view-override
 * Define ou atualiza um override de vista para um usuário específico
 * Body: { email, view_id, has_access }
 * Apenas admin/director/dev
 */
app.put('/api/admin/user-view-override', requireAuth, async (req, res) => {
  try {
    if (!hasFullAccess(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
      });
    }

    const { email, view_id, has_access } = req.body;

    if (!email || !view_id || has_access === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: email, view_id, has_access',
      });
    }

    await setUserViewOverride(email, view_id, has_access);

    await createLog({
      user_email: req.user.email,
      user_name: req.user.name,
      action_type: 'update',
      resource_type: 'user_view_override',
      resource_id: email,
      details: { view_id, has_access },
    });

    res.json({
      success: true,
      message: 'Override de vista atualizado com sucesso',
    });
  } catch (error) {
    console.error('❌ Erro ao definir override de vista:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao definir override de vista',
    });
  }
});

/**
 * Rota: DELETE /api/admin/user-view-override
 * Remove um override de vista para um usuário
 * Query params: email, view_id
 * Apenas admin/director/dev
 */
app.delete('/api/admin/user-view-override', requireAuth, async (req, res) => {
  try {
    if (!hasFullAccess(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
      });
    }

    const { email, view_id } = req.query;

    if (!email || !view_id) {
      return res.status(400).json({
        success: false,
        error: 'Query params obrigatórios: email, view_id',
      });
    }

    await removeUserViewOverride(email, view_id);

    await createLog({
      user_email: req.user.email,
      user_name: req.user.name,
      action_type: 'delete',
      resource_type: 'user_view_override',
      resource_id: email,
      details: { view_id },
    });

    res.json({
      success: true,
      message: 'Override de vista removido com sucesso',
    });
  } catch (error) {
    console.error('❌ Erro ao remover override de vista:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao remover override de vista',
    });
  }
});

/**
 * Rota: GET /api/admin/user-view-overrides/:email
 * Retorna os overrides de vista de um usuário específico
 * Apenas admin/director/dev
 */
app.get('/api/admin/user-view-overrides/:email', requireAuth, async (req, res) => {
  try {
    if (!hasFullAccess(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
      });
    }

    const { email } = req.params;
    const overrides = await getUserViewOverrides(decodeURIComponent(email));

    res.json({
      success: true,
      data: overrides,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar overrides do usuário:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar overrides do usuário',
    });
  }
});

/**
 * Rota: GET /api/admin/logs
 * Retorna logs do sistema (apenas admin/director)
 * Query params: user_email, action_type, resource_type, start_date, end_date, limit, offset
 */
app.get('/api/admin/logs', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        message: 'Somente admin ou director podem acessar este recurso',
      });
    }

    const filters = {
      user_email: req.query.user_email || null,
      action_type: req.query.action_type || null,
      resource_type: req.query.resource_type || null,
      start_date: req.query.start_date ? new Date(req.query.start_date) : null,
      end_date: req.query.end_date ? new Date(req.query.end_date) : null,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 1000,
      offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
    };

    const logs = await fetchLogs(filters);

    // Registra a visualização dos logs
    await logAction(req, 'view', 'logs', null, 'Logs do Sistema');

    res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar logs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar logs',
    });
  }
});

/**
 * Rota: GET /api/admin/logs/stats
 * Retorna estatísticas de uso (apenas admin/director)
 * Query params: start_date, end_date
 */
app.get('/api/admin/logs/stats', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        message: 'Somente admin ou director podem acessar este recurso',
      });
    }

    const startDate = req.query.start_date ? new Date(req.query.start_date) : null;
    const endDate = req.query.end_date ? new Date(req.query.end_date) : null;

    const [actionsStats, viewsStats] = await Promise.all([
      countLogsByAction(startDate, endDate),
      countViewUsage(startDate, endDate),
    ]);

    res.json({
      success: true,
      data: {
        actions: actionsStats,
        views: viewsStats,
      },
    });
  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar estatísticas',
    });
  }
});

// Em produção (Docker): serve o frontend estático e SPA
const publicDir = path.join(process.cwd(), 'public');
const hasPublic = existsSync(publicDir);
if (hasPublic) {
  app.use(express.static(publicDir));
  app.get('/', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.type('html').send(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Plataforma Otus</title></head>
      <body>
        <h1>Frontend não encontrado</h1>
        <p>A pasta <code>public</code> não existe no container. O backend está rodando.</p>
        <p><a href="/api/health">Verificar /api/health</a></p>
      </body></html>
    `);
  });
}

// ============================================
// OKRs - Objetivos e Resultados Chave
// ============================================

/**
 * Rota: GET /api/okrs
 * Retorna todos os OKRs com filtros opcionais
 * Query params: quarter, level
 */
app.get('/api/okrs', requireAuth, async (req, res) => {
  try {
    const quarter = req.query.quarter || null;
    const level = req.query.level || null;

    const okrs = await fetchOKRs(quarter, level);

    await logAction(req, 'view', 'okrs', null, 'Lista de OKRs');

    res.json({
      success: true,
      data: okrs,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar OKRs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar OKRs',
    });
  }
});

/**
 * Rota: POST /api/okrs
 * Cria um novo OKR
 * Body: { titulo, nivel, responsavel, quarter, keyResults: [{ descricao, meta, atual }] }
 */
app.post('/api/okrs', requireAuth, async (req, res) => {
  try {
    const { titulo, nivel, responsavel, quarter, keyResults } = req.body;

    if (!titulo || !nivel || !responsavel || !quarter) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: titulo, nivel, responsavel, quarter',
      });
    }

    const okr = await createOKR({
      titulo,
      nivel,
      responsavel,
      quarter,
      keyResults: keyResults || [],
      created_by: req.user.email,
    });

    await logAction(req, 'create', 'okr', okr.id, `OKR criado: ${titulo}`);

    res.json({
      success: true,
      data: okr,
    });
  } catch (error) {
    console.error('❌ Erro ao criar OKR:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao criar OKR',
    });
  }
});

// ============================================
// ROTAS ESPECÍFICAS (devem vir ANTES das rotas com :id)
// ============================================

/**
 * Rota: GET /api/okrs/check-ins
 * Retorna check-ins de OKRs
 * Query params: keyResultIds (comma-separated)
 */
app.get('/api/okrs/check-ins', requireAuth, async (req, res) => {
  try {
    const keyResultIds = req.query.keyResultIds
      ? req.query.keyResultIds.split(',').map(id => parseInt(id))
      : [];

    const checkIns = await fetchOKRCheckIns(keyResultIds);

    res.json({
      success: true,
      data: checkIns,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar check-ins de OKR:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar check-ins de OKR',
    });
  }
});

/**
 * Rota: POST /api/okrs/check-ins
 * Cria um novo check-in de OKR
 */
app.post('/api/okrs/check-ins', requireAuth, async (req, res) => {
  try {
    const checkInData = {
      ...req.body,
      created_by: req.user.email,
    };

    const checkIn = await createOKRCheckIn(checkInData);

    // Recalcular valor consolidado se auto_calculate=true
    if (checkIn.key_result_id) {
      await recalculateKRConsolidatedValue(checkIn.key_result_id);
    }

    await logAction(req, 'create', 'okr_check_in', checkIn.id, `Check-in OKR criado`);

    res.json({
      success: true,
      data: checkIn,
    });
  } catch (error) {
    console.error('❌ Erro ao criar check-in de OKR:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao criar check-in de OKR',
    });
  }
});

/**
 * Rota: PUT /api/okrs/check-ins/:id
 * Atualiza um check-in de OKR
 */
app.put('/api/okrs/check-ins/:id', requireAuth, async (req, res) => {
  try {
    const checkInId = req.params.id;
    const checkIn = await updateOKRCheckIn(checkInId, req.body);

    // Recalcular valor consolidado se auto_calculate=true
    if (checkIn.key_result_id) {
      await recalculateKRConsolidatedValue(checkIn.key_result_id);
    }

    await logAction(req, 'update', 'okr_check_in', checkInId, `Check-in OKR atualizado`);

    res.json({
      success: true,
      data: checkIn,
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar check-in de OKR:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar check-in de OKR',
    });
  }
});

/**
 * Rota: DELETE /api/okrs/check-ins/:id
 * Deleta um check-in de OKR
 */
app.delete('/api/okrs/check-ins/:id', requireAuth, async (req, res) => {
  try {
    const checkInId = req.params.id;

    await deleteOKRCheckIn(checkInId);

    await logAction(req, 'delete', 'okr_check_in', checkInId, `Check-in OKR deletado`);

    res.json({
      success: true,
      message: 'Check-in deletado com sucesso',
    });
  } catch (error) {
    console.error('❌ Erro ao deletar check-in de OKR:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao deletar check-in de OKR',
    });
  }
});

/**
 * Rota: GET /api/okrs/usuarios-responsaveis
 * Lista usuários disponíveis para serem responsáveis por KRs
 * Query params:
 *   - setor_id: filtra por setor
 *   - only_leadership: 'true' para mostrar apenas cargos de liderança (default: false)
 */
app.get('/api/okrs/usuarios-responsaveis', requireAuth, async (req, res) => {
  try {
    const { setor_id, only_leadership } = req.query;
    const onlyLeadership = only_leadership === 'true';

    const supabase = getSupabaseServiceClient();
    let query = supabase
      .from('users_otus')
      .select(`
        id,
        name,
        avatar_url,
        setor_id,
        cargo:position_id(id, name, is_leadership)
      `)
      .eq('is_active', true)
      .order('name', { ascending: true });

    // Filtra por setor se especificado
    if (setor_id) {
      query = query.eq('setor_id', setor_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Filtra para mostrar só lideranças se solicitado
    let filteredData = data || [];
    if (onlyLeadership) {
      filteredData = filteredData.filter(u => u.cargo?.is_leadership);
    }

    res.json({
      success: true,
      data: filteredData,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar usuários responsáveis:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar usuários',
    });
  }
});

/**
 * Rota: PUT /api/okrs/key-results/:id
 * Atualiza um Key Result
 */
app.put('/api/okrs/key-results/:id', requireAuth, async (req, res) => {
  try {
    const krId = req.params.id;
    const kr = await updateKeyResult(krId, req.body);

    // Recalcular valor consolidado se auto_calculate=true ou se mudou consolidation_type
    if (kr.auto_calculate) {
      await recalculateKRConsolidatedValue(krId);
    }

    await logAction(req, 'update', 'key_result', krId, `KR atualizado`);

    res.json({
      success: true,
      data: kr,
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar Key Result:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar Key Result',
    });
  }
});

/**
 * Rota: GET /api/okrs/initiatives/:objectiveId
 * Retorna iniciativas de um objetivo
 */
app.get('/api/okrs/initiatives/:objectiveId', requireAuth, async (req, res) => {
  try {
    const objectiveId = req.params.objectiveId;
    const initiatives = await fetchOKRInitiatives(objectiveId);

    res.json({
      success: true,
      data: initiatives,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar iniciativas:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar iniciativas',
    });
  }
});

/**
 * Rota: POST /api/okrs/initiatives
 * Cria uma nova iniciativa
 */
app.post('/api/okrs/initiatives', requireAuth, async (req, res) => {
  try {
    const initiativeData = {
      ...req.body,
      created_by: req.user.email,
    };

    const initiative = await createOKRInitiative(initiativeData);

    await logAction(req, 'create', 'okr_initiative', initiative.id, `Iniciativa criada: ${initiativeData.title}`);

    res.json({
      success: true,
      data: initiative,
    });
  } catch (error) {
    console.error('❌ Erro ao criar iniciativa:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao criar iniciativa',
    });
  }
});

/**
 * Rota: PUT /api/okrs/initiatives/:id
 * Atualiza uma iniciativa
 */
app.put('/api/okrs/initiatives/:id', requireAuth, async (req, res) => {
  try {
    const initiativeId = req.params.id;
    const initiative = await updateOKRInitiative(initiativeId, req.body);

    await logAction(req, 'update', 'okr_initiative', initiativeId, `Iniciativa atualizada`);

    res.json({
      success: true,
      data: initiative,
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar iniciativa:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar iniciativa',
    });
  }
});

/**
 * Rota: DELETE /api/okrs/initiatives/:id
 * Deleta uma iniciativa
 */
app.delete('/api/okrs/initiatives/:id', requireAuth, async (req, res) => {
  try {
    const initiativeId = req.params.id;

    await deleteOKRInitiative(initiativeId);

    await logAction(req, 'delete', 'okr_initiative', initiativeId, `Iniciativa deletada`);

    res.json({
      success: true,
      message: 'Iniciativa deletada com sucesso',
    });
  } catch (error) {
    console.error('❌ Erro ao deletar iniciativa:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao deletar iniciativa',
    });
  }
});

/**
 * Rota: GET /api/okrs/initiative-comments/:initiativeId
 * Retorna comentários de uma iniciativa
 */
app.get('/api/okrs/initiative-comments/:initiativeId', requireAuth, async (req, res) => {
  try {
    const initiativeId = req.params.initiativeId;
    const comments = await fetchInitiativeComments(initiativeId);

    res.json({
      success: true,
      data: comments,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar comentários:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar comentários',
    });
  }
});

/**
 * Rota: GET /api/okrs/initiative-comments
 * Retorna comentários de múltiplas iniciativas
 * Query params: initiativeIds (comma-separated)
 */
app.get('/api/okrs/initiative-comments', requireAuth, async (req, res) => {
  try {
    const initiativeIds = req.query.initiativeIds
      ? req.query.initiativeIds.split(',')
      : [];

    const comments = await fetchCommentsForInitiatives(initiativeIds);

    res.json({
      success: true,
      data: comments,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar comentários:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar comentários',
    });
  }
});

/**
 * Rota: POST /api/okrs/initiative-comments
 * Cria um novo comentário em uma iniciativa
 */
app.post('/api/okrs/initiative-comments', requireAuth, async (req, res) => {
  try {
    const commentData = {
      initiative_id: req.body.initiative_id,
      content: req.body.content,
      author_name: req.user.name,
      author_email: req.user.email,
    };

    const comment = await createInitiativeComment(commentData);

    await logAction(req, 'create', 'initiative_comment', comment.id, `Comentário criado na iniciativa`);

    res.json({
      success: true,
      data: comment,
    });
  } catch (error) {
    console.error('❌ Erro ao criar comentário:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao criar comentário',
    });
  }
});

/**
 * Rota: DELETE /api/okrs/initiative-comments/:id
 * Deleta um comentário
 */
app.delete('/api/okrs/initiative-comments/:id', requireAuth, async (req, res) => {
  try {
    const commentId = req.params.id;

    await deleteInitiativeComment(commentId);

    await logAction(req, 'delete', 'initiative_comment', commentId, `Comentário deletado`);

    res.json({
      success: true,
      message: 'Comentário deletado com sucesso',
    });
  } catch (error) {
    console.error('❌ Erro ao deletar comentário:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao deletar comentário',
    });
  }
});

// ============================================
// ACTION PLANS (Planos de Ação das Iniciativas)
// ============================================

/**
 * Rota: GET /api/okrs/initiatives/:id/action-plans
 * Lista planos de ação de uma iniciativa
 */
app.get('/api/okrs/initiatives/:id/action-plans', requireAuth, async (req, res) => {
  try {
    const initiativeId = req.params.id;
    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('initiative_action_plans')
      .select(`
        *,
        responsible:responsible_id(id, name, avatar_url)
      `)
      .eq('initiative_id', initiativeId)
      .order('due_date', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('❌ Erro ao buscar planos de ação:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar planos de ação',
    });
  }
});

/**
 * Rota: GET /api/okrs/action-plans
 * Lista planos de ação de múltiplas iniciativas
 * Query params: initiativeIds (comma-separated)
 */
app.get('/api/okrs/action-plans', requireAuth, async (req, res) => {
  try {
    const initiativeIds = req.query.initiativeIds
      ? req.query.initiativeIds.split(',')
      : [];

    if (initiativeIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('initiative_action_plans')
      .select(`
        *,
        responsible:responsible_id(id, name, avatar_url)
      `)
      .in('initiative_id', initiativeIds)
      .order('due_date', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('❌ Erro ao buscar planos de ação:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar planos de ação',
    });
  }
});

/**
 * Rota: POST /api/okrs/initiatives/:id/action-plans
 * Cria um plano de ação
 */
app.post('/api/okrs/initiatives/:id/action-plans', requireAuth, async (req, res) => {
  try {
    const initiativeId = req.params.id;
    const { title, description, responsible_id, due_date, status } = req.body;

    if (!title || !due_date) {
      return res.status(400).json({
        success: false,
        error: 'Título e data são obrigatórios',
      });
    }

    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('initiative_action_plans')
      .insert({
        initiative_id: initiativeId,
        title,
        description: description || null,
        responsible_id: responsible_id || null,
        due_date,
        status: status || 'pending',
      })
      .select(`
        *,
        responsible:responsible_id(id, name, avatar_url)
      `)
      .single();

    if (error) throw error;

    await logAction(req, 'create', 'action_plan', data.id, `Plano de ação criado: ${title}`);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('❌ Erro ao criar plano de ação:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao criar plano de ação',
    });
  }
});

/**
 * Rota: PUT /api/okrs/action-plans/:id
 * Atualiza um plano de ação
 */
app.put('/api/okrs/action-plans/:id', requireAuth, async (req, res) => {
  try {
    const planId = req.params.id;
    const { title, description, responsible_id, due_date, status } = req.body;

    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('initiative_action_plans')
      .update({
        title,
        description,
        responsible_id: responsible_id || null,
        due_date,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId)
      .select(`
        *,
        responsible:responsible_id(id, name, avatar_url)
      `)
      .single();

    if (error) throw error;

    await logAction(req, 'update', 'action_plan', planId, `Plano de ação atualizado`);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar plano de ação:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar plano de ação',
    });
  }
});

/**
 * Rota: DELETE /api/okrs/action-plans/:id
 * Deleta um plano de ação
 */
app.delete('/api/okrs/action-plans/:id', requireAuth, async (req, res) => {
  try {
    const planId = req.params.id;
    const supabase = getSupabaseServiceClient();

    const { error } = await supabase
      .from('initiative_action_plans')
      .delete()
      .eq('id', planId);

    if (error) throw error;

    await logAction(req, 'delete', 'action_plan', planId, `Plano de ação deletado`);

    res.json({
      success: true,
      message: 'Plano de ação deletado com sucesso',
    });
  } catch (error) {
    console.error('❌ Erro ao deletar plano de ação:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao deletar plano de ação',
    });
  }
});

// ============================================
// DEFINITION OF DONE (DoD) - Critérios de Conclusão
// ============================================

/**
 * Rota: GET /api/okrs/initiatives/:id/dod
 * Lista itens de DoD de uma iniciativa
 */
app.get('/api/okrs/initiatives/:id/dod', requireAuth, async (req, res) => {
  try {
    const initiativeId = req.params.id;
    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('initiative_dod_items')
      .select('*')
      .eq('initiative_id', initiativeId)
      .order('position', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('❌ Erro ao buscar DoD:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar itens de DoD',
    });
  }
});

/**
 * Rota: GET /api/okrs/dod
 * Lista itens de DoD de múltiplas iniciativas
 * Query params: initiativeIds (comma-separated)
 */
app.get('/api/okrs/dod', requireAuth, async (req, res) => {
  try {
    const initiativeIds = req.query.initiativeIds
      ? req.query.initiativeIds.split(',')
      : [];

    if (initiativeIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('initiative_dod_items')
      .select('*')
      .in('initiative_id', initiativeIds)
      .order('position', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('❌ Erro ao buscar DoD:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar itens de DoD',
    });
  }
});

/**
 * Rota: POST /api/okrs/initiatives/:id/dod
 * Cria um item de DoD
 */
app.post('/api/okrs/initiatives/:id/dod', requireAuth, async (req, res) => {
  try {
    const initiativeId = req.params.id;
    const { title, position } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Título é obrigatório',
      });
    }

    const supabase = getSupabaseServiceClient();

    // Se não passou position, pega o próximo
    let finalPosition = position;
    if (finalPosition === undefined) {
      const { data: existing } = await supabase
        .from('initiative_dod_items')
        .select('position')
        .eq('initiative_id', initiativeId)
        .order('position', { ascending: false })
        .limit(1);

      finalPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;
    }

    const { data, error } = await supabase
      .from('initiative_dod_items')
      .insert({
        initiative_id: initiativeId,
        title,
        completed: false,
        position: finalPosition,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    await logAction(req, 'create', 'dod_item', data.id, `Item DoD criado: ${title}`);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('❌ Erro ao criar item DoD:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao criar item de DoD',
    });
  }
});

/**
 * Rota: PUT /api/okrs/dod/:id
 * Atualiza um item de DoD
 */
app.put('/api/okrs/dod/:id', requireAuth, async (req, res) => {
  try {
    const dodId = req.params.id;
    const { title, completed, position } = req.body;

    const supabase = getSupabaseServiceClient();

    const updateData = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = title;
    if (completed !== undefined) updateData.completed = completed;
    if (position !== undefined) updateData.position = position;

    const { data, error } = await supabase
      .from('initiative_dod_items')
      .update(updateData)
      .eq('id', dodId)
      .select()
      .single();

    if (error) throw error;

    await logAction(req, 'update', 'dod_item', dodId, `Item DoD atualizado`);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar item DoD:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar item de DoD',
    });
  }
});

/**
 * Rota: DELETE /api/okrs/dod/:id
 * Deleta um item de DoD
 */
app.delete('/api/okrs/dod/:id', requireAuth, async (req, res) => {
  try {
    const dodId = req.params.id;
    const supabase = getSupabaseServiceClient();

    const { error } = await supabase
      .from('initiative_dod_items')
      .delete()
      .eq('id', dodId);

    if (error) throw error;

    await logAction(req, 'delete', 'dod_item', dodId, `Item DoD deletado`);

    res.json({
      success: true,
      message: 'Item de DoD deletado com sucesso',
    });
  } catch (error) {
    console.error('❌ Erro ao deletar item DoD:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao deletar item de DoD',
    });
  }
});

// ============================================
// ROTAS COM PARÂMETRO :id (devem vir DEPOIS das rotas específicas)
// ============================================

/**
 * Rota: PUT /api/okrs/:id
 * Atualiza um OKR existente
 */
app.put('/api/okrs/:id', requireAuth, async (req, res) => {
  try {
    const okrId = req.params.id;
    const { titulo, nivel, responsavel, responsavel_id, quarter, keyResults, peso } = req.body;

    const okr = await updateOKR(okrId, {
      titulo,
      nivel,
      responsavel,
      responsavel_id,
      quarter,
      keyResults,
      peso,
    });

    await logAction(req, 'update', 'okr', okrId, `OKR atualizado: ${titulo || okrId}`);

    res.json({
      success: true,
      data: okr,
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar OKR:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar OKR',
    });
  }
});

/**
 * Rota: DELETE /api/okrs/:id
 * Deleta um OKR
 */
app.delete('/api/okrs/:id', requireAuth, async (req, res) => {
  try {
    const okrId = req.params.id;

    await deleteOKR(okrId);

    await logAction(req, 'delete', 'okr', okrId, `OKR deletado: ${okrId}`);

    res.json({
      success: true,
      message: 'OKR deletado com sucesso',
    });
  } catch (error) {
    console.error('❌ Erro ao deletar OKR:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao deletar OKR',
    });
  }
});

/**
 * Rota: GET /api/okrs/:id
 * Retorna um OKR específico com seus Key Results
 */
app.get('/api/okrs/:id', requireAuth, async (req, res) => {
  try {
    const okrId = req.params.id;
    const okr = await fetchOKRById(okrId);

    res.json({
      success: true,
      data: okr,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar OKR:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar OKR',
    });
  }
});

/**
 * Rota: GET /api/okrs/sector-weight-sum
 * Retorna a soma dos pesos dos OKRs de um setor para um quarter
 */
app.get('/api/okrs/sector-weight-sum', requireAuth, async (req, res) => {
  try {
    const { setor_id, quarter } = req.query;

    if (!setor_id || !quarter) {
      return res.status(400).json({
        success: false,
        error: 'setor_id e quarter são obrigatórios',
      });
    }

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from('okrs')
      .select('peso')
      .eq('setor_id', setor_id)
      .eq('quarter', quarter);

    if (error) {
      throw new Error(error.message);
    }

    const totalWeight = (data || []).reduce((sum, okr) => sum + (okr.peso || 0), 0);

    res.json({
      success: true,
      data: {
        totalWeight,
        remaining: 100 - totalWeight,
      },
    });
  } catch (error) {
    console.error('❌ Erro ao calcular soma de pesos:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao calcular soma de pesos',
    });
  }
});

/**
 * Rota: POST /api/okrs/:id/key-results
 * Cria um novo Key Result para um OKR
 */
app.post('/api/okrs/:id/key-results', requireAuth, async (req, res) => {
  try {
    const okrId = req.params.id;
    const krData = { ...req.body, okr_id: parseInt(okrId) };

    const kr = await createKeyResult(krData);

    await logAction(req, 'create', 'key_result', kr.id, `KR criado: ${krData.descricao}`);

    res.json({
      success: true,
      data: kr,
    });
  } catch (error) {
    console.error('❌ Erro ao criar Key Result:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao criar Key Result',
    });
  }
});

/**
 * Rota: DELETE /api/okrs/key-results/:id
 * Deleta um Key Result
 */
app.delete('/api/okrs/key-results/:id', requireAuth, async (req, res) => {
  try {
    const krId = req.params.id;
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('key_results')
      .delete()
      .eq('id', krId);

    if (error) throw error;

    await logAction(req, 'delete', 'key_result', krId, 'Key Result excluído');

    res.json({
      success: true,
      message: 'Key Result excluído com sucesso',
    });
  } catch (error) {
    console.error('❌ Erro ao excluir Key Result:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao excluir Key Result',
    });
  }
});

/**
 * Rota: POST /api/okrs/key-results/:id/comments
 * Cria um comentário em um Key Result
 */
app.post('/api/okrs/key-results/:id/comments', requireAuth, async (req, res) => {
  try {
    const krId = req.params.id;
    const { content, categoria = 'Comentário', parent_id = null } = req.body;
    const supabase = getSupabaseServiceClient();

    // Validar categoria
    const categoriasValidas = ['Dúvida', 'Sugestão', 'Comentário'];
    if (!categoriasValidas.includes(categoria)) {
      return res.status(400).json({
        success: false,
        error: 'Categoria inválida. Use: Dúvida, Sugestão ou Comentário',
      });
    }

    const insertData = {
      key_result_id: parseInt(krId),
      author_email: req.user?.email,
      content: content,
      categoria: categoria
    };

    // Adicionar parent_id se for uma resposta (UUID, não precisa parseInt)
    if (parent_id) {
      insertData.parent_id = parent_id;
    }

    const { data, error } = await supabase
      .from('okr_comments')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    const actionDesc = parent_id ? 'Resposta criada' : `Comentário criado (${categoria})`;
    await logAction(req, 'create', 'okr_comment', data.id, actionDesc);

    res.json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error('❌ Erro ao criar comentário:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao criar comentário',
    });
  }
});

/**
 * Rota: GET /api/okrs/key-results/:id/comments
 * Busca comentários de um Key Result
 */
app.get('/api/okrs/key-results/:id/comments', requireAuth, async (req, res) => {
  try {
    const krId = req.params.id;
    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('okr_comments')
      .select('*')
      .eq('key_result_id', parseInt(krId))
      .order('created_at', { ascending: true }); // Ordem cronológica para hierarquia

    if (error) throw error;

    // Busca nomes dos autores
    const emails = [...new Set((data || []).map(c => c.author_email).filter(Boolean))];
    let authorsMap = new Map();

    if (emails.length > 0) {
      const { data: users } = await supabase
        .from('users_otus')
        .select('email, name')
        .in('email', emails);

      if (users) {
        users.forEach(u => authorsMap.set(u.email, u.name));
      }
    }

    // Enriquece comentários com nome do autor
    const enrichedData = (data || []).map(comment => ({
      ...comment,
      author_name: authorsMap.get(comment.author_email) || comment.author_email,
      replies: [] // Placeholder para respostas
    }));

    // Organiza em estrutura hierárquica (comentários pai com respostas aninhadas)
    const commentsMap = new Map();
    const rootComments = [];

    // Primeiro pass: indexar todos os comentários
    enrichedData.forEach(comment => {
      commentsMap.set(comment.id, comment);
    });

    // Segundo pass: organizar hierarquia
    enrichedData.forEach(comment => {
      if (comment.parent_id && commentsMap.has(comment.parent_id)) {
        // É uma resposta - adiciona ao pai
        const parent = commentsMap.get(comment.parent_id);
        parent.replies.push(comment);
      } else {
        // É um comentário raiz
        rootComments.push(comment);
      }
    });

    // Ordena: comentários raiz por data (mais recentes primeiro), respostas por data (cronológica)
    rootComments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    rootComments.forEach(comment => {
      comment.replies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    });

    res.json({
      success: true,
      data: rootComments,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar comentários:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar comentários',
    });
  }
});

/**
 * Rota: GET /api/okrs/key-results/:id/recovery-plans
 * Busca planos de recuperação de um Key Result
 */
app.get('/api/okrs/key-results/:id/recovery-plans', requireAuth, async (req, res) => {
  try {
    const krId = req.params.id;
    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('okr_recovery_plans')
      .select('*')
      .eq('key_result_id', parseInt(krId))
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('❌ Erro ao buscar planos de recuperação:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar planos de recuperação',
    });
  }
});

/**
 * Rota: POST /api/okrs/key-results/:id/recovery-plans
 * Cria um plano de recuperação para um Key Result
 */
app.post('/api/okrs/key-results/:id/recovery-plans', requireAuth, async (req, res) => {
  try {
    const krId = req.params.id;
    const { mes_referencia, ano_referencia, description, actions } = req.body;
    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('okr_recovery_plans')
      .insert({
        key_result_id: parseInt(krId),
        mes_referencia,
        ano_referencia,
        description,
        actions: actions || null,
        status: 'pending',
        created_by: req.user?.email
      })
      .select()
      .single();

    if (error) throw error;

    await logAction(req, 'create', 'okr_recovery_plan', data.id, 'Plano de recuperação criado');

    res.json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error('❌ Erro ao criar plano de recuperação:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao criar plano de recuperação',
    });
  }
});

/**
 * Rota: PUT /api/okrs/recovery-plans/:id
 * Atualiza um plano de recuperação
 */
app.put('/api/okrs/recovery-plans/:id', requireAuth, async (req, res) => {
  try {
    const planId = req.params.id;
    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('okr_recovery_plans')
      .update(req.body)
      .eq('id', planId)
      .select()
      .single();

    if (error) throw error;

    await logAction(req, 'update', 'okr_recovery_plan', planId, 'Plano de recuperação atualizado');

    res.json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar plano de recuperação:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar plano de recuperação',
    });
  }
});

/**
 * Rota: DELETE /api/okrs/recovery-plans/:id
 * Deleta um plano de recuperação
 */
app.delete('/api/okrs/recovery-plans/:id', requireAuth, async (req, res) => {
  try {
    const planId = req.params.id;
    const supabase = getSupabaseServiceClient();

    const { error } = await supabase
      .from('okr_recovery_plans')
      .delete()
      .eq('id', planId);

    if (error) throw error;

    await logAction(req, 'delete', 'okr_recovery_plan', planId, 'Plano de recuperação excluído');

    res.json({
      success: true,
      message: 'Plano de recuperação excluído com sucesso',
    });
  } catch (error) {
    console.error('❌ Erro ao excluir plano de recuperação:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao excluir plano de recuperação',
    });
  }
});

// ============================================
// Indicadores
// ============================================

/**
 * Rota: GET /api/indicadores
 * Retorna todos os indicadores com filtros opcionais
 * Query params: period, category
 */
app.get('/api/indicadores', requireAuth, async (req, res) => {
  try {
    const period = req.query.period || null;
    const category = req.query.category || null;

    const indicadores = await fetchIndicadores(period, category);

    await logAction(req, 'view', 'indicadores', null, 'Lista de Indicadores');

    res.json({
      success: true,
      data: indicadores,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar indicadores:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar indicadores',
    });
  }
});

/**
 * Rota: POST /api/indicadores
 * Cria um novo indicador
 * Body: { nome, valor, meta, unidade, categoria, periodo, tendencia }
 */
app.post('/api/indicadores', requireAuth, async (req, res) => {
  try {
    const { nome, valor, meta, unidade, categoria, periodo, tendencia } = req.body;

    if (!nome || valor === undefined || !meta || !unidade || !categoria) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: nome, valor, meta, unidade, categoria',
      });
    }

    const indicador = await createIndicador({
      nome,
      valor,
      meta,
      unidade,
      categoria,
      periodo: periodo || 'mensal',
      tendencia: tendencia || 'stable',
      created_by: req.user.email,
    });

    await logAction(req, 'create', 'indicador', indicador.id, `Indicador criado: ${nome}`);

    res.json({
      success: true,
      data: indicador,
    });
  } catch (error) {
    console.error('❌ Erro ao criar indicador:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao criar indicador',
    });
  }
});

/**
 * Rota: PUT /api/indicadores/:id
 * Atualiza um indicador existente
 */
app.put('/api/indicadores/:id', requireAuth, async (req, res) => {
  try {
    const indicadorId = req.params.id;
    const updateData = req.body;

    const indicador = await updateIndicador(indicadorId, updateData);

    await logAction(req, 'update', 'indicador', indicadorId, `Indicador atualizado: ${indicadorId}`);

    res.json({
      success: true,
      data: indicador,
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar indicador:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar indicador',
    });
  }
});

/**
 * Rota: DELETE /api/indicadores/:id
 * Deleta um indicador
 */
app.delete('/api/indicadores/:id', requireAuth, async (req, res) => {
  try {
    const indicadorId = req.params.id;

    await deleteIndicador(indicadorId);

    await logAction(req, 'delete', 'indicador', indicadorId, `Indicador deletado: ${indicadorId}`);

    res.json({
      success: true,
      message: 'Indicador deletado com sucesso',
    });
  } catch (error) {
    console.error('❌ Erro ao deletar indicador:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao deletar indicador',
    });
  }
});

// ============================================
// Sistema de Indicadores Individuais (/api/ind/*)
// ============================================

// --- SETORES ---

/**
 * Rota: GET /api/ind/sectors
 * Retorna todos os setores
 */
app.get('/api/ind/sectors', requireAuth, async (req, res) => {
  try {
    const sectors = await fetchSectors();
    res.json({ success: true, data: sectors });
  } catch (error) {
    console.error('❌ Erro ao buscar setores:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/ind/sectors/:id
 * Retorna um setor por ID
 */
app.get('/api/ind/sectors/:id', requireAuth, async (req, res) => {
  try {
    const sector = await getSectorById(req.params.id);
    res.json({ success: true, data: sector });
  } catch (error) {
    console.error('❌ Erro ao buscar setor:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: POST /api/ind/sectors
 * Cria um novo setor (admin)
 */
app.post('/api/ind/sectors', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const { name, description, can_access_projetos, can_access_configuracoes } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
    }

    const sector = await createSector({ name, description, can_access_projetos, can_access_configuracoes });
    await logAction(req, 'create', 'sector', sector.id, `Setor criado: ${name}`);
    res.json({ success: true, data: sector });
  } catch (error) {
    console.error('❌ Erro ao criar setor:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: PUT /api/ind/sectors/:id
 * Atualiza um setor (admin)
 */
app.put('/api/ind/sectors/:id', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const sector = await updateSector(req.params.id, req.body);
    await logAction(req, 'update', 'sector', req.params.id, `Setor atualizado`);
    res.json({ success: true, data: sector });
  } catch (error) {
    console.error('❌ Erro ao atualizar setor:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: PUT /api/ind/sectors/:id/platform-access
 * Toggle acesso à plataforma para um setor (apenas admin/director)
 */
app.put('/api/ind/sectors/:id/platform-access', requireAuth, async (req, res) => {
  try {
    // Apenas admin ou director podem alterar
    if (!['admin', 'director', 'dev'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Apenas administradores podem alterar acesso de setores' });
    }

    const { has_platform_access } = req.body;
    if (typeof has_platform_access !== 'boolean') {
      return res.status(400).json({ success: false, error: 'Campo has_platform_access é obrigatório (boolean)' });
    }

    const sector = await updateSector(req.params.id, { has_platform_access });
    await logAction(req, 'update', 'sector', req.params.id, `Acesso à plataforma: ${has_platform_access ? 'liberado' : 'bloqueado'}`);
    res.json({ success: true, data: sector });
  } catch (error) {
    console.error('❌ Erro ao atualizar acesso do setor:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: DELETE /api/ind/sectors/:id
 * Deleta um setor (admin)
 */
app.delete('/api/ind/sectors/:id', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    await deleteSector(req.params.id);
    await logAction(req, 'delete', 'sector', req.params.id, `Setor deletado`);
    res.json({ success: true, message: 'Setor deletado com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar setor:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/ind/sectors/:id/team
 * Retorna membros da equipe de um setor
 */
app.get('/api/ind/sectors/:id/team', requireAuth, async (req, res) => {
  try {
    const team = await fetchTeam(req.params.id);
    res.json({ success: true, data: team });
  } catch (error) {
    console.error('❌ Erro ao buscar equipe do setor:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- CARGOS ---

/**
 * Rota: GET /api/ind/positions
 * Retorna todos os cargos
 * Query: sector_id (opcional)
 */
app.get('/api/ind/positions', requireAuth, async (req, res) => {
  try {
    const sectorId = req.query.sector_id || null;
    const positions = await fetchPositions(sectorId);
    res.json({ success: true, data: positions });
  } catch (error) {
    console.error('❌ Erro ao buscar cargos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/ind/positions/:id
 * Retorna um cargo por ID
 */
app.get('/api/ind/positions/:id', requireAuth, async (req, res) => {
  try {
    const position = await getPositionById(req.params.id);
    res.json({ success: true, data: position });
  } catch (error) {
    console.error('❌ Erro ao buscar cargo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: POST /api/ind/positions
 * Cria um novo cargo (admin)
 */
app.post('/api/ind/positions', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const { name, description, is_leadership, sector_id } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
    }

    const position = await createPosition({ name, description, is_leadership, sector_id });
    await logAction(req, 'create', 'position', position.id, `Cargo criado: ${name}`);
    res.json({ success: true, data: position });
  } catch (error) {
    console.error('❌ Erro ao criar cargo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: PUT /api/ind/positions/:id
 * Atualiza um cargo (admin)
 */
app.put('/api/ind/positions/:id', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const position = await updatePosition(req.params.id, req.body);
    await logAction(req, 'update', 'position', req.params.id, `Cargo atualizado`);
    res.json({ success: true, data: position });
  } catch (error) {
    console.error('❌ Erro ao atualizar cargo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: DELETE /api/ind/positions/:id
 * Deleta um cargo (admin)
 */
app.delete('/api/ind/positions/:id', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    await deletePosition(req.params.id);
    await logAction(req, 'delete', 'position', req.params.id, `Cargo deletado`);
    res.json({ success: true, message: 'Cargo deletado com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar cargo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- TEMPLATES DE INDICADORES POR CARGO ---

/**
 * Rota: GET /api/ind/positions/:id/indicators
 * Retorna templates de indicadores de um cargo
 */
app.get('/api/ind/positions/:id/indicators', requireAuth, async (req, res) => {
  try {
    const templates = await fetchPositionIndicators(req.params.id);
    res.json({ success: true, data: templates });
  } catch (error) {
    console.error('❌ Erro ao buscar templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: POST /api/ind/positions/:id/indicators
 * Cria um template de indicador para um cargo (admin)
 */
app.post('/api/ind/positions/:id/indicators', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const { title, description, metric_type, consolidation_type, default_initial, default_target,
            default_threshold_80, default_threshold_120, default_weight, is_inverse, monthly_targets } = req.body;

    if (!title || default_target === undefined) {
      return res.status(400).json({ success: false, error: 'Título e meta são obrigatórios' });
    }

    const template = await createPositionIndicator(req.params.id, {
      title, description, metric_type, consolidation_type, default_initial, default_target,
      default_threshold_80, default_threshold_120, default_weight, is_inverse, monthly_targets
    });

    await logAction(req, 'create', 'position_indicator', template.id, `Template criado: ${title}`);
    res.json({ success: true, data: template });
  } catch (error) {
    console.error('❌ Erro ao criar template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: PUT /api/ind/positions/:posId/indicators/:indId
 * Atualiza um template de indicador (admin)
 */
app.put('/api/ind/positions/:posId/indicators/:indId', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const template = await updatePositionIndicator(req.params.indId, req.body);
    await logAction(req, 'update', 'position_indicator', req.params.indId, `Template atualizado`);
    res.json({ success: true, data: template });
  } catch (error) {
    console.error('❌ Erro ao atualizar template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: DELETE /api/ind/positions/:posId/indicators/:indId
 * Deleta um template de indicador (admin)
 */
app.delete('/api/ind/positions/:posId/indicators/:indId', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    await deletePositionIndicator(req.params.indId);
    await logAction(req, 'delete', 'position_indicator', req.params.indId, `Template deletado`);
    res.json({ success: true, message: 'Template deletado com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: POST /api/ind/positions/:id/sync-indicators
 * Sincroniza indicadores do cargo com usuarios que possuem esse cargo
 * Cria indicadores faltantes e atualiza existentes (preservando meses com check-in)
 * Body: { ciclo, ano, leader_id (opcional) }
 */
app.post('/api/ind/positions/:id/sync-indicators', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const { ciclo, ano, leader_id } = req.body;

    if (!ciclo || !ano) {
      return res.status(400).json({ success: false, error: 'Ciclo e ano sao obrigatorios' });
    }

    const result = await syncPositionIndicators(
      req.params.id,
      ciclo,
      parseInt(ano, 10),
      leader_id || null
    );

    await logAction(
      req,
      'sync',
      'position_indicators',
      req.params.id,
      `Sincronizacao: ${result.created} criados, ${result.updated} atualizados`
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ Erro ao sincronizar indicadores:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- INDICADORES INDIVIDUAIS ---

/**
 * Rota: GET /api/ind/indicators
 * Retorna indicadores individuais com filtros
 * Query: person_email, ciclo, ano, setor_id
 */
app.get('/api/ind/indicators', requireAuth, async (req, res) => {
  try {
    const filters = {
      person_email: req.query.person_email || null,
      ciclo: req.query.ciclo || null,
      ano: req.query.ano ? parseInt(req.query.ano, 10) : null,
      setor_id: req.query.setor_id || null,
    };

    // Se não for privilegiado e não passou person_email, usa o email do usuário efetivo
    const effectiveUser = getEffectiveUser(req);
    if (!isPrivileged(effectiveUser) && !filters.person_email) {
      filters.person_email = effectiveUser.email;
    }

    const indicadores = await fetchIndicadoresIndividuais(filters);
    await logAction(req, 'view', 'ind_indicators', null, 'Indicadores Individuais');
    res.json({ success: true, data: indicadores });
  } catch (error) {
    console.error('❌ Erro ao buscar indicadores individuais:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/ind/indicators/my
 * Retorna indicadores do usuário logado
 * Query: ciclo, ano
 */
app.get('/api/ind/indicators/my', requireAuth, async (req, res) => {
  try {
    const filters = {
      person_email: getEffectiveUser(req).email,
      ciclo: req.query.ciclo || null,
      ano: req.query.ano ? parseInt(req.query.ano, 10) : new Date().getFullYear(),
    };

    const indicadores = await fetchIndicadoresIndividuais(filters);

    // Enriquecer com check-ins e recovery plans para o dashboard
    const enriched = await Promise.all(
      indicadores.map(async (ind) => {
        const [checkIns, recoveryPlans] = await Promise.all([
          fetchCheckIns(ind.id),
          fetchRecoveryPlans(ind.id)
        ]);
        return { ...ind, check_ins: checkIns, recovery_plans: recoveryPlans };
      })
    );

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('❌ Erro ao buscar meus indicadores:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/ind/indicators/:id
 * Retorna detalhe de um indicador com check-ins
 */
app.get('/api/ind/indicators/:id', requireAuth, async (req, res) => {
  try {
    const indicador = await getIndicadorById(req.params.id);

    // Verifica permissão: apenas o dono, líder do setor ou admin pode ver
    const effectiveUser = getEffectiveUser(req);
    if (!isPrivileged(effectiveUser) && indicador.person_email !== effectiveUser.email) {
      // TODO: Verificar se é líder do setor
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    res.json({ success: true, data: indicador });
  } catch (error) {
    console.error('❌ Erro ao buscar indicador:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: POST /api/ind/indicators
 * Cria um indicador a partir de um template
 * Body: { template_id, ciclo, ano }
 */
app.post('/api/ind/indicators', requireAuth, async (req, res) => {
  try {
    const { template_id, ciclo, ano } = req.body;

    if (!template_id || !ciclo || !ano) {
      return res.status(400).json({ success: false, error: 'template_id, ciclo e ano são obrigatórios' });
    }

    const indicador = await createIndicadorFromTemplate(template_id, getEffectiveUser(req).email, ciclo, ano);
    await logAction(req, 'create', 'ind_indicator', indicador.id, `Indicador criado: ${indicador.nome}`);
    res.json({ success: true, data: indicador });
  } catch (error) {
    console.error('❌ Erro ao criar indicador:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: PUT /api/ind/indicators/:id
 * Atualiza um indicador individual
 */
app.put('/api/ind/indicators/:id', requireAuth, async (req, res) => {
  try {
    // Busca o indicador para verificar permissão
    const existing = await getIndicadorById(req.params.id);
    const effectiveUser = getEffectiveUser(req);
    if (!isPrivileged(effectiveUser) && existing.person_email !== effectiveUser.email) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const indicador = await updateIndicadorIndividual(req.params.id, req.body);
    await logAction(req, 'update', 'ind_indicator', req.params.id, `Indicador atualizado`);
    res.json({ success: true, data: indicador });
  } catch (error) {
    console.error('❌ Erro ao atualizar indicador:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- CHECK-INS ---

/**
 * Rota: GET /api/ind/indicators/:id/check-ins
 * Retorna check-ins de um indicador
 */
app.get('/api/ind/indicators/:id/check-ins', requireAuth, async (req, res) => {
  try {
    const checkIns = await fetchCheckIns(req.params.id);
    res.json({ success: true, data: checkIns });
  } catch (error) {
    console.error('❌ Erro ao buscar check-ins:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: POST /api/ind/indicators/:id/check-ins
 * Cria um check-in mensal
 * Body: { mes, ano, valor, notas }
 */
app.post('/api/ind/indicators/:id/check-ins', requireAuth, async (req, res) => {
  try {
    const { mes, ano, valor, notas } = req.body;

    if (!mes || !ano || valor === undefined) {
      return res.status(400).json({ success: false, error: 'mes, ano e valor são obrigatórios' });
    }

    // Verifica permissão
    const indicador = await getIndicadorById(req.params.id);
    const effectiveUser = getEffectiveUser(req);
    if (!isPrivileged(effectiveUser) && indicador.person_email !== effectiveUser.email) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const checkIn = await createCheckIn({
      indicador_id: req.params.id,
      mes, ano, valor, notas,
      created_by: req.user.email,
    });

    await logAction(req, 'create', 'check_in', checkIn.id, `Check-in criado para ${indicador.nome}`);
    res.json({ success: true, data: checkIn });
  } catch (error) {
    console.error('❌ Erro ao criar check-in:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: PUT /api/ind/indicators/:id/check-ins/:checkInId
 * Atualiza um check-in
 */
app.put('/api/ind/indicators/:id/check-ins/:checkInId', requireAuth, async (req, res) => {
  try {
    // Verifica permissão
    const indicador = await getIndicadorById(req.params.id);
    const effectiveUser = getEffectiveUser(req);
    if (!isPrivileged(effectiveUser) && indicador.person_email !== effectiveUser.email) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const checkIn = await updateCheckIn(req.params.checkInId, req.body);
    await logAction(req, 'update', 'check_in', req.params.checkInId, `Check-in atualizado`);
    res.json({ success: true, data: checkIn });
  } catch (error) {
    console.error('❌ Erro ao atualizar check-in:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: DELETE /api/ind/check-ins/:checkInId
 * Exclui um check-in
 */
app.delete('/api/ind/check-ins/:checkInId', requireAuth, async (req, res) => {
  try {
    // Busca o check-in para verificar permissão
    const checkIn = await getCheckInById(req.params.checkInId);
    if (!checkIn) {
      return res.status(404).json({ success: false, error: 'Check-in não encontrado' });
    }

    // Busca o indicador para verificar permissão
    const indicador = await getIndicadorById(checkIn.indicador_id);
    const effectiveUser = getEffectiveUser(req);
    if (!isPrivileged(effectiveUser) && indicador.person_email !== effectiveUser.email) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    await deleteCheckIn(req.params.checkInId, checkIn.indicador_id);
    await logAction(req, 'delete', 'check_in', req.params.checkInId, `Check-in excluído`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao excluir check-in:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- PLANOS DE RECUPERAÇÃO ---

/**
 * Rota: GET /api/ind/indicators/:id/recovery-plans
 * Retorna planos de recuperação de um indicador
 */
app.get('/api/ind/indicators/:id/recovery-plans', requireAuth, async (req, res) => {
  try {
    const plans = await fetchRecoveryPlans(req.params.id);
    res.json({ success: true, data: plans });
  } catch (error) {
    console.error('❌ Erro ao buscar planos de recuperação:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: POST /api/ind/indicators/:id/recovery-plans
 * Cria um plano de recuperação
 * Body: { descricao, acoes, prazo, mes_referencia, ano_referencia }
 */
app.post('/api/ind/indicators/:id/recovery-plans', requireAuth, async (req, res) => {
  try {
    const { descricao, acoes, prazo, mes_referencia, ano_referencia } = req.body;

    if (!descricao) {
      return res.status(400).json({ success: false, error: 'Descrição é obrigatória' });
    }

    // Verifica permissão
    const indicador = await getIndicadorById(req.params.id);
    const effectiveUser = getEffectiveUser(req);
    if (!isPrivileged(effectiveUser) && indicador.person_email !== effectiveUser.email) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const plan = await createRecoveryPlan({
      indicador_id: req.params.id,
      descricao, acoes, prazo, mes_referencia, ano_referencia,
      created_by: req.user.email,
    });

    await logAction(req, 'create', 'recovery_plan', plan.id, `Plano de recuperação criado`);
    res.json({ success: true, data: plan });
  } catch (error) {
    console.error('❌ Erro ao criar plano de recuperação:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: PUT /api/ind/indicators/:id/recovery-plans/:planId
 * Atualiza um plano de recuperação
 */
app.put('/api/ind/indicators/:id/recovery-plans/:planId', requireAuth, async (req, res) => {
  try {
    // Verifica permissão
    const indicador = await getIndicadorById(req.params.id);
    const effectiveUser = getEffectiveUser(req);
    if (!isPrivileged(effectiveUser) && indicador.person_email !== effectiveUser.email) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const plan = await updateRecoveryPlan(req.params.planId, req.body);
    await logAction(req, 'update', 'recovery_plan', req.params.planId, `Plano de recuperação atualizado`);
    res.json({ success: true, data: plan });
  } catch (error) {
    console.error('❌ Erro ao atualizar plano de recuperação:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: DELETE /api/ind/indicators/:id/recovery-plans/:planId
 * Exclui um plano de recuperação
 */
app.delete('/api/ind/indicators/:id/recovery-plans/:planId', requireAuth, async (req, res) => {
  try {
    const indicador = await getIndicadorById(req.params.id);
    const effectiveUser = getEffectiveUser(req);
    if (!isPrivileged(effectiveUser) && indicador.person_email !== effectiveUser.email) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    await deleteRecoveryPlan(req.params.planId);
    await logAction(req, 'delete', 'recovery_plan', req.params.planId, `Plano de recuperação excluído`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao excluir plano de recuperação:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- PESSOAS / EQUIPE ---

/**
 * Rota: GET /api/ind/people
 * Retorna pessoas com scores
 * Query: setor_id, ciclo, ano
 */
app.get('/api/ind/people', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(getEffectiveUser(req))) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const filters = {
      setor_id: req.query.setor_id || null,
      ciclo: req.query.ciclo || null,
      ano: req.query.ano ? parseInt(req.query.ano, 10) : new Date().getFullYear(),
    };

    const people = await fetchPeopleWithScores(filters);
    res.json({ success: true, data: people });
  } catch (error) {
    console.error('❌ Erro ao buscar pessoas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/ind/people/:id
 * Retorna detalhe de uma pessoa com indicadores
 * Query: ciclo, ano
 */
app.get('/api/ind/people/:id', requireAuth, async (req, res) => {
  try {
    const filters = {
      ciclo: req.query.ciclo || null,
      ano: req.query.ano ? parseInt(req.query.ano, 10) : new Date().getFullYear(),
    };

    const person = await getPersonById(req.params.id, filters);

    // Verifica permissão: próprio usuário, líder do setor ou admin
    const effectiveUser = getEffectiveUser(req);
    if (!isPrivileged(effectiveUser) && person.email !== effectiveUser.email) {
      // TODO: Verificar se é líder do setor
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    res.json({ success: true, data: person });
  } catch (error) {
    console.error('❌ Erro ao buscar pessoa:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/ind/team
 * Retorna equipe do setor do usuário logado
 * - Líderes veem apenas seus liderados diretos (filtro por leader_id)
 * - Admins/Diretores/Devs veem todos do setor selecionado
 * Query: ciclo, ano, sector_id (privileged only), all (dev only - retorna todos setores)
 */
app.get('/api/ind/team', requireAuth, async (req, res) => {
  try {
    const effectiveUser = getEffectiveUser(req);
    const userEmail = effectiveUser.email;
    const realEmail = getRealEmailForIndicadores(userEmail);
    const userRole = getUserRole(effectiveUser);
    const isFullAccess = userRole === 'admin' || userRole === 'director' || userRole === 'dev';
    const showAll = req.query.all === 'true' && userRole === 'dev';

    // Se dev solicitou todos os indicadores
    if (showAll) {
      const filters = {
        ciclo: req.query.ciclo || null,
        ano: req.query.ano ? parseInt(req.query.ano, 10) : new Date().getFullYear(),
      };
      const pessoas = await fetchPeopleWithScores(filters);
      const { data: sectors } = await getSupabaseClient()
        .from('ind_setores')
        .select('id, name')
        .order('name');
      return res.json({
        success: true,
        data: { pessoas, setor: { name: 'Todos os Setores' }, availableSectors: sectors || [] },
      });
    }

    // Busca informações do usuário atual (para obter ID se for líder)
    const currentUser = await getUserByEmail(realEmail);
    let targetSector = null;
    let leaderId = null;

    // Admin/Director/Dev pode visualizar qualquer setor passando sector_id
    if (req.query.sector_id && isFullAccess) {
      const { data: sectorData } = await getSupabaseClient()
        .from('ind_setores')
        .select('id, name')
        .eq('id', req.query.sector_id)
        .single();
      targetSector = sectorData;
    } else if (currentUser) {
      // Usa o setor do usuário logado
      targetSector = currentUser.setor;

      // Se for líder, filtra pelos liderados
      if (userRole === 'leader' && currentUser.id) {
        leaderId = currentUser.id;
      }
    }

    if (!targetSector) {
      // Para admins/directors/devs sem setor, retorna lista de setores disponíveis
      if (isFullAccess) {
        const { data: sectors } = await getSupabaseClient()
          .from('ind_setores')
          .select('id, name')
          .order('name');
        return res.json({
          success: true,
          data: { pessoas: [], setor: null, availableSectors: sectors || [] },
          message: 'Selecione um setor para visualizar a equipe'
        });
      }
      return res.json({ success: true, data: { pessoas: [], setor: null }, message: 'Usuário não está em nenhum setor' });
    }

    const filters = {
      setor_id: targetSector.id,
      ciclo: req.query.ciclo || null,
      ano: req.query.ano ? parseInt(req.query.ano, 10) : new Date().getFullYear(),
    };

    // Se for líder, adiciona filtro de leader_id
    if (leaderId) {
      filters.leader_id = leaderId;
    }

    const pessoas = await fetchPeopleWithScores(filters);

    // Para admins/directors/devs, também retorna lista de setores disponíveis
    let availableSectors = [];
    if (isFullAccess) {
      const { data: sectors } = await getSupabaseClient()
        .from('ind_setores')
        .select('id, name')
        .order('name');
      availableSectors = sectors || [];
    }

    res.json({
      success: true,
      data: { pessoas, setor: targetSector, availableSectors },
      sector: targetSector
    });
  } catch (error) {
    console.error('❌ Erro ao buscar equipe:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- ADMIN: USUÁRIOS ---

/**
 * Rota: GET /api/ind/admin/users
 * Retorna usuários com informações de setor e cargo
 */
app.get('/api/ind/admin/users', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const users = await fetchUsersWithRoles();
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('❌ Erro ao buscar usuários:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: PUT /api/ind/admin/users/:id/position
 * Atualiza cargo de um usuário
 */
app.put('/api/ind/admin/users/:id/position', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const { position_id } = req.body;
    const user = await updateUserPosition(req.params.id, position_id);
    await logAction(req, 'update', 'user_position', req.params.id, `Cargo do usuário atualizado`);
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('❌ Erro ao atualizar cargo do usuário:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: PUT /api/ind/admin/users/:id/sector
 * Atualiza setor de um usuário
 */
app.put('/api/ind/admin/users/:id/sector', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const { sector_id } = req.body;
    const user = await updateUserSector(req.params.id, sector_id);
    await logAction(req, 'update', 'user_sector', req.params.id, `Setor do usuário atualizado`);
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('❌ Erro ao atualizar setor do usuário:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: PUT /api/ind/admin/users/:id/role
 * Atualiza papel/role de um usuário
 */
app.put('/api/ind/admin/users/:id/role', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const { role } = req.body;
    const validRoles = ['user', 'leader', 'admin', 'director', 'ceo', 'dev'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, error: 'Role inválido' });
    }

    // Buscar usuário alvo para verificar role atual
    const supabase = getSupabaseClient();
    const { data: targetUser } = await supabase
      .from('users_otus')
      .select('role, email')
      .eq('id', req.params.id)
      .single();

    // Somente devs podem atribuir roles dev e ceo
    if ((role === 'dev' || role === 'ceo') && !isDev(req.user)) {
      return res.status(403).json({ success: false, error: 'Somente desenvolvedores podem atribuir o papel Dev ou CEO' });
    }

    // Somente devs podem alterar o role de quem já é dev ou ceo
    if ((targetUser?.role === 'dev' || targetUser?.role === 'ceo') && !isDev(req.user)) {
      return res.status(403).json({ success: false, error: 'Somente desenvolvedores podem alterar o papel de Dev ou CEO' });
    }

    const user = await updateUserRole(req.params.id, role);
    await logAction(req, 'update', 'user_role', req.params.id, `Role do usuário atualizado para ${role}`);
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('❌ Erro ao atualizar role do usuário:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: PUT /api/ind/admin/users/:id/status
 * Ativa/desativa um usuário
 */
app.put('/api/ind/admin/users/:id/status', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const { is_active } = req.body;
    const user = await updateUserStatus(req.params.id, is_active);
    await logAction(req, 'update', 'user_status', req.params.id, `Usuário ${is_active ? 'ativado' : 'desativado'}`);
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('❌ Erro ao atualizar status do usuário:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: PUT /api/ind/admin/users/:id/leader
 * Atualiza líder de um usuário
 */
app.put('/api/ind/admin/users/:id/leader', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const { leader_id } = req.body;
    const user = await updateUserLeader(req.params.id, leader_id);
    await logAction(req, 'update', 'user_leader', req.params.id, `Líder do usuário atualizado`);
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('❌ Erro ao atualizar líder do usuário:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: POST /api/ind/admin/users
 * Cria um novo usuario
 */
app.post('/api/ind/admin/users', requireAuth, async (req, res) => {
  try {
    if (!hasFullAccess(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const { name, email, role, setor_id, position_id, phone } = req.body;

    // Validacoes
    if (!name?.trim()) {
      return res.status(400).json({ success: false, error: 'Nome e obrigatorio' });
    }
    if (!email?.trim()) {
      return res.status(400).json({ success: false, error: 'Email e obrigatorio' });
    }
    if (!email.endsWith('@otusengenharia.com')) {
      return res.status(400).json({ success: false, error: 'Email deve ser @otusengenharia.com' });
    }

    const user = await createUser({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      role: role || 'user',
      setor_id: setor_id || null,
      position_id: position_id || null,
      phone: phone || null,
    });

    await logAction(req, 'create', 'user', user.id, `Usuario ${name} criado`);
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    console.error('❌ Erro ao criar usuario:', error);
    if (error.message.includes('ja cadastrado')) {
      return res.status(409).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- OVERVIEW E HISTÓRICO ---

/**
 * Rota: GET /api/ind/overview
 * Retorna visão geral de todos setores com scores
 * Query: ciclo, ano
 */
app.get('/api/ind/overview', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(getEffectiveUser(req))) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const filters = {
      ciclo: req.query.ciclo || 'anual',
      ano: req.query.ano ? parseInt(req.query.ano, 10) : new Date().getFullYear(),
    };

    console.log('📊 Overview filters:', filters);
    const overview = await fetchSectorsOverview(filters);
    console.log('📊 Overview sectors count:', overview?.sectors?.length || 0);

    await logAction(req, 'view', 'ind_overview', null, 'Visão Geral Indicadores');
    res.json({ success: true, data: overview });
  } catch (error) {
    console.error('❌ Erro ao buscar overview:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/ind/history
 * Retorna histórico para comparação ano-a-ano
 * Query: ciclo
 */
app.get('/api/ind/history', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const filters = {
      ciclo: req.query.ciclo || 'anual',
    };

    const history = await fetchHistoryComparison(filters);
    await logAction(req, 'view', 'ind_history', null, 'Histórico Indicadores');
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('❌ Erro ao buscar histórico:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/ind/my-history
 * Retorna histórico pessoal do usuário para comparação ano-a-ano
 * Query: years (comma-separated), email
 */
app.get('/api/ind/my-history', requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const userEmail = getEffectiveUser(req).email;
    const yearsParam = req.query.years || `${new Date().getFullYear()},${new Date().getFullYear() - 1}`;
    const years = yearsParam.split(',').map(Number);

    // Buscar indicadores do usuário para os anos selecionados
    const { data: indicators, error: indError } = await supabase
      .from('indicadores')
      .select('*')
      .eq('person_email', userEmail)
      .in('ano', years)
      .order('nome');

    if (indError) {
      console.error('Erro ao buscar indicadores:', indError);
      throw new Error(indError.message);
    }

    // Buscar check-ins dos indicadores
    let checkIns = [];
    if (indicators && indicators.length > 0) {
      const indicatorIds = indicators.map(i => i.id);
      const { data: checkInsData, error: checkError } = await supabase
        .from('indicadores_check_ins')
        .select('*')
        .in('indicador_id', indicatorIds);

      if (checkError) {
        console.error('Erro ao buscar check-ins:', checkError);
      } else {
        checkIns = checkInsData || [];
      }
    }

    res.json({
      success: true,
      data: {
        indicators: indicators || [],
        checkIns: checkIns
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar histórico pessoal:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/ind/my-templates
 * Retorna templates de indicadores disponíveis para o cargo do usuário logado
 * Query: position_id (opcional, para dev mode)
 */
app.get('/api/ind/my-templates', requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const effectiveEmail = getEffectiveUser(req).email;
    let positionId = req.query.position_id;

    // Se não foi especificado position_id, busca do usuário
    if (!positionId) {
      const { data: user, error: userError } = await supabase
        .from('users_otus')
        .select('position_id')
        .eq('email', effectiveEmail)
        .single();

      if (!userError && user?.position_id) {
        positionId = user.position_id;
      }
    }

    // Se ainda não tem position_id e é usuário de dev (sem impersonação), usa cargo default
    if (!positionId && !req.session?.impersonating && req.user.email?.endsWith('@otus.dev')) {
      // Mapeamento de email dev para cargo default
      const devPositionMap = {
        'dev-leader@otus.dev': 'Líder de projeto',
        'dev-operacao@otus.dev': 'Analista de coordenação',
        'dev-director@otus.dev': 'Líder de projeto',
        'dev-admin@otus.dev': 'Líder de projeto'
      };

      const positionName = devPositionMap[req.user.email] || 'Líder de projeto';
      const { data: defaultPosition } = await supabase
        .from('positions')
        .select('id')
        .eq('name', positionName)
        .single();

      if (defaultPosition) {
        positionId = defaultPosition.id;
      }
    }

    if (!positionId) {
      return res.json({ success: true, data: [], message: 'Usuário não possui cargo definido' });
    }

    const templates = await fetchPositionIndicators(positionId);
    res.json({ success: true, data: templates });
  } catch (error) {
    console.error('❌ Erro ao buscar templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// BUG REPORTS - REMOVIDO (unificado com feedbacks)
// Use as rotas /api/feedbacks com type='bug'
// =====================================================

// ============================================
// Workspace Management (Gestão de Tarefas)
// Usa a tabela sectors existente como "workspaces"
// Para listar setores, usar /api/ind/sectors
// ============================================

// --- WORKSPACE PROJECTS (usa sector_id) ---

/**
 * GET /api/workspace-projects
 * Retorna projetos (opcionalmente filtrado por setor)
 */
app.get('/api/workspace-projects', requireAuth, async (req, res) => {
  try {
    const { sector_id } = req.query;
    const projects = await fetchWorkspaceProjects(sector_id);
    res.json({ success: true, data: projects });
  } catch (error) {
    console.error('❌ Erro ao buscar projetos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/workspace-projects/:id
 * Retorna um projeto por ID
 */
app.get('/api/workspace-projects/:id', requireAuth, async (req, res) => {
  try {
    const project = await getWorkspaceProjectById(req.params.id);
    res.json({ success: true, data: project });
  } catch (error) {
    console.error('❌ Erro ao buscar projeto:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/workspace-projects
 * Cria um novo projeto (admin only)
 */
app.post('/api/workspace-projects', requireAuth, async (req, res) => {
  try {
    if (!hasFullAccess(req.user)) {
      return res.status(403).json({ success: false, error: 'Apenas admins podem criar projetos' });
    }

    const { sector_id, name, description, color, start_date, due_date } = req.body;
    if (!sector_id || !name) {
      return res.status(400).json({ success: false, error: 'sector_id e name são obrigatórios' });
    }

    const project = await createWorkspaceProject({
      sector_id,
      name,
      description,
      color,
      start_date,
      due_date,
      created_by: req.user.id
    });

    await logAction(req, 'create', 'workspace_project', project.id, `Projeto criado: ${name}`);
    res.status(201).json({ success: true, data: project });
  } catch (error) {
    console.error('❌ Erro ao criar projeto:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/workspace-projects/:id
 * Atualiza um projeto (admin only)
 */
app.put('/api/workspace-projects/:id', requireAuth, async (req, res) => {
  try {
    if (!hasFullAccess(req.user)) {
      return res.status(403).json({ success: false, error: 'Apenas admins podem editar projetos' });
    }

    const project = await updateWorkspaceProject(req.params.id, req.body);
    await logAction(req, 'update', 'workspace_project', req.params.id, `Projeto atualizado: ${project.name}`);
    res.json({ success: true, data: project });
  } catch (error) {
    console.error('❌ Erro ao atualizar projeto:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/workspace-projects/:id
 * Deleta um projeto (admin only)
 */
app.delete('/api/workspace-projects/:id', requireAuth, async (req, res) => {
  try {
    if (!hasFullAccess(req.user)) {
      return res.status(403).json({ success: false, error: 'Apenas admins podem deletar projetos' });
    }

    await deleteWorkspaceProject(req.params.id);
    await logAction(req, 'delete', 'workspace_project', req.params.id, 'Projeto deletado');
    res.json({ success: true, message: 'Projeto deletado com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar projeto:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- WORKSPACE TASKS ---

/**
 * GET /api/workspace-tasks
 * Retorna tarefas com filtros
 */
app.get('/api/workspace-tasks', requireAuth, async (req, res) => {
  try {
    const { project_id, status, assignee_id, priority } = req.query;
    const tasks = await fetchWorkspaceTasks({ project_id, status, assignee_id, priority });
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('❌ Erro ao buscar tarefas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/workspace-tasks/:id
 * Retorna uma tarefa por ID
 */
app.get('/api/workspace-tasks/:id', requireAuth, async (req, res) => {
  try {
    const task = await getWorkspaceTaskById(req.params.id);
    res.json({ success: true, data: task });
  } catch (error) {
    console.error('❌ Erro ao buscar tarefa:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/workspace-tasks
 * Cria uma nova tarefa
 */
app.post('/api/workspace-tasks', requireAuth, async (req, res) => {
  try {
    const { project_id, title, description, status, priority, start_date, due_date, assignee_id, parent_task_id, tags } = req.body;
    if (!project_id || !title) {
      return res.status(400).json({ success: false, error: 'project_id e title são obrigatórios' });
    }

    const task = await createWorkspaceTask({
      project_id,
      parent_task_id,
      title,
      description,
      status,
      priority,
      start_date,
      due_date,
      assignee_id,
      tags,
      created_by: req.user.id
    });

    await logAction(req, 'create', 'workspace_task', task.id, `Tarefa criada: ${title}`);
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    console.error('❌ Erro ao criar tarefa:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/workspace-tasks/:id
 * Atualiza uma tarefa
 */
app.put('/api/workspace-tasks/:id', requireAuth, async (req, res) => {
  try {
    const task = await updateWorkspaceTask(req.params.id, req.body);
    await logAction(req, 'update', 'workspace_task', req.params.id, `Tarefa atualizada: ${task.title}`);
    res.json({ success: true, data: task });
  } catch (error) {
    console.error('❌ Erro ao atualizar tarefa:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/workspace-tasks/:id
 * Deleta uma tarefa
 */
app.delete('/api/workspace-tasks/:id', requireAuth, async (req, res) => {
  try {
    await deleteWorkspaceTask(req.params.id);
    await logAction(req, 'delete', 'workspace_task', req.params.id, 'Tarefa deletada');
    res.json({ success: true, message: 'Tarefa deletada com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar tarefa:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/workspace-tasks/reorder
 * Reordena tarefas no kanban
 */
app.post('/api/workspace-tasks/reorder', requireAuth, async (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      return res.status(400).json({ success: false, error: 'updates deve ser um array' });
    }

    await reorderWorkspaceTasks(updates);
    res.json({ success: true, message: 'Tarefas reordenadas com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao reordenar tarefas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- PROJECT MEMBERS ---

/**
 * GET /api/workspace-projects/:id/members
 * Retorna membros de um projeto
 */
app.get('/api/workspace-projects/:id/members', requireAuth, async (req, res) => {
  try {
    const members = await fetchProjectMembers(req.params.id);
    res.json({ success: true, data: members });
  } catch (error) {
    console.error('❌ Erro ao buscar membros:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/workspace-projects/:id/members
 * Adiciona um membro ao projeto (admin only)
 */
app.post('/api/workspace-projects/:id/members', requireAuth, async (req, res) => {
  try {
    if (!hasFullAccess(req.user)) {
      return res.status(403).json({ success: false, error: 'Apenas admins podem adicionar membros' });
    }

    const { user_id, role } = req.body;
    if (!user_id) {
      return res.status(400).json({ success: false, error: 'user_id é obrigatório' });
    }

    const member = await addProjectMember({
      project_id: req.params.id,
      user_id,
      role,
      invited_by: req.user.id
    });

    await logAction(req, 'create', 'project_member', member.id, `Membro adicionado ao projeto`);
    res.status(201).json({ success: true, data: member });
  } catch (error) {
    console.error('❌ Erro ao adicionar membro:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/project-members/:id
 * Atualiza role de um membro (admin only)
 */
app.put('/api/project-members/:id', requireAuth, async (req, res) => {
  try {
    if (!hasFullAccess(req.user)) {
      return res.status(403).json({ success: false, error: 'Apenas admins podem editar membros' });
    }

    const { role } = req.body;
    const member = await updateProjectMemberRole(req.params.id, role);
    await logAction(req, 'update', 'project_member', req.params.id, `Role do membro atualizado`);
    res.json({ success: true, data: member });
  } catch (error) {
    console.error('❌ Erro ao atualizar membro:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/project-members/:id
 * Remove um membro do projeto (admin only)
 */
app.delete('/api/project-members/:id', requireAuth, async (req, res) => {
  try {
    if (!hasFullAccess(req.user)) {
      return res.status(403).json({ success: false, error: 'Apenas admins podem remover membros' });
    }

    await removeProjectMember(req.params.id);
    await logAction(req, 'delete', 'project_member', req.params.id, 'Membro removido do projeto');
    res.json({ success: true, message: 'Membro removido com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao remover membro:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- PROJECT MESSAGES (Chat) ---

/**
 * GET /api/workspace-projects/:id/messages
 * Retorna mensagens de um projeto
 */
app.get('/api/workspace-projects/:id/messages', requireAuth, async (req, res) => {
  try {
    const { limit, offset } = req.query;
    const messages = await fetchProjectMessages(req.params.id, {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });
    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('❌ Erro ao buscar mensagens:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/workspace-projects/:id/messages
 * Cria uma nova mensagem no projeto
 */
app.post('/api/workspace-projects/:id/messages', requireAuth, async (req, res) => {
  try {
    const { content, reply_to_id, attachments } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, error: 'content é obrigatório' });
    }

    const message = await createProjectMessage({
      project_id: req.params.id,
      user_id: req.user.id,
      content,
      reply_to_id,
      attachments
    });

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    console.error('❌ Erro ao criar mensagem:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/project-messages/:id
 * Deleta uma mensagem
 */
app.delete('/api/project-messages/:id', requireAuth, async (req, res) => {
  try {
    await deleteProjectMessage(req.params.id);
    res.json({ success: true, message: 'Mensagem deletada com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar mensagem:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Home Modules - Configuração dos módulos da Home
// ============================================

/**
 * GET /api/home-modules
 * Retorna todos os módulos da Home (para montar a tela inicial)
 */
app.get('/api/home-modules', requireAuth, async (req, res) => {
  try {
    const modules = await fetchHomeModules();
    res.json({ success: true, data: modules });
  } catch (error) {
    console.error('❌ Erro ao buscar módulos da Home:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/home-modules/:id
 * Atualiza um módulo (dev only)
 */
app.put('/api/admin/home-modules/:id', requireAuth, async (req, res) => {
  try {
    if (!isDev(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Apenas desenvolvedores podem atualizar módulos',
      });
    }

    const { id } = req.params;
    const { name, description, path, color, visible, access_type, sort_order } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (path !== undefined) updateData.path = path;
    if (color !== undefined) updateData.color = color;
    if (visible !== undefined) updateData.visible = visible;
    if (access_type !== undefined) updateData.access_type = access_type;
    if (sort_order !== undefined) updateData.sort_order = sort_order;

    const module = await updateHomeModule(id, updateData);

    await createLog({
      user_email: req.user.email,
      user_name: req.user.displayName || req.user.email,
      action: 'update',
      entity_type: 'home_module',
      entity_id: id,
      details: `Módulo atualizado: ${module.name}`,
      metadata: updateData,
    });

    res.json({ success: true, data: module });
  } catch (error) {
    console.error('❌ Erro ao atualizar módulo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/home-modules
 * Cria um novo módulo (dev only)
 */
app.post('/api/admin/home-modules', requireAuth, async (req, res) => {
  try {
    if (!isDev(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Apenas desenvolvedores podem criar módulos',
      });
    }

    const { id, name, description, icon_name, path, color, visible, access_type, sort_order } = req.body;

    if (!id || !name || !icon_name || !path) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: id, name, icon_name, path',
      });
    }

    const module = await createHomeModule({
      id,
      name,
      description: description || null,
      icon_name,
      path,
      color: color || '#4285F4',
      visible: visible !== false,
      access_type: access_type || 'all',
      sort_order: sort_order || 0,
    });

    await createLog({
      user_email: req.user.email,
      user_name: req.user.displayName || req.user.email,
      action: 'create',
      entity_type: 'home_module',
      entity_id: module.id,
      details: `Módulo criado: ${module.name}`,
    });

    res.json({ success: true, data: module });
  } catch (error) {
    console.error('❌ Erro ao criar módulo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/home-modules/:id
 * Remove um módulo (dev only)
 */
app.delete('/api/admin/home-modules/:id', requireAuth, async (req, res) => {
  try {
    if (!isDev(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Apenas desenvolvedores podem remover módulos',
      });
    }

    const { id } = req.params;
    await deleteHomeModule(id);

    await createLog({
      user_email: req.user.email,
      user_name: req.user.displayName || req.user.email,
      action: 'delete',
      entity_type: 'home_module',
      entity_id: id,
      details: `Módulo removido: ${id}`,
    });

    res.json({ success: true, message: 'Módulo removido com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao remover módulo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// UNIFIED MODULES SYSTEM - Sistema unificado de permissões
// ============================================

/**
 * GET /api/modules
 * Retorna módulos que o usuário pode acessar
 */
app.get('/api/modules', requireAuth, async (req, res) => {
  try {
    const effectiveUser = getEffectiveUser(req);
    const userRole = effectiveUser.role || getUserRole(effectiveUser) || 'user';
    const accessLevel = getUserAccessLevel(userRole);
    // Buscar setor do usuário para filtro por setor
    const userOtus = await getUserOtusByEmail(effectiveUser.email);
    const sectorId = userOtus?.setor_id || null;
    const modules = await fetchModulesForUser(effectiveUser.email, accessLevel, sectorId);
    res.json({ success: true, data: modules });
  } catch (error) {
    console.error('❌ Erro ao buscar módulos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/modules/home
 * Retorna módulos para exibir na Home
 */
/**
 * GET /api/user/accessible-areas
 * Retorna as áreas (módulos agrupados) que o usuário pode acessar
 * Baseado em: role, setor e overrides configurados em Permissões
 */
app.get('/api/user/accessible-areas', requireAuth, async (req, res) => {
  try {
    const effectiveUser = getEffectiveUser(req);
    const userRole = effectiveUser.role || getUserRole(effectiveUser) || 'user';
    const accessLevel = getUserAccessLevel(userRole);
    const userOtus = await getUserOtusByEmail(effectiveUser.email);
    const sectorId = userOtus?.setor_id || null;
    console.log('[accessible-areas] effectiveUser:', effectiveUser.email, 'role:', userRole, 'level:', accessLevel, 'sector:', sectorId);

    const modules = await fetchModulesForUser(effectiveUser.email, accessLevel, sectorId);
    // Extrair áreas únicas dos módulos acessíveis
    const areas = [...new Set(modules.map(m => m.area).filter(Boolean))];

    console.log('[accessible-areas] areas:', areas.join(', '));

    res.json({ success: true, areas });
  } catch (error) {
    console.error('❌ Erro ao buscar áreas acessíveis:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/modules/home', requireAuth, async (req, res) => {
  try {
    const effectiveUser = getEffectiveUser(req);
    const userRole = effectiveUser.role || getUserRole(effectiveUser) || 'user';
    const accessLevel = getUserAccessLevel(userRole);
    // Buscar setor do usuário para filtro por setor
    const userOtus = await getUserOtusByEmail(effectiveUser.email);
    const sectorId = userOtus?.setor_id || null;
    console.log('[modules/home] effectiveUser:', effectiveUser.email, 'role:', userRole, 'level:', accessLevel, 'sector:', sectorId);

    const modules = await fetchHomeModulesForUser(effectiveUser.email, accessLevel, sectorId);

    console.log('[modules/home] modules returned:', modules.map(m => `${m.name}(${m.area})`).join(', '));

    res.json({ success: true, data: modules });
  } catch (error) {
    console.error('❌ Erro ao buscar módulos da home:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/modules
 * Retorna todos os módulos (admin/privilegiado)
 */
app.get('/api/admin/modules', requireAuth, async (req, res) => {
  try {
    if (!hasFullAccess(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
      });
    }
    const modules = await fetchAllModules();
    res.json({ success: true, data: modules });
  } catch (error) {
    console.error('❌ Erro ao buscar todos os módulos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/modules/access-matrix
 * Retorna matriz de acesso (módulos vs níveis)
 */
app.get('/api/admin/modules/access-matrix', requireAuth, async (req, res) => {
  try {
    if (!hasFullAccess(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
      });
    }
    const matrix = await getAccessMatrix();
    res.json({ success: true, data: matrix });
  } catch (error) {
    console.error('❌ Erro ao buscar matriz de acesso:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/modules/:id
 * Atualiza um módulo (admin/privilegiado)
 */
app.put('/api/admin/modules/:id', requireAuth, async (req, res) => {
  try {
    if (!hasFullAccess(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
      });
    }

    const { id } = req.params;
    const { name, description, path, icon_name, color, visible, show_on_home, min_access_level, sort_order, area } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (path !== undefined) updateData.path = path;
    if (icon_name !== undefined) updateData.icon_name = icon_name;
    if (color !== undefined) updateData.color = color;
    if (visible !== undefined) updateData.visible = visible;
    if (show_on_home !== undefined) updateData.show_on_home = show_on_home;
    if (min_access_level !== undefined) updateData.min_access_level = min_access_level;
    if (sort_order !== undefined) updateData.sort_order = sort_order;
    if (area !== undefined) updateData.area = area;

    const module = await updateModuleUnified(id, updateData);

    await createLog({
      user_email: req.user.email,
      user_name: req.user.displayName || req.user.email,
      action: 'update',
      entity_type: 'module',
      entity_id: id,
      details: `Módulo atualizado: ${module.name}`,
      metadata: updateData,
    });

    res.json({ success: true, data: module });
  } catch (error) {
    console.error('❌ Erro ao atualizar módulo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/modules
 * Cria um novo módulo (dev only)
 */
app.post('/api/admin/modules', requireAuth, async (req, res) => {
  try {
    if (!isDev(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Apenas desenvolvedores podem criar módulos',
      });
    }

    const { id, name, description, icon_name, path, color, visible, show_on_home, min_access_level, sort_order, area } = req.body;

    if (!id || !name || !path || !area) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: id, name, path, area',
      });
    }

    const module = await createModuleUnified({
      id,
      name,
      description: description || null,
      icon_name: icon_name || null,
      path,
      color: color || '#4285F4',
      visible: visible !== false,
      show_on_home: show_on_home || false,
      min_access_level: min_access_level || 5,
      sort_order: sort_order || 0,
      area,
    });

    await createLog({
      user_email: req.user.email,
      user_name: req.user.displayName || req.user.email,
      action: 'create',
      entity_type: 'module',
      entity_id: module.id,
      details: `Módulo criado: ${module.name}`,
    });

    res.json({ success: true, data: module });
  } catch (error) {
    console.error('❌ Erro ao criar módulo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/modules/:id
 * Remove um módulo (dev only)
 */
app.delete('/api/admin/modules/:id', requireAuth, async (req, res) => {
  try {
    if (!isDev(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Apenas desenvolvedores podem remover módulos',
      });
    }

    const { id } = req.params;
    await deleteModuleUnified(id);

    await createLog({
      user_email: req.user.email,
      user_name: req.user.displayName || req.user.email,
      action: 'delete',
      entity_type: 'module',
      entity_id: id,
      details: `Módulo removido: ${id}`,
    });

    res.json({ success: true, message: 'Módulo removido com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao remover módulo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/module-overrides
 * Lista todas as exceções de módulos
 */
app.get('/api/admin/module-overrides', requireAuth, async (req, res) => {
  try {
    if (!hasFullAccess(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
      });
    }
    const overrides = await fetchModuleOverrides();
    res.json({ success: true, data: overrides });
  } catch (error) {
    console.error('❌ Erro ao buscar overrides:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/module-overrides
 * Cria uma exceção de módulo
 */
app.post('/api/admin/module-overrides', requireAuth, async (req, res) => {
  try {
    if (!hasFullAccess(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
      });
    }

    const { module_id, user_email, position_id, sector_id, grant_access } = req.body;

    if (!module_id || grant_access === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: module_id, grant_access',
      });
    }

    if (!user_email && !position_id && !sector_id) {
      return res.status(400).json({
        success: false,
        error: 'É necessário informar user_email, position_id ou sector_id',
      });
    }

    const override = await createModuleOverride({
      module_id,
      user_email: user_email || null,
      position_id: position_id || null,
      sector_id: sector_id || null,
      grant_access,
      created_by: req.user.email,
    });

    await createLog({
      user_email: req.user.email,
      user_name: req.user.displayName || req.user.email,
      action: 'create',
      entity_type: 'module_override',
      entity_id: override.id,
      details: `Override criado para módulo ${module_id}`,
      metadata: { module_id, user_email, position_id, sector_id, grant_access },
    });

    res.json({ success: true, data: override });
  } catch (error) {
    console.error('❌ Erro ao criar override:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/module-overrides/:id
 * Remove uma exceção de módulo
 */
app.delete('/api/admin/module-overrides/:id', requireAuth, async (req, res) => {
  try {
    if (!hasFullAccess(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
      });
    }

    const { id } = req.params;
    await deleteModuleOverride(id);

    await createLog({
      user_email: req.user.email,
      user_name: req.user.displayName || req.user.email,
      action: 'delete',
      entity_type: 'module_override',
      entity_id: id,
      details: `Override removido: ${id}`,
    });

    res.json({ success: true, message: 'Override removido com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao remover override:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ROTAS - EQUIPE DO PROJETO
// ============================================

/**
 * Rota: GET /api/projetos/equipe
 * Retorna a equipe/disciplinas de um projeto
 */
app.get('/api/projetos/equipe', requireAuth, async (req, res) => {
  try {
    const projectId = req.query.projectId;
    if (!projectId) {
      return res.status(400).json({ success: false, error: 'projectId é obrigatório' });
    }

    const data = await fetchProjectDisciplines(projectId);
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error('❌ Erro ao buscar equipe do projeto:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/projetos/equipe/disciplinas
 * Retorna todas as disciplinas padrão disponíveis
 */
app.get('/api/projetos/equipe/disciplinas', requireAuth, async (req, res) => {
  try {
    const data = await fetchStandardDisciplines();
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error('❌ Erro ao buscar disciplinas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/projetos/equipe/empresas
 * Retorna todas as empresas disponíveis
 */
app.get('/api/projetos/equipe/empresas', requireAuth, async (req, res) => {
  try {
    const data = await fetchCompanies();
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error('❌ Erro ao buscar empresas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/projetos/equipe/contatos
 * Retorna todos os contatos disponíveis
 */
app.get('/api/projetos/equipe/contatos', requireAuth, async (req, res) => {
  try {
    const data = await fetchContacts();
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error('❌ Erro ao buscar contatos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/projetos/equipe/disciplinas-cruzadas
 * Análise cruzada de disciplinas entre Smartsheet, ConstruFlow e Otus
 */
app.get('/api/projetos/equipe/disciplinas-cruzadas', requireAuth, async (req, res) => {
  try {
    const { construflowId, smartsheetId, projectName } = req.query;
    if (!construflowId) {
      return res.status(400).json({ success: false, error: 'construflowId é obrigatório' });
    }

    // 1. Busca disciplinas externas (Smartsheet + ConstruFlow)
    const external = await queryDisciplinesCrossReference(construflowId, smartsheetId || null, projectName || null);

    // 2. Busca disciplinas da Otus (Supabase)
    const otusTeam = await fetchProjectDisciplines(construflowId);
    const otusNames = otusTeam.map(d => d.discipline?.discipline_name).filter(Boolean);

    // 3. Busca mapeamentos personalizados do projeto
    const projId = await getProjectIdByConstruflow(construflowId);
    const customMappings = projId ? await fetchDisciplineMappings(projId) : [];

    // 4. Classifica usando helper compartilhado
    const { groups, analysis } = classifyDisciplines(external.smartsheet, external.construflow, otusNames, customMappings);

    res.json({
      success: true,
      data: {
        smartsheet: external.smartsheet,
        construflow: external.construflow,
        otus: otusNames,
        customMappings: customMappings.map(m => ({
          id: m.id,
          externalSource: m.external_source,
          externalName: m.external_discipline_name,
          standardDisciplineId: m.standard_discipline_id,
          standardDisciplineName: m.standard_discipline?.discipline_name
        })),
        groups,
        analysis
      }
    });
  } catch (error) {
    console.error('❌ Erro na análise cruzada de disciplinas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// MAPEAMENTOS PERSONALIZADOS DE DISCIPLINAS
// ============================================

/**
 * Rota: GET /api/projetos/equipe/mapeamentos-disciplinas
 * Lista mapeamentos personalizados de um projeto
 */
app.get('/api/projetos/equipe/mapeamentos-disciplinas', requireAuth, async (req, res) => {
  try {
    const { construflowId } = req.query;
    if (!construflowId) {
      return res.status(400).json({ success: false, error: 'construflowId é obrigatório' });
    }
    const projectId = await getProjectIdByConstruflow(construflowId);
    if (!projectId) {
      return res.json({ success: true, data: [] });
    }
    const data = await fetchDisciplineMappings(projectId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Erro ao buscar mapeamentos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: POST /api/projetos/equipe/mapeamentos-disciplinas
 * Cria ou atualiza um mapeamento personalizado
 */
app.post('/api/projetos/equipe/mapeamentos-disciplinas', requireAuth, async (req, res) => {
  try {
    const { construflowId, externalSource, externalDisciplineName, standardDisciplineId } = req.body;
    if (!construflowId || !externalSource || !externalDisciplineName || !standardDisciplineId) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: construflowId, externalSource, externalDisciplineName, standardDisciplineId'
      });
    }
    const projectId = await getProjectIdByConstruflow(construflowId);
    if (!projectId) {
      return res.status(404).json({ success: false, error: 'Projeto não encontrado' });
    }
    const data = await createOrUpdateDisciplineMapping({
      projectId,
      externalSource,
      externalDisciplineName,
      standardDisciplineId,
      createdBy: req.user?.email || 'unknown'
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Erro ao salvar mapeamento:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: DELETE /api/projetos/equipe/mapeamentos-disciplinas/:id
 * Remove um mapeamento personalizado
 */
app.delete('/api/projetos/equipe/mapeamentos-disciplinas/:id', requireAuth, async (req, res) => {
  try {
    await deleteDisciplineMapping(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar mapeamento:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: POST /api/projetos/equipe
 * Adiciona uma disciplina/equipe a um projeto
 */
app.post('/api/projetos/equipe', requireAuth, async (req, res) => {
  try {
    const { construflow_id, discipline_id, company_id, contact_id, discipline_detail } = req.body;

    if (!construflow_id || !discipline_id) {
      return res.status(400).json({
        success: false,
        error: 'construflow_id e discipline_id são obrigatórios'
      });
    }

    const projectId = await getProjectIdByConstruflow(construflow_id);
    if (!projectId) {
      return res.status(404).json({
        success: false,
        error: 'Projeto não encontrado no Supabase'
      });
    }

    const data = await createProjectDiscipline({
      project_id: projectId,
      discipline_id,
      company_id,
      contact_id,
      discipline_detail
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Erro ao adicionar equipe:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: PUT /api/projetos/equipe/:id
 * Atualiza uma disciplina/equipe de um projeto
 */
app.put('/api/projetos/equipe/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { discipline_id, company_id, contact_id, discipline_detail } = req.body;

    if (!discipline_id) {
      return res.status(400).json({
        success: false,
        error: 'discipline_id é obrigatório'
      });
    }

    const data = await updateProjectDiscipline(id, {
      discipline_id,
      company_id,
      contact_id,
      discipline_detail
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Erro ao atualizar equipe:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: DELETE /api/projetos/equipe/:id
 * Remove uma disciplina/equipe de um projeto
 */
app.delete('/api/projetos/equipe/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await deleteProjectDiscipline(id);
    res.json({ success: true, message: 'Equipe removida com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao remover equipe:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// ROTAS: VISTA DE CONTATOS
// ==========================================

/**
 * Rota: GET /api/contatos/agregado
 * Retorna dados agregados de disciplina/empresa com contagem de projetos
 */
app.get('/api/contatos/agregado', requireAuth, async (req, res) => {
  try {
    const { discipline_id, company_id, project_id } = req.query;
    const filters = {};

    if (discipline_id) filters.discipline_id = discipline_id;
    if (company_id) filters.company_id = company_id;
    if (project_id) filters.project_id = project_id;

    const data = await fetchDisciplineCompanyAggregation(filters);
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Erro ao buscar dados agregados de contatos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/contatos/detalhes
 * Retorna detalhes de contatos e projetos para uma combinação disciplina/empresa
 */
app.get('/api/contatos/detalhes', requireAuth, async (req, res) => {
  try {
    const { discipline_id, company_id } = req.query;

    if (!discipline_id || !company_id) {
      return res.status(400).json({
        success: false,
        error: 'discipline_id e company_id são obrigatórios'
      });
    }

    const data = await fetchDisciplineCompanyDetails(discipline_id, company_id);
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Erro ao buscar detalhes de contatos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/contatos/filtros/disciplinas
 * Retorna lista de todas as disciplinas para o filtro
 */
app.get('/api/contatos/filtros/disciplinas', requireAuth, async (req, res) => {
  try {
    const data = await fetchAllDisciplines();
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Erro ao buscar disciplinas para filtro:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/contatos/filtros/empresas
 * Retorna lista de todas as empresas para o filtro
 */
app.get('/api/contatos/filtros/empresas', requireAuth, async (req, res) => {
  try {
    const data = await fetchAllCompanies();
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Erro ao buscar empresas para filtro:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rota: GET /api/contatos/filtros/projetos
 * Retorna lista de todos os projetos para o filtro
 */
app.get('/api/contatos/filtros/projetos', requireAuth, async (req, res) => {
  try {
    const data = await fetchAllProjects();
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Erro ao buscar projetos para filtro:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== WHITEBOARD ====================

/**
 * GET /api/whiteboard
 * Busca o quadro compartilhado
 */
app.get('/api/whiteboard', requireAuth, async (req, res) => {
  try {
    const data = await fetchWhiteboard();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/whiteboard
 * Salva o quadro compartilhado (limite de 10MB para desenhos grandes)
 */
app.put('/api/whiteboard', requireAuth, express.json({ limit: '10mb' }), async (req, res) => {
  try {
    const { elements, appState, files } = req.body;
    const data = await saveWhiteboard(elements, appState, files, req.user.email);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/whiteboard/:boardId
 * Busca um quadro específico por ID
 */
app.get('/api/whiteboard/:boardId', requireAuth, async (req, res) => {
  try {
    const { boardId } = req.params;
    const data = await fetchWhiteboard(boardId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/whiteboard/:boardId
 * Salva um quadro específico por ID (limite de 10MB)
 */
app.put('/api/whiteboard/:boardId', requireAuth, express.json({ limit: '10mb' }), async (req, res) => {
  try {
    const { boardId } = req.params;
    const { elements, appState, files } = req.body;
    const data = await saveWhiteboard(elements, appState, files, req.user.email, boardId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Inicia o servidor
const HOST = process.env.HOST || '0.0.0.0'; // Aceita conexões de qualquer IP
app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📍 Local: ${FRONTEND_URL}/api/health`);
  console.log(`🔍 Schema da tabela: ${FRONTEND_URL}/api/schema`);
  console.log(`📊 Portfolio API: ${FRONTEND_URL}/api/portfolio`);
  console.log(`📈 Curva S API: ${FRONTEND_URL}/api/curva-s`);
  if (hasPublic) {
    console.log(`\n📦 Frontend servido em ${FRONTEND_URL}`);
  } else {
    console.log(`\n⚠️ Pasta public não encontrada em ${publicDir}`);
    console.log(`   Acesse /api/health para checar o backend. Frontend não disponível.`);
  }
});
