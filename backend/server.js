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
import { isDirector, isAdmin, isPrivileged, getLeaderNameFromEmail, getUserRole, getUltimoTimeForLeader, canAccessFormularioPassagem } from './auth-config.js';
import { getSupabaseClient, fetchPortfolioRealtime, fetchCurvaSRealtime, fetchCurvaSColaboradoresRealtime, fetchCobrancasFeitas, upsertCobranca, fetchTimesList, fetchUsuarioToTime, fetchFeedbacks, createFeedback, updateFeedbackStatus, updateFeedbackParecer, fetchUserViews, updateUserViews, getUserViews, createLog, fetchLogs, countLogsByAction, countViewUsage, fetchOKRs, createOKR, updateOKR, deleteOKR, fetchIndicadores, createIndicador, updateIndicador, deleteIndicador } from './supabase.js';

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
  max: 100, // Máximo 100 requisições por IP
  message: 'Muitas requisições deste IP, tente novamente em 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Configuração de sessão
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'otus-engenharia-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS em produção
      httpOnly: true,
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
    return; // Não loga ações de usuários não autenticados
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
    // Não interrompe o fluxo se houver erro no log
    console.error('Erro ao registrar log:', error);
  }
}

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
    // Registra o login
    if (req.user) {
      await logAction(req, 'login', 'auth', null, 'Login no sistema');
    }
    // Redireciona para o frontend após login bem-sucedido
    res.redirect(FRONTEND_URL);
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
  if (val == null || val === '') return null;
  const n = parseInt(String(val).trim(), 10);
  return Number.isNaN(n) || n < 0 || n > 10 ? null : n;
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

/** Parse duracao (STRING) para horas decimais. */
function parseDuracaoHoras(duracao) {
  if (duracao == null || String(duracao).trim() === '') return 0;
  const s = String(duracao).trim();
  const n = parseFloat(s.replace(',', '.'));
  if (!Number.isNaN(n)) return n;
  const hMatch = s.match(/(\d+)\s*h/i);
  const mMatch = s.match(/(\d+)\s*m/i);
  const h = hMatch ? parseInt(hMatch[1], 10) : 0;
  const m = mMatch ? parseInt(mMatch[1], 10) : 0;
  return h + m / 60;
}

/** BigQuery DATE pode vir como { value: "YYYY-MM-DD" }. Normaliza para string. */
function toDateString(v) {
  if (v == null) return null;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  if (typeof v === 'object' && v && typeof v.value === 'string') return v.value.slice(0, 10);
  try {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch (_) {}
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

/** Retorna data em YYYY-MM-DD. */
function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Intervalo padrão para horas: últimos 12 meses (evita consulta pesada). */
function defaultHorasDateRange() {
  const fim = new Date();
  const inicio = new Date();
  inicio.setFullYear(inicio.getFullYear() - 1);
  return { dataInicio: toISODate(inicio), dataFim: toISODate(fim) };
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
 * Retorna todos os feedbacks
 * Usuários normais veem apenas seus próprios feedbacks
 * Admin/Director veem todos
 */
app.get('/api/feedbacks', requireAuth, async (req, res) => {
  try {
    const isPrivilegedUser = isPrivileged(req.user.email);
    const feedbacks = await fetchFeedbacks(isPrivilegedUser, req.user.email);
    
    res.json({
      success: true,
      count: feedbacks.length,
      data: feedbacks,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar feedbacks:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar feedbacks',
    });
  }
});

/**
 * Rota: POST /api/feedbacks
 * Cria um novo feedback
 */
app.post('/api/feedbacks', requireAuth, async (req, res) => {
  try {
    const { tipo, titulo, descricao } = req.body;

    if (!tipo || !['processo', 'plataforma'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo deve ser "processo" ou "plataforma"',
      });
    }

    if (!titulo || !descricao) {
      return res.status(400).json({
        success: false,
        error: 'Título e descrição são obrigatórios',
      });
    }

    const feedback = await createFeedback({
      tipo,
      titulo,
      descricao,
      created_by: req.user.email,
    });

    // Registra a criação do feedback
    await logAction(req, 'create', 'feedback', feedback.id, `Feedback: ${titulo}`, { tipo });

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
 * Atualiza o status de um feedback
 */
app.put('/api/feedbacks/:id/status', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pendente', 'em_analise', 'resolvido', 'arquivado'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Status deve ser um dos seguintes: ${validStatuses.join(', ')}`,
      });
    }

    const feedback = await updateFeedbackStatus(id, status, req.user.email);

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
    const { parecer } = req.body;

    if (!parecer || typeof parecer !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Parecer é obrigatório',
      });
    }

    const feedback = await updateFeedbackParecer(id, parecer, req.user.email);

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
