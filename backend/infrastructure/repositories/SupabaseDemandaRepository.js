/**
 * Implementação: SupabaseDemandaRepository
 *
 * Implementa a interface DemandaRepository usando Supabase como storage.
 */

import { DemandaRepository } from '../../domain/demandas/DemandaRepository.js';
import { Demanda } from '../../domain/demandas/entities/Demanda.js';
import { getSupabaseClient } from '../../supabase.js';

const DEMANDAS_TABLE = 'demandas';
const COMENTARIOS_TABLE = 'demanda_comentarios';
const USERS_TABLE = 'users_otus';

class SupabaseDemandaRepository extends DemandaRepository {
  #supabase;

  constructor() {
    super();
    this.#supabase = getSupabaseClient();
  }

  async findAll(options = {}) {
    const { userId } = options;

    const { data, error } = await this.#supabase
      .from(DEMANDAS_TABLE)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar demandas: ${error.message}`);
    }

    let demandas = (data || []).map(row => Demanda.fromPersistence(row));

    if (userId) {
      demandas.sort((a, b) => {
        const aIsOwn = a.authorId === userId;
        const bIsOwn = b.authorId === userId;
        if (aIsOwn && !bIsOwn) return -1;
        if (!aIsOwn && bIsOwn) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    }

    return demandas;
  }

  async findById(id) {
    const { data, error } = await this.#supabase
      .from(DEMANDAS_TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Erro ao buscar demanda: ${error.message}`);
    }

    return data ? Demanda.fromPersistence(data) : null;
  }

  async findByAuthor(authorId) {
    const { data, error } = await this.#supabase
      .from(DEMANDAS_TABLE)
      .select('*')
      .eq('author_id', authorId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar demandas do autor: ${error.message}`);
    }

    return (data || []).map(row => Demanda.fromPersistence(row));
  }

  async findByStatus(status) {
    const { data, error } = await this.#supabase
      .from(DEMANDAS_TABLE)
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar demandas por status: ${error.message}`);
    }

    return (data || []).map(row => Demanda.fromPersistence(row));
  }

  async save(demanda) {
    const persistData = demanda.toPersistence();
    delete persistData.id;

    const { data, error } = await this.#supabase
      .from(DEMANDAS_TABLE)
      .insert(persistData)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar demanda: ${error.message}`);
    }

    return Demanda.fromPersistence(data);
  }

  async update(demanda) {
    const persistData = demanda.toPersistence();
    const { id, ...updateData } = persistData;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await this.#supabase
      .from(DEMANDAS_TABLE)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar demanda: ${error.message}`);
    }

    return Demanda.fromPersistence(data);
  }

  async delete(id) {
    const { error } = await this.#supabase
      .from(DEMANDAS_TABLE)
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao remover demanda: ${error.message}`);
    }
  }

  async getStats() {
    const { data, error } = await this.#supabase
      .from(DEMANDAS_TABLE)
      .select('status');

    if (error) {
      throw new Error(`Erro ao buscar estatísticas: ${error.message}`);
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

  // --- Comentários ---

  async findComentarios(demandaId) {
    const { data, error } = await this.#supabase
      .from(COMENTARIOS_TABLE)
      .select('*')
      .eq('demanda_id', demandaId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar comentários: ${error.message}`);
    }

    return data || [];
  }

  async saveComentario({ demandaId, authorId, texto, tipo = 'comentario', metadata = null }) {
    const { data, error } = await this.#supabase
      .from(COMENTARIOS_TABLE)
      .insert({
        demanda_id: demandaId,
        author_id: authorId,
        texto,
        tipo,
        metadata,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar comentário: ${error.message}`);
    }

    return data;
  }

  async deleteComentario(comentarioId) {
    const { error } = await this.#supabase
      .from(COMENTARIOS_TABLE)
      .delete()
      .eq('id', comentarioId);

    if (error) {
      throw new Error(`Erro ao remover comentário: ${error.message}`);
    }
  }

  async deleteComentariosByDemandaId(demandaId) {
    const { error } = await this.#supabase
      .from(COMENTARIOS_TABLE)
      .delete()
      .eq('demanda_id', demandaId);

    if (error) {
      throw new Error(`Erro ao remover comentários da demanda: ${error.message}`);
    }
  }

  // --- Usuários ---

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

export { SupabaseDemandaRepository };
