/**
 * Cliente Supabase (backend)
 * Usa variaveis de ambiente para conexao.
 */

import { createClient } from '@supabase/supabase-js';

// Nota: variáveis de ambiente são lidas dentro das funções para garantir
// que dotenv.config() já foi executado antes do acesso

export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('SUPABASE_URL ou SUPABASE_ANON_KEY nao configuradas');
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Cliente Supabase com service role (bypassa RLS)
 * Usar apenas no backend para operacoes que precisam ignorar RLS
 */
export function getSupabaseServiceClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao configuradas');
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function fetchPortfolioRealtime(leaderName = null) {
  const supabase = getSupabaseClient();
  const portfolioView = process.env.SUPABASE_PORTFOLIO_VIEW || 'portfolio_realtime';
  let query = supabase
    .from(portfolioView)
    .select('*');

  if (leaderName) {
    query = query.eq('lider', leaderName);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return Array.isArray(data) ? data : [];
}

export async function fetchCurvaSRealtime(leaderName = null, projectCode = null) {
  const curvaSView = process.env.SUPABASE_CURVA_S_VIEW || '';
  if (!curvaSView) {
    throw new Error('SUPABASE_CURVA_S_VIEW nao configurada');
  }

  const supabase = getSupabaseClient();
  let query = supabase
    .from(curvaSView)
    .select('*');

  if (leaderName) {
    query = query.eq('lider', leaderName);
  }

  if (projectCode) {
    query = query.eq('project_code', projectCode);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return Array.isArray(data) ? data : [];
}

export async function fetchCurvaSColaboradoresRealtime(projectCode, leaderName = null) {
  const curvaSColabView = process.env.SUPABASE_CURVA_S_COLAB_VIEW || '';
  if (!curvaSColabView) {
    throw new Error('SUPABASE_CURVA_S_COLAB_VIEW nao configurada');
  }

  const supabase = getSupabaseClient();
  let query = supabase
    .from(curvaSColabView)
    .select('*')
    .eq('project_code', projectCode);

  if (leaderName) {
    query = query.eq('lider', leaderName);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return Array.isArray(data) ? data : [];
}

const CRONOGRAMA_COBRANCA_TABLE = 'cronograma_cobranca';

/**
 * Busca os row_ids marcados como "cobrança feita" para um projeto.
 * @param {string} smartsheetId - ID do projeto no SmartSheet
 * @returns {Promise<string[]>} - Lista de row_ids com cobrança feita
 */
export async function fetchCobrancasFeitas(smartsheetId) {
  if (!smartsheetId) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(CRONOGRAMA_COBRANCA_TABLE)
    .select('row_id')
    .eq('smartsheet_id', String(smartsheetId))
    .eq('cobranca_feita', true);

  if (error) {
    throw new Error(`Erro ao buscar cobranças: ${error.message}`);
  }
  return (data || []).map((r) => r.row_id);
}

/**
 * Marca ou desmarca "cobrança feita" para uma tarefa.
 * @param {string} smartsheetId - ID do projeto no SmartSheet
 * @param {string} rowId - ID da linha (tarefa)
 * @param {boolean} cobrancaFeita - true = marcado, false = desmarcado
 * @param {string} [updatedBy] - Email de quem atualizou
 */
export async function upsertCobranca(smartsheetId, rowId, cobrancaFeita, updatedBy = null) {
  const supabase = getSupabaseClient();
  const row = {
    smartsheet_id: String(smartsheetId),
    row_id: String(rowId),
    cobranca_feita: Boolean(cobrancaFeita),
    updated_at: new Date().toISOString(),
    updated_by: updatedBy || null,
  };

  const { error } = await supabase
    .from(CRONOGRAMA_COBRANCA_TABLE)
    .upsert(row, {
      onConflict: ['smartsheet_id', 'row_id'],
    });

  if (error) {
    throw new Error(`Erro ao salvar cobrança: ${error.message}`);
  }
}

/**
 * Lista de times (Colaboradores) para filtros.
 * Formato "N - Time Nome" (ex.: "5 - Time Eliane").
 * @returns {Promise<Array<{ value: string, label: string }>>}
 */
export async function fetchTimesList() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users_otus')
    .select('team:team_id(team_number, team_name)')
    .eq('status', 'ativo');

  if (error) throw new Error(error.message);

  const seen = new Set();
  const out = [];
  for (const row of data || []) {
    const n = row.team?.team_number ?? null;
    const name = row.team?.team_name ?? null;
    const label =
      n != null && String(n).trim() !== ''
        ? `${n} - ${name || ''}`.trim()
        : (name || 'Sem time').trim();
    if (!label) continue;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ value: label, label });
  }
  out.sort((a, b) => (a.label || '').localeCompare(b.label || '', 'pt-BR'));
  return out;
}

/**
 * Mapa usuario (name) → time "N - Time Nome" para enriquecer Horas.
 * @returns {Promise<Map<string, string>>}
 */
export async function fetchUsuarioToTime() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users_otus')
    .select('name, team:team_id(team_number, team_name)')
    .eq('status', 'ativo');

  if (error) throw new Error(error.message);

  const map = new Map();
  for (const row of data || []) {
    const name = String(row.name ?? '').trim();
    if (!name) continue;
    const n = row.team?.team_number ?? null;
    const tn = row.team?.team_name ?? null;
    const time =
      n != null && String(n).trim() !== ''
        ? `${n} - ${tn || ''}`.trim()
        : (tn || 'Sem time').trim();
    map.set(name, time);
  }
  return map;
}

/**
 * Tabela de feedbacks
 */
const FEEDBACKS_TABLE = 'feedbacks';

/**
 * Status válidos para feedbacks
 */
const FEEDBACK_STATUS = [
  'pendente',
  'em_analise',
  'backlog_desenvolvimento',
  'backlog_treinamento',
  'analise_funcionalidade',
  'finalizado',
  'recusado'
];

/**
 * Busca todos os feedbacks
 * Retorna todos feedbacks para todos usuários, com os próprios primeiro
 * @param {string} userId - UUID do usuário logado (para ordenar os próprios primeiro)
 * @returns {Promise<Array>}
 */
export async function fetchFeedbacks(userId = null) {
  const supabase = getSupabaseClient();

  // Busca feedbacks
  const { data, error } = await supabase
    .from(FEEDBACKS_TABLE)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar feedbacks: ${error.message}`);
  }

  const feedbacks = Array.isArray(data) ? data : [];

  // Coleta IDs únicos de autores e resolvedores
  const authorIds = [...new Set(feedbacks.map(f => f.author_id).filter(Boolean))];
  const resolvedByIds = [...new Set(feedbacks.map(f => f.resolved_by_id).filter(Boolean))];
  const allUserIds = [...new Set([...authorIds, ...resolvedByIds])];

  // Busca dados dos usuários
  let usersMap = new Map();
  if (allUserIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from('users_otus')
      .select('id, name, email')
      .in('id', allUserIds);

    if (!usersError && users) {
      users.forEach(u => usersMap.set(u.id, u));
    }
  }

  // Enriquece feedbacks com dados dos usuários (para compatibilidade com frontend)
  const enrichedFeedbacks = feedbacks.map(f => {
    const author = usersMap.get(f.author_id);
    const resolvedBy = usersMap.get(f.resolved_by_id);
    return {
      ...f,
      // Campos para compatibilidade com frontend
      author_name: author?.name || null,
      author_email: author?.email || null,
      resolved_by: resolvedBy?.name || null,
    };
  });

  // Se temos ID do usuário, ordenar para que os próprios venham primeiro
  if (userId) {
    enrichedFeedbacks.sort((a, b) => {
      const aIsOwn = a.author_id === userId;
      const bIsOwn = b.author_id === userId;
      if (aIsOwn && !bIsOwn) return -1;
      if (!aIsOwn && bIsOwn) return 1;
      // Manter ordem por data para feedbacks do mesmo "grupo"
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }

  return enrichedFeedbacks;
}

/**
 * Busca estatísticas de feedbacks por status
 * @returns {Promise<Object>}
 */
export async function getFeedbackStats() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(FEEDBACKS_TABLE)
    .select('status');

  if (error) {
    throw new Error(`Erro ao buscar estatísticas: ${error.message}`);
  }

  const stats = {
    total: 0,
    pendente: 0,
    em_analise: 0,
    backlog_desenvolvimento: 0,
    backlog_treinamento: 0,
    analise_funcionalidade: 0,
    finalizado: 0,
    recusado: 0,
    // Agrupamentos para Kanban
    novos: 0,
    em_andamento: 0,
    finalizados: 0,
    recusados: 0
  };

  (data || []).forEach(row => {
    stats.total++;
    if (stats[row.status] !== undefined) {
      stats[row.status]++;
    }
    // Agrupamentos
    if (row.status === 'pendente') stats.novos++;
    else if (['em_analise', 'backlog_desenvolvimento', 'backlog_treinamento', 'analise_funcionalidade'].includes(row.status)) stats.em_andamento++;
    else if (row.status === 'finalizado') stats.finalizados++;
    else if (row.status === 'recusado') stats.recusados++;
  });

  return stats;
}

/**
 * Cria um novo feedback
 * @param {Object} feedback - Dados do feedback
 * @param {string} feedback.type - 'bug', 'feedback_processo', 'feedback_plataforma', 'erro' ou 'outro'
 * @param {string} feedback.titulo - Título do feedback (opcional)
 * @param {string} feedback.feedback_text - Descrição do feedback
 * @param {string} feedback.author_id - UUID do autor (auth.users.id)
 * @param {string} feedback.page_url - URL da página onde foi criado (opcional)
 * @param {string} feedback.screenshot_url - URL do screenshot (opcional)
 * @returns {Promise<Object>}
 */
export async function createFeedback(feedback) {
  const supabase = getSupabaseClient();

  const row = {
    type: feedback.type || 'feedback_plataforma',
    titulo: feedback.titulo || null,
    feedback_text: feedback.feedback_text || feedback.descricao || '',
    screenshot_url: feedback.screenshot_url || null,
    status: 'pendente',
    author_id: feedback.author_id,
    page_url: feedback.page_url || null,
    screenshot_url: feedback.screenshot_url || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(FEEDBACKS_TABLE)
    .insert(row)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar feedback: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza o status de um feedback
 * @param {string} id - ID do feedback
 * @param {string} status - Novo status
 * @param {string} resolvedById - UUID de quem atualizou (auth.users.id)
 * @returns {Promise<Object>}
 */
export async function updateFeedbackStatus(id, status, resolvedById) {
  const supabase = getSupabaseClient();

  const updateData = {
    status,
    updated_at: new Date().toISOString(),
  };

  // Se status é finalizado ou recusado, registrar quem resolveu
  if (status === 'finalizado' || status === 'recusado') {
    updateData.resolved_at = new Date().toISOString();
    updateData.resolved_by_id = resolvedById;
  }

  const { data, error } = await supabase
    .from(FEEDBACKS_TABLE)
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar status do feedback: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza feedback completo (apenas admin)
 * @param {string} id - ID do feedback
 * @param {Object} updateData - Dados a atualizar
 * @param {string} resolvedById - UUID de quem atualizou (auth.users.id)
 * @returns {Promise<Object>}
 */
export async function updateFeedback(id, updateData, resolvedById) {
  const supabase = getSupabaseClient();

  const row = {
    ...updateData,
    updated_at: new Date().toISOString(),
  };

  // Se status é finalizado ou recusado, registrar quem resolveu
  if (updateData.status === 'finalizado' || updateData.status === 'recusado') {
    row.resolved_at = new Date().toISOString();
    row.resolved_by_id = resolvedById;
  }

  // Remover campos que não devem ser atualizados diretamente
  delete row.id;
  delete row.created_at;
  delete row.author_id;

  const { data, error } = await supabase
    .from(FEEDBACKS_TABLE)
    .update(row)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar feedback: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza análise e ação do admin em um feedback
 * @param {string} id - ID do feedback
 * @param {string} analysis - Análise do admin
 * @param {string} action - Ação a tomar
 * @param {string} updatedBy - Email de quem atualizou
 * @returns {Promise<Object>}
 */
export async function updateFeedbackParecer(id, analysis, action, updatedBy) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(FEEDBACKS_TABLE)
    .update({
      admin_analysis: analysis,
      admin_action: action,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar parecer do feedback: ${error.message}`);
  }

  return data;
}

/**
 * Tabela de permissões de vistas por usuário
 */
const USER_VIEWS_TABLE = 'user_views';

/**
 * Busca todas as permissões de vistas dos usuários
 * @returns {Promise<Array<{email: string, view_id: string}>>}
 */
export async function fetchUserViews() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(USER_VIEWS_TABLE)
    .select('email, view_id')
    .order('email');

  if (error) {
    throw new Error(`Erro ao buscar permissões de vistas: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Atualiza as permissões de vistas de um usuário
 * @param {string} email - Email do usuário
 * @param {string[]} views - Array de IDs das vistas permitidas
 * @returns {Promise<void>}
 */
export async function updateUserViews(email, views) {
  const supabase = getSupabaseClient();

  // Primeiro, remove todas as permissões existentes do usuário
  const { error: deleteError } = await supabase
    .from(USER_VIEWS_TABLE)
    .delete()
    .eq('email', email);

  if (deleteError) {
    throw new Error(`Erro ao remover permissões antigas: ${deleteError.message}`);
  }

  // Se não há vistas para adicionar, apenas retorna
  if (!views || views.length === 0) {
    return;
  }

  // Adiciona as novas permissões
  const rows = views.map((viewId) => ({
    email,
    view_id: viewId,
    created_at: new Date().toISOString(),
  }));

  const { error: insertError } = await supabase
    .from(USER_VIEWS_TABLE)
    .insert(rows);

  if (insertError) {
    throw new Error(`Erro ao salvar permissões: ${insertError.message}`);
  }
}

/**
 * Busca as vistas permitidas para um usuário específico
 * @param {string} email - Email do usuário
 * @returns {Promise<string[]>} - Array de IDs das vistas permitidas
 */
export async function getUserViews(email) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(USER_VIEWS_TABLE)
    .select('view_id')
    .eq('email', email);

  if (error) {
    throw new Error(`Erro ao buscar vistas do usuário: ${error.message}`);
  }

  return (data || []).map((row) => row.view_id);
}

/**
 * Tabela de logs
 */
const LOGS_TABLE = 'logs';

/**
 * Registra uma ação no log
 * @param {Object} logData - Dados do log
 * @param {string} logData.user_email - Email do usuário
 * @param {string} logData.user_name - Nome do usuário
 * @param {string} logData.action_type - Tipo de ação (access, view, create, update, delete, etc)
 * @param {string} logData.resource_type - Tipo de recurso (view, feedback, etc)
 * @param {string} [logData.resource_id] - ID do recurso
 * @param {string} [logData.resource_name] - Nome do recurso
 * @param {Object} [logData.details] - Detalhes adicionais (JSON)
 * @param {string} [logData.ip_address] - IP do usuário
 * @param {string} [logData.user_agent] - User agent
 * @returns {Promise<void>}
 */
export async function createLog(logData) {
  try {
    const supabase = getSupabaseClient();
    const row = {
      user_email: logData.user_email,
      user_name: logData.user_name || null,
      action_type: logData.action_type,
      resource_type: logData.resource_type || null,
      resource_id: logData.resource_id || null,
      resource_name: logData.resource_name || null,
      details: logData.details || null,
      ip_address: logData.ip_address || null,
      user_agent: logData.user_agent || null,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from(LOGS_TABLE)
      .insert(row);

    // Não lança erro para não quebrar o fluxo principal
    // Apenas loga o erro
    if (error) {
      console.error('Erro ao criar log no Supabase:', error.message || error.hint || JSON.stringify(error));
    }
  } catch (err) {
    // Captura qualquer erro e não interrompe o fluxo
    console.error('Erro ao criar log (catch):', err);
  }
}

/**
 * Busca logs com filtros
 * @param {Object} filters - Filtros de busca
 * @param {string} [filters.user_email] - Filtrar por email
 * @param {string} [filters.action_type] - Filtrar por tipo de ação
 * @param {string} [filters.resource_type] - Filtrar por tipo de recurso
 * @param {Date} [filters.start_date] - Data inicial
 * @param {Date} [filters.end_date] - Data final
 * @param {number} [filters.limit] - Limite de resultados (padrão: 1000)
 * @param {number} [filters.offset] - Offset para paginação
 * @returns {Promise<Array>}
 */
export async function fetchLogs(filters = {}) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from(LOGS_TABLE)
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.user_email) {
    query = query.eq('user_email', filters.user_email);
  }

  if (filters.action_type) {
    query = query.eq('action_type', filters.action_type);
  }

  if (filters.resource_type) {
    query = query.eq('resource_type', filters.resource_type);
  }

  if (filters.start_date) {
    query = query.gte('created_at', filters.start_date.toISOString());
  }

  if (filters.end_date) {
    query = query.lte('created_at', filters.end_date.toISOString());
  }

  const limit = filters.limit || 1000;
  const offset = filters.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao buscar logs: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Conta logs por tipo de ação (para indicadores)
 * @param {Date} [startDate] - Data inicial
 * @param {Date} [endDate] - Data final
 * @returns {Promise<Array<{action_type: string, count: number}>>}
 */
export async function countLogsByAction(startDate = null, endDate = null) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from(LOGS_TABLE)
    .select('action_type');

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString());
  }

  if (endDate) {
    query = query.lte('created_at', endDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao contar logs: ${error.message}`);
  }

  // Agrupa por action_type
  const counts = {};
  (data || []).forEach((log) => {
    const action = log.action_type || 'unknown';
    counts[action] = (counts[action] || 0) + 1;
  });

  return Object.entries(counts).map(([action_type, count]) => ({
    action_type,
    count,
  })).sort((a, b) => b.count - a.count);
}

/**
 * Conta uso de vistas (para indicadores)
 * @param {Date} [startDate] - Data inicial
 * @param {Date} [endDate] - Data final
 * @returns {Promise<Array<{vista: string, usuarios_unicos: number, total_acessos: number}>>}
 */
export async function countViewUsage(startDate = null, endDate = null) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from(LOGS_TABLE)
    .select('resource_name, user_email')
    .eq('resource_type', 'view');

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString());
  }

  if (endDate) {
    query = query.lte('created_at', endDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao contar uso de vistas: ${error.message}`);
  }

  // Agrupa por vista
  const vistaMap = {};
  (data || []).forEach((log) => {
    const vista = log.resource_name || 'unknown';
    if (!vistaMap[vista]) {
      vistaMap[vista] = {
        vista,
        usuarios: new Set(),
        total_acessos: 0,
      };
    }
    vistaMap[vista].usuarios.add(log.user_email);
    vistaMap[vista].total_acessos++;
  });

  return Object.values(vistaMap).map((item) => ({
    vista: item.vista,
    usuarios_unicos: item.usuarios.size,
    total_acessos: item.total_acessos,
  })).sort((a, b) => b.total_acessos - a.total_acessos);
}

// ============================================
// OKRs - Objetivos e Resultados Chave
// ============================================

const OKRS_TABLE = 'okrs';
const KEY_RESULTS_TABLE = 'key_results';

/**
 * Busca todos os OKRs
 * @param {string} [quarter] - Trimestre (ex: 'Q1-2025')
 * @param {string} [level] - Nível (empresa, time, individual)
 * @returns {Promise<Array>}
 */
export async function fetchOKRs(quarter = null, level = null) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from(OKRS_TABLE)
    .select(`
      *,
      responsavel_user:responsavel_id(id, name, avatar_url)
    `)
    .order('created_at', { ascending: false });

  if (quarter) {
    query = query.eq('quarter', quarter);
  }

  if (level && level !== 'todos') {
    query = query.eq('nivel', level);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao buscar OKRs: ${error.message}`);
  }

  // Busca key results para cada OKR
  const okrsWithKeyResults = await Promise.all(
    (data || []).map(async (okr) => {
      const keyResults = await fetchKeyResults(okr.id);
      const progresso = calculateOKRProgress(keyResults);
      return {
        ...okr,
        keyResults,
        progresso,
      };
    })
  );

  return okrsWithKeyResults;
}

/**
 * Busca Key Results de um OKR
 * @param {string} okrId - ID do OKR
 * @returns {Promise<Array>}
 */
export async function fetchKeyResults(okrId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(KEY_RESULTS_TABLE)
    .select(`
      *,
      responsavel_user:responsavel_id(id, name, avatar_url)
    `)
    .eq('okr_id', okrId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar Key Results: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Calcula o progresso de um OKR baseado nos Key Results
 * @param {Array} keyResults - Array de Key Results
 * @returns {number} - Progresso em porcentagem (0-100)
 */
function calculateOKRProgress(keyResults) {
  if (!keyResults || keyResults.length === 0) return 0;

  const totalProgress = keyResults.reduce((sum, kr) => {
    const progress = kr.meta > 0 ? (kr.atual / kr.meta) * 100 : 0;
    return sum + Math.min(progress, 100);
  }, 0);

  return Math.round(totalProgress / keyResults.length);
}

/**
 * Cria um novo OKR
 * @param {Object} okrData - Dados do OKR
 * @returns {Promise<Object>}
 */
export async function createOKR(okrData) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(OKRS_TABLE)
    .insert([{
      titulo: okrData.titulo,
      nivel: okrData.nivel,
      responsavel: okrData.responsavel,
      responsavel_id: okrData.responsavel_id || null,
      quarter: okrData.quarter,
      created_by: okrData.created_by,
      peso: okrData.peso || 1,
      setor_id: okrData.setor_id || null,
    }])
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar OKR: ${error.message}`);
  }

  // Cria Key Results se fornecidos
  if (okrData.keyResults && okrData.keyResults.length > 0) {
    await Promise.all(
      okrData.keyResults.map((kr) =>
        createKeyResult({
          okr_id: data.id,
          descricao: kr.descricao,
          meta: kr.meta,
          atual: kr.atual || 0,
        })
      )
    );
  }

  // Busca OKR completo com Key Results
  const keyResults = await fetchKeyResults(data.id);
  const progresso = calculateOKRProgress(keyResults);
  return {
    ...data,
    keyResults,
    progresso,
  };
}

/**
 * Atualiza um OKR
 * @param {string} okrId - ID do OKR
 * @param {Object} okrData - Dados atualizados
 * @returns {Promise<Object>}
 */
export async function updateOKR(okrId, okrData) {
  const supabase = getSupabaseClient();

  // Build update object only with provided fields
  const updateData = {
    updated_at: new Date().toISOString(),
  };
  if (okrData.titulo !== undefined) updateData.titulo = okrData.titulo;
  if (okrData.nivel !== undefined) updateData.nivel = okrData.nivel;
  if (okrData.responsavel !== undefined) updateData.responsavel = okrData.responsavel;
  if (okrData.responsavel_id !== undefined) updateData.responsavel_id = okrData.responsavel_id;
  if (okrData.quarter !== undefined) updateData.quarter = okrData.quarter;
  if (okrData.peso !== undefined) updateData.peso = okrData.peso;
  if (okrData.setor_id !== undefined) updateData.setor_id = okrData.setor_id;

  const { data, error } = await supabase
    .from(OKRS_TABLE)
    .update(updateData)
    .eq('id', okrId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar OKR: ${error.message}`);
  }

  // Atualiza Key Results se fornecidos
  if (okrData.keyResults) {
    // Remove Key Results existentes
    await supabase.from(KEY_RESULTS_TABLE).delete().eq('okr_id', okrId);

    // Cria novos Key Results
    if (okrData.keyResults.length > 0) {
      await Promise.all(
        okrData.keyResults.map((kr) =>
          createKeyResult({
            okr_id: okrId,
            descricao: kr.descricao,
            meta: kr.meta,
            atual: kr.atual || 0,
          })
        )
      );
    }
  }

  // Busca OKR completo com Key Results
  const okr = await fetchOKRs();
  return okr.find((o) => o.id === okrId);
}

/**
 * Deleta um OKR
 * @param {string} okrId - ID do OKR
 * @returns {Promise<void>}
 */
export async function deleteOKR(okrId) {
  const supabase = getSupabaseClient();

  // Deleta Key Results primeiro
  await supabase.from(KEY_RESULTS_TABLE).delete().eq('okr_id', okrId);

  // Deleta OKR
  const { error } = await supabase.from(OKRS_TABLE).delete().eq('id', okrId);

  if (error) {
    throw new Error(`Erro ao deletar OKR: ${error.message}`);
  }
}

/**
 * Cria um Key Result
 * @param {Object} krData - Dados do Key Result
 * @returns {Promise<Object>}
 */
export async function createKeyResult(krData) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(KEY_RESULTS_TABLE)
    .insert([krData])
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar Key Result: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza um Key Result
 * @param {string} krId - ID do Key Result
 * @param {Object} krData - Dados atualizados
 * @returns {Promise<Object>}
 */
export async function updateKeyResult(krId, krData) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(KEY_RESULTS_TABLE)
    .update({
      ...krData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', krId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar Key Result: ${error.message}`);
  }

  return data;
}

/**
 * Recalcula o valor consolidado de um Key Result baseado nos check-ins
 * e o planejado acumulado baseado nas metas mensais
 * Só executa se auto_calculate=true
 * @param {string} krId - ID do Key Result
 * @returns {Promise<Object|null>}
 */
export async function recalculateKRConsolidatedValue(krId) {
  const supabase = getSupabaseClient();

  // 1. Buscar KR para saber consolidation_type, auto_calculate e monthly_targets
  const { data: kr, error: krError } = await supabase
    .from(KEY_RESULTS_TABLE)
    .select('id, consolidation_type, auto_calculate, monthly_targets')
    .eq('id', krId)
    .single();

  if (krError || !kr) {
    console.log(`[recalculateKR] KR não encontrado: ${krId}`);
    return null;
  }

  // Só recalcula se auto_calculate estiver ativo
  if (!kr.auto_calculate) {
    console.log(`[recalculateKR] auto_calculate=false para KR ${krId}, ignorando`);
    return null;
  }

  const type = kr.consolidation_type || 'last_value';
  const currentMonth = new Date().getMonth() + 1; // 1-12

  // 2. Calcular planejado acumulado das metas mensais
  let planejadoAcumulado = null;
  if (kr.monthly_targets && Object.keys(kr.monthly_targets).length > 0) {
    const targets = kr.monthly_targets;
    const relevantMonths = Object.keys(targets)
      .map(Number)
      .filter(m => m <= currentMonth)
      .sort((a, b) => a - b);

    if (relevantMonths.length > 0) {
      if (type === 'sum') {
        planejadoAcumulado = relevantMonths.reduce((sum, m) => sum + (targets[m] || 0), 0);
      } else if (type === 'average') {
        const sum = relevantMonths.reduce((acc, m) => acc + (targets[m] || 0), 0);
        planejadoAcumulado = Math.round((sum / relevantMonths.length) * 100) / 100;
      } else { // last_value (default)
        const lastMonth = relevantMonths[relevantMonths.length - 1];
        planejadoAcumulado = targets[lastMonth] ?? null;
      }
    }
  }

  // 3. Buscar todos check-ins do KR com valor não nulo
  const { data: checkIns, error: checkInsError } = await supabase
    .from('okr_check_ins')
    .select('mes, ano, valor')
    .eq('key_result_id', krId)
    .not('valor', 'is', null);

  if (checkInsError) {
    console.error(`[recalculateKR] Erro ao buscar check-ins: ${checkInsError.message}`);
    return null;
  }

  // 4. Calcular realizado baseado em consolidation_type
  let calculatedValue = 0;
  if (checkIns && checkIns.length > 0) {
    if (type === 'sum') {
      calculatedValue = checkIns.reduce((sum, c) => sum + (c.valor || 0), 0);
    } else if (type === 'average') {
      const sum = checkIns.reduce((acc, c) => acc + (c.valor || 0), 0);
      calculatedValue = Math.round((sum / checkIns.length) * 100) / 100;
    } else { // last_value (default)
      const sorted = [...checkIns].sort((a, b) => {
        if (a.ano !== b.ano) return b.ano - a.ano;
        return b.mes - a.mes;
      });
      calculatedValue = sorted[0]?.valor ?? 0;
    }
  }

  console.log(`[recalculateKR] KR ${krId}: tipo=${type}, realizado=${calculatedValue}, planejado=${planejadoAcumulado}`);

  // 5. Atualizar KR com valores calculados
  const updateData = {
    atual: calculatedValue,
    updated_at: new Date().toISOString(),
  };

  // Só atualiza planejado_acumulado se foi calculado (há metas mensais)
  if (planejadoAcumulado !== null) {
    updateData.planejado_acumulado = planejadoAcumulado;
  }

  const { data: updated, error: updateError } = await supabase
    .from(KEY_RESULTS_TABLE)
    .update(updateData)
    .eq('id', krId)
    .select()
    .single();

  if (updateError) {
    console.error(`[recalculateKR] Erro ao atualizar KR: ${updateError.message}`);
    return null;
  }

  return updated;
}

// ============================================
// OKR Check-ins
// ============================================

const OKR_CHECK_INS_TABLE = 'okr_check_ins';

/**
 * Busca check-ins de OKRs
 * @param {Array} keyResultIds - IDs dos Key Results
 * @returns {Promise<Array>}
 */
export async function fetchOKRCheckIns(keyResultIds = []) {
  const supabase = getSupabaseClient();

  let query = supabase
    .from(OKR_CHECK_INS_TABLE)
    .select('*')
    .order('ano', { ascending: false })
    .order('mes', { ascending: false });

  if (keyResultIds && keyResultIds.length > 0) {
    query = query.in('key_result_id', keyResultIds);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao buscar check-ins de OKR: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Cria um check-in de OKR
 * @param {Object} checkInData - Dados do check-in
 * @returns {Promise<Object>}
 */
export async function createOKRCheckIn(checkInData) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(OKR_CHECK_INS_TABLE)
    .insert([checkInData])
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar check-in de OKR: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza um check-in de OKR
 * @param {string} checkInId - ID do check-in
 * @param {Object} checkInData - Dados atualizados
 * @returns {Promise<Object>}
 */
export async function updateOKRCheckIn(checkInId, checkInData) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(OKR_CHECK_INS_TABLE)
    .update({
      ...checkInData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', checkInId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar check-in de OKR: ${error.message}`);
  }

  return data;
}

/**
 * Deleta um check-in de OKR
 * @param {string} checkInId - ID do check-in
 * @returns {Promise<void>}
 */
export async function deleteOKRCheckIn(checkInId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(OKR_CHECK_INS_TABLE)
    .delete()
    .eq('id', checkInId);

  if (error) {
    throw new Error(`Erro ao deletar check-in de OKR: ${error.message}`);
  }
}

/**
 * Busca um OKR por ID com seus Key Results
 * @param {string} okrId - ID do OKR
 * @returns {Promise<Object>}
 */
export async function fetchOKRById(okrId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(OKRS_TABLE)
    .select(`
      *,
      responsavel_user:responsavel_id(id, name, avatar_url),
      key_results(*, responsavel_user:responsavel_id(id, name, avatar_url))
    `)
    .eq('id', okrId)
    .single();

  if (error) {
    throw new Error(`Erro ao buscar OKR: ${error.message}`);
  }

  return data;
}

// ============================================
// OKR Initiatives (Iniciativas)
// ============================================

const OKR_INITIATIVES_TABLE = 'okr_initiatives';

/**
 * Busca iniciativas de um objetivo
 * @param {number} objectiveId - ID do objetivo
 * @returns {Promise<Array>}
 */
export async function fetchOKRInitiatives(objectiveId) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from(OKR_INITIATIVES_TABLE)
    .select(`
      *,
      responsible_user:responsible_id(id, name, avatar_url)
    `)
    .eq('objective_id', objectiveId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar iniciativas: ${error.message}`);
  }

  return data || [];
}

/**
 * Cria uma nova iniciativa
 * @param {Object} initiativeData - Dados da iniciativa
 * @returns {Promise<Object>}
 */
export async function createOKRInitiative(initiativeData) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from(OKR_INITIATIVES_TABLE)
    .insert({
      ...initiativeData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar iniciativa: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza uma iniciativa
 * @param {string} initiativeId - ID da iniciativa
 * @param {Object} initiativeData - Dados atualizados
 * @returns {Promise<Object>}
 */
export async function updateOKRInitiative(initiativeId, initiativeData) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from(OKR_INITIATIVES_TABLE)
    .update({
      ...initiativeData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', initiativeId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar iniciativa: ${error.message}`);
  }

  return data;
}

/**
 * Deleta uma iniciativa
 * @param {string} initiativeId - ID da iniciativa
 * @returns {Promise<void>}
 */
export async function deleteOKRInitiative(initiativeId) {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from(OKR_INITIATIVES_TABLE)
    .delete()
    .eq('id', initiativeId);

  if (error) {
    throw new Error(`Erro ao deletar iniciativa: ${error.message}`);
  }
}

// ============================================
// Initiative Comments (Comentários de Iniciativas)
// ============================================

const INITIATIVE_COMMENTS_TABLE = 'okr_initiative_comments';

/**
 * Busca comentários de uma iniciativa
 * @param {string} initiativeId - ID da iniciativa
 * @returns {Promise<Array>}
 */
export async function fetchInitiativeComments(initiativeId) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from(INITIATIVE_COMMENTS_TABLE)
    .select('*')
    .eq('initiative_id', initiativeId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar comentários: ${error.message}`);
  }

  return data || [];
}

/**
 * Busca comentários de múltiplas iniciativas
 * @param {Array} initiativeIds - IDs das iniciativas
 * @returns {Promise<Array>}
 */
export async function fetchCommentsForInitiatives(initiativeIds) {
  if (!initiativeIds || initiativeIds.length === 0) return [];

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from(INITIATIVE_COMMENTS_TABLE)
    .select('*')
    .in('initiative_id', initiativeIds)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar comentários: ${error.message}`);
  }

  return data || [];
}

/**
 * Cria um novo comentário
 * @param {Object} commentData - Dados do comentário
 * @returns {Promise<Object>}
 */
export async function createInitiativeComment(commentData) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from(INITIATIVE_COMMENTS_TABLE)
    .insert({
      ...commentData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar comentário: ${error.message}`);
  }

  return data;
}

/**
 * Deleta um comentário
 * @param {string} commentId - ID do comentário
 * @returns {Promise<void>}
 */
export async function deleteInitiativeComment(commentId) {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from(INITIATIVE_COMMENTS_TABLE)
    .delete()
    .eq('id', commentId);

  if (error) {
    throw new Error(`Erro ao deletar comentário: ${error.message}`);
  }
}

// ============================================
// Indicadores
// ============================================

const INDICADORES_TABLE = 'indicadores';

/**
 * Busca todos os indicadores
 * @param {string} [period] - Período (mensal, trimestral, anual)
 * @param {string} [category] - Categoria (projetos, financeiro, operacional)
 * @returns {Promise<Array>}
 */
export async function fetchIndicadores(period = null, category = null) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from(INDICADORES_TABLE)
    .select('*')
    .order('nome', { ascending: true });

  if (period) {
    query = query.eq('periodo', period);
  }

  if (category && category !== 'todos') {
    query = query.eq('categoria', category);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao buscar indicadores: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Cria um novo indicador
 * @param {Object} indicadorData - Dados do indicador
 * @returns {Promise<Object>}
 */
export async function createIndicador(indicadorData) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(INDICADORES_TABLE)
    .insert([indicadorData])
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar indicador: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza um indicador
 * @param {string} indicadorId - ID do indicador
 * @param {Object} indicadorData - Dados atualizados
 * @returns {Promise<Object>}
 */
export async function updateIndicador(indicadorId, indicadorData) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(INDICADORES_TABLE)
    .update({
      ...indicadorData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', indicadorId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar indicador: ${error.message}`);
  }

  return data;
}

/**
 * Deleta um indicador
 * @param {string} indicadorId - ID do indicador
 * @returns {Promise<void>}
 */
export async function deleteIndicador(indicadorId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(INDICADORES_TABLE)
    .delete()
    .eq('id', indicadorId);

  if (error) {
    throw new Error(`Erro ao deletar indicador: ${error.message}`);
  }
}

// ============================================
// Sistema de Indicadores Individuais
// ============================================

const SECTORS_TABLE = 'sectors';
const POSITIONS_TABLE = 'positions';
const POSITION_INDICATORS_TABLE = 'position_indicators';
const USERS_OTUS_TABLE = 'users_otus';
const CHECK_INS_TABLE = 'indicadores_check_ins';
const RECOVERY_PLANS_TABLE = 'recovery_plans';

// Valid metric types accepted by the indicadores table constraint
const VALID_METRIC_TYPES = ['number', 'integer', 'percentage', 'boolean', 'currency'];

/**
 * Sanitiza metric_type para garantir compatibilidade com a constraint do banco.
 * Retorna 'number' como fallback seguro se o valor for invalido.
 */
function sanitizeMetricType(value) {
  if (value && VALID_METRIC_TYPES.includes(value)) return value;
  console.warn(`[sanitizeMetricType] Valor invalido: "${value}" — usando 'number'`);
  return 'number';
}

// --- SETORES ---

/**
 * Busca todos os setores
 * @returns {Promise<Array>}
 */
export async function fetchSectors() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SECTORS_TABLE)
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar setores: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Busca um setor por ID
 * @param {string} sectorId - ID do setor
 * @returns {Promise<Object>}
 */
export async function getSectorById(sectorId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SECTORS_TABLE)
    .select('*')
    .eq('id', sectorId)
    .single();

  if (error) {
    throw new Error(`Erro ao buscar setor: ${error.message}`);
  }

  return data;
}

/**
 * Cria um novo setor
 * @param {Object} sectorData - Dados do setor
 * @returns {Promise<Object>}
 */
export async function createSector(sectorData) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SECTORS_TABLE)
    .insert([{
      name: sectorData.name,
      description: sectorData.description || null,
      can_access_projetos: sectorData.can_access_projetos || false,
      can_access_configuracoes: sectorData.can_access_configuracoes || false,
    }])
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar setor: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza um setor
 * @param {string} sectorId - ID do setor
 * @param {Object} sectorData - Dados atualizados
 * @returns {Promise<Object>}
 */
export async function updateSector(sectorId, sectorData) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SECTORS_TABLE)
    .update({
      ...sectorData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sectorId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar setor: ${error.message}`);
  }

  return data;
}

/**
 * Deleta um setor
 * @param {string} sectorId - ID do setor
 * @returns {Promise<void>}
 */
export async function deleteSector(sectorId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(SECTORS_TABLE)
    .delete()
    .eq('id', sectorId);

  if (error) {
    throw new Error(`Erro ao deletar setor: ${error.message}`);
  }
}

// --- CARGOS ---

/**
 * Busca todos os cargos
 * @param {string} [sectorId] - Filtro por setor
 * @returns {Promise<Array>}
 */
export async function fetchPositions(sectorId = null) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from(POSITIONS_TABLE)
    .select(`
      *,
      sector:sector_id(id, name)
    `)
    .order('name', { ascending: true });

  if (sectorId) {
    query = query.eq('sector_id', sectorId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao buscar cargos: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Busca um cargo por ID
 * @param {string} positionId - ID do cargo
 * @returns {Promise<Object>}
 */
export async function getPositionById(positionId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(POSITIONS_TABLE)
    .select(`
      *,
      sector:sector_id(id, name)
    `)
    .eq('id', positionId)
    .single();

  if (error) {
    throw new Error(`Erro ao buscar cargo: ${error.message}`);
  }

  return data;
}

/**
 * Cria um novo cargo
 * @param {Object} positionData - Dados do cargo
 * @returns {Promise<Object>}
 */
export async function createPosition(positionData) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(POSITIONS_TABLE)
    .insert([{
      name: positionData.name,
      description: positionData.description || null,
      is_leadership: positionData.is_leadership || false,
      sector_id: positionData.sector_id || null,
    }])
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar cargo: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza um cargo
 * @param {string} positionId - ID do cargo
 * @param {Object} positionData - Dados atualizados
 * @returns {Promise<Object>}
 */
export async function updatePosition(positionId, positionData) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(POSITIONS_TABLE)
    .update({
      ...positionData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', positionId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar cargo: ${error.message}`);
  }

  return data;
}

/**
 * Deleta um cargo
 * @param {string} positionId - ID do cargo
 * @returns {Promise<void>}
 */
export async function deletePosition(positionId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(POSITIONS_TABLE)
    .delete()
    .eq('id', positionId);

  if (error) {
    throw new Error(`Erro ao deletar cargo: ${error.message}`);
  }
}

// --- TEMPLATES DE INDICADORES POR CARGO ---

/**
 * Busca templates de indicadores de um cargo
 * @param {string} positionId - ID do cargo
 * @returns {Promise<Array>}
 */
export async function fetchPositionIndicators(positionId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(POSITION_INDICATORS_TABLE)
    .select('*')
    .eq('position_id', positionId)
    .order('title', { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar templates de indicadores: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Cria um template de indicador para um cargo
 * @param {string} positionId - ID do cargo
 * @param {Object} templateData - Dados do template
 * @returns {Promise<Object>}
 */
export async function createPositionIndicator(positionId, templateData) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(POSITION_INDICATORS_TABLE)
    .insert([{
      position_id: positionId,
      title: templateData.title,
      description: templateData.description || null,
      metric_type: templateData.metric_type || 'number',
      consolidation_type: templateData.consolidation_type || 'last_value',
      default_initial: templateData.default_initial || 0,
      default_target: templateData.default_target,
      default_threshold_80: templateData.default_threshold_80,
      default_threshold_120: templateData.default_threshold_120,
      default_weight: templateData.default_weight ?? 1,
      is_inverse: templateData.is_inverse || false,
      monthly_targets: templateData.monthly_targets || {},
      active_quarters: templateData.active_quarters || { q1: true, q2: true, q3: true, q4: true },
      auto_calculate: templateData.auto_calculate !== false,
      mes_inicio: templateData.mes_inicio || 1,
      frequencia: templateData.frequencia || 'mensal',
      setor_apuracao_id: templateData.setor_apuracao_id || null,
    }])
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar template de indicador: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza um template de indicador
 * @param {string} templateId - ID do template
 * @param {Object} templateData - Dados atualizados
 * @returns {Promise<Object>}
 */
export async function updatePositionIndicator(templateId, templateData) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(POSITION_INDICATORS_TABLE)
    .update({
      ...templateData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', templateId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar template de indicador: ${error.message}`);
  }

  return data;
}

/**
 * Deleta um template de indicador
 * @param {string} templateId - ID do template
 * @returns {Promise<void>}
 */
export async function deletePositionIndicator(templateId) {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from(POSITION_INDICATORS_TABLE)
    .delete()
    .eq('id', templateId);

  if (error) {
    throw new Error(`Erro ao deletar template de indicador: ${error.message}`);
  }
}

// --- INDICADORES INDIVIDUAIS ---

/**
 * Busca indicadores individuais com filtros
 * @param {Object} filters - Filtros de busca
 * @param {string} [filters.person_email] - Email da pessoa
 * @param {string} [filters.ciclo] - Ciclo (q1, q2, q3, q4, anual)
 * @param {number} [filters.ano] - Ano
 * @param {string} [filters.setor_id] - ID do setor
 * @returns {Promise<Array>}
 */
export async function fetchIndicadoresIndividuais(filters = {}) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from(INDICADORES_TABLE)
    .select(`
      *,
      setor:setor_id(id, name),
      cargo:cargo_id(id, name),
      template:template_id(id, title)
    `)
    .not('person_email', 'is', null)
    .order('nome', { ascending: true });

  if (filters.person_email) {
    query = query.eq('person_email', filters.person_email);
  }

  if (filters.ciclo) {
    // Indicadores anuais devem aparecer em qualquer quarter selecionado
    if (['q1', 'q2', 'q3', 'q4'].includes(filters.ciclo)) {
      query = query.in('ciclo', [filters.ciclo, 'anual']);
    } else {
      query = query.eq('ciclo', filters.ciclo);
    }
  }

  if (filters.ano) {
    query = query.eq('ano', filters.ano);
  }

  if (filters.setor_id) {
    query = query.eq('setor_id', filters.setor_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao buscar indicadores individuais: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Busca um indicador por ID com check-ins
 * @param {string} indicadorId - ID do indicador
 * @returns {Promise<Object>}
 */
export async function getIndicadorById(indicadorId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(INDICADORES_TABLE)
    .select(`
      *,
      setor:setor_id(id, name),
      cargo:cargo_id(id, name),
      template:template_id(id, title)
    `)
    .eq('id', indicadorId)
    .single();

  if (error) {
    throw new Error(`Erro ao buscar indicador: ${error.message}`);
  }

  // Busca dados da pessoa (pelo person_email)
  let pessoa = null;
  if (data.person_email) {
    const { data: user, error: userError } = await supabase
      .from(USERS_OTUS_TABLE)
      .select('id, name, email, avatar_url')
      .eq('email', data.person_email)
      .single();

    if (!userError && user) {
      pessoa = user;
    }
  }

  // Busca check-ins do indicador
  const checkIns = await fetchCheckIns(indicadorId);
  // Busca planos de recuperação
  const recoveryPlans = await fetchRecoveryPlans(indicadorId);

  return {
    ...data,
    pessoa,
    check_ins: checkIns,
    recovery_plans: recoveryPlans,
  };
}

/**
 * Cria um indicador a partir de um template
 * @param {string} templateId - ID do template
 * @param {string} personEmail - Email da pessoa
 * @param {string} ciclo - Ciclo (q1, q2, q3, q4, anual)
 * @param {number} ano - Ano
 * @returns {Promise<Object>}
 */
export async function createIndicadorFromTemplate(templateId, personEmail, ciclo, ano) {
  const supabase = getSupabaseClient();

  // Busca o template
  const { data: template, error: templateError } = await supabase
    .from(POSITION_INDICATORS_TABLE)
    .select(`
      *,
      position:position_id(id, name, sector_id)
    `)
    .eq('id', templateId)
    .single();

  if (templateError) {
    throw new Error(`Erro ao buscar template: ${templateError.message}`);
  }

  // Cria o indicador
  const { data, error } = await supabase
    .from(INDICADORES_TABLE)
    .insert([{
      nome: template.title,
      descricao: template.description,
      valor: template.default_initial || 0,
      meta: template.default_target,
      unidade: template.metric_type === 'percentage' ? '%' :
               template.metric_type === 'currency' ? 'R$' :
               template.metric_type === 'boolean' ? 'sim/não' :
               template.metric_type === 'integer' ? 'un' : 'un',
      categoria: 'pessoas',
      periodo: ciclo === 'anual' ? 'anual' : 'trimestral',
      ciclo,
      ano,
      person_email: personEmail,
      cargo_id: template.position_id,
      setor_id: template.position?.sector_id || null,
      template_id: templateId,
      peso: template.default_weight ?? 1,
      threshold_80: template.default_threshold_80,
      threshold_120: template.default_threshold_120,
      is_inverse: template.is_inverse || false,
      consolidation_type: template.consolidation_type || 'last_value',
      metric_type: sanitizeMetricType(template.metric_type),
      monthly_targets: template.monthly_targets || {},
      active_quarters: template.active_quarters || { q1: true, q2: true, q3: true, q4: true },
      auto_calculate: template.auto_calculate !== false,
      mes_inicio: template.mes_inicio || 1,
      frequencia: template.frequencia || 'mensal',
      setor_apuracao_id: template.setor_apuracao_id || null,
    }])
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar indicador: ${error.message}`);
  }

  return data;
}

/**
 * Sincroniza indicadores de um cargo com os usuarios que possuem esse cargo
 * Cria apenas os indicadores faltantes, sem sobrescrever existentes
 * @param {string} positionId - ID do cargo
 * @param {string} ciclo - Ciclo (q1, q2, q3, q4, anual)
 * @param {number} ano - Ano
 * @param {string} [leaderId] - ID do lider (opcional - para filtrar apenas liderados)
 * @returns {Promise<Object>} - Resultado com criados e ignorados
 */
export async function syncPositionIndicators(positionId, ciclo, ano, leaderId = null) {
  const supabase = getSupabaseClient();

  // 1. Busca todos os templates do cargo
  const { data: templates, error: templatesError } = await supabase
    .from(POSITION_INDICATORS_TABLE)
    .select('*')
    .eq('position_id', positionId);

  if (templatesError) {
    throw new Error(`Erro ao buscar templates: ${templatesError.message}`);
  }

  if (!templates || templates.length === 0) {
    return { created: 0, updated: 0, usersProcessed: 0, templatesCount: 0, details: [], errors: [], message: 'Nenhum template (indicador) encontrado para este cargo. Configure indicadores no Admin de Cargos antes de sincronizar.' };
  }

  // 2. Busca usuarios com esse cargo (opcionalmente filtrado por lider)
  let query = supabase
    .from(USERS_OTUS_TABLE)
    .select('id, email, name')
    .eq('position_id', positionId)
    .eq('status', 'ativo');

  if (leaderId) {
    query = query.eq('leader_id', leaderId);
  }

  const { data: users, error: usersError } = await query;

  if (usersError) {
    throw new Error(`Erro ao buscar usuarios: ${usersError.message}`);
  }

  if (!users || users.length === 0) {
    return { created: 0, updated: 0, usersProcessed: 0, templatesCount: templates.length, details: [], errors: [], message: 'Nenhum usuario ativo encontrado com este cargo. Verifique se ha usuarios com este cargo atribuido em Admin > Usuarios.' };
  }

  console.log(`[sync] Cargo ${positionId} - Encontrados ${users.length} usuarios: ${users.map(u => u.name).join(', ')}`);

  // 3. Busca info do cargo para o setor (1 query, fora dos loops)
  const { data: position } = await supabase
    .from('positions')
    .select('sector_id')
    .eq('id', positionId)
    .single();

  // 4. Para cada usuario, verifica quais indicadores faltam e cria/atualiza
  let created = 0;
  let updated = 0;
  const details = [];
  const errors = [];

  for (const user of users) {
    // Busca indicadores existentes do usuario para este ciclo/ano (com dados para merge)
    const { data: existingIndicators } = await supabase
      .from(INDICADORES_TABLE)
      .select('id, template_id, monthly_targets')
      .eq('person_email', user.email)
      .eq('ciclo', ciclo)
      .eq('ano', ano);

    const existingByTemplateId = new Map(
      (existingIndicators || []).map(i => [i.template_id, i])
    );

    for (const template of templates) {
      const existing = existingByTemplateId.get(template.id);

      if (existing) {
        // UPDATE: indicador ja existe — atualizar campos do template,
        // preservando monthly_targets de meses que ja tem check-in
        try {
          const checkIns = await fetchCheckIns(existing.id);
          const monthsWithCheckIns = new Set(
            checkIns.filter(ci => ci.ano === ano).map(ci => String(ci.mes))
          );

          // Merge monthly_targets: template para meses sem check-in, existente para meses com check-in
          const templateTargets = template.monthly_targets || {};
          const existingTargets = existing.monthly_targets || {};
          const mergedTargets = { ...templateTargets };
          for (const month of monthsWithCheckIns) {
            if (existingTargets[month] !== undefined) {
              mergedTargets[month] = existingTargets[month];
            }
          }

          const { error: updateError } = await supabase
            .from(INDICADORES_TABLE)
            .update({
              nome: template.title,
              descricao: template.description,
              meta: template.default_target,
              threshold_80: template.default_threshold_80,
              threshold_120: template.default_threshold_120,
              peso: template.default_weight ?? 1,
              is_inverse: template.is_inverse || false,
              consolidation_type: template.consolidation_type || 'last_value',
              metric_type: sanitizeMetricType(template.metric_type),
              monthly_targets: mergedTargets,
              active_quarters: template.active_quarters || { q1: true, q2: true, q3: true, q4: true },
              auto_calculate: template.auto_calculate !== false,
              mes_inicio: template.mes_inicio || 1,
              frequencia: template.frequencia || 'mensal',
              setor_apuracao_id: template.setor_apuracao_id || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error(`Erro ao atualizar indicador para ${user.email}:`, updateError);
            errors.push({ user: user.name, indicator: template.title, error: updateError.message });
          } else {
            updated++;
            details.push({ user: user.name, indicator: template.title, action: 'updated' });
          }
        } catch (err) {
          console.error(`Erro ao processar atualização para ${user.email}:`, err);
          errors.push({ user: user.name, indicator: template.title, error: err.message });
        }
        continue;
      }

      // CREATE: indicador nao existe — criar novo
      const { error: createError } = await supabase
        .from(INDICADORES_TABLE)
        .insert({
          nome: template.title,
          descricao: template.description,
          valor: template.default_initial || 0,
          meta: template.default_target,
          unidade: template.metric_type === 'percentage' ? '%' :
                   template.metric_type === 'currency' ? 'R$' :
                   template.metric_type === 'boolean' ? 'sim/não' :
                   template.metric_type === 'integer' ? 'un' : 'un',
          categoria: 'pessoas',
          periodo: ciclo === 'anual' ? 'anual' : 'trimestral',
          ciclo,
          ano,
          person_email: user.email,
          cargo_id: positionId,
          setor_id: position?.sector_id || null,
          template_id: template.id,
          peso: template.default_weight ?? 1,
          threshold_80: template.default_threshold_80,
          threshold_120: template.default_threshold_120,
          is_inverse: template.is_inverse || false,
          consolidation_type: template.consolidation_type || 'last_value',
          metric_type: sanitizeMetricType(template.metric_type),
          monthly_targets: template.monthly_targets || {},
          active_quarters: template.active_quarters || { q1: true, q2: true, q3: true, q4: true },
          auto_calculate: template.auto_calculate !== false,
          mes_inicio: template.mes_inicio || 1,
          frequencia: template.frequencia || 'mensal',
          setor_apuracao_id: template.setor_apuracao_id || null,
        });

      if (createError) {
        console.error(`Erro ao criar indicador para ${user.email}:`, createError);
        errors.push({ user: user.name, indicator: template.title, error: createError.message });
      } else {
        created++;
        details.push({ user: user.name, indicator: template.title, action: 'created' });
      }
    }
  }

  return {
    created,
    updated,
    usersProcessed: users.length,
    templatesCount: templates.length,
    details,
    errors,
    message: `${created} indicadores criados, ${updated} atualizados`
  };
}

/**
 * Atualiza um indicador individual
 * @param {string} indicadorId - ID do indicador
 * @param {Object} updateData - Dados atualizados
 * @returns {Promise<Object>}
 */
export async function updateIndicadorIndividual(indicadorId, updateData) {
  const supabase = getSupabaseClient();
  const sanitizedData = { ...updateData };
  if (sanitizedData.metric_type !== undefined) {
    sanitizedData.metric_type = sanitizeMetricType(sanitizedData.metric_type);
  }
  const { data, error } = await supabase
    .from(INDICADORES_TABLE)
    .update({
      ...sanitizedData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', indicadorId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar indicador: ${error.message}`);
  }

  return data;
}

// --- CHECK-INS ---

/**
 * Busca check-ins de um indicador
 * @param {string} indicadorId - ID do indicador
 * @returns {Promise<Array>}
 */
export async function fetchCheckIns(indicadorId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(CHECK_INS_TABLE)
    .select('*')
    .eq('indicador_id', indicadorId)
    .order('ano', { ascending: true })
    .order('mes', { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar check-ins: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Cria ou atualiza um check-in mensal (upsert)
 * @param {Object} checkInData - Dados do check-in
 * @returns {Promise<Object>}
 */
export async function createCheckIn(checkInData) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(CHECK_INS_TABLE)
    .upsert({
      indicador_id: checkInData.indicador_id,
      mes: checkInData.mes,
      ano: checkInData.ano,
      valor: checkInData.valor,
      notas: checkInData.notas || null,
      created_by: checkInData.created_by || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'indicador_id,mes,ano',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar check-in: ${error.message}`);
  }

  // Atualiza o valor consolidado do indicador
  await updateIndicadorConsolidatedValue(checkInData.indicador_id);

  return data;
}

/**
 * Atualiza um check-in
 * @param {string} checkInId - ID do check-in
 * @param {Object} checkInData - Dados atualizados
 * @returns {Promise<Object>}
 */
export async function updateCheckIn(checkInId, checkInData) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(CHECK_INS_TABLE)
    .update({
      ...checkInData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', checkInId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar check-in: ${error.message}`);
  }

  // Atualiza o valor consolidado do indicador
  if (data.indicador_id) {
    await updateIndicadorConsolidatedValue(data.indicador_id);
  }

  return data;
}

/**
 * Busca um check-in por ID
 * @param {string} checkInId - ID do check-in
 * @returns {Promise<Object|null>}
 */
export async function getCheckInById(checkInId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(CHECK_INS_TABLE)
    .select('*')
    .eq('id', checkInId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Erro ao buscar check-in: ${error.message}`);
  }

  return data;
}

/**
 * Exclui um check-in
 * @param {string} checkInId - ID do check-in
 * @param {string} indicadorId - ID do indicador para atualizar valor consolidado
 */
export async function deleteCheckIn(checkInId, indicadorId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(CHECK_INS_TABLE)
    .delete()
    .eq('id', checkInId);

  if (error) {
    throw new Error(`Erro ao excluir check-in: ${error.message}`);
  }

  // Atualiza o valor consolidado do indicador
  if (indicadorId) {
    await updateIndicadorConsolidatedValue(indicadorId);
  }
}

/**
 * Atualiza o valor consolidado de um indicador baseado nos check-ins
 * @param {string} indicadorId - ID do indicador
 */
async function updateIndicadorConsolidatedValue(indicadorId) {
  const supabase = getSupabaseClient();

  // Busca o indicador
  const { data: indicador, error: indError } = await supabase
    .from(INDICADORES_TABLE)
    .select('consolidation_type')
    .eq('id', indicadorId)
    .single();

  if (indError) return;

  // Busca todos os check-ins
  const checkIns = await fetchCheckIns(indicadorId);

  // Se não há check-ins, reseta para valor inicial
  if (checkIns.length === 0) {
    await supabase
      .from(INDICADORES_TABLE)
      .update({
        valor: indicador.valor_inicial || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', indicadorId);
    return;
  }

  let valorConsolidado = 0;
  const consolidationType = indicador.consolidation_type || 'last_value';

  switch (consolidationType) {
    case 'sum':
      valorConsolidado = checkIns.reduce((sum, ci) => sum + (parseFloat(ci.valor) || 0), 0);
      break;
    case 'average':
      valorConsolidado = checkIns.reduce((sum, ci) => sum + (parseFloat(ci.valor) || 0), 0) / checkIns.length;
      break;
    case 'last_value':
    default:
      valorConsolidado = parseFloat(checkIns[checkIns.length - 1].valor) || 0;
      break;
  }

  // Atualiza o indicador
  await supabase
    .from(INDICADORES_TABLE)
    .update({
      valor: valorConsolidado,
      updated_at: new Date().toISOString()
    })
    .eq('id', indicadorId);
}

// --- PLANOS DE RECUPERAÇÃO ---

/**
 * Busca planos de recuperação de um indicador
 * @param {string} indicadorId - ID do indicador
 * @returns {Promise<Array>}
 */
export async function fetchRecoveryPlans(indicadorId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(RECOVERY_PLANS_TABLE)
    .select('*')
    .eq('indicador_id', indicadorId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar planos de recuperação: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Cria um plano de recuperação
 * @param {Object} planData - Dados do plano
 * @returns {Promise<Object>}
 */
export async function createRecoveryPlan(planData) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(RECOVERY_PLANS_TABLE)
    .insert([{
      indicador_id: planData.indicador_id,
      descricao: planData.descricao,
      acoes: planData.acoes || null,
      prazo: planData.prazo || null,
      status: 'pendente',
      mes_referencia: planData.mes_referencia || null,
      ano_referencia: planData.ano_referencia || null,
      created_by: planData.created_by || null,
    }])
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar plano de recuperação: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza um plano de recuperação
 * @param {string} planId - ID do plano
 * @param {Object} planData - Dados atualizados
 * @returns {Promise<Object>}
 */
export async function updateRecoveryPlan(planId, planData) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(RECOVERY_PLANS_TABLE)
    .update({
      ...planData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', planId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar plano de recuperação: ${error.message}`);
  }

  return data;
}

/**
 * Exclui um plano de recuperação
 * @param {string} planId - ID do plano
 */
export async function deleteRecoveryPlan(planId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(RECOVERY_PLANS_TABLE)
    .delete()
    .eq('id', planId);

  if (error) {
    throw new Error(`Erro ao excluir plano de recuperação: ${error.message}`);
  }
}

// --- PESSOAS / EQUIPE ---

/**
 * Busca pessoas com seus indicadores e scores
 * @param {Object} filters - Filtros de busca
 * @param {string} [filters.setor_id] - ID do setor
 * @param {string} [filters.ciclo] - Ciclo
 * @param {number} [filters.ano] - Ano
 * @returns {Promise<Array>}
 */
export async function fetchPeopleWithScores(filters = {}) {
  const supabase = getSupabaseClient();

  // Busca usuários ativos
  let usersQuery = supabase
    .from(USERS_OTUS_TABLE)
    .select(`
      id,
      name,
      email,
      avatar_url,
      setor:setor_id(id, name),
      cargo:position_id(id, name, is_leadership)
    `)
    .eq('status', 'ativo')
    .order('name', { ascending: true });

  if (filters.setor_id) {
    usersQuery = usersQuery.eq('setor_id', filters.setor_id);
  }

  // Filtra por líder se especificado
  if (filters.leader_id) {
    usersQuery = usersQuery.eq('leader_id', filters.leader_id);
  }

  const { data: users, error: usersError } = await usersQuery;

  if (usersError) {
    throw new Error(`Erro ao buscar pessoas: ${usersError.message}`);
  }

  // Para cada pessoa, busca indicadores e calcula score
  const peopleWithScores = await Promise.all(
    (users || []).map(async (user) => {
      if (!user.email) return { ...user, score: null, indicadoresCount: 0 };

      const allIndicadores = await fetchIndicadoresIndividuais({
        person_email: user.email,
        ciclo: filters.ciclo,
        ano: filters.ano,
      });

      // Filtrar indicadores que têm meses ativos no ciclo selecionado
      const indicadores = allIndicadores.filter(ind => hasActiveMonthsInCycle(ind, filters.ciclo));

      const score = calculatePersonScore(indicadores);

      return {
        ...user,
        score,
        indicadoresCount: indicadores.length,
        indicadoresAtRisk: indicadores.filter(i => {
          const indScore = calculateIndicatorScore(i);
          return indScore < 80;
        }).length,
      };
    })
  );

  return peopleWithScores;
}

/**
 * Busca detalhes de uma pessoa com todos indicadores
 * @param {string} personId - ID da pessoa (users_otus)
 * @param {Object} filters - Filtros
 * @returns {Promise<Object>}
 */
export async function getPersonById(personId, filters = {}) {
  const supabase = getSupabaseClient();

  const { data: user, error } = await supabase
    .from(USERS_OTUS_TABLE)
    .select(`
      id,
      name,
      email,
      phone,
      avatar_url,
      setor:setor_id(id, name),
      cargo:position_id(id, name, is_leadership),
      leader:leader_id(id, name)
    `)
    .eq('id', personId)
    .single();

  if (error) {
    throw new Error(`Erro ao buscar pessoa: ${error.message}`);
  }

  if (!user.email) {
    return { ...user, indicadores: [], score: null };
  }

  const indicadores = await fetchIndicadoresIndividuais({
    person_email: user.email,
    ciclo: filters.ciclo,
    ano: filters.ano,
  });

  // Busca check-ins e recovery plans para cada indicador
  const indicadoresWithCheckIns = await Promise.all(
    indicadores.map(async (ind) => {
      const [checkIns, recoveryPlans] = await Promise.all([
        fetchCheckIns(ind.id),
        fetchRecoveryPlans(ind.id)
      ]);
      return { ...ind, check_ins: checkIns, recovery_plans: recoveryPlans };
    })
  );

  const score = calculatePersonScore(indicadores);

  return {
    ...user,
    indicadores: indicadoresWithCheckIns,
    score,
  };
}

/**
 * Busca equipe de um setor
 * @param {string} sectorId - ID do setor
 * @param {Object} filters - Filtros
 * @returns {Promise<Array>}
 */
export async function fetchTeam(sectorId, filters = {}) {
  return fetchPeopleWithScores({
    setor_id: sectorId,
    ciclo: filters.ciclo,
    ano: filters.ano,
  });
}

/**
 * Calcula score de uma pessoa baseado nos indicadores
 * @param {Array} indicadores - Lista de indicadores
 * @returns {number|null} - Score ponderado (0-120) ou null se não houver indicadores
 */

/**
 * Verifica se um indicador tem meses ativos dentro de um ciclo
 * Ex: indicador semestral (meses 6,12) não aparece em Q1 (meses 1-3)
 */
function hasActiveMonthsInCycle(indicador, ciclo) {
  if (!ciclo || ciclo === 'anual') return true;
  // Indicadores anuais aparecem em todos os quarters (respeitando active_quarters)
  if (indicador.ciclo === 'anual') {
    const aq = indicador.active_quarters || { q1: true, q2: true, q3: true, q4: true };
    return aq[ciclo] !== false;
  }
  const ranges = { q1: [1, 3], q2: [4, 6], q3: [7, 9], q4: [10, 12] };
  const [start, end] = ranges[ciclo] || [1, 12];
  const frequencia = indicador.frequencia || 'mensal';
  const mesInicio = indicador.mes_inicio || 1;
  const aq = indicador.active_quarters || { q1: true, q2: true, q3: true, q4: true };
  const FREQ_MONTHS = {
    mensal: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    trimestral: [3, 6, 9, 12],
    semestral: [6, 12],
    anual: [12],
  };
  const visibleMonths = FREQ_MONTHS[frequencia] || FREQ_MONTHS.mensal;
  for (let m = start; m <= end; m++) {
    if (m < mesInicio) continue;
    if (!visibleMonths.includes(m)) continue;
    if (m <= 3 && !aq.q1) continue;
    if (m > 3 && m <= 6 && !aq.q2) continue;
    if (m > 6 && m <= 9 && !aq.q3) continue;
    if (m > 9 && !aq.q4) continue;
    return true;
  }
  return false;
}

function calculatePersonScore(indicadores) {
  if (!indicadores || indicadores.length === 0) return null;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const ind of indicadores) {
    const peso = ind.peso ?? 1;
    if (peso === 0) continue;
    const score = calculateIndicatorScore(ind);
    totalWeight += peso;
    weightedSum += score * peso;
  }

  if (totalWeight === 0) return null;
  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

/**
 * Calcula score de um indicador (0-120)
 * @param {Object} indicador - Indicador com valor, meta, thresholds
 * @returns {number} - Score (0-120)
 */
function calculateIndicatorScore(indicador) {
  const { valor, meta, threshold_80, threshold_120, is_inverse } = indicador;

  if (meta === null || meta === undefined || meta === 0) return 0;

  const v = parseFloat(valor) || 0;
  const m = parseFloat(meta);
  const t80 = threshold_80 !== null && threshold_80 !== undefined ? parseFloat(threshold_80) : m * 0.8;
  const t120 = threshold_120 !== null && threshold_120 !== undefined ? parseFloat(threshold_120) : m * 1.2;

  if (is_inverse) {
    // Para métricas inversas (menor é melhor)
    if (v <= t120) return 120;
    if (v <= m) return 100 + ((m - v) / (m - t120)) * 20;
    if (v <= t80) return 80 + ((t80 - v) / (t80 - m)) * 20;
    return Math.max(0, 80 * (t80 / v));
  } else {
    // Para métricas normais (maior é melhor)
    if (v >= t120) return 120;
    if (v >= m) return 100 + ((v - m) / (t120 - m)) * 20;
    if (v >= t80) return 80 + ((v - t80) / (m - t80)) * 20;
    return Math.max(0, (v / t80) * 80);
  }
}

// --- ADMIN: USUÁRIOS ---

/**
 * Busca usuários com informações de setor, cargo e indicadores
 * @returns {Promise<Array>}
 */
export async function fetchUsersWithRoles() {
  const supabase = getSupabaseClient();

  // Busca usuarios com setor, cargo e time
  const { data, error } = await supabase
    .from(USERS_OTUS_TABLE)
    .select(`
      id,
      name,
      email,
      role,
      status,
      is_active,
      leader_id,
      avatar_url,
      setor:setor_id(id, name),
      cargo:position_id(id, name, is_leadership),
      team:team_id(id, team_number, team_name)
    `)
    .eq('status', 'ativo')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar usuários: ${error.message}`);
  }

  const users = Array.isArray(data) ? data : [];

  // Busca contagem de indicadores por cargo
  const positionIds = [...new Set(users.map(u => u.cargo?.id).filter(Boolean))];
  let indicatorCountMap = new Map();

  if (positionIds.length > 0) {
    const { data: indicators, error: indError } = await supabase
      .from(POSITION_INDICATORS_TABLE)
      .select('position_id')
      .in('position_id', positionIds);

    if (!indError && indicators) {
      // Conta indicadores por position_id
      indicators.forEach(ind => {
        const count = indicatorCountMap.get(ind.position_id) || 0;
        indicatorCountMap.set(ind.position_id, count + 1);
      });
    }
  }

  // Map leaders from the same user list (self-referential relationship)
  const userMap = new Map(users.map(u => [u.id, { id: u.id, name: u.name, email: u.email }]));

  return users.map(user => ({
    ...user,
    leader: user.leader_id ? userMap.get(user.leader_id) || null : null,
    indicadores_count: user.cargo?.id ? indicatorCountMap.get(user.cargo.id) || 0 : 0
  }));
}

/**
 * Atualiza cargo de um usuário
 * @param {string} userId - ID do usuário
 * @param {string} positionId - ID do cargo
 * @returns {Promise<Object>}
 */
export async function updateUserPosition(userId, positionId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(USERS_OTUS_TABLE)
    .update({ position_id: positionId })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar cargo do usuário: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza setor de um usuário
 * @param {string} userId - ID do usuário
 * @param {string} sectorId - ID do setor
 * @returns {Promise<Object>}
 */
export async function updateUserSector(userId, sectorId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(USERS_OTUS_TABLE)
    .update({ setor_id: sectorId })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar setor do usuário: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza role/papel de um usuário
 * @param {string} userId - ID do usuário
 * @param {string} role - Role (user, leader, admin, director)
 * @returns {Promise<Object>}
 */
export async function updateUserRole(userId, role) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(USERS_OTUS_TABLE)
    .update({ role })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar role do usuário: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza status (ativo/inativo) de um usuário
 * @param {string} userId - ID do usuário
 * @param {boolean} isActive - Status ativo/inativo
 * @returns {Promise<Object>}
 */
export async function updateUserStatus(userId, isActive) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(USERS_OTUS_TABLE)
    .update({ is_active: isActive, status: isActive ? 'ativo' : 'inativo' })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar status do usuário: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza líder de um usuário
 * @param {string} userId - ID do usuário
 * @param {string} leaderId - ID do líder
 * @returns {Promise<Object>}
 */
export async function updateUserLeader(userId, leaderId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(USERS_OTUS_TABLE)
    .update({ leader_id: leaderId })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar líder do usuário: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza avatar (foto de perfil) de um usuário
 * @param {string} userId - ID do usuário
 * @param {string} avatarUrl - URL do avatar (Google profile photo)
 * @returns {Promise<Object>}
 */
export async function updateUserAvatar(userId, avatarUrl) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(USERS_OTUS_TABLE)
    .update({ avatar_url: avatarUrl })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar avatar do usuário: ${error.message}`);
  }

  return data;
}

/**
 * Cria um novo usuario
 * @param {Object} userData - Dados do usuario
 * @param {string} userData.name - Nome (obrigatorio)
 * @param {string} userData.email - Email (obrigatorio)
 * @param {string} [userData.role] - Role (user, leader, admin)
 * @param {string} [userData.setor_id] - ID do setor
 * @param {string} [userData.position_id] - ID do cargo
 * @param {string} [userData.phone] - Telefone
 * @returns {Promise<Object>}
 */
export async function createUser(userData) {
  const supabase = getSupabaseClient();

  // Verificar email unico
  const { data: existing } = await supabase
    .from(USERS_OTUS_TABLE)
    .select('id')
    .eq('email', userData.email.toLowerCase())
    .maybeSingle();

  if (existing) {
    throw new Error('Email ja cadastrado no sistema');
  }

  const { data, error } = await supabase
    .from(USERS_OTUS_TABLE)
    .insert({
      name: userData.name,
      email: userData.email.toLowerCase().trim(),
      role: userData.role || 'user',
      setor_id: userData.setor_id || null,
      position_id: userData.position_id || null,
      phone: userData.phone || null,
      status: 'ativo',
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar usuario: ${error.message}`);
  }

  return data;
}

/**
 * Busca o setor de um usuário por email
 * @param {string} email - Email do usuário
 * @returns {Promise<Object|null>}
 */
export async function getUserSectorByEmail(email) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(USERS_OTUS_TABLE)
    .select(`
      id,
      setor_id,
      setor:setor_id(id, name)
    `)
    .eq('email', email)
    .single();

  if (error) {
    return null;
  }

  return data?.setor || null;
}

/**
 * Busca informações do usuário pelo email (para módulo de indicadores)
 * @param {string} email - Email do usuário
 * @returns {Promise<Object|null>} - Dados do usuário ou null
 */
export async function getUserByEmail(email) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(USERS_OTUS_TABLE)
    .select(`
      id,
      name,
      email,
      setor_id,
      setor:setor_id(id, name),
      cargo:position_id(id, name, is_leadership)
    `)
    .eq('email', email)
    .single();

  if (error) {
    return null;
  }

  return data;
}

// --- OVERVIEW E HISTÓRICO ---

/**
 * Busca visão geral de todos setores com scores
 * @param {Object} filters - Filtros
 * @returns {Promise<Array>}
 */
export async function fetchSectorsOverview(filters = {}) {
  const sectors = await fetchSectors();
  console.log('📊 fetchSectorsOverview - Total sectors from DB:', sectors?.length || 0);

  const sectorsWithStats = await Promise.all(
    sectors.map(async (sector) => {
      const people = await fetchPeopleWithScores({
        setor_id: sector.id,
        ciclo: filters.ciclo,
        ano: filters.ano,
      });

      const scores = people.map(p => p.score).filter(s => s !== null);
      const avgScore = scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
        : 0;

      const atRisk = people.filter(p => p.score !== null && p.score < 80).length;

      // Sort people by score descending
      const sortedPeople = [...people].sort((a, b) => (b.score || 0) - (a.score || 0));

      return {
        ...sector,
        people_count: people.length,
        avg_score: avgScore,
        at_risk_count: atRisk,
        people: sortedPeople, // Include people array for expandable view
      };
    })
  );

  return { sectors: sectorsWithStats };
}

/**
 * Busca histórico para comparação ano-a-ano
 * @param {Object} filters - Filtros
 * @returns {Promise<Object>}
 */
export async function fetchHistoryComparison(filters = {}) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear];

  const results = {};

  for (const year of years) {
    const overview = await fetchSectorsOverview({
      ciclo: filters.ciclo || 'anual',
      ano: year,
    });
    results[year] = overview;
  }

  return results;
}

// ============================================================================
// VIEWS & ACCESS CONTROL
// ============================================================================

const VIEWS_TABLE = 'views';
const VIEW_ACCESS_DEFAULTS_TABLE = 'view_access_defaults';

/**
 * Busca todas as vistas cadastradas
 * @returns {Promise<Array>}
 */
export async function fetchViews() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(VIEWS_TABLE)
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar vistas: ${error.message}`);
  }

  return data || [];
}

/**
 * Cria uma nova vista
 * @param {Object} viewData - Dados da vista
 * @returns {Promise<Object>}
 */
export async function createView(viewData) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(VIEWS_TABLE)
    .insert(viewData)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar vista: ${error.message}`);
  }

  return data;
}

/**
 * Remove uma vista
 * @param {string} viewId - ID da vista
 * @returns {Promise<void>}
 */
export async function deleteView(viewId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(VIEWS_TABLE)
    .delete()
    .eq('id', viewId);

  if (error) {
    throw new Error(`Erro ao remover vista: ${error.message}`);
  }
}

/**
 * Busca todas as regras de acesso padrão
 * @param {Object} filters - Filtros opcionais
 * @returns {Promise<Array>}
 */
export async function fetchAccessDefaults(filters = {}) {
  const supabase = getSupabaseServiceClient();
  let query = supabase
    .from(VIEW_ACCESS_DEFAULTS_TABLE)
    .select(`
      *,
      view:views!view_id(id, name, route, area),
      sector:sectors!sector_id(id, name),
      position:positions!position_id(id, name)
    `)
    .order('view_id');

  if (filters.view_id) {
    query = query.eq('view_id', filters.view_id);
  }
  if (filters.role) {
    query = query.eq('role', filters.role);
  }
  if (filters.sector_id) {
    query = query.eq('sector_id', filters.sector_id);
  }
  if (filters.position_id) {
    query = query.eq('position_id', filters.position_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao buscar regras de acesso: ${error.message}`);
  }

  return data || [];
}

/**
 * Cria uma nova regra de acesso padrão
 * @param {Object} ruleData - Dados da regra
 * @returns {Promise<Object>}
 */
export async function createAccessDefault(ruleData) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(VIEW_ACCESS_DEFAULTS_TABLE)
    .insert({
      view_id: ruleData.view_id,
      role: ruleData.role || null,
      sector_id: ruleData.sector_id || null,
      position_id: ruleData.position_id || null,
      has_access: ruleData.has_access ?? true,
    })
    .select(`
      *,
      view:view_id(*),
      sector:sector_id(id, name),
      position:position_id(id, name)
    `)
    .single();

  if (error) {
    throw new Error(`Erro ao criar regra de acesso: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza uma regra de acesso padrão
 * @param {number} id - ID da regra
 * @param {Object} ruleData - Dados para atualizar
 * @returns {Promise<Object>}
 */
export async function updateAccessDefault(id, ruleData) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(VIEW_ACCESS_DEFAULTS_TABLE)
    .update({
      view_id: ruleData.view_id,
      role: ruleData.role || null,
      sector_id: ruleData.sector_id || null,
      position_id: ruleData.position_id || null,
      has_access: ruleData.has_access ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      *,
      view:view_id(*),
      sector:sector_id(id, name),
      position:position_id(id, name)
    `)
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar regra de acesso: ${error.message}`);
  }

  return data;
}

/**
 * Remove uma regra de acesso padrão
 * @param {number} id - ID da regra
 * @returns {Promise<void>}
 */
export async function deleteAccessDefault(id) {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from(VIEW_ACCESS_DEFAULTS_TABLE)
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Erro ao remover regra de acesso: ${error.message}`);
  }
}

/**
 * Busca overrides de vistas para um usuário específico (com has_access)
 * @param {string} email - Email do usuário
 * @returns {Promise<Array<{view_id: string, has_access: boolean}>>}
 */
export async function getUserViewOverrides(email) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(USER_VIEWS_TABLE)
    .select('view_id, has_access')
    .eq('email', email);

  if (error) {
    console.error('Erro ao buscar overrides do usuário:', error);
    return [];
  }

  return data || [];
}

/**
 * Atualiza override de vista para um usuário
 * @param {string} email - Email do usuário
 * @param {string} viewId - ID da vista
 * @param {boolean} hasAccess - Se tem acesso ou não
 * @returns {Promise<void>}
 */
export async function setUserViewOverride(email, viewId, hasAccess) {
  const supabase = getSupabaseClient();

  // Upsert - insere ou atualiza se já existe
  const { error } = await supabase
    .from(USER_VIEWS_TABLE)
    .upsert({
      email,
      view_id: viewId,
      has_access: hasAccess,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'email,view_id',
    });

  if (error) {
    throw new Error(`Erro ao definir override: ${error.message}`);
  }
}

/**
 * Remove override de vista para um usuário
 * @param {string} email - Email do usuário
 * @param {string} viewId - ID da vista
 * @returns {Promise<void>}
 */
export async function removeUserViewOverride(email, viewId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(USER_VIEWS_TABLE)
    .delete()
    .eq('email', email)
    .eq('view_id', viewId);

  if (error) {
    throw new Error(`Erro ao remover override: ${error.message}`);
  }
}

/**
 * Calcula as vistas efetivas que um usuário pode acessar
 *
 * Lógica:
 * 1. Se role === 'dev' → acesso total
 * 2. Verificar overrides em user_views para o email
 * 3. Para vistas sem override, buscar regra mais específica em view_access_defaults
 *
 * Prioridade de regras (do mais específico ao menos):
 * 1. role + sector_id + position_id (todos definidos)
 * 2. role + sector_id (position_id NULL)
 * 3. role + position_id (sector_id NULL)
 * 4. role apenas (sector_id e position_id NULL)
 * 5. sector_id + position_id (role NULL)
 * 6. sector_id apenas
 * 7. position_id apenas
 * 8. Sem regra → BLOQUEAR
 *
 * @param {Object} user - Dados do usuário
 * @param {string} user.email - Email do usuário
 * @param {string} user.role - Role do usuário
 * @param {string|null} user.sector_id - ID do setor do usuário
 * @param {string|null} user.position_id - ID do cargo do usuário
 * @returns {Promise<string[]>} - Array de view_ids permitidos
 */
export async function getEffectiveViews(user) {
  const { email, role, sector_id, position_id } = user;

  // 1. Devs têm acesso total
  if (role === 'dev') {
    const allViews = await fetchViews();
    return allViews.map(v => v.id);
  }

  // 2. Buscar todas as vistas
  const allViews = await fetchViews();

  // 3. Buscar overrides do usuário
  const userOverrides = await getUserViewOverrides(email);
  const overrideMap = new Map(userOverrides.map(o => [o.view_id, o.has_access]));

  // 4. Buscar todas as regras de acesso padrão
  const allRules = await fetchAccessDefaults();

  // 5. Para cada vista, determinar se tem acesso
  const allowedViews = [];

  for (const view of allViews) {
    // Primeiro verificar se existe override
    if (overrideMap.has(view.id)) {
      if (overrideMap.get(view.id) === true) {
        allowedViews.push(view.id);
      }
      continue; // Override encontrado, não precisa verificar regras
    }

    // Buscar regras aplicáveis para esta vista
    const viewRules = allRules.filter(r => r.view_id === view.id);

    // Calcular score de especificidade para cada regra
    // Maior score = mais específico
    const scoredRules = viewRules.map(rule => {
      let score = 0;

      // Role match
      const roleMatches = rule.role === null || rule.role === role;
      if (!roleMatches) return { rule, score: -1, matches: false };

      if (rule.role !== null) score += 100; // Role específico vale mais

      // Sector match
      const sectorMatches = rule.sector_id === null || rule.sector_id === sector_id;
      if (!sectorMatches) return { rule, score: -1, matches: false };

      if (rule.sector_id !== null) score += 10;

      // Position match
      const positionMatches = rule.position_id === null || rule.position_id === position_id;
      if (!positionMatches) return { rule, score: -1, matches: false };

      if (rule.position_id !== null) score += 1;

      return { rule, score, matches: true };
    });

    // Filtrar regras que deram match e ordenar por score
    const matchingRules = scoredRules
      .filter(sr => sr.matches && sr.score >= 0)
      .sort((a, b) => b.score - a.score);

    // A regra mais específica (maior score) vence
    if (matchingRules.length > 0) {
      const bestRule = matchingRules[0].rule;
      if (bestRule.has_access) {
        allowedViews.push(view.id);
      }
    }
    // Se não encontrou regra, bloqueia por padrão (não adiciona à lista)
  }

  return allowedViews;
}

// ============================================
// Workspace Management (Gestão de Tarefas)
// Usa a tabela sectors existente como "workspaces"
// ============================================

const WORKSPACE_PROJECTS_TABLE = 'workspace_projects';
const WORKSPACE_TASKS_TABLE = 'workspace_tasks';
const WORKSPACE_PROJECT_MEMBERS_TABLE = 'workspace_project_members';
const PROJECT_MESSAGES_TABLE = 'project_messages';

// ---- Workspace Projects (usa sector_id) ----

/**
 * Busca projetos (opcionalmente filtrado por setor)
 * @param {string} sectorId - ID do setor (opcional)
 * @returns {Promise<Array>}
 */
export async function fetchWorkspaceProjects(sectorId = null) {
  const supabase = getSupabaseServiceClient();
  let query = supabase
    .from(WORKSPACE_PROJECTS_TABLE)
    .select(`
      *,
      sector:sector_id(id, name, description),
      created_by_user:created_by(id, name, email)
    `)
    .order('created_at', { ascending: false });

  if (sectorId) {
    query = query.eq('sector_id', sectorId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao buscar projetos: ${error.message}`);
  }

  return data || [];
}

/**
 * Busca um projeto por ID
 * @param {string} id - ID do projeto
 * @returns {Promise<Object>}
 */
export async function getWorkspaceProjectById(id) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(WORKSPACE_PROJECTS_TABLE)
    .select(`
      *,
      sector:sector_id(id, name, description),
      created_by_user:created_by(id, name, email)
    `)
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(`Erro ao buscar projeto: ${error.message}`);
  }

  return data;
}

/**
 * Cria um novo projeto
 * @param {Object} projectData - Dados do projeto
 * @returns {Promise<Object>}
 */
export async function createWorkspaceProject(projectData) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(WORKSPACE_PROJECTS_TABLE)
    .insert({
      sector_id: projectData.sector_id,
      name: projectData.name,
      description: projectData.description || null,
      status: projectData.status || 'ativo',
      color: projectData.color || null,
      start_date: projectData.start_date || null,
      due_date: projectData.due_date || null,
      created_by: projectData.created_by || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select(`
      *,
      sector:sector_id(id, name, description)
    `)
    .single();

  if (error) {
    throw new Error(`Erro ao criar projeto: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza um projeto
 * @param {string} id - ID do projeto
 * @param {Object} projectData - Dados para atualizar
 * @returns {Promise<Object>}
 */
export async function updateWorkspaceProject(id, projectData) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(WORKSPACE_PROJECTS_TABLE)
    .update({
      ...projectData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      *,
      sector:sector_id(id, name, description)
    `)
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar projeto: ${error.message}`);
  }

  return data;
}

/**
 * Deleta um projeto
 * @param {string} id - ID do projeto
 * @returns {Promise<void>}
 */
export async function deleteWorkspaceProject(id) {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from(WORKSPACE_PROJECTS_TABLE)
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Erro ao deletar projeto: ${error.message}`);
  }
}

// ---- Workspace Tasks ----

/**
 * Busca tarefas com filtros
 * @param {Object} filters - Filtros
 * @returns {Promise<Array>}
 */
export async function fetchWorkspaceTasks(filters = {}) {
  const supabase = getSupabaseServiceClient();
  let query = supabase
    .from(WORKSPACE_TASKS_TABLE)
    .select(`
      *,
      project:project_id(id, name, workspace_id, color),
      assignee:assignee_id(id, name, email),
      created_by_user:created_by(id, name, email),
      subtasks:workspace_tasks!parent_task_id(id, title, status, priority, assignee_id)
    `)
    .is('parent_task_id', null) // Apenas tarefas raiz
    .order('position_order')
    .order('created_at', { ascending: false });

  if (filters.project_id) {
    query = query.eq('project_id', filters.project_id);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.assignee_id) {
    query = query.eq('assignee_id', filters.assignee_id);
  }

  if (filters.priority) {
    query = query.eq('priority', filters.priority);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao buscar tarefas: ${error.message}`);
  }

  return data || [];
}

/**
 * Busca uma tarefa por ID com subtarefas
 * @param {string} id - ID da tarefa
 * @returns {Promise<Object>}
 */
export async function getWorkspaceTaskById(id) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(WORKSPACE_TASKS_TABLE)
    .select(`
      *,
      project:project_id(id, name, workspace_id, color),
      assignee:assignee_id(id, name, email),
      created_by_user:created_by(id, name, email),
      parent_task:parent_task_id(id, title),
      subtasks:workspace_tasks!parent_task_id(
        id, title, status, priority, due_date, position_order,
        assignee:assignee_id(id, name, email)
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(`Erro ao buscar tarefa: ${error.message}`);
  }

  return data;
}

/**
 * Cria uma nova tarefa
 * @param {Object} taskData - Dados da tarefa
 * @returns {Promise<Object>}
 */
export async function createWorkspaceTask(taskData) {
  const supabase = getSupabaseServiceClient();

  // Buscar próximo position_order
  const { data: maxOrder } = await supabase
    .from(WORKSPACE_TASKS_TABLE)
    .select('position_order')
    .eq('project_id', taskData.project_id)
    .eq('status', taskData.status || 'a_fazer')
    .order('position_order', { ascending: false })
    .limit(1)
    .single();

  const nextOrder = (maxOrder?.position_order || 0) + 1;

  const { data, error } = await supabase
    .from(WORKSPACE_TASKS_TABLE)
    .insert({
      project_id: taskData.project_id,
      parent_task_id: taskData.parent_task_id || null,
      title: taskData.title,
      description: taskData.description || null,
      status: taskData.status || 'a_fazer',
      priority: taskData.priority || 'media',
      start_date: taskData.start_date || null,
      due_date: taskData.due_date || null,
      assignee_id: taskData.assignee_id || null,
      created_by: taskData.created_by || null,
      tags: taskData.tags || [],
      custom_fields: taskData.custom_fields || {},
      position_order: nextOrder,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select(`
      *,
      project:project_id(id, name, workspace_id, color),
      assignee:assignee_id(id, name, email)
    `)
    .single();

  if (error) {
    throw new Error(`Erro ao criar tarefa: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza uma tarefa
 * @param {string} id - ID da tarefa
 * @param {Object} taskData - Dados para atualizar
 * @returns {Promise<Object>}
 */
export async function updateWorkspaceTask(id, taskData) {
  const supabase = getSupabaseServiceClient();

  // Se mudou para concluido, setar completed_at
  const updateData = { ...taskData };
  if (taskData.status === 'concluido' && !taskData.completed_at) {
    updateData.completed_at = new Date().toISOString();
  } else if (taskData.status && taskData.status !== 'concluido') {
    updateData.completed_at = null;
  }

  const { data, error } = await supabase
    .from(WORKSPACE_TASKS_TABLE)
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      *,
      project:project_id(id, name, workspace_id, color),
      assignee:assignee_id(id, name, email)
    `)
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar tarefa: ${error.message}`);
  }

  return data;
}

/**
 * Deleta uma tarefa
 * @param {string} id - ID da tarefa
 * @returns {Promise<void>}
 */
export async function deleteWorkspaceTask(id) {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from(WORKSPACE_TASKS_TABLE)
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Erro ao deletar tarefa: ${error.message}`);
  }
}

/**
 * Reordena tarefas no kanban
 * @param {Array} updates - Array de {id, status, position_order}
 * @returns {Promise<void>}
 */
export async function reorderWorkspaceTasks(updates) {
  const supabase = getSupabaseServiceClient();

  for (const update of updates) {
    const { error } = await supabase
      .from(WORKSPACE_TASKS_TABLE)
      .update({
        status: update.status,
        position_order: update.position_order,
        updated_at: new Date().toISOString(),
      })
      .eq('id', update.id);

    if (error) {
      throw new Error(`Erro ao reordenar tarefa ${update.id}: ${error.message}`);
    }
  }
}

// ---- Project Members ----

/**
 * Busca membros de um projeto
 * @param {string} projectId - ID do projeto
 * @returns {Promise<Array>}
 */
export async function fetchProjectMembers(projectId) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(WORKSPACE_PROJECT_MEMBERS_TABLE)
    .select(`
      *,
      user:user_id(id, name, email),
      invited_by_user:invited_by(id, name, email)
    `)
    .eq('project_id', projectId)
    .order('joined_at');

  if (error) {
    throw new Error(`Erro ao buscar membros: ${error.message}`);
  }

  return data || [];
}

/**
 * Adiciona um membro ao projeto
 * @param {Object} memberData - Dados do membro
 * @returns {Promise<Object>}
 */
export async function addProjectMember(memberData) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(WORKSPACE_PROJECT_MEMBERS_TABLE)
    .insert({
      project_id: memberData.project_id,
      user_id: memberData.user_id,
      role: memberData.role || 'member',
      invited_by: memberData.invited_by || null,
      joined_at: new Date().toISOString(),
    })
    .select(`
      *,
      user:user_id(id, name, email)
    `)
    .single();

  if (error) {
    if (error.code === '23505') { // Unique violation
      throw new Error('Usuário já é membro deste projeto');
    }
    throw new Error(`Erro ao adicionar membro: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza role de um membro
 * @param {string} memberId - ID do membro
 * @param {string} role - Novo role
 * @returns {Promise<Object>}
 */
export async function updateProjectMemberRole(memberId, role) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(WORKSPACE_PROJECT_MEMBERS_TABLE)
    .update({ role })
    .eq('id', memberId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar membro: ${error.message}`);
  }

  return data;
}

/**
 * Remove um membro do projeto
 * @param {string} memberId - ID do membro
 * @returns {Promise<void>}
 */
export async function removeProjectMember(memberId) {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from(WORKSPACE_PROJECT_MEMBERS_TABLE)
    .delete()
    .eq('id', memberId);

  if (error) {
    throw new Error(`Erro ao remover membro: ${error.message}`);
  }
}

// ---- Project Messages (Chat) ----

/**
 * Busca mensagens de um projeto
 * @param {string} projectId - ID do projeto
 * @param {Object} options - Opções de paginação
 * @returns {Promise<Array>}
 */
export async function fetchProjectMessages(projectId, options = {}) {
  const supabase = getSupabaseServiceClient();
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  let query = supabase
    .from(PROJECT_MESSAGES_TABLE)
    .select(`
      *,
      user:user_id(id, name, email),
      reply_to:reply_to_id(id, content, user:user_id(id, name))
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao buscar mensagens: ${error.message}`);
  }

  // Retornar em ordem cronológica
  return (data || []).reverse();
}

/**
 * Cria uma nova mensagem
 * @param {Object} messageData - Dados da mensagem
 * @returns {Promise<Object>}
 */
export async function createProjectMessage(messageData) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(PROJECT_MESSAGES_TABLE)
    .insert({
      project_id: messageData.project_id,
      user_id: messageData.user_id,
      content: messageData.content,
      reply_to_id: messageData.reply_to_id || null,
      attachments: messageData.attachments || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select(`
      *,
      user:user_id(id, name, email)
    `)
    .single();

  if (error) {
    throw new Error(`Erro ao criar mensagem: ${error.message}`);
  }

  return data;
}

/**
 * Deleta uma mensagem
 * @param {string} messageId - ID da mensagem
 * @returns {Promise<void>}
 */
export async function deleteProjectMessage(messageId) {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from(PROJECT_MESSAGES_TABLE)
    .delete()
    .eq('id', messageId);

  if (error) {
    throw new Error(`Erro ao deletar mensagem: ${error.message}`);
  }
}

// ============================================================================
// HOME MODULES - Configuração dos módulos da Home
// ============================================================================

const HOME_MODULES_TABLE = 'home_modules';

/**
 * Busca todos os módulos da Home ordenados por sort_order
 * @returns {Promise<Array>}
 */
export async function fetchHomeModules() {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(HOME_MODULES_TABLE)
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar módulos: ${error.message}`);
  }

  return data || [];
}

/**
 * Atualiza um módulo da Home
 * @param {string} moduleId - ID do módulo
 * @param {Object} moduleData - Dados a atualizar
 * @returns {Promise<Object>}
 */
export async function updateHomeModule(moduleId, moduleData) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(HOME_MODULES_TABLE)
    .update({
      ...moduleData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', moduleId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar módulo: ${error.message}`);
  }

  return data;
}

/**
 * Cria um novo módulo da Home
 * @param {Object} moduleData - Dados do módulo
 * @returns {Promise<Object>}
 */
export async function createHomeModule(moduleData) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(HOME_MODULES_TABLE)
    .insert(moduleData)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar módulo: ${error.message}`);
  }

  return data;
}

/**
 * Remove um módulo da Home
 * @param {string} moduleId - ID do módulo
 * @returns {Promise<void>}
 */
export async function deleteHomeModule(moduleId) {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from(HOME_MODULES_TABLE)
    .delete()
    .eq('id', moduleId);

  if (error) {
    throw new Error(`Erro ao remover módulo: ${error.message}`);
  }
}

// ============================================================================
// UNIFIED MODULES SYSTEM - Sistema unificado de módulos com níveis de acesso
// ============================================================================

const MODULES_TABLE = 'modules';
const MODULE_OVERRIDES_TABLE = 'module_overrides';

/**
 * Mapeamento de roles para níveis de acesso numéricos
 * Quanto menor o número, maior o privilégio
 */
export const ACCESS_LEVELS = {
  dev: 1,
  director: 2,
  admin: 3,
  leader: 4,
  user: 5,
};

/**
 * Labels para exibição dos níveis de acesso
 */
export const ACCESS_LEVEL_LABELS = {
  1: 'Dev',
  2: 'Diretor',
  3: 'Admin',
  4: 'Líder',
  5: 'Operação',
};

/**
 * Cores para exibição dos níveis de acesso
 */
export const ACCESS_LEVEL_COLORS = {
  1: '#8b5cf6', // roxo - dev
  2: '#ef4444', // vermelho - diretor
  3: '#f59e0b', // laranja - admin
  4: '#3b82f6', // azul - líder
  5: '#22c55e', // verde - operação
};

/**
 * Retorna o nível de acesso numérico de um role
 * @param {string} role - Role do usuário (dev, director, admin, leader, user)
 * @returns {number} - Nível de acesso (1-5)
 */
export function getUserAccessLevel(role) {
  return ACCESS_LEVELS[role] || 5;
}

/**
 * Busca todos os módulos (para admin)
 * @returns {Promise<Array>}
 */
export async function fetchAllModules() {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(MODULES_TABLE)
    .select('*')
    .order('area')
    .order('sort_order');

  if (error) {
    throw new Error(`Erro ao buscar módulos: ${error.message}`);
  }

  return data || [];
}

/**
 * Busca módulos que o usuário pode acessar
 * @param {string} email - Email do usuário
 * @param {number} accessLevel - Nível de acesso do usuário (1-5)
 * @param {string|null} sectorId - ID do setor do usuário (opcional)
 * @returns {Promise<Array>}
 */
export async function fetchModulesForUser(email, accessLevel, sectorId = null) {
  const supabase = getSupabaseServiceClient();

  // Buscar todos os módulos visíveis
  const { data: modules, error } = await supabase
    .from(MODULES_TABLE)
    .select('*')
    .eq('visible', true)
    .order('sort_order');

  if (error) {
    throw new Error(`Erro ao buscar módulos: ${error.message}`);
  }

  // Buscar overrides para este usuário (por email)
  const { data: userOverrides } = await supabase
    .from(MODULE_OVERRIDES_TABLE)
    .select('*')
    .eq('user_email', email);

  // Buscar overrides por setor (se sectorId fornecido)
  let sectorOverrides = [];
  if (sectorId) {
    const { data: sectorData } = await supabase
      .from(MODULE_OVERRIDES_TABLE)
      .select('*')
      .eq('sector_id', sectorId);
    sectorOverrides = sectorData || [];
  }

  // Mapa de user overrides (maior prioridade)
  const userOverrideMap = {};
  (userOverrides || []).forEach(o => {
    userOverrideMap[o.module_id] = o.grant_access;
  });

  // Mapa de sector overrides (somente overrides puros de setor, sem user_email)
  const sectorGrantMap = {};
  sectorOverrides.filter(o => !o.user_email).forEach(o => {
    sectorGrantMap[o.module_id] = o.grant_access;
  });

  // Filtrar módulos: AMBAS as liberações necessárias (CARGO + SETOR)
  return (modules || []).filter(module => {
    // 1. User override tem maior prioridade
    if (userOverrideMap[module.id] !== undefined) {
      return userOverrideMap[module.id];
    }

    // 2. Dev bypass (acesso total)
    if (accessLevel <= 1) return true;

    // 3. AMBAS as liberações necessárias: CARGO + SETOR
    const cargoPermite = accessLevel <= module.min_access_level;
    const setorPermite = sectorGrantMap[module.id] === true;
    return cargoPermite && setorPermite;
  });
}

/**
 * Busca módulos para exibir na Home
 * @param {string} email - Email do usuário
 * @param {number} accessLevel - Nível de acesso do usuário (1-5)
 * @param {string|null} sectorId - ID do setor do usuário (opcional)
 * @returns {Promise<Array>}
 */
export async function fetchHomeModulesForUser(email, accessLevel, sectorId = null) {
  const modules = await fetchModulesForUser(email, accessLevel, sectorId);
  return modules.filter(m => m.show_on_home);
}

/**
 * Atualiza um módulo
 * @param {string} moduleId - ID do módulo
 * @param {Object} moduleData - Dados a atualizar
 * @returns {Promise<Object>}
 */
export async function updateModuleUnified(moduleId, moduleData) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(MODULES_TABLE)
    .update({
      ...moduleData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', moduleId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar módulo: ${error.message}`);
  }

  return data;
}

/**
 * Cria um novo módulo
 * @param {Object} moduleData - Dados do módulo
 * @returns {Promise<Object>}
 */
export async function createModuleUnified(moduleData) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(MODULES_TABLE)
    .insert(moduleData)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar módulo: ${error.message}`);
  }

  return data;
}

/**
 * Remove um módulo
 * @param {string} moduleId - ID do módulo
 */
export async function deleteModuleUnified(moduleId) {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from(MODULES_TABLE)
    .delete()
    .eq('id', moduleId);

  if (error) {
    throw new Error(`Erro ao remover módulo: ${error.message}`);
  }
}

/**
 * Busca dados do usuário pelo email (incluindo setor)
 * @param {string} email - Email do usuário
 * @returns {Promise<Object|null>}
 */
export async function getUserOtusByEmail(email) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(USERS_OTUS_TABLE)
    .select('id, setor_id, position_id, name, role, setor:setor_id(id, name)')
    .eq('email', email)
    .single();

  if (error) return null;
  return data;
}

/**
 * Busca dados do usuário pelo ID (incluindo setor)
 * @param {string} userId - ID do usuário (UUID)
 * @returns {Promise<Object|null>}
 */
export async function getUserOtusById(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(USERS_OTUS_TABLE)
    .select('id, name, email, role, setor:setor_id(id, name)')
    .eq('id', userId)
    .single();

  if (error) return null;
  return data;
}

/**
 * Busca matriz de acesso (módulos vs níveis)
 * @returns {Promise<Object>}
 */
export async function getAccessMatrix() {
  const supabase = getSupabaseServiceClient();

  // Buscar todos os módulos
  const { data: modules, error: modulesError } = await supabase
    .from(MODULES_TABLE)
    .select('*')
    .order('area')
    .order('sort_order');

  if (modulesError) {
    throw new Error(`Erro ao buscar módulos: ${modulesError.message}`);
  }

  // Buscar todos os overrides
  const { data: overrides, error: overridesError } = await supabase
    .from(MODULE_OVERRIDES_TABLE)
    .select('*');

  if (overridesError) {
    throw new Error(`Erro ao buscar overrides: ${overridesError.message}`);
  }

  // Agrupar por área
  const matrix = {};
  const roles = ['dev', 'director', 'admin', 'leader', 'user'];

  (modules || []).forEach(m => {
    if (!matrix[m.area]) matrix[m.area] = [];

    const moduleAccess = {
      id: m.id,
      name: m.name,
      path: m.path,
      icon_name: m.icon_name,
      color: m.color,
      show_on_home: m.show_on_home,
      min_access_level: m.min_access_level,
      visible: m.visible,
      access: {},
      overrides: (overrides || []).filter(o => o.module_id === m.id),
    };

    roles.forEach(role => {
      const level = ACCESS_LEVELS[role];
      moduleAccess.access[role] = level <= m.min_access_level;
    });

    matrix[m.area].push(moduleAccess);
  });

  return {
    matrix,
    levels: ACCESS_LEVELS,
    labels: ACCESS_LEVEL_LABELS,
    colors: ACCESS_LEVEL_COLORS,
  };
}

/**
 * Busca todos os overrides de módulos
 * @returns {Promise<Array>}
 */
export async function fetchModuleOverrides() {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(MODULE_OVERRIDES_TABLE)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar overrides: ${error.message}`);
  }

  return data || [];
}

/**
 * Cria um override de módulo
 * @param {Object} overrideData - {module_id, user_email?, position_id?, sector_id?, grant_access, created_by?}
 * @returns {Promise<Object>}
 */
export async function createModuleOverride(overrideData) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(MODULE_OVERRIDES_TABLE)
    .insert(overrideData)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar override: ${error.message}`);
  }

  return data;
}

/**
 * Remove um override de módulo
 * @param {number} overrideId - ID do override
 */
export async function deleteModuleOverride(overrideId) {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from(MODULE_OVERRIDES_TABLE)
    .delete()
    .eq('id', overrideId);

  if (error) {
    throw new Error(`Erro ao remover override: ${error.message}`);
  }
}

// ============================================
// EQUIPE DO PROJETO (project_disciplines)
// ============================================

/**
 * Busca a equipe/disciplinas de um projeto com joins nas tabelas relacionadas
 * @param {string} construflowId - ID do projeto no Construflow (de project_features)
 * @returns {Promise<Array>}
 */
export async function fetchProjectDisciplines(construflowId) {
  if (!construflowId) return [];

  const supabase = getSupabaseClient();

  const { data: projectFeature, error: projectError } = await supabase
    .from('project_features')
    .select('project_id')
    .eq('construflow_id', construflowId)
    .single();

  if (projectError || !projectFeature) {
    return [];
  }

  const { data, error } = await supabase
    .from('project_disciplines')
    .select(`
      id,
      project_id,
      discipline_id,
      company_id,
      contact_id,
      discipline_detail,
      email,
      phone,
      position,
      status,
      created_at,
      update_at,
      project:project_id(id, name, project_code),
      discipline:discipline_id(id, discipline_name, short_name),
      company:company_id(id, name, status),
      contact:contact_id(id, name, email, phone, position)
    `)
    .eq('project_id', projectFeature.project_id)
    .eq('status', 'ativo');

  if (error) {
    throw new Error(`Erro ao buscar equipe do projeto: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Busca o ID interno do projeto pelo construflow_id
 */
export async function getProjectIdByConstruflow(construflowId) {
  if (!construflowId) return null;

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('project_features')
    .select('project_id')
    .eq('construflow_id', construflowId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.project_id;
}

/**
 * Busca todas as disciplinas padrão disponíveis
 */
export async function fetchStandardDisciplines() {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('standard_disciplines')
    .select('id, discipline_name, short_name, status')
    .eq('status', 'validado')
    .order('discipline_name', { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar disciplinas: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

// ============================================
// MAPEAMENTOS PERSONALIZADOS DE DISCIPLINAS
// ============================================

/**
 * Busca mapeamentos personalizados de disciplinas para um projeto
 * @param {number} projectId - ID interno do projeto (projects.id)
 * @returns {Promise<Array>}
 */
export async function fetchDisciplineMappings(projectId) {
  if (!projectId) return [];
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('discipline_mappings')
    .select(`
      id,
      project_id,
      external_source,
      external_discipline_name,
      standard_discipline_id,
      created_at,
      updated_at,
      created_by,
      standard_discipline:standard_discipline_id(id, discipline_name, short_name)
    `)
    .eq('project_id', projectId)
    .order('external_discipline_name', { ascending: true });

  if (error) {
    console.error('Erro ao buscar mapeamentos de disciplinas:', error);
    throw new Error(`Erro ao buscar mapeamentos: ${error.message}`);
  }
  return data || [];
}

/**
 * Cria ou atualiza um mapeamento de disciplina (upsert)
 */
export async function createOrUpdateDisciplineMapping({ projectId, externalSource, externalDisciplineName, standardDisciplineId, createdBy }) {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from('discipline_mappings')
    .upsert({
      project_id: projectId,
      external_source: externalSource,
      external_discipline_name: externalDisciplineName,
      standard_discipline_id: standardDisciplineId,
      created_by: createdBy,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'project_id,external_source,external_discipline_name',
      ignoreDuplicates: false
    })
    .select(`
      id, project_id, external_source, external_discipline_name, standard_discipline_id,
      standard_discipline:standard_discipline_id(id, discipline_name, short_name)
    `)
    .single();

  if (error) {
    throw new Error(`Erro ao salvar mapeamento: ${error.message}`);
  }
  return data;
}

/**
 * Remove um mapeamento personalizado
 */
export async function deleteDisciplineMapping(mappingId) {
  const supabase = getSupabaseServiceClient();

  const { error } = await supabase
    .from('discipline_mappings')
    .delete()
    .eq('id', mappingId);

  if (error) {
    throw new Error(`Erro ao deletar mapeamento: ${error.message}`);
  }
}

// ============================================
// FUNÇÕES BATCH PARA COBERTURA DE DISCIPLINAS (PORTFOLIO)
// ============================================

/**
 * Batch: busca project_id por construflow_id para múltiplos projetos
 * @param {string[]} construflowIds
 * @returns {Promise<Object>} Map { construflow_id: project_id }
 */
export async function fetchProjectIdsByConstruflowBatch(construflowIds) {
  if (!construflowIds || construflowIds.length === 0) return {};
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('project_features')
    .select('construflow_id, project_id')
    .in('construflow_id', construflowIds);

  if (error) {
    console.error('Erro batch project_features:', error);
    return {};
  }

  const map = {};
  (data || []).forEach(r => { map[r.construflow_id] = r.project_id; });
  return map;
}

/**
 * Batch: busca disciplinas da equipe (Otus) para múltiplos projetos
 * @param {number[]} projectIds - IDs internos (projects.id)
 * @returns {Promise<Object>} Map { project_id: [{ discipline: { id, discipline_name, short_name } }] }
 */
export async function fetchProjectDisciplinesBatch(projectIds) {
  if (!projectIds || projectIds.length === 0) return {};
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('project_disciplines')
    .select(`
      project_id,
      discipline:discipline_id(id, discipline_name, short_name)
    `)
    .in('project_id', projectIds)
    .eq('status', 'ativo');

  if (error) {
    console.error('Erro batch project_disciplines:', error);
    return {};
  }

  const map = {};
  (data || []).forEach(r => {
    if (!map[r.project_id]) map[r.project_id] = [];
    map[r.project_id].push(r);
  });
  return map;
}

/**
 * Batch: busca mapeamentos personalizados para múltiplos projetos
 * @param {number[]} projectIds - IDs internos (projects.id)
 * @returns {Promise<Object>} Map { project_id: [mapping] }
 */
export async function fetchDisciplineMappingsBatch(projectIds) {
  if (!projectIds || projectIds.length === 0) return {};
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('discipline_mappings')
    .select(`
      id, project_id, external_source, external_discipline_name,
      standard_discipline_id,
      standard_discipline:standard_discipline_id(id, discipline_name, short_name)
    `)
    .in('project_id', projectIds);

  if (error) {
    console.error('Erro batch discipline_mappings:', error);
    return {};
  }

  const map = {};
  (data || []).forEach(r => {
    if (!map[r.project_id]) map[r.project_id] = [];
    map[r.project_id].push(r);
  });
  return map;
}

/**
 * Busca todas as empresas disponíveis
 */
export async function fetchCompanies() {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('companies')
    .select('id, name, company_type, status')
    .in('status', ['validado', 'pendente'])
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar empresas: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Busca todos os contatos disponíveis
 */
export async function fetchContacts() {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('contacts')
    .select(`
      id,
      name,
      email,
      phone,
      position,
      company_id,
      company:company_id(id, name)
    `)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar contatos: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Adiciona uma disciplina/equipe a um projeto
 */
export async function createProjectDiscipline(disciplineData) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('project_disciplines')
    .insert({
      project_id: disciplineData.project_id,
      discipline_id: disciplineData.discipline_id,
      company_id: disciplineData.company_id || null,
      contact_id: disciplineData.contact_id || null,
      discipline_detail: disciplineData.discipline_detail || null,
      email: disciplineData.email || null,
      phone: disciplineData.phone || null,
      position: disciplineData.position || null,
      status: 'ativo',
    })
    .select(`
      id,
      project_id,
      discipline_id,
      company_id,
      contact_id,
      discipline_detail,
      email,
      phone,
      position,
      status,
      created_at,
      update_at,
      project:project_id(id, name, project_code),
      discipline:discipline_id(id, discipline_name, short_name),
      company:company_id(id, name, status),
      contact:contact_id(id, name, email, phone, position)
    `)
    .single();

  if (error) {
    throw new Error(`Erro ao adicionar equipe: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza uma disciplina/equipe de um projeto
 */
export async function updateProjectDiscipline(id, disciplineData) {
  const supabase = getSupabaseClient();

  const updateData = {
    update_at: new Date().toISOString(),
  };

  if (disciplineData.contact_id !== undefined) {
    updateData.contact_id = disciplineData.contact_id || null;
  }
  if (disciplineData.discipline_detail !== undefined) {
    updateData.discipline_detail = disciplineData.discipline_detail || null;
  }
  if (disciplineData.email !== undefined) {
    updateData.email = disciplineData.email || null;
  }
  if (disciplineData.phone !== undefined) {
    updateData.phone = disciplineData.phone || null;
  }
  if (disciplineData.position !== undefined) {
    updateData.position = disciplineData.position || null;
  }
  if (disciplineData.discipline_id !== undefined) {
    updateData.discipline_id = disciplineData.discipline_id;
  }
  if (disciplineData.company_id !== undefined) {
    updateData.company_id = disciplineData.company_id || null;
  }

  const { data, error } = await supabase
    .from('project_disciplines')
    .update(updateData)
    .eq('id', id)
    .select(`
      id,
      project_id,
      discipline_id,
      company_id,
      contact_id,
      discipline_detail,
      email,
      phone,
      position,
      status,
      created_at,
      update_at,
      project:project_id(id, name, project_code),
      discipline:discipline_id(id, discipline_name, short_name),
      company:company_id(id, name, status),
      contact:contact_id(id, name, email, phone, position)
    `)
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar equipe: ${error.message}`);
  }

  return data;
}

/**
 * Desativa uma disciplina/equipe de um projeto (soft delete)
 */
export async function deleteProjectDiscipline(id) {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('project_disciplines')
    .update({
      status: 'desativado',
      update_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    throw new Error(`Erro ao desativar equipe: ${error.message}`);
  }
}

// ============================================
// VISTA DE CONTATOS (Agregação por Disciplina/Empresa)
// ============================================

/**
 * Busca todas as disciplinas padrão para filtro
 */
export async function fetchAllDisciplines() {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('standard_disciplines')
    .select('id, discipline_name, short_name, status')
    .order('discipline_name', { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar disciplinas: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Busca todas as empresas para filtro
 */
export async function fetchAllCompanies() {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('companies')
    .select('id, name, company_type, status')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar empresas: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Busca todos os projetos para filtro
 */
export async function fetchAllProjects() {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('projects')
    .select('id, name, project_code, status, sector')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar projetos: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Busca dados agregados de disciplina/empresa com contagem de projetos
 */
export async function fetchDisciplineCompanyAggregation(filters = {}) {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('project_disciplines')
    .select('discipline_id, company_id, project_id')
    .eq('status', 'ativo');

  if (filters.discipline_id) {
    query = query.eq('discipline_id', filters.discipline_id);
  }
  if (filters.company_id) {
    query = query.eq('company_id', filters.company_id);
  }
  if (filters.project_id) {
    query = query.eq('project_id', filters.project_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao buscar dados de contatos: ${error.message}`);
  }

  const [disciplinesRes, companiesRes] = await Promise.all([
    supabase.from('standard_disciplines').select('id, discipline_name, short_name'),
    supabase.from('companies').select('id, name, status'),
  ]);

  const disciplinesMap = new Map();
  for (const d of disciplinesRes.data || []) {
    disciplinesMap.set(d.id, d);
  }

  const companiesMap = new Map();
  for (const c of companiesRes.data || []) {
    companiesMap.set(c.id, c);
  }

  const aggregationMap = new Map();

  for (const item of data || []) {
    const discipline = disciplinesMap.get(item.discipline_id);
    const company = companiesMap.get(item.company_id);

    if (!discipline || !company) continue;

    const key = `${item.discipline_id}-${item.company_id}`;

    if (!aggregationMap.has(key)) {
      aggregationMap.set(key, {
        discipline_id: item.discipline_id,
        company_id: item.company_id,
        discipline_name: discipline.discipline_name || '',
        discipline_short_name: discipline.short_name || '',
        company_name: company.name || '',
        company_status: company.status || '',
        projects: new Set(),
      });
    }

    if (item.project_id) {
      aggregationMap.get(key).projects.add(item.project_id);
    }
  }

  const result = Array.from(aggregationMap.values()).map((item) => ({
    discipline_id: item.discipline_id,
    company_id: item.company_id,
    discipline_name: item.discipline_name,
    discipline_short_name: item.discipline_short_name,
    company_name: item.company_name,
    company_status: item.company_status,
    project_count: item.projects.size,
  }));

  result.sort((a, b) => {
    const discComp = a.discipline_name.localeCompare(b.discipline_name, 'pt-BR');
    if (discComp !== 0) return discComp;
    return a.company_name.localeCompare(b.company_name, 'pt-BR');
  });

  return result;
}

/**
 * Busca detalhes de contatos e projetos para uma combinação disciplina/empresa
 */
export async function fetchDisciplineCompanyDetails(disciplineId, companyId) {
  const supabase = getSupabaseClient();

  const { data: records, error: recordsError } = await supabase
    .from('project_disciplines')
    .select('id, project_id, contact_id, email, phone, position, discipline_detail')
    .eq('discipline_id', disciplineId)
    .eq('company_id', companyId)
    .eq('status', 'ativo');

  if (recordsError) {
    throw new Error(`Erro ao buscar detalhes: ${recordsError.message}`);
  }

  const projectIds = [...new Set((records || []).map(r => r.project_id).filter(Boolean))];
  const contactIds = [...new Set((records || []).map(r => r.contact_id).filter(Boolean))];

  const [discResult, compResult, projectsResult, contactsResult] = await Promise.all([
    supabase.from('standard_disciplines').select('id, discipline_name, short_name').eq('id', disciplineId).single(),
    supabase.from('companies').select('id, name, status').eq('id', companyId).single(),
    projectIds.length > 0
      ? supabase.from('projects').select('id, name, project_code').in('id', projectIds)
      : Promise.resolve({ data: [] }),
    contactIds.length > 0
      ? supabase.from('contacts').select('id, name, email, phone, position').in('id', contactIds)
      : Promise.resolve({ data: [] }),
  ]);

  const contactsMap = new Map();
  for (const c of contactsResult.data || []) {
    contactsMap.set(c.id, c);
  }

  const projectsMap = new Map();
  for (const p of projectsResult.data || []) {
    projectsMap.set(p.id, p);
  }

  const enrichedContacts = [];
  const seenContactIds = new Set();
  const projectContactMap = new Map();

  for (const record of records || []) {
    if (record.project_id && record.contact_id) {
      const contactName = contactsMap.get(record.contact_id)?.name || '';
      if (!projectContactMap.has(record.project_id)) {
        projectContactMap.set(record.project_id, []);
      }
      const existingContacts = projectContactMap.get(record.project_id);
      if (!existingContacts.includes(contactName) && contactName) {
        existingContacts.push(contactName);
      }
    }

    if (!record.contact_id || seenContactIds.has(record.contact_id)) continue;
    seenContactIds.add(record.contact_id);

    const baseContact = contactsMap.get(record.contact_id) || {};
    enrichedContacts.push({
      id: record.contact_id,
      name: baseContact.name || '',
      email: record.email || baseContact.email || '',
      phone: record.phone || baseContact.phone || '',
      position: record.position || baseContact.position || '',
    });
  }

  const enrichedProjects = (projectsResult.data || []).map((p) => ({
    id: p.id,
    name: p.name || '',
    project_code: p.project_code || '',
    contact_names: projectContactMap.get(p.id) || [],
  }));

  return {
    discipline: discResult.data || { id: disciplineId, discipline_name: '', short_name: '' },
    company: compResult.data || { id: companyId, name: '', status: '' },
    contacts: enrichedContacts.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR')),
    projects: enrichedProjects.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR')),
  };
}

// ============================================
// Portfolio - Edicao de Projetos
// ============================================

/**
 * Busca projetos do Supabase com joins para edicao
 * @returns {Promise<Array>}
 */
export async function fetchProjectsFromSupabase() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('projects')
    .select(`
      project_code,
      comercial_name,
      status,
      team_id,
      company_id,
      project_manager_id,
      teams:team_id (id, team_name, team_number),
      companies:company_id (id, name),
      users_otus:project_manager_id (id, name)
    `);

  if (error) {
    throw new Error(`Erro ao buscar projetos: ${error.message}`);
  }

  return data || [];
}

/**
 * Atualiza um campo do projeto no Supabase
 * @param {string} projectCode - Codigo do projeto
 * @param {string} field - Campo a atualizar (comercial_name, status, client, nome_time, lider)
 * @param {any} value - Novo valor
 * @returns {Promise<Object>}
 */
export async function updateProjectField(projectCode, field, value) {
  const supabase = getSupabaseClient();

  // Mapear campo do frontend para campo do banco
  const fieldMap = {
    'comercial_name': 'comercial_name',
    'status': 'status',
    'client': 'company_id',
    'nome_time': 'team_id',
    'lider': 'project_manager_id'
  };

  const dbField = fieldMap[field];
  if (!dbField) {
    throw new Error(`Campo '${field}' nao mapeado`);
  }

  // Converter valor vazio para null
  const dbValue = value === '' || value === undefined ? null : value;

  const { data, error } = await supabase
    .from('projects')
    .update({ [dbField]: dbValue })
    .eq('project_code', projectCode)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar projeto: ${error.message}`);
  }

  return data;
}

/**
 * Busca opcoes para dropdowns de edicao de portfolio
 * @returns {Promise<Object>}
 */
export async function fetchPortfolioEditOptions() {
  const supabase = getSupabaseClient();

  const [teamsResult, companiesResult, leadersResult] = await Promise.all([
    supabase.from('teams').select('id, team_name, team_number').order('team_number'),
    supabase.from('companies').select('id, name').order('name'),
    supabase.from('users_otus').select('id, name').eq('is_active', true).order('name')
  ]);

  if (teamsResult.error) {
    throw new Error(`Erro ao buscar times: ${teamsResult.error.message}`);
  }
  if (companiesResult.error) {
    throw new Error(`Erro ao buscar empresas: ${companiesResult.error.message}`);
  }
  if (leadersResult.error) {
    throw new Error(`Erro ao buscar lideres: ${leadersResult.error.message}`);
  }

  return {
    teams: teamsResult.data || [],
    companies: companiesResult.data || [],
    leaders: leadersResult.data || []
  };
}

// ============================================
// APOIO DE PROJETOS - PORTFOLIO
// ============================================

/**
 * Busca dados de project_features para enriquecer portfolio
 * Retorna mapa { project_code: { plataforma_acd, controle_apoio } }
 */
export async function fetchProjectFeaturesForPortfolio() {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('project_features')
    .select('project_id, plataforma_acd, controle_apoio, link_ifc, projects!inner(project_code)');

  if (error) {
    throw new Error(`Erro ao buscar project_features: ${error.message}`);
  }

  const map = {};
  (data || []).forEach(row => {
    const code = row.projects?.project_code;
    if (code) {
      map[code] = {
        plataforma_acd: row.plataforma_acd || null,
        controle_apoio: row.controle_apoio || null,
        link_ifc: row.link_ifc || null,
      };
    }
  });

  return map;
}

/**
 * Atualiza o campo controle_apoio em project_features
 * @param {string} projectCode - Codigo do projeto (project_code)
 * @param {string|null} controleApoio - Valor: Controlando, Nao controlando, Dispensado ou null
 */
export async function updateControleApoio(projectCode, controleApoio) {
  const supabase = getSupabaseClient();

  // Buscar project_id pelo project_code
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('project_code', projectCode)
    .single();

  if (projectError || !project) {
    throw new Error(`Projeto nao encontrado: ${projectCode}`);
  }

  // Upsert em project_features
  const { data, error } = await supabase
    .from('project_features')
    .upsert(
      { project_id: project.id, controle_apoio: controleApoio },
      { onConflict: 'project_id' }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar controle_apoio: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza o campo link_ifc em project_features
 * @param {string} projectCode - Codigo do projeto (project_code)
 * @param {string|null} linkIfc - URL da pasta de IFCs atualizados
 */
export async function updateLinkIfc(projectCode, linkIfc) {
  const supabase = getSupabaseClient();

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('project_code', projectCode)
    .single();

  if (projectError || !project) {
    throw new Error(`Projeto nao encontrado: ${projectCode}`);
  }

  const { data, error } = await supabase
    .from('project_features')
    .upsert(
      { project_id: project.id, link_ifc: linkIfc },
      { onConflict: 'project_id' }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar link_ifc: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza o campo plataforma_acd em project_features
 * @param {string} projectCode - Codigo do projeto (project_code)
 * @param {string|null} plataformaAcd - Valor da plataforma ACD
 */
export async function updatePlataformaAcd(projectCode, plataformaAcd) {
  const supabase = getSupabaseClient();

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('project_code', projectCode)
    .single();

  if (projectError || !project) {
    throw new Error(`Projeto nao encontrado: ${projectCode}`);
  }

  const { data, error } = await supabase
    .from('project_features')
    .upsert(
      { project_id: project.id, plataforma_acd: plataformaAcd },
      { onConflict: 'project_id' }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar plataforma_acd: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza um campo de ferramenta em project_features
 * Usado pela aba Ferramentas para toggle de status e edicao de IDs/URLs
 * @param {string} projectCode - Codigo do projeto (project_code)
 * @param {string} field - Campo a atualizar (ex: whatsapp_status, dod_id)
 * @param {any} value - Novo valor
 */
export async function updateProjectToolField(projectCode, field, value) {
  const supabase = getSupabaseClient();

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('project_code', projectCode)
    .single();

  if (projectError || !project) {
    throw new Error(`Projeto nao encontrado: ${projectCode}`);
  }

  const dbValue = value === '' || value === undefined ? null : value;

  const { data, error } = await supabase
    .from('project_features')
    .upsert(
      { project_id: project.id, [field]: dbValue },
      { onConflict: 'project_id' }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar ferramenta: ${error.message}`);
  }

  return data;
}

// ============================================
// OAUTH TOKENS (Gmail Draft)
// ============================================

/**
 * Armazena tokens OAuth de um usuário (upsert)
 * Usa service_role para bypassar RLS
 * @param {string} userId - ID do users_otus
 * @param {Object} tokens - { accessToken, refreshToken, scopes }
 */
export async function storeUserOAuthTokens(userId, { accessToken, refreshToken, scopes }) {
  const supabase = getSupabaseServiceClient();

  const upsertData = {
    user_id: userId,
    provider: 'google',
    access_token: accessToken,
    scopes: scopes || [],
    updated_at: new Date().toISOString(),
  };

  // Só sobrescreve refresh_token se recebemos um novo
  // (Google só envia refresh_token no primeiro consent)
  if (refreshToken) {
    upsertData.refresh_token = refreshToken;
  }

  const { error } = await supabase
    .from('user_oauth_tokens')
    .upsert(upsertData, {
      onConflict: 'user_id,provider',
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(`Erro ao salvar tokens OAuth: ${error.message}`);
  }
}

/**
 * Busca tokens OAuth de um usuário
 * Usa service_role para bypassar RLS
 * @param {string} userId - ID do users_otus
 * @returns {Promise<{access_token, refresh_token, scopes}|null>}
 */
export async function getUserOAuthTokens(userId) {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from('user_oauth_tokens')
    .select('access_token, refresh_token, scopes, updated_at')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Resolve emails dos responsáveis por uma disciplina em um projeto
 * Usa 3 estratégias: match exato → discipline_mappings → match parcial
 * @param {string} construflowId - ID Construflow do projeto
 * @param {string} disciplinaName - Nome da disciplina (do Smartsheet/BigQuery)
 * @returns {Promise<string[]>} - Array de emails
 */
export async function resolveRecipientEmails(construflowId, disciplinaName) {
  if (!construflowId || !disciplinaName) return [];

  const disciplines = await fetchProjectDisciplines(construflowId);
  if (!disciplines || disciplines.length === 0) return [];

  const normalizedInput = disciplinaName.trim().toLowerCase();

  // Estratégia 1: Match exato no discipline_name ou short_name
  let matched = disciplines.filter(d => {
    const name = (d.discipline?.discipline_name || '').toLowerCase();
    const short = (d.discipline?.short_name || '').toLowerCase();
    return name === normalizedInput || short === normalizedInput;
  });

  // Estratégia 2: Via discipline_mappings (smartsheet → standard)
  if (matched.length === 0) {
    const projectId = await getProjectIdByConstruflow(construflowId);
    if (projectId) {
      const mappings = await fetchDisciplineMappings(projectId);
      const mapping = mappings.find(m =>
        m.external_discipline_name?.toLowerCase() === normalizedInput &&
        m.external_source === 'smartsheet'
      );
      if (mapping?.standard_discipline_id) {
        matched = disciplines.filter(d =>
          d.discipline_id === mapping.standard_discipline_id
        );
      }
    }
  }

  // Estratégia 3: Match parcial (contains)
  if (matched.length === 0) {
    matched = disciplines.filter(d => {
      const name = (d.discipline?.discipline_name || '').toLowerCase();
      return name.includes(normalizedInput) || normalizedInput.includes(name);
    });
  }

  // Extrair emails: prefere override da project_disciplines, fallback para contact.email
  const emails = [];
  for (const d of matched) {
    const email = d.email || d.contact?.email;
    if (email && !emails.includes(email)) {
      emails.push(email);
    }
  }

  return emails;
}

// ==================== WHITEBOARD ====================

/**
 * Busca o quadro compartilhado
 * @returns {Promise<Object>} - { elements, app_state, files, updated_at, updated_by }
 */
export async function fetchWhiteboard(boardId = 'shared') {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from('whiteboard')
    .select('*')
    .eq('id', boardId)
    .single();

  if (error) {
    // Se não existe, retorna vazio
    if (error.code === 'PGRST116') {
      return { elements: [], app_state: {}, files: {} };
    }
    throw new Error(`Erro ao buscar whiteboard: ${error.message}`);
  }

  return data;
}

/**
 * Salva o quadro compartilhado
 * @param {Array} elements - Elementos do Excalidraw
 * @param {Object} appState - Estado da aplicação
 * @param {Object} files - Arquivos (imagens) do Excalidraw
 * @param {string} updatedBy - Email do usuário que salvou
 * @returns {Promise<Object>}
 */
export async function saveWhiteboard(elements, appState, files, updatedBy, boardId = 'shared') {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from('whiteboard')
    .upsert({
      id: boardId,
      elements,
      app_state: appState,
      files,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao salvar whiteboard: ${error.message}`);
  }

  return data;
}
