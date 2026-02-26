/**
 * Rotas de ToDo's (DDD)
 *
 * Implementa as rotas usando a arquitetura DDD com use cases.
 */

import express from 'express';
import { getSupabaseClient } from '../supabase.js';
import { SupabaseTodoRepository } from '../infrastructure/repositories/SupabaseTodoRepository.js';
import {
  CreateTodo,
  ListTodos,
  GetTodo,
  UpdateTodo,
  DeleteTodo,
  CompleteTodo,
  GetTodoStats,
} from '../application/use-cases/todos/index.js';
import { TaskStatus } from '../domain/todos/value-objects/TaskStatus.js';
import { TaskPriority } from '../domain/todos/value-objects/TaskPriority.js';

const router = express.Router();

let todoRepository = null;

function getRepository() {
  if (!todoRepository) {
    todoRepository = new SupabaseTodoRepository();
  }
  return todoRepository;
}

function createRoutes(requireAuth, logAction) {
  const repository = getRepository();

  /**
   * GET /api/todos
   * Lista ToDo's com filtros via query params
   */
  router.get('/', requireAuth, async (req, res) => {
    try {
      const { status, priority, project_id, assignee, search, sort_field, sort_dir, team_id, due_date, standalone_only } = req.query;

      const filters = {};
      if (status) filters.status = status;
      if (priority) filters.priority = priority;
      if (project_id) filters.projectId = parseInt(project_id, 10);
      if (assignee) filters.assignee = assignee;
      if (search) filters.search = search;
      if (team_id) filters.teamId = team_id;
      if (due_date) filters.dueDate = due_date;
      if (standalone_only === 'true') filters.standaloneOnly = true;

      const sort = {};
      if (sort_field) sort.field = sort_field;
      if (sort_dir) sort.direction = sort_dir;

      const listTodos = new ListTodos(repository);
      const todos = await listTodos.execute({
        userId: req.user?.id,
        filters,
        sort,
      });

      res.json({ success: true, data: todos });
    } catch (error) {
      console.error('Erro ao buscar ToDos:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao buscar ToDos' });
    }
  });

  /**
   * GET /api/todos/teams
   * Lista times disponíveis para filtro
   */
  router.get('/teams', requireAuth, async (req, res) => {
    try {
      const teams = await repository.getTeams();
      res.json({ success: true, data: teams });
    } catch (error) {
      console.error('Erro ao buscar times:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao buscar times' });
    }
  });

  /**
   * GET /api/todos/users
   * Lista usuários ativos para seleção de responsável
   */
  router.get('/users', requireAuth, async (req, res) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('users_otus')
        .select('id, name, email')
        .eq('status', 'ativo')
        .order('name', { ascending: true });

      if (error) throw error;
      res.json({ success: true, data: data || [] });
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao buscar usuários' });
    }
  });

  /**
   * GET /api/todos/projects
   * Lista todos os projetos disponíveis
   */
  router.get('/projects', requireAuth, async (req, res) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, project_code, comercial_name, status, team_id')
        .order('comercial_name', { ascending: true });

      if (error) throw error;
      res.json({ success: true, data: data || [] });
    } catch (error) {
      console.error('Erro ao buscar projetos:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao buscar projetos' });
    }
  });

  /**
   * GET /api/todos/favorite-projects
   * Lista projetos favoritados pelo usuário
   */
  router.get('/favorite-projects', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Usuário não autenticado' });
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('project_favorites')
        .select('project_id, projects(id, name, project_code, comercial_name, status, sector, team_id)')
        .eq('user_id', userId);

      if (error) throw error;

      const projects = (data || [])
        .map(row => row.projects)
        .filter(Boolean);

      res.json({ success: true, data: projects });
    } catch (error) {
      console.error('Erro ao buscar projetos favoritos:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao buscar projetos favoritos' });
    }
  });

  /**
   * GET /api/todos/stats
   * Estatísticas de ToDo's
   */
  router.get('/stats', requireAuth, async (req, res) => {
    try {
      const getStats = new GetTodoStats(repository);
      const stats = await getStats.execute({ userId: req.user?.id });

      res.json({ success: true, data: stats });
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao buscar estatísticas' });
    }
  });

  /**
   * GET /api/todos/:id
   * Busca um ToDo por ID
   */
  router.get('/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const getTodo = new GetTodo(repository);
      const todo = await getTodo.execute(parseInt(id, 10));

      if (!todo) {
        return res.status(404).json({ success: false, error: 'ToDo não encontrado' });
      }

      res.json({ success: true, data: todo });
    } catch (error) {
      console.error('Erro ao buscar ToDo:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao buscar ToDo' });
    }
  });

  /**
   * POST /api/todos
   * Cria um novo ToDo
   */
  router.post('/', requireAuth, async (req, res) => {
    try {
      const { name, description, priority, start_date, due_date, assignee, project_id } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Nome da tarefa é obrigatório' });
      }

      if (priority && !TaskPriority.isValid(priority)) {
        return res.status(400).json({
          success: false,
          error: `Prioridade deve ser: ${TaskPriority.VALID_VALUES.join(', ')}`,
        });
      }

      const createTodo = new CreateTodo(repository);
      const todo = await createTodo.execute({
        name,
        description: description || null,
        priority: priority || 'média',
        startDate: start_date || null,
        dueDate: due_date || null,
        assignee: assignee || req.user?.id,
        createdBy: req.user?.id,
        projectId: project_id ? parseInt(project_id, 10) : null,
      });

      if (logAction) {
        await logAction(req, 'create', 'todo', todo.id, 'ToDo criado', { name });
      }

      res.status(201).json({ success: true, data: todo });
    } catch (error) {
      console.error('Erro ao criar ToDo:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao criar ToDo' });
    }
  });

  /**
   * PUT /api/todos/:id
   * Atualiza campos de um ToDo
   */
  router.put('/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, status, priority, start_date, due_date, assignee, project_id, agenda_task_id } = req.body;

      if (status && !TaskStatus.isValid(status)) {
        return res.status(400).json({
          success: false,
          error: `Status deve ser: ${TaskStatus.VALID_VALUES.join(', ')}`,
        });
      }

      if (priority && !TaskPriority.isValid(priority)) {
        return res.status(400).json({
          success: false,
          error: `Prioridade deve ser: ${TaskPriority.VALID_VALUES.join(', ')}`,
        });
      }

      const updateTodo = new UpdateTodo(repository);
      const todo = await updateTodo.execute({
        id: parseInt(id, 10),
        name,
        description,
        status,
        priority,
        startDate: start_date,
        dueDate: due_date,
        assignee,
        projectId: project_id !== undefined ? (project_id ? parseInt(project_id, 10) : null) : undefined,
        agendaTaskId: agenda_task_id !== undefined ? (agenda_task_id ? parseInt(agenda_task_id, 10) : null) : undefined,
        userId: req.user?.id,
      });

      if (logAction) {
        await logAction(req, 'update', 'todo', id, 'ToDo atualizado', { status, priority });
      }

      res.json({ success: true, data: todo });
    } catch (error) {
      console.error('Erro ao atualizar ToDo:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao atualizar ToDo' });
    }
  });

  /**
   * PATCH /api/todos/:id/complete
   * Toggle finalizado/a fazer (checkbox)
   */
  router.patch('/:id/complete', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      const completeTodo = new CompleteTodo(repository);
      const todo = await completeTodo.execute({
        id: parseInt(id, 10),
        userId: req.user?.id,
      });

      if (logAction) {
        const action = todo.is_closed ? 'Tarefa finalizada' : 'Tarefa reaberta';
        await logAction(req, 'update', 'todo', id, action, { status: todo.status });
      }

      res.json({ success: true, data: todo });
    } catch (error) {
      console.error('Erro ao completar ToDo:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao completar ToDo' });
    }
  });

  /**
   * DELETE /api/todos/:id
   * Remove um ToDo
   */
  router.delete('/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      const deleteTodo = new DeleteTodo(repository);
      await deleteTodo.execute(parseInt(id, 10));

      if (logAction) {
        await logAction(req, 'delete', 'todo', id, 'ToDo removido');
      }

      res.json({ success: true, message: 'ToDo removido com sucesso' });
    } catch (error) {
      console.error('Erro ao remover ToDo:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro ao remover ToDo' });
    }
  });

  return router;
}

export { createRoutes };
export default router;
