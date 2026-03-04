/**
 * Implementação: SupabaseContactChangeRequestRepository
 *
 * Implementa a interface ContactChangeRequestRepository usando Supabase.
 */

import { ContactChangeRequestRepository } from '../../domain/contact-requests/ContactChangeRequestRepository.js';
import { ContactChangeRequest } from '../../domain/contact-requests/entities/ContactChangeRequest.js';
import { getSupabaseServiceClient } from '../../supabase.js';

const TABLE = 'contact_change_requests';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_FIELDS = [
  'target_contact_id', 'target_company_id',
  'requested_by_id', 'reviewed_by_id',
  'result_contact_id', 'result_company_id',
];

/** Garante que campos UUID contêm valores válidos (ou null) */
function sanitizeUuidFields(data) {
  for (const field of UUID_FIELDS) {
    if (data[field] && !UUID_RE.test(String(data[field]))) {
      console.warn(`⚠️ Campo ${field} com valor não-UUID: "${data[field]}", convertendo para null`);
      data[field] = null;
    }
  }
  return data;
}

/**
 * Converte row do banco em entidade, com fallback para dados raw
 * quando a validação do construtor falha (ex: payload vazio, email faltando).
 * Isso evita que UMA row inválida quebre a listagem inteira.
 */
function safeFromPersistence(row) {
  try {
    return ContactChangeRequest.fromPersistence(row);
  } catch (err) {
    console.warn(`⚠️ Solicitação id=${row.id} com dados inválidos, retornando raw:`, err.message);
    return {
      toResponse: () => ({
        id: row.id,
        request_type: row.request_type,
        request_type_label: row.request_type,
        status: row.status,
        payload: row.payload || {},
        target_contact_id: row.target_contact_id,
        target_company_id: row.target_company_id,
        project_code: row.project_code,
        requested_by_id: row.requested_by_id,
        requested_by_email: row.requested_by_email,
        requested_by_name: row.requested_by_name,
        reviewed_by_id: row.reviewed_by_id,
        reviewed_by_email: row.reviewed_by_email,
        reviewed_by_name: row.reviewed_by_name,
        reviewed_at: row.reviewed_at,
        rejection_reason: row.rejection_reason,
        result_contact_id: row.result_contact_id,
        result_company_id: row.result_company_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        is_pending: row.status === 'pendente',
      }),
    };
  }
}

class SupabaseContactChangeRequestRepository extends ContactChangeRequestRepository {
  #supabase;

  constructor() {
    super();
    this.#supabase = getSupabaseServiceClient();
  }

  async save(request) {
    const data = sanitizeUuidFields(request.toPersistence());
    delete data.id; // Auto-generated

    const { data: inserted, error } = await this.#supabase
      .from(TABLE)
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao salvar solicitação de contato: ${error.message}`);
    }

    return ContactChangeRequest.fromPersistence(inserted);
  }

  async findById(id) {
    const { data, error } = await this.#supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar solicitação: ${error.message}`);
    }

    return data ? ContactChangeRequest.fromPersistence(data) : null;
  }

  async findPending() {
    const { data, error } = await this.#supabase
      .from(TABLE)
      .select('*')
      .eq('status', 'pendente')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ findPending query error:', error.code, error.message);
      throw new Error(`Erro ao listar solicitações pendentes: ${error.message}`);
    }

    return (data || []).map(safeFromPersistence);
  }

  async findByRequester(email) {
    const { data, error } = await this.#supabase
      .from(TABLE)
      .select('*')
      .eq('requested_by_email', email)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`Erro ao listar solicitações do usuário: ${error.message}`);
    }

    return (data || []).map(safeFromPersistence);
  }

  async findByProjectCode(projectCode) {
    const { data, error } = await this.#supabase
      .from(TABLE)
      .select('*')
      .eq('project_code', projectCode)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao listar solicitações do projeto: ${error.message}`);
    }

    return (data || []).map(safeFromPersistence);
  }

  async findAll({ status, requestType } = {}) {
    let query = this.#supabase.from(TABLE).select('*');

    if (status) {
      query = query.eq('status', status);
    }
    if (requestType) {
      query = query.eq('request_type', requestType);
    }

    query = query.order('created_at', { ascending: false }).limit(200);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao listar solicitações: ${error.message}`);
    }

    return (data || []).map(safeFromPersistence);
  }

  async countPending() {
    const { count, error } = await this.#supabase
      .from(TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pendente');

    if (error) {
      throw new Error(`Erro ao contar solicitações pendentes: ${error.message}`);
    }

    return count || 0;
  }

  async update(request) {
    const data = sanitizeUuidFields(request.toPersistence());
    const id = data.id;
    delete data.id;
    delete data.created_at;

    const { data: updated, error } = await this.#supabase
      .from(TABLE)
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar solicitação: ${error.message}`);
    }

    return ContactChangeRequest.fromPersistence(updated);
  }
}

export { SupabaseContactChangeRequestRepository };
