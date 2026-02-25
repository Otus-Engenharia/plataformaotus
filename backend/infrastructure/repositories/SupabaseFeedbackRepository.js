/**
 * Implementação: SupabaseFeedbackRepository
 *
 * Implementa a interface FeedbackRepository usando Supabase como storage.
 */

import { FeedbackRepository } from '../../domain/feedbacks/FeedbackRepository.js';
import { Feedback } from '../../domain/feedbacks/entities/Feedback.js';
import { getSupabaseClient } from '../../supabase.js';

const FEEDBACKS_TABLE = 'feedbacks';
const USERS_TABLE = 'users_otus';

class SupabaseFeedbackRepository extends FeedbackRepository {
  #supabase;

  constructor() {
    super();
    this.#supabase = getSupabaseClient();
  }

  /**
   * Busca todos os feedbacks com filtros opcionais
   */
  async findAll(options = {}) {
    const { userId, area = null, viewerRoleLevel = null } = options;

    let query = this.#supabase
      .from(FEEDBACKS_TABLE)
      .select('*')
      .order('created_at', { ascending: false });

    // Filtro por área: inclui feedbacks da área OU sem área (globais/legados)
    if (area) {
      query = query.or(`area.eq.${area},area.is.null`);
    }

    // Filtro por hierarquia de role: user(5) vê só de users, leader(4) vê de users+leaders
    if (viewerRoleLevel !== null && viewerRoleLevel > 3) {
      query = query.gte('author_role_level', viewerRoleLevel);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar feedbacks: ${error.message}`);
    }

    // Converte para entidades
    let feedbacks = (data || []).map(row => Feedback.fromPersistence(row));

    // Ordena para que os feedbacks do usuário venham primeiro
    if (userId) {
      feedbacks.sort((a, b) => {
        const aIsOwn = a.authorId === userId;
        const bIsOwn = b.authorId === userId;
        if (aIsOwn && !bIsOwn) return -1;
        if (!aIsOwn && bIsOwn) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    }

    return feedbacks;
  }

  /**
   * Busca feedback por ID
   */
  async findById(id) {
    const { data, error } = await this.#supabase
      .from(FEEDBACKS_TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Não encontrado
      }
      throw new Error(`Erro ao buscar feedback: ${error.message}`);
    }

    return data ? Feedback.fromPersistence(data) : null;
  }

  /**
   * Busca feedbacks por autor
   */
  async findByAuthor(authorId) {
    const { data, error } = await this.#supabase
      .from(FEEDBACKS_TABLE)
      .select('*')
      .eq('author_id', authorId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar feedbacks do autor: ${error.message}`);
    }

    return (data || []).map(row => Feedback.fromPersistence(row));
  }

  /**
   * Busca feedbacks por status
   */
  async findByStatus(status) {
    const { data, error } = await this.#supabase
      .from(FEEDBACKS_TABLE)
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar feedbacks por status: ${error.message}`);
    }

    return (data || []).map(row => Feedback.fromPersistence(row));
  }

  /**
   * Salva um novo feedback
   */
  async save(feedback) {
    const persistData = feedback.toPersistence();

    // Remove o ID pois será gerado pelo banco
    delete persistData.id;

    const { data, error } = await this.#supabase
      .from(FEEDBACKS_TABLE)
      .insert(persistData)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar feedback: ${error.message}`);
    }

    return Feedback.fromPersistence(data);
  }

  /**
   * Atualiza um feedback existente
   */
  async update(feedback) {
    const persistData = feedback.toPersistence();
    const { id, ...updateData } = persistData;

    // Atualiza o updated_at
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await this.#supabase
      .from(FEEDBACKS_TABLE)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar feedback: ${error.message}`);
    }

    return Feedback.fromPersistence(data);
  }

  /**
   * Remove um feedback
   */
  async delete(id) {
    const { error } = await this.#supabase
      .from(FEEDBACKS_TABLE)
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao remover feedback: ${error.message}`);
    }
  }

  /**
   * Busca estatísticas de feedbacks por status
   */
  async getStats() {
    const { data, error } = await this.#supabase
      .from(FEEDBACKS_TABLE)
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

  /**
   * Busca dados do usuário por ID
   */
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

  /**
   * Busca dados de múltiplos usuários por IDs
   */
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

export { SupabaseFeedbackRepository };
