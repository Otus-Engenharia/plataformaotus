/**
 * Implementação: SupabaseRelatoRepository
 *
 * Implementa a interface RelatoRepository usando Supabase como storage.
 */

import { RelatoRepository } from '../../domain/relatos/RelatoRepository.js';
import { Relato } from '../../domain/relatos/entities/Relato.js';
import { getSupabaseClient } from '../../supabase.js';

const RELATOS_TABLE = 'relatos';
const TIPOS_TABLE = 'relato_tipos';
const PRIORIDADES_TABLE = 'relato_prioridades';
const USERS_TABLE = 'users_otus';

class SupabaseRelatoRepository extends RelatoRepository {
  #supabase;

  constructor() {
    super();
    this.#supabase = getSupabaseClient();
  }

  // --- Relatos ---

  async findByProjectCode(projectCode, options = {}) {
    let query = this.#supabase
      .from(RELATOS_TABLE)
      .select('*')
      .eq('project_code', projectCode)
      .order('created_at', { ascending: false });

    if (options.tipo) {
      query = query.eq('tipo_slug', options.tipo);
    }
    if (options.prioridade) {
      query = query.eq('prioridade_slug', options.prioridade);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar relatos: ${error.message}`);
    }

    return (data || []).map(row => Relato.fromPersistence(row));
  }

  async findById(id) {
    const { data, error } = await this.#supabase
      .from(RELATOS_TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Erro ao buscar relato: ${error.message}`);
    }

    return data ? Relato.fromPersistence(data) : null;
  }

  async save(relato) {
    const persistData = relato.toPersistence();
    delete persistData.id;

    const { data, error } = await this.#supabase
      .from(RELATOS_TABLE)
      .insert(persistData)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar relato: ${error.message}`);
    }

    return Relato.fromPersistence(data);
  }

  async update(relato) {
    const persistData = relato.toPersistence();
    const { id, ...updateData } = persistData;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await this.#supabase
      .from(RELATOS_TABLE)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar relato: ${error.message}`);
    }

    return Relato.fromPersistence(data);
  }

  async delete(id) {
    const { error } = await this.#supabase
      .from(RELATOS_TABLE)
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao remover relato: ${error.message}`);
    }
  }

  async getStatsByProject(projectCode) {
    const { data, error } = await this.#supabase
      .from(RELATOS_TABLE)
      .select('tipo_slug, prioridade_slug, is_resolved')
      .eq('project_code', projectCode);

    if (error) {
      throw new Error(`Erro ao buscar estatísticas: ${error.message}`);
    }

    const stats = { total: 0, by_tipo: {}, by_prioridade: {}, resolved: 0 };

    for (const row of data || []) {
      stats.total++;
      stats.by_tipo[row.tipo_slug] = (stats.by_tipo[row.tipo_slug] || 0) + 1;
      stats.by_prioridade[row.prioridade_slug] = (stats.by_prioridade[row.prioridade_slug] || 0) + 1;
      if (row.is_resolved) stats.resolved++;
    }

    return stats;
  }

  // --- Tipos ---

  async findAllTipos() {
    const { data, error } = await this.#supabase
      .from(TIPOS_TABLE)
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar tipos: ${error.message}`);
    }

    return data || [];
  }

  async saveTipo(tipo) {
    const { data, error } = await this.#supabase
      .from(TIPOS_TABLE)
      .insert(tipo)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar tipo: ${error.message}`);
    }

    return data;
  }

  async updateTipo(id, updateData) {
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await this.#supabase
      .from(TIPOS_TABLE)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar tipo: ${error.message}`);
    }

    return data;
  }

  // --- Prioridades ---

  async findAllPrioridades() {
    const { data, error } = await this.#supabase
      .from(PRIORIDADES_TABLE)
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar prioridades: ${error.message}`);
    }

    return data || [];
  }

  async savePrioridade(prioridade) {
    const { data, error } = await this.#supabase
      .from(PRIORIDADES_TABLE)
      .insert(prioridade)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar prioridade: ${error.message}`);
    }

    return data;
  }

  async updatePrioridade(id, updateData) {
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await this.#supabase
      .from(PRIORIDADES_TABLE)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar prioridade: ${error.message}`);
    }

    return data;
  }

  // --- Users ---

  async getUserById(userId) {
    const { data, error } = await this.#supabase
      .from(USERS_TABLE)
      .select('id, name, email')
      .eq('id', userId)
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  async getUsersByIds(userIds) {
    if (!userIds || userIds.length === 0) {
      return new Map();
    }

    const { data, error } = await this.#supabase
      .from(USERS_TABLE)
      .select('id, name, email')
      .in('id', userIds);

    if (error) {
      console.error('Erro ao buscar usuários:', error);
      return new Map();
    }

    const usersMap = new Map();
    for (const user of data || []) {
      usersMap.set(user.id, user);
    }

    return usersMap;
  }
}

export { SupabaseRelatoRepository };
