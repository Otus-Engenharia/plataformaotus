/**
 * Cliente Supabase (backend)
 * Usa variaveis de ambiente para conexao.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
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
    query = query.eq('level', level);
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
