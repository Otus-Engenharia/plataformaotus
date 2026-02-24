/**
 * Implementação: SupabaseTodoRepository
 *
 * Implementa a interface TodoRepository usando Supabase como storage.
 */

import { TodoRepository } from '../../domain/todos/TodoRepository.js';
import { Todo } from '../../domain/todos/entities/Todo.js';
import { getSupabaseClient } from '../../supabase.js';

const TASKS_TABLE = 'tasks';
const USERS_TABLE = 'users_otus';
const PROJECTS_TABLE = 'projects';

class SupabaseTodoRepository extends TodoRepository {
  #supabase;

  constructor() {
    super();
    this.#supabase = getSupabaseClient();
  }

  /**
   * Busca todos os ToDo's com filtros
   * Por padrão filtra apenas ToDo's independentes (agenda_task_id IS NULL)
   */
  async findAll(options = {}) {
    const { filters = {}, sort = {} } = options;

    let query = this.#supabase
      .from(TASKS_TABLE)
      .select('*');

    // Filtra apenas ToDo's independentes (sem vínculo com agenda)
    if (filters.standaloneOnly !== false) {
      query = query.is('agenda_task_id', null);
    }

    // Aplica filtros
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }

    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId);
    }

    if (filters.assignee) {
      query = query.eq('assignee', filters.assignee);
    }

    if (filters.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    // Ordenação
    const sortField = sort.field || 'created_at';
    const ascending = sort.direction === 'asc';
    query = query.order(sortField, { ascending });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar ToDo's: ${error.message}`);
    }

    return (data || []).map(row => Todo.fromPersistence(row));
  }

  /**
   * Busca ToDo por ID
   */
  async findById(id) {
    const { data, error } = await this.#supabase
      .from(TASKS_TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Erro ao buscar ToDo: ${error.message}`);
    }

    return data ? Todo.fromPersistence(data) : null;
  }

  /**
   * Salva um novo ToDo
   */
  async save(todo) {
    const persistData = todo.toPersistence();
    delete persistData.id;

    const { data, error } = await this.#supabase
      .from(TASKS_TABLE)
      .insert(persistData)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar ToDo: ${error.message}`);
    }

    return Todo.fromPersistence(data);
  }

  /**
   * Atualiza um ToDo existente
   */
  async update(todo) {
    const persistData = todo.toPersistence();
    const { id, ...updateData } = persistData;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await this.#supabase
      .from(TASKS_TABLE)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar ToDo: ${error.message}`);
    }

    return Todo.fromPersistence(data);
  }

  /**
   * Remove um ToDo
   */
  async delete(id) {
    const { error } = await this.#supabase
      .from(TASKS_TABLE)
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao remover ToDo: ${error.message}`);
    }
  }

  /**
   * Busca estatísticas de ToDo's
   */
  async getStats(userId) {
    let query = this.#supabase
      .from(TASKS_TABLE)
      .select('status, priority')
      .is('agenda_task_id', null);

    if (userId) {
      query = query.or(`assignee.eq.${userId},created_by.eq.${userId}`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar estatísticas: ${error.message}`);
    }

    const stats = {
      total: 0,
      by_status: {},
      by_priority: {},
    };

    for (const row of data || []) {
      stats.total++;
      stats.by_status[row.status] = (stats.by_status[row.status] || 0) + 1;
      if (row.priority) {
        stats.by_priority[row.priority] = (stats.by_priority[row.priority] || 0) + 1;
      }
    }

    return stats;
  }

  /**
   * Busca dados de múltiplos usuários por IDs
   */
  async getUsersByIds(userIds) {
    if (!userIds || userIds.length === 0) {
      return new Map();
    }

    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueIds.length === 0) return new Map();

    const { data, error } = await this.#supabase
      .from(USERS_TABLE)
      .select('id, name, email')
      .in('id', uniqueIds);

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

  /**
   * Busca dados de múltiplos projetos por IDs
   */
  async getProjectsByIds(projectIds) {
    if (!projectIds || projectIds.length === 0) {
      return new Map();
    }

    const uniqueIds = [...new Set(projectIds.filter(Boolean))];
    if (uniqueIds.length === 0) return new Map();

    const { data, error } = await this.#supabase
      .from(PROJECTS_TABLE)
      .select('id, name, comercial_name')
      .in('id', uniqueIds);

    if (error) {
      console.error('Erro ao buscar projetos:', error);
      return new Map();
    }

    const projectsMap = new Map();
    for (const p of data || []) {
      projectsMap.set(p.id, { id: p.id, name: p.comercial_name || p.name });
    }

    return projectsMap;
  }
}

export { SupabaseTodoRepository };
