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

    // Filtra apenas ToDo's independentes se explicitamente solicitado
    if (filters.standaloneOnly === true) {
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

    if (filters.dueDate) {
      const dayStart = `${filters.dueDate}T00:00:00.000Z`;
      const dayEnd = `${filters.dueDate}T23:59:59.999Z`;
      query = query.gte('due_date', dayStart).lte('due_date', dayEnd);
    }

    // Filtro por time (via projetos do time)
    if (filters.teamId) {
      const { data: teamProjects } = await this.#supabase
        .from(PROJECTS_TABLE)
        .select('id')
        .eq('team_id', filters.teamId);
      const projectIds = (teamProjects || []).map(p => p.id);
      if (projectIds.length === 0) {
        return [];
      }
      query = query.in('project_id', projectIds);
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
    const insertData = {
      name: todo.name,
      description: todo.description || null,
      status: todo.status.value || todo.status,
      priority: todo.priority.value || todo.priority,
      due_date: todo.dueDate?.toISOString() || null,
      assignee: todo.assignee || null,
      created_by: todo.createdBy || null,
      project_id: todo.projectId || null,
      agenda_task_id: todo.agendaTaskId || null,
    };

    const { data, error } = await this.#supabase
      .from(TASKS_TABLE)
      .insert(insertData)
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
    const updateData = {
      name: todo.name,
      description: todo.description || null,
      status: todo.status.value || todo.status,
      priority: todo.priority.value || todo.priority,
      due_date: todo.dueDate?.toISOString() || null,
      assignee: todo.assignee || null,
      project_id: todo.projectId || null,
      closed_at: todo.closedAt?.toISOString() || null,
      agenda_task_id: todo.agendaTaskId || null,
    };

    const { data, error } = await this.#supabase
      .from(TASKS_TABLE)
      .update(updateData)
      .eq('id', todo.id)
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
      .select('status, priority');

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
      .select('id, name, comercial_name, team_id, teams(id, team_name, team_number)')
      .in('id', uniqueIds);

    if (error) {
      console.error('Erro ao buscar projetos:', error);
      return new Map();
    }

    const projectsMap = new Map();
    for (const p of data || []) {
      const team = p.teams;
      projectsMap.set(p.id, {
        id: p.id,
        name: p.comercial_name || p.name,
        team_id: p.team_id || null,
        team_name: team ? `${team.team_number} - ${team.team_name}` : null,
      });
    }

    return projectsMap;
  }
  /**
   * Garante que um projeto esteja vinculado a uma tarefa de agenda (agenda_projects)
   * Não faz nada se já existir o vínculo
   */
  async ensureAgendaProjectLink(agendaTaskId, projectId) {
    if (!agendaTaskId || !projectId) return;

    const { data: existing } = await this.#supabase
      .from('agenda_projects')
      .select('project_id')
      .eq('agenda_task_id', agendaTaskId)
      .eq('project_id', projectId)
      .maybeSingle();

    if (existing) return;

    const { error } = await this.#supabase
      .from('agenda_projects')
      .insert({ agenda_task_id: agendaTaskId, project_id: projectId });

    if (error) {
      console.error('Erro ao vincular projeto à agenda:', error);
    }
  }

  /**
   * Busca nome de uma tarefa de agenda por ID
   */
  async getAgendaTaskById(agendaTaskId) {
    if (!agendaTaskId) return null;

    const { data, error } = await this.#supabase
      .from('agenda_tasks')
      .select('id, name')
      .eq('id', agendaTaskId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Erro ao buscar agenda task:', error);
      return null;
    }

    return data ? { id: data.id, name: data.name } : null;
  }

  /**
   * Busca nomes de múltiplas tarefas de agenda por IDs
   */
  async getAgendaTasksByIds(agendaTaskIds) {
    if (!agendaTaskIds || agendaTaskIds.length === 0) {
      return new Map();
    }

    const uniqueIds = [...new Set(agendaTaskIds.filter(Boolean))];
    if (uniqueIds.length === 0) return new Map();

    const { data, error } = await this.#supabase
      .from('agenda_tasks')
      .select('id, name')
      .in('id', uniqueIds);

    if (error) {
      console.error('Erro ao buscar agenda tasks:', error);
      return new Map();
    }

    const map = new Map();
    for (const item of data || []) {
      map.set(item.id, { id: item.id, name: item.name });
    }
    return map;
  }

  /**
   * Busca lista de times para filtro
   */
  async getTeams() {
    const { data, error } = await this.#supabase
      .from('teams')
      .select('id, team_name, team_number')
      .order('team_number', { ascending: true });

    if (error) {
      console.error('Erro ao buscar times:', error);
      return [];
    }

    return data || [];
  }
}

export { SupabaseTodoRepository };
