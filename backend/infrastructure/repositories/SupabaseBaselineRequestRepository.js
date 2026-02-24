/**
 * Implementação: SupabaseBaselineRequestRepository
 *
 * Implementa a interface BaselineRequestRepository usando Supabase.
 */

import { BaselineRequestRepository } from '../../domain/baseline-requests/BaselineRequestRepository.js';
import { BaselineRequest } from '../../domain/baseline-requests/entities/BaselineRequest.js';
import { getSupabaseClient } from '../../supabase.js';

const TABLE = 'baseline_requests';

class SupabaseBaselineRequestRepository extends BaselineRequestRepository {
  #supabase;

  constructor() {
    super();
    this.#supabase = getSupabaseClient();
  }

  async save(baselineRequest) {
    const data = baselineRequest.toPersistence();
    delete data.id; // Auto-generated

    const { data: inserted, error } = await this.#supabase
      .from(TABLE)
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao salvar solicitação de baseline: ${error.message}`);
    }

    return BaselineRequest.fromPersistence(inserted);
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

    return data ? BaselineRequest.fromPersistence(data) : null;
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

    return (data || []).map(row => BaselineRequest.fromPersistence(row));
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

    return (data || []).map(row => BaselineRequest.fromPersistence(row));
  }

  async update(baselineRequest) {
    const data = baselineRequest.toPersistence();
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

    return BaselineRequest.fromPersistence(updated);
  }
}

export { SupabaseBaselineRequestRepository };
