/**
 * Implementação: SupabaseContactChangeRequestRepository
 *
 * Implementa a interface ContactChangeRequestRepository usando Supabase.
 */

import { ContactChangeRequestRepository } from '../../domain/contact-requests/ContactChangeRequestRepository.js';
import { ContactChangeRequest } from '../../domain/contact-requests/entities/ContactChangeRequest.js';
import { getSupabaseClient } from '../../supabase.js';

const TABLE = 'contact_change_requests';

class SupabaseContactChangeRequestRepository extends ContactChangeRequestRepository {
  #supabase;

  constructor() {
    super();
    this.#supabase = getSupabaseClient();
  }

  async save(request) {
    const data = request.toPersistence();
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
      throw new Error(`Erro ao listar solicitações pendentes: ${error.message}`);
    }

    return (data || []).map(row => ContactChangeRequest.fromPersistence(row));
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

    return (data || []).map(row => ContactChangeRequest.fromPersistence(row));
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

    return (data || []).map(row => ContactChangeRequest.fromPersistence(row));
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

    return (data || []).map(row => ContactChangeRequest.fromPersistence(row));
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
    const data = request.toPersistence();
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
