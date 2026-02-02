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
import passport from './auth.js';
import { queryPortfolio, queryCurvaS, queryCurvaSColaboradores, queryIssues, queryCronograma, getTableSchema, queryNPSRaw, queryPortClientes, queryNPSFilterOptions, queryEstudoCustos, queryHorasRaw } from './bigquery.js';
import { isDirector, isAdmin, isPrivileged, isDev, hasFullAccess, getLeaderNameFromEmail, getUserRole, getUltimoTimeForLeader, canAccessFormularioPassagem, getRealEmailForIndicadores } from './auth-config.js';
import {
  getSupabaseClient, getSupabaseServiceClient, fetchPortfolioRealtime, fetchCurvaSRealtime, fetchCurvaSColaboradoresRealtime,
  fetchCobrancasFeitas, upsertCobranca, fetchTimesList, fetchUsuarioToTime,
  fetchFeedbacks, createFeedback, updateFeedbackStatus, updateFeedbackParecer, updateFeedback, getFeedbackStats,
  fetchUserViews, updateUserViews, getUserViews, createLog, fetchLogs, countLogsByAction, countViewUsage,
  fetchOKRs, fetchOKRById, createOKR, updateOKR, deleteOKR, createKeyResult, updateKeyResult,
  fetchOKRCheckIns, createOKRCheckIn, updateOKRCheckIn, deleteOKRCheckIn,
  fetchOKRInitiatives, createOKRInitiative, updateOKRInitiative, deleteOKRInitiative,
  fetchInitiativeComments, fetchCommentsForInitiatives, createInitiativeComment, deleteInitiativeComment,
  fetchIndicadores, createIndicador, updateIndicador, deleteIndicador,
  // Novo sistema de indicadores
  fetchSectors, getSectorById, createSector, updateSector, deleteSector,
  fetchPositions, getPositionById, createPosition, updatePosition, deletePosition,
  fetchPositionIndicators, createPositionIndicator, updatePositionIndicator, deletePositionIndicator,
  fetchIndicadoresIndividuais, getIndicadorById, createIndicadorFromTemplate, updateIndicadorIndividual,
  fetchCheckIns, getCheckInById, createCheckIn, updateCheckIn, deleteCheckIn,
  fetchRecoveryPlans, createRecoveryPlan, updateRecoveryPlan,
  fetchPeopleWithScores, getPersonById, fetchTeam,
  fetchUsersWithRoles, updateUserPosition, updateUserSector, updateUserRole, updateUserStatus, updateUserLeader, getUserSectorByEmail, getUserByEmail,
  fetchSectorsOverview, fetchHistoryComparison,
  // Views & Access Control
  fetchViews, createView, deleteView,
  fetchAccessDefaults, createAccessDefault, updateAccessDefault, deleteAccessDefault,
  getUserViewOverrides, setUserViewOverride, removeUserViewOverride, getEffectiveViews
} from './supabase.js';

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
});
app.use('/api/', limiter);

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

  const devUsers = {
    director: { id: 'dev-1', email: 'dev-director@otus.dev', name: 'Dev Director', role: 'director' },
    admin: { id: 'dev-2', email: 'dev-admin@otus.dev', name: 'Dev Admin', role: 'admin' },
    leader: { id: 'dev-3', email: 'dev-leader@otus.dev', name: 'Dev Leader', role: 'leader' }
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
 * Rota: GET /api/auth/user
 * Retorna informações do usuário logado
 */
app.get('/api/auth/user', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: {
      email: req.user.email,
      name: req.user.name,
      picture: req.user.picture,
      role: req.user.role,
      canAccessFormularioPassagem: canAccessFormularioPassagem(req.user.email),
    }
  });
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
    passport.authenticate('google', {
      scope: ['profile', 'email']
    })(req, res, next);
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
 * Filtra por líder se o usuário for líder
 */
app.get('/api/portfolio', requireAuth, async (req, res) => {
  try {
    console.log('📊 Buscando dados do portfólio...');
    
    // Se o usuário for líder, filtra apenas seus projetos
    // Se for diretora, retorna todos os projetos
    let leaderName = null;
    if (!isPrivileged(req.user.email)) {
      // Converte o email do usuário para o nome do líder na coluna do BigQuery
      leaderName = getLeaderNameFromEmail(req.user.email);
      if (!leaderName) {
        console.warn(`⚠️ Nome do líder não encontrado para o email: ${req.user.email}`);
        // Se não encontrar o mapeamento, retorna array vazio para segurança
        return res.json({
          success: true,
          count: 0,
          data: []
        });
      }
    }
    
    let data = [];

    try {
      data = await fetchPortfolioRealtime(leaderName);
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
 * Rota: GET /api/admin/colaboradores
 * Retorna lista de colaboradores ativos para conferência de acessos
 * Apenas diretoria/admin
 */
app.get('/api/admin/colaboradores', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user.email)) {
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
        position_type,
        phone,
        email,
        construflow_user_id,
        discord_user_id,
        leader:leader_id(name),
        padrinho:onboarding_buddy_id(name),
        team:team_id(team_number, team_name),
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
      cargo: row.position_type ?? null,
      lider: row.leader?.name ?? null,
      padrinho: row.padrinho?.name ?? null,
      time_numero: row.team?.team_number ?? null,
      time_nome: row.team?.team_name ?? null,
      telefone: row.phone ?? null,
      email: row.email ?? null,
      nivel_acesso: getUserRole(row.email) || 'sem_acesso',
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
app.get('/api/curva-s', requireAuth, async (req, res) => {
  try {
    console.log('📈 Buscando dados da Curva S...');
    
    // Se o usuário for líder, filtra apenas seus projetos
    let leaderName = null;
    if (!isPrivileged(req.user.email)) {
      leaderName = getLeaderNameFromEmail(req.user.email);
      if (!leaderName) {
        console.warn(`⚠️ Nome do líder não encontrado para o email: ${req.user.email}`);
        return res.json({
          success: true,
          count: 0,
          data: []
        });
      }
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
app.get('/api/curva-s/colaboradores', requireAuth, async (req, res) => {
  try {
    const projectCode = req.query.projectCode;
    
    if (!projectCode) {
      return res.status(400).json({
        success: false,
        error: 'projectCode é obrigatório'
      });
    }
    
    // Se o usuário for líder, valida se o projeto pertence a ele
    let leaderName = null;
    if (!isPrivileged(req.user.email)) {
      leaderName = getLeaderNameFromEmail(req.user.email);
      if (!leaderName) {
        return res.json({
          success: true,
          count: 0,
          data: []
        });
      }
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
 * Rota: GET /api/projetos/cronograma
 * Retorna os dados de cronograma (smartsheet_data_projetos) de um projeto específico
 * Filtra por smartsheet_id do portfólio
 */
app.get('/api/projetos/cronograma', requireAuth, async (req, res) => {
  try {
    const smartsheetId = req.query.smartsheetId;
    
    console.log(`📅 [API] Recebida requisição para buscar cronograma`);
    console.log(`   Query params:`, req.query);
    console.log(`   SmartSheet ID recebido: ${smartsheetId}`);
    console.log(`   Usuário: ${req.user?.email || 'N/A'}`);
    
    if (!smartsheetId) {
      console.warn(`⚠️ SmartSheet ID não fornecido`);
      return res.status(400).json({
        success: false,
        error: 'smartsheetId é obrigatório'
      });
    }
    
    // Se o usuário for líder, valida se o projeto pertence a ele
    let leaderName = null;
    if (!isPrivileged(req.user.email)) {
      leaderName = getLeaderNameFromEmail(req.user.email);
      if (!leaderName) {
        console.warn(`⚠️ Nome do líder não encontrado para: ${req.user.email}`);
        return res.json({
          success: true,
          count: 0,
          data: []
        });
      }
      // TODO: Validar se o projeto pertence ao líder
    }
    
    console.log(`📅 Chamando queryCronograma(${smartsheetId})...`);
    const data = await queryCronograma(smartsheetId);
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
 * Rota: GET /api/cs/nps
 * NPS do setor de sucesso do cliente, vinculado a port_clientes.
 * Líderes veem apenas o time (Ultimo_Time); privilegiados veem todos.
 * Query: campanha, organizacao, cargo
 */
app.get('/api/cs/nps', requireAuth, async (req, res) => {
  try {
    const campanha = req.query.campanha ?? '';
    const organizacao = req.query.organizacao ?? '';
    const cargo = req.query.cargo ?? '';

    let ultimoTime = null;
    if (!isPrivileged(req.user.email)) {
      const leaderName = getLeaderNameFromEmail(req.user.email);
      if (!leaderName) {
        return res.json({
          success: true,
          data: {
            npsScore: 0,
            promotores: 0,
            neutros: 0,
            detratores: 0,
            totalRespostas: 0,
            metaRespostas: META_RESPOSTAS_NPS,
            respostasMetaPct: 0,
            porNota: [],
            porOrganizacao: [],
            porTime: [],
          },
          filters: { campanhas: [], organizacoes: [], cargos: [] },
          applied: { campanha: '', organizacao: '', cargo: '' },
        });
      }
      ultimoTime = getUltimoTimeForLeader(leaderName);
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
app.get('/api/estudo-custos', requireAuth, async (req, res) => {
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

/**
 * Rota: GET /api/horas
 * Horas (timetracker) agrupadas por time (Colaboradores). Líderes veem só o seu time.
 * Sempre filtra por data (últimos 12 meses) para evitar carregamento lento.
 * Query: dataInicio, dataFim (YYYY-MM-DD, opcional) — senão usa último ano.
 */
app.get('/api/horas', requireAuth, async (req, res) => {
  try {
    let leaderName = null;
    if (!isPrivileged(req.user.email)) {
      leaderName = getLeaderNameFromEmail(req.user.email);
      if (!leaderName) {
        const def = defaultHorasDateRange();
        return res.json({ success: true, porTime: [], porProjeto: [], dataInicio: def.dataInicio, dataFim: def.dataFim });
      }
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
app.get('/api/projetos/apontamentos', requireAuth, async (req, res) => {
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
    if (!isPrivileged(req.user.email)) {
      leaderName = getLeaderNameFromEmail(req.user.email);
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

/**
 * Rota: GET /api/feedbacks
 * Retorna todos os feedbacks, ordenados com os do usuário primeiro
 */
app.get('/api/feedbacks', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user?.email || null;
    console.log('📋 Buscando feedbacks para:', userEmail);

    const feedbacks = await fetchFeedbacks(userEmail);

    res.json({
      success: true,
      count: feedbacks.length,
      data: feedbacks,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar feedbacks:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar feedbacks',
    });
  }
});

/**
 * Rota: GET /api/feedbacks/stats
 * Retorna estatísticas dos feedbacks (contagem por status)
 */
app.get('/api/feedbacks/stats', requireAuth, async (req, res) => {
  try {
    const stats = await getFeedbackStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas de feedbacks:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar estatísticas',
    });
  }
});

/**
 * Rota: POST /api/feedbacks
 * Cria um novo feedback
 */
app.post('/api/feedbacks', requireAuth, async (req, res) => {
  try {
    const { tipo, titulo, descricao, feedback_text } = req.body;

    // Aceita tanto 'descricao' (legacy) quanto 'feedback_text' (novo)
    const text = feedback_text || descricao;

    const validTipos = ['processo', 'plataforma', 'sugestao', 'outro'];
    if (!tipo || !validTipos.includes(tipo)) {
      return res.status(400).json({
        success: false,
        error: `Tipo deve ser um dos seguintes: ${validTipos.join(', ')}`,
      });
    }

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Texto do feedback é obrigatório',
      });
    }

    const feedback = await createFeedback({
      tipo,
      titulo: titulo || null,
      feedback_text: text,
      author_email: req.user.email,
      author_name: req.user.displayName || req.user.name || null,
    });

    // Registra a criação do feedback
    await logAction(req, 'create', 'feedback', feedback.id, `Feedback: ${titulo || text.substring(0, 50)}`, { tipo });

    res.json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    console.error('❌ Erro ao criar feedback:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao criar feedback',
    });
  }
});

/**
 * Rota: PUT /api/feedbacks/:id/status
 * Atualiza o status de um feedback (apenas admin/director)
 */
app.put('/api/feedbacks/:id/status', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user.email)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        message: 'Somente admin ou director podem alterar o status',
      });
    }

    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = [
      'pendente',
      'em_analise',
      'backlog_desenvolvimento',
      'backlog_treinamento',
      'analise_funcionalidade',
      'finalizado',
      'recusado'
    ];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Status deve ser um dos seguintes: ${validStatuses.join(', ')}`,
      });
    }

    const feedback = await updateFeedbackStatus(id, status, req.user.email);

    // Registra a alteração de status
    await logAction(req, 'update', 'feedback', id, `Status alterado para: ${status}`, { status });

    res.json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar status do feedback:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar status do feedback',
    });
  }
});

/**
 * Rota: PUT /api/feedbacks/:id/parecer
 * Atualiza o parecer de um feedback (apenas admin/director)
 * Aceita: admin_analysis (análise) e admin_action (ação a tomar)
 */
app.put('/api/feedbacks/:id/parecer', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user.email)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        message: 'Somente admin ou director podem adicionar parecer',
      });
    }

    const { id } = req.params;
    const { parecer, admin_analysis, admin_action } = req.body;

    // Suporte legacy: 'parecer' vai para admin_analysis se não houver admin_analysis
    const analysis = admin_analysis || parecer || null;
    const action = admin_action || null;

    if (!analysis && !action) {
      return res.status(400).json({
        success: false,
        error: 'Análise ou ação a tomar é obrigatória',
      });
    }

    const feedback = await updateFeedbackParecer(id, analysis, action, req.user.email);

    // Registra a ação
    await logAction(req, 'update', 'feedback', id, 'Parecer atualizado', { hasAnalysis: !!analysis, hasAction: !!action });

    res.json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar parecer do feedback:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar parecer do feedback',
    });
  }
});

/**
 * Rota: PUT /api/feedbacks/:id
 * Atualização completa de um feedback (apenas admin/director)
 * Permite atualizar status, análise e ação de uma só vez
 */
app.put('/api/feedbacks/:id', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user.email)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        message: 'Somente admin ou director podem atualizar feedbacks',
      });
    }

    const { id } = req.params;
    const { status, admin_analysis, admin_action } = req.body;

    // Validar status se fornecido
    if (status) {
      const validStatuses = [
        'pendente',
        'em_analise',
        'backlog_desenvolvimento',
        'backlog_treinamento',
        'analise_funcionalidade',
        'finalizado',
        'recusado'
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Status deve ser um dos seguintes: ${validStatuses.join(', ')}`,
        });
      }
    }

    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (admin_analysis !== undefined) updateData.admin_analysis = admin_analysis;
    if (admin_action !== undefined) updateData.admin_action = admin_action;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum campo para atualizar foi fornecido',
      });
    }

    const feedback = await updateFeedback(id, updateData, req.user.email);

    // Registra a ação
    await logAction(req, 'update', 'feedback', id, 'Feedback atualizado', updateData);

    res.json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar feedback:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar feedback',
    });
  }
});

/**
 * Rota: GET /api/admin/user-views
 * Retorna todas as permissões de vistas dos usuários
 * Apenas admin/director
 */
app.get('/api/admin/user-views', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user.email)) {
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
    if (!isPrivileged(req.user.email)) {
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
    const userInfo = await getUserByEmail(req.user.email);

    const user = {
      email: req.user.email,
      role: req.user.role || getUserRole(req.user.email),
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
    if (!isPrivileged(req.user.email)) {
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
    if (!isDev(req.user.email)) {
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
    if (!isDev(req.user.email)) {
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
    if (!hasFullAccess(req.user.email)) {
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
    if (!hasFullAccess(req.user.email)) {
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
    if (!hasFullAccess(req.user.email)) {
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
    if (!hasFullAccess(req.user.email)) {
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
    if (!hasFullAccess(req.user.email)) {
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
    if (!hasFullAccess(req.user.email)) {
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
    if (!hasFullAccess(req.user.email)) {
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
    if (!isPrivileged(req.user.email)) {
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
    if (!isPrivileged(req.user.email)) {
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
 * Rota: PUT /api/okrs/key-results/:id
 * Atualiza um Key Result
 */
app.put('/api/okrs/key-results/:id', requireAuth, async (req, res) => {
  try {
    const krId = req.params.id;
    const kr = await updateKeyResult(krId, req.body);

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
// ROTAS COM PARÂMETRO :id (devem vir DEPOIS das rotas específicas)
// ============================================

/**
 * Rota: PUT /api/okrs/:id
 * Atualiza um OKR existente
 */
app.put('/api/okrs/:id', requireAuth, async (req, res) => {
  try {
    const okrId = req.params.id;
    const { titulo, nivel, responsavel, quarter, keyResults } = req.body;

    const okr = await updateOKR(okrId, {
      titulo,
      nivel,
      responsavel,
      quarter,
      keyResults,
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
    const { content } = req.body;
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('okr_comments')
      .insert({
        key_result_id: parseInt(krId),
        author_id: req.user?.email,
        content: content
      })
      .select()
      .single();

    if (error) throw error;

    await logAction(req, 'create', 'okr_comment', data.id, 'Comentário criado');

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
    if (!isPrivileged(req.user.email)) {
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
    if (!isPrivileged(req.user.email)) {
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
 * Rota: DELETE /api/ind/sectors/:id
 * Deleta um setor (admin)
 */
app.delete('/api/ind/sectors/:id', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user.email)) {
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
    if (!isPrivileged(req.user.email)) {
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
    if (!isPrivileged(req.user.email)) {
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
    if (!isPrivileged(req.user.email)) {
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
    if (!isPrivileged(req.user.email)) {
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
    if (!isPrivileged(req.user.email)) {
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
    if (!isPrivileged(req.user.email)) {
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

    // Se não for privilegiado e não passou person_email, usa o email do usuário logado
    if (!isPrivileged(req.user.email) && !filters.person_email) {
      filters.person_email = req.user.email;
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
      person_email: req.user.email,
      ciclo: req.query.ciclo || null,
      ano: req.query.ano ? parseInt(req.query.ano, 10) : new Date().getFullYear(),
    };

    const indicadores = await fetchIndicadoresIndividuais(filters);
    res.json({ success: true, data: indicadores });
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
    if (!isPrivileged(req.user.email) && indicador.person_email !== req.user.email) {
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

    const indicador = await createIndicadorFromTemplate(template_id, req.user.email, ciclo, ano);
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
    if (!isPrivileged(req.user.email) && existing.person_email !== req.user.email) {
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
    if (!isPrivileged(req.user.email) && indicador.person_email !== req.user.email) {
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
    if (!isPrivileged(req.user.email) && indicador.person_email !== req.user.email) {
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
    if (!isPrivileged(req.user.email) && indicador.person_email !== req.user.email) {
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
    if (!isPrivileged(req.user.email) && indicador.person_email !== req.user.email) {
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
    if (!isPrivileged(req.user.email) && indicador.person_email !== req.user.email) {
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

// --- PESSOAS / EQUIPE ---

/**
 * Rota: GET /api/ind/people
 * Retorna pessoas com scores
 * Query: setor_id, ciclo, ano
 */
app.get('/api/ind/people', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user.email)) {
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
    if (!isPrivileged(req.user.email) && person.email !== req.user.email) {
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
 * - Admins/Diretores veem todos do setor selecionado
 * Query: ciclo, ano, sector_id (admin only)
 */
app.get('/api/ind/team', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const realEmail = getRealEmailForIndicadores(userEmail);
    const userRole = getUserRole(userEmail);
    const isAdminOrDirector = userRole === 'admin' || userRole === 'director';

    // Busca informações do usuário atual (para obter ID se for líder)
    const currentUser = await getUserByEmail(realEmail);
    let targetSector = null;
    let leaderId = null;

    // Admin/Director pode visualizar qualquer setor passando sector_id
    if (req.query.sector_id && isAdminOrDirector) {
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
      // Para admins sem setor, retorna lista de setores disponíveis
      if (isAdminOrDirector) {
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

    // Para admins, também retorna lista de setores disponíveis
    let availableSectors = [];
    if (isAdminOrDirector) {
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
    if (!isPrivileged(req.user.email)) {
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
    if (!isPrivileged(req.user.email)) {
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
    if (!isPrivileged(req.user.email)) {
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
    if (!isPrivileged(req.user.email)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const { role } = req.body;
    const validRoles = ['user', 'leader', 'admin', 'director'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, error: 'Role inválido' });
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
    if (!isPrivileged(req.user.email)) {
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
    if (!isPrivileged(req.user.email)) {
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

// --- OVERVIEW E HISTÓRICO ---

/**
 * Rota: GET /api/ind/overview
 * Retorna visão geral de todos setores com scores
 * Query: ciclo, ano
 */
app.get('/api/ind/overview', requireAuth, async (req, res) => {
  try {
    if (!isPrivileged(req.user.email)) {
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
    if (!isPrivileged(req.user.email)) {
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
    const userEmail = req.user.email;
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
    let positionId = req.query.position_id;

    // Se não foi especificado position_id, busca do usuário
    if (!positionId) {
      const { data: user, error: userError } = await supabase
        .from('users_otus')
        .select('position_id')
        .eq('email', req.user.email)
        .single();

      if (!userError && user?.position_id) {
        positionId = user.position_id;
      }
    }

    // Se ainda não tem position_id e é usuário de dev, usa cargo default
    if (!positionId && req.user.email?.endsWith('@otus.dev')) {
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
// BUG REPORTS - Sistema de relatórios de bugs/erros
// =====================================================

/**
 * GET /api/bug-reports
 * Lista todos os relatórios de bugs
 */
app.get('/api/bug-reports', requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Erro ao buscar bug reports:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bug-reports
 * Cria um novo relatório de bug
 */
app.post('/api/bug-reports', requireAuth, async (req, res) => {
  try {
    const { title, description, type, screenshot, page_url, reporter_email, reporter_name } = req.body;

    if (!title || !description || !type) {
      return res.status(400).json({
        success: false,
        error: 'Título, descrição e tipo são obrigatórios'
      });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('bug_reports')
      .insert({
        title,
        description,
        type,
        screenshot_url: screenshot,
        page_url,
        reporter_email: reporter_email || req.user?.email,
        reporter_name: reporter_name || req.user?.name,
        status: 'pendente'
      })
      .select()
      .single();

    if (error) throw error;

    // Log da ação
    await logAction(req, 'create', 'bug_report', data.id, title, { type });

    res.status(201).json({ success: true, data });
  } catch (error) {
    console.error('❌ Erro ao criar bug report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/bug-reports/:id
 * Atualiza um relatório de bug (status, notas admin, etc)
 */
app.patch('/api/bug-reports/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Adiciona updated_at
    updates.updated_at = new Date().toISOString();

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('bug_reports')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log da ação
    await logAction(req, 'update', 'bug_report', id, data.title, { updates });

    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Erro ao atualizar bug report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/bug-reports/:id
 * Exclui um relatório de bug
 */
app.delete('/api/bug-reports/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const supabase = getSupabaseClient();

    // Busca o report antes de deletar para o log
    const { data: report } = await supabase
      .from('bug_reports')
      .select('title')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('bug_reports')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Log da ação
    await logAction(req, 'delete', 'bug_report', id, report?.title);

    res.json({ success: true, message: 'Bug report excluído com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao excluir bug report:', error);
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
