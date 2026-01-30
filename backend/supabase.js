/**
 * Cliente Supabase (backend)
 * Usa variaveis de ambiente para conexao.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_PORTFOLIO_VIEW = process.env.SUPABASE_PORTFOLIO_VIEW || 'portfolio_realtime';
const SUPABASE_CURVA_S_VIEW = process.env.SUPABASE_CURVA_S_VIEW || '';
const SUPABASE_CURVA_S_COLAB_VIEW = process.env.SUPABASE_CURVA_S_COLAB_VIEW || '';

export function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_URL ou SUPABASE_ANON_KEY nao configuradas');
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao configuradas');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function fetchPortfolioRealtime(leaderName = null) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from(SUPABASE_PORTFOLIO_VIEW)
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
  if (!SUPABASE_CURVA_S_VIEW) {
    throw new Error('SUPABASE_CURVA_S_VIEW nao configurada');
  }

  const supabase = getSupabaseClient();
  let query = supabase
    .from(SUPABASE_CURVA_S_VIEW)
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
  if (!SUPABASE_CURVA_S_COLAB_VIEW) {
    throw new Error('SUPABASE_CURVA_S_COLAB_VIEW nao configurada');
  }

  const supabase = getSupabaseClient();
  let query = supabase
    .from(SUPABASE_CURVA_S_COLAB_VIEW)
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
 * Busca todos os feedbacks
 * @param {boolean} isPrivileged - Se o usuário é admin/director
 * @param {string} userEmail - Email do usuário (para filtrar feedbacks próprios se não for privilegiado)
 * @returns {Promise<Array>}
 */
export async function fetchFeedbacks(isPrivileged = false, userEmail = null) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from(FEEDBACKS_TABLE)
    .select('*')
    .order('created_at', { ascending: false });

  // Se não for privilegiado, mostra apenas seus próprios feedbacks
  if (!isPrivileged && userEmail) {
    query = query.eq('created_by', userEmail);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao buscar feedbacks: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Cria um novo feedback
 * @param {Object} feedback - Dados do feedback
 * @param {string} feedback.tipo - 'processo' ou 'plataforma'
 * @param {string} feedback.titulo - Título do feedback
 * @param {string} feedback.descricao - Descrição do feedback
 * @param {string} feedback.created_by - Email de quem criou
 * @returns {Promise<Object>}
 */
export async function createFeedback(feedback) {
  const supabase = getSupabaseClient();
  const row = {
    tipo: feedback.tipo,
    titulo: feedback.titulo || '',
    descricao: feedback.descricao || '',
    status: 'pendente',
    created_by: feedback.created_by,
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
 * @param {string} status - Novo status ('pendente', 'em_analise', 'resolvido', 'arquivado')
 * @param {string} updatedBy - Email de quem atualizou
 * @returns {Promise<Object>}
 */
export async function updateFeedbackStatus(id, status, updatedBy) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(FEEDBACKS_TABLE)
    .update({
      status,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar status do feedback: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza o parecer de um feedback (apenas admin)
 * @param {string} id - ID do feedback
 * @param {string} parecer - Parecer do admin
 * @param {string} updatedBy - Email de quem atualizou
 * @returns {Promise<Object>}
 */
export async function updateFeedbackParecer(id, parecer, updatedBy) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(FEEDBACKS_TABLE)
    .update({
      parecer_admin: parecer,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
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
    .select('*')
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
    .select('*')
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
      quarter: okrData.quarter,
      created_by: okrData.created_by,
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
  const { data, error } = await supabase
    .from(OKRS_TABLE)
    .update({
      titulo: okrData.titulo,
      nivel: okrData.nivel,
      responsavel: okrData.responsavel,
      quarter: okrData.quarter,
      updated_at: new Date().toISOString(),
    })
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
    .select('*, key_results(*)')
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
    .select('*')
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
  const supabase = getSupabaseClient();
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
      default_weight: templateData.default_weight || 1,
      is_inverse: templateData.is_inverse || false,
      monthly_targets: templateData.monthly_targets || {},
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
  const supabase = getSupabaseClient();
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
  const supabase = getSupabaseClient();
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
    query = query.eq('ciclo', filters.ciclo);
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

  // Busca check-ins do indicador
  const checkIns = await fetchCheckIns(indicadorId);
  // Busca planos de recuperação
  const recoveryPlans = await fetchRecoveryPlans(indicadorId);

  return {
    ...data,
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
               template.metric_type === 'boolean' ? 'sim/não' : 'un',
      categoria: 'pessoas',
      periodo: ciclo === 'anual' ? 'anual' : 'trimestral',
      ciclo,
      ano,
      person_email: personEmail,
      cargo_id: template.position_id,
      setor_id: template.position?.sector_id || null,
      template_id: templateId,
      peso: template.default_weight || 1,
      threshold_80: template.default_threshold_80,
      threshold_120: template.default_threshold_120,
      is_inverse: template.is_inverse || false,
      consolidation_type: template.consolidation_type || 'last_value',
      metric_type: template.metric_type || 'number',
      monthly_targets: template.monthly_targets || {},
    }])
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar indicador: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza um indicador individual
 * @param {string} indicadorId - ID do indicador
 * @param {Object} updateData - Dados atualizados
 * @returns {Promise<Object>}
 */
export async function updateIndicadorIndividual(indicadorId, updateData) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(INDICADORES_TABLE)
    .update({
      ...updateData,
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

      const indicadores = await fetchIndicadoresIndividuais({
        person_email: user.email,
        ciclo: filters.ciclo,
        ano: filters.ano,
      });

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

  // Busca check-ins para cada indicador
  const indicadoresWithCheckIns = await Promise.all(
    indicadores.map(async (ind) => {
      const checkIns = await fetchCheckIns(ind.id);
      return { ...ind, checkIns };
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
function calculatePersonScore(indicadores) {
  if (!indicadores || indicadores.length === 0) return null;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const ind of indicadores) {
    const peso = ind.peso || 1;
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
 * Busca usuários com informações de setor e cargo
 * @returns {Promise<Array>}
 */
export async function fetchUsersWithRoles() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(USERS_OTUS_TABLE)
    .select(`
      id,
      name,
      email,
      role,
      status,
      leader_id,
      setor:setor_id(id, name),
      cargo:position_id(id, name, is_leadership)
    `)
    .eq('status', 'ativo')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar usuários: ${error.message}`);
  }

  const users = Array.isArray(data) ? data : [];

  // Map leaders from the same user list (self-referential relationship)
  const userMap = new Map(users.map(u => [u.id, { id: u.id, name: u.name, email: u.email }]));

  return users.map(user => ({
    ...user,
    leader: user.leader_id ? userMap.get(user.leader_id) || null : null
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
    .update({ is_active: isActive })
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
