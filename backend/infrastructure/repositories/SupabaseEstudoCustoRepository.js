/**
 * Implementacao: SupabaseEstudoCustoRepository
 *
 * Implementa a interface EstudoCustoRepository usando Supabase como storage.
 */

import { EstudoCustoRepository } from '../../domain/estudos-custos/EstudoCustoRepository.js';
import { EstudoCusto } from '../../domain/estudos-custos/entities/EstudoCusto.js';
import { getSupabaseClient } from '../../supabase.js';

const ESTUDOS_CUSTOS_TABLE = 'estudos_custos';
const COMENTARIOS_TABLE = 'estudo_custo_comentarios';
const USERS_TABLE = 'users_otus';

class SupabaseEstudoCustoRepository extends EstudoCustoRepository {
  #supabase;

  constructor() {
    super();
    this.#supabase = getSupabaseClient();
  }

  async findAll(options = {}) {
    const { userId } = options;

    const { data, error } = await this.#supabase
      .from(ESTUDOS_CUSTOS_TABLE)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar estudos de custos: ${error.message}`);
    }

    let estudos = (data || []).map(row => EstudoCusto.fromPersistence(row));

    if (userId) {
      estudos.sort((a, b) => {
        const aIsOwn = a.authorId === userId;
        const bIsOwn = b.authorId === userId;
        if (aIsOwn && !bIsOwn) return -1;
        if (!aIsOwn && bIsOwn) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    }

    return estudos;
  }

  async findById(id) {
    const { data, error } = await this.#supabase
      .from(ESTUDOS_CUSTOS_TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Erro ao buscar estudo de custo: ${error.message}`);
    }

    return data ? EstudoCusto.fromPersistence(data) : null;
  }

  async findByAuthor(authorId) {
    const { data, error } = await this.#supabase
      .from(ESTUDOS_CUSTOS_TABLE)
      .select('*')
      .eq('author_id', authorId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar estudos do autor: ${error.message}`);
    }

    return (data || []).map(row => EstudoCusto.fromPersistence(row));
  }

  async findByStatus(status) {
    const { data, error } = await this.#supabase
      .from(ESTUDOS_CUSTOS_TABLE)
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar estudos por status: ${error.message}`);
    }

    return (data || []).map(row => EstudoCusto.fromPersistence(row));
  }

  async save(estudoCusto) {
    const persistData = estudoCusto.toPersistence();
    delete persistData.id;

    const { data, error } = await this.#supabase
      .from(ESTUDOS_CUSTOS_TABLE)
      .insert(persistData)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar estudo de custo: ${error.message}`);
    }

    return EstudoCusto.fromPersistence(data);
  }

  async update(estudoCusto) {
    const persistData = estudoCusto.toPersistence();
    const { id, ...updateData } = persistData;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await this.#supabase
      .from(ESTUDOS_CUSTOS_TABLE)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar estudo de custo: ${error.message}`);
    }

    return EstudoCusto.fromPersistence(data);
  }

  async delete(id) {
    const { error } = await this.#supabase
      .from(ESTUDOS_CUSTOS_TABLE)
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao remover estudo de custo: ${error.message}`);
    }
  }

  async getStats() {
    const { data, error } = await this.#supabase
      .from(ESTUDOS_CUSTOS_TABLE)
      .select('status');

    if (error) {
      throw new Error(`Erro ao buscar estatisticas: ${error.message}`);
    }

    const stats = {
      total: 0,
      by_status: {},
    };

    for (const row of data || []) {
      stats.total++;
      stats.by_status[row.status] = (stats.by_status[row.status] || 0) + 1;
    }

    return stats;
  }

  // --- Comentarios ---

  async findComentarios(estudoCustoId) {
    const { data, error } = await this.#supabase
      .from(COMENTARIOS_TABLE)
      .select('*')
      .eq('estudo_custo_id', estudoCustoId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar comentarios: ${error.message}`);
    }

    return data || [];
  }

  async saveComentario({ estudoCustoId, authorId, texto, tipo = 'comentario', metadata = null }) {
    const { data, error } = await this.#supabase
      .from(COMENTARIOS_TABLE)
      .insert({
        estudo_custo_id: estudoCustoId,
        author_id: authorId,
        texto,
        tipo,
        metadata,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar comentario: ${error.message}`);
    }

    return data;
  }

  async deleteComentario(comentarioId) {
    const { error } = await this.#supabase
      .from(COMENTARIOS_TABLE)
      .delete()
      .eq('id', comentarioId);

    if (error) {
      throw new Error(`Erro ao remover comentario: ${error.message}`);
    }
  }

  async deleteComentariosByEstudoCustoId(estudoCustoId) {
    const { error } = await this.#supabase
      .from(COMENTARIOS_TABLE)
      .delete()
      .eq('estudo_custo_id', estudoCustoId);

    if (error) {
      throw new Error(`Erro ao remover comentarios do estudo: ${error.message}`);
    }
  }

  // --- Usuarios ---

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
      console.error('Erro ao buscar usuarios:', error);
      return new Map();
    }

    const usersMap = new Map();
    for (const user of data || []) {
      usersMap.set(user.id, user);
    }

    return usersMap;
  }
}

export { SupabaseEstudoCustoRepository };
