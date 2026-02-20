/**
 * Implementação: SupabaseAgendaRepository
 *
 * Implementa a interface AgendaRepository usando Supabase como storage.
 */

import { AgendaRepository } from '../../domain/agenda/AgendaRepository.js';
import { AgendaTask } from '../../domain/agenda/entities/AgendaTask.js';
import { getSupabaseClient } from '../../supabase.js';

const AGENDA_TASKS_TABLE = 'agenda_tasks';
const AGENDA_PROJECTS_TABLE = 'agenda_projects';
const TASKS_TABLE = 'tasks';

class SupabaseAgendaRepository extends AgendaRepository {
  #supabase;

  constructor() {
    super();
    this.#supabase = getSupabaseClient();
  }

  /**
   * Busca tarefas agendadas de um usuário em um intervalo de datas
   */
  async findByUserAndDateRange(userId, startDate, endDate) {
    const { data, error } = await this.#supabase
      .from(AGENDA_TASKS_TABLE)
      .select('*')
      .eq('user_id', userId)
      .not('start_date', 'is', null)
      .gte('start_date', startDate)
      .lte('start_date', endDate)
      .order('start_date', { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar tarefas de agenda: ${error.message}`);
    }

    return (data || []).map(row => AgendaTask.fromPersistence(row));
  }

  /**
   * Busca tarefa por ID
   */
  async findById(id) {
    const { data, error } = await this.#supabase
      .from(AGENDA_TASKS_TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Erro ao buscar tarefa de agenda: ${error.message}`);
    }

    return data ? AgendaTask.fromPersistence(data) : null;
  }

  /**
   * Persiste uma nova tarefa
   */
  async save(task) {
    const persistData = task.toPersistence();
    delete persistData.id;

    const { data, error } = await this.#supabase
      .from(AGENDA_TASKS_TABLE)
      .insert(persistData)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar tarefa de agenda: ${error.message}`);
    }

    return AgendaTask.fromPersistence(data);
  }

  /**
   * Atualiza uma tarefa existente
   */
  async update(task) {
    const persistData = task.toPersistence();
    const { id, created_at, ...updateData } = persistData;

    const { data, error } = await this.#supabase
      .from(AGENDA_TASKS_TABLE)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar tarefa de agenda: ${error.message}`);
    }

    return AgendaTask.fromPersistence(data);
  }

  /**
   * Remove uma tarefa pelo ID
   */
  async delete(id) {
    const { error } = await this.#supabase
      .from(AGENDA_TASKS_TABLE)
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao excluir tarefa de agenda: ${error.message}`);
    }
  }

  /**
   * Retorna os IDs de projetos vinculados a uma tarefa
   */
  async findProjectsByTaskId(taskId) {
    const { data, error } = await this.#supabase
      .from(AGENDA_PROJECTS_TABLE)
      .select('project_id')
      .eq('agenda_task_id', taskId);

    if (error) {
      throw new Error(`Erro ao buscar projetos da tarefa: ${error.message}`);
    }

    return (data || []).map(row => row.project_id);
  }

  /**
   * Vincula projetos a uma tarefa de agenda
   */
  async saveProjectLinks(taskId, projectIds) {
    if (!projectIds.length) return;

    const rows = projectIds.map(pid => ({
      agenda_task_id: taskId,
      project_id: pid,
    }));

    const { error } = await this.#supabase
      .from(AGENDA_PROJECTS_TABLE)
      .insert(rows);

    if (error) {
      throw new Error(`Erro ao vincular projetos à tarefa: ${error.message}`);
    }
  }

  /**
   * Cria ToDo's na tabela tasks
   */
  async saveTodos(todos) {
    if (!todos.length) return;

    const rows = todos.map(t => ({
      name: t.name,
      status: 'backlog',
      start_date: null,
      due_date: t.due_date,
      priority: 'média',
      assignee: t.assignee,
      project_id: t.project_id,
      agenda_task_id: t.agenda_task_id,
    }));

    const { error } = await this.#supabase
      .from(TASKS_TABLE)
      .insert(rows);

    if (error) {
      throw new Error(`Erro ao criar ToDo's: ${error.message}`);
    }
  }

  /**
   * Busca ToDo's por IDs de tarefas de agenda, com nome do projeto
   */
  async findTodosByAgendaTaskIds(agendaTaskIds) {
    if (!agendaTaskIds.length) return [];

    const { data, error } = await this.#supabase
      .from(TASKS_TABLE)
      .select('id, name, status, agenda_task_id, project_id, projects(name, comercial_name)')
      .in('agenda_task_id', agendaTaskIds)
      .order('id', { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar ToDo's: ${error.message}`);
    }

    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      status: row.status,
      agenda_task_id: row.agenda_task_id,
      project_id: row.project_id,
      project_name: row.projects?.comercial_name || row.projects?.name || null,
    }));
  }

  /**
   * Atualiza o status de um ToDo
   */
  async updateTodoStatus(todoId, status) {
    const updateData = { status };
    if (status === 'finalizado') {
      updateData.closed_at = new Date().toISOString();
    } else {
      updateData.closed_at = null;
    }

    const { data, error } = await this.#supabase
      .from(TASKS_TABLE)
      .update(updateData)
      .eq('id', todoId)
      .select('id, name, status, agenda_task_id, project_id')
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar status do ToDo: ${error.message}`);
    }

    return data;
  }
}

export { SupabaseAgendaRepository };
