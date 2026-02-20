/**
 * Rotas de Agenda (DDD)
 *
 * Implementa as rotas usando a arquitetura DDD com use cases.
 */

import express from 'express';
import { SupabaseAgendaRepository } from '../infrastructure/repositories/SupabaseAgendaRepository.js';
import {
  ListAgendaTasks,
  GetAgendaTask,
  CreateAgendaTask,
  UpdateAgendaTask,
  DeleteAgendaTask,
} from '../application/use-cases/agenda/index.js';
import { AgendaTaskStatus } from '../domain/agenda/value-objects/AgendaTaskStatus.js';
import { AgendaRecurrence } from '../domain/agenda/value-objects/AgendaRecurrence.js';
import { fetchAllDisciplines } from '../supabase.js';
import { getSupabaseClient } from '../supabase.js';

const router = express.Router();

let agendaRepository = null;

function getRepository() {
  if (!agendaRepository) {
    agendaRepository = new SupabaseAgendaRepository();
  }
  return agendaRepository;
}

function createRoutes(requireAuth, logAction) {
  const repository = getRepository();

  /**
   * GET /api/agenda/tasks
   * Lista tarefas agendadas de um usuário em um intervalo de datas
   * Query params: startDate (ISO), endDate (ISO), userId (opcional — usa o usuário logado)
   */
  router.get('/', requireAuth, async (req, res) => {
    try {
      const { startDate, endDate, userId: queryUserId } = req.query;
      const userId = queryUserId || req.user?.id;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Os parâmetros startDate e endDate são obrigatórios',
        });
      }

      const listTasks = new ListAgendaTasks(repository);
      const tasks = await listTasks.execute({ userId, startDate, endDate });

      res.json({ success: true, data: tasks });
    } catch (error) {
      console.error('❌ Erro ao buscar tarefas de agenda:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar tarefas de agenda',
      });
    }
  });

  /**
   * GET /api/agenda/tasks/form/disciplines
   * Retorna disciplinas disponíveis para seleção no formulário
   */
  router.get('/form/disciplines', requireAuth, async (req, res) => {
    try {
      const disciplines = await fetchAllDisciplines();
      res.json({ success: true, data: disciplines });
    } catch (error) {
      console.error('❌ Erro ao buscar disciplinas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/agenda/tasks/form/standard-agenda-tasks
   * Retorna grupos de atividades padrão filtrados por position
   * Query params: position (ex: 'coordenação' ou 'digital,time bim' para múltiplos)
   */
  router.get('/form/standard-agenda-tasks', requireAuth, async (req, res) => {
    try {
      const { position } = req.query;

      if (!position) {
        return res.status(400).json({
          success: false,
          error: 'O parâmetro position é obrigatório',
        });
      }

      const positions = position.split(',').map(p => p.trim()).filter(Boolean);

      const supabase = getSupabaseClient();
      let query = supabase
        .from('standard_agenda_task')
        .select('id, name')
        .eq('status', 'ativo')
        .order('name', { ascending: true });

      if (positions.length === 1) {
        query = query.eq('position', positions[0]);
      } else {
        query = query.in('position', positions);
      }

      const { data, error } = await query;

      if (error) throw new Error(`Erro ao buscar atividades padrão: ${error.message}`);

      res.json({ success: true, data: data || [] });
    } catch (error) {
      console.error('❌ Erro ao buscar standard_agenda_task:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/agenda/tasks/form/favorite-projects
   * Retorna projetos favoritados pelo usuário logado
   */
  router.get('/form/favorite-projects', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Usuário não autenticado' });
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('project_favorites')
        .select('project_id, projects(id, name, project_code, comercial_name, status, sector)')
        .eq('user_id', userId);

      if (error) throw new Error(`Erro ao buscar projetos favoritos: ${error.message}`);

      const projects = (data || [])
        .map(row => row.projects)
        .filter(p => p && p.sector === 'Projetos');

      res.json({ success: true, data: projects });
    } catch (error) {
      console.error('❌ Erro ao buscar projetos favoritos:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/agenda/tasks/form/projects
   * Retorna projetos disponíveis para seleção no formulário
   * Filtra: sector='Projetos'
   */
  router.get('/form/projects', requireAuth, async (req, res) => {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('projects')
        .select('id, name, project_code, comercial_name, status')
        .eq('sector', 'Projetos')
        .order('comercial_name', { ascending: true });

      if (error) throw new Error(`Erro ao buscar projetos: ${error.message}`);

      res.json({ success: true, data: data || [] });
    } catch (error) {
      console.error('❌ Erro ao buscar projetos para formulário:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/agenda/tasks/form/standard-tasks
   * Retorna tarefas padrão (nível 3) para seleção no formulário
   * Query params: standardAgendaTaskId (ex: 18 para Verificação)
   */
  router.get('/form/standard-tasks', requireAuth, async (req, res) => {
    try {
      const { standardAgendaTaskId } = req.query;

      if (!standardAgendaTaskId) {
        return res.status(400).json({
          success: false,
          error: 'O parâmetro standardAgendaTaskId é obrigatório',
        });
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('standard_tasks')
        .select('id, name, order_index')
        .eq('standard_agenda_task_id', Number(standardAgendaTaskId))
        .order('order_index', { ascending: true });

      if (error) throw new Error(`Erro ao buscar tarefas padrão: ${error.message}`);

      res.json({ success: true, data: data || [] });
    } catch (error) {
      console.error('❌ Erro ao buscar tarefas padrão:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/agenda/tasks/todos
   * Retorna ToDo's vinculados a tarefas de agenda
   * Query params: agendaTaskIds (comma-separated)
   */
  router.get('/todos', requireAuth, async (req, res) => {
    try {
      const { agendaTaskIds } = req.query;

      if (!agendaTaskIds) {
        return res.json({ success: true, data: [] });
      }

      const ids = agendaTaskIds.split(',').map(Number).filter(n => !isNaN(n));
      if (!ids.length) {
        return res.json({ success: true, data: [] });
      }

      const todos = await repository.findTodosByAgendaTaskIds(ids);
      res.json({ success: true, data: todos });
    } catch (error) {
      console.error('❌ Erro ao buscar ToDos:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * PATCH /api/agenda/tasks/todos/:todoId
   * Atualiza o status de um ToDo
   * Body: { status: 'finalizado' | 'backlog' }
   */
  router.patch('/todos/:todoId', requireAuth, async (req, res) => {
    try {
      const { todoId } = req.params;
      const { status } = req.body;

      const validStatuses = ['backlog', 'a fazer', 'em progresso', 'finalizado', 'validação', 'cancelado'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Status inválido. Valores permitidos: ${validStatuses.join(', ')}`,
        });
      }

      const updated = await repository.updateTodoStatus(parseInt(todoId, 10), status);
      res.json({ success: true, data: updated });
    } catch (error) {
      console.error('❌ Erro ao atualizar ToDo:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/agenda/tasks/:id/details
   * Retorna dados complementares: nome da atividade padrão e projetos vinculados
   */
  router.get('/:id/details', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const supabase = getSupabaseClient();

      // Buscar nome da atividade padrão (standard_agenda_task)
      const getTask = new GetAgendaTask(repository);
      const task = await getTask.execute(parseInt(id, 10));

      let standardAgendaTaskName = null;
      if (task?.standard_agenda_task) {
        const { data: sat } = await supabase
          .from('standard_agenda_task')
          .select('name')
          .eq('id', task.standard_agenda_task)
          .single();
        standardAgendaTaskName = sat?.name || null;
      }

      // Buscar projetos vinculados via agenda_projects
      const { data: agendaProjects } = await supabase
        .from('agenda_projects')
        .select('project_id, projects(id, name, comercial_name)')
        .eq('agenda_task_id', parseInt(id, 10));

      const projects = (agendaProjects || [])
        .map(row => row.projects)
        .filter(Boolean);

      res.json({
        success: true,
        data: {
          standard_agenda_task_name: standardAgendaTaskName,
          projects,
        },
      });
    } catch (error) {
      console.error('❌ Erro ao buscar detalhes da tarefa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/agenda/tasks/:id/projects
   * Adiciona projetos à atividade
   * Body: { project_ids: [1, 2, 3] }
   */
  router.post('/:id/projects', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { project_ids } = req.body;

      if (!project_ids?.length) {
        return res.status(400).json({ success: false, error: 'project_ids é obrigatório' });
      }

      const supabase = getSupabaseClient();
      const agendaTaskId = parseInt(id, 10);

      // Buscar links existentes para não duplicar
      const { data: existing } = await supabase
        .from('agenda_projects')
        .select('project_id')
        .eq('agenda_task_id', agendaTaskId);

      const existingIds = new Set((existing || []).map(r => r.project_id));
      const newIds = project_ids.filter(pid => !existingIds.has(Number(pid)));

      if (newIds.length > 0) {
        const rows = newIds.map(pid => ({ agenda_task_id: agendaTaskId, project_id: Number(pid) }));
        const { error } = await supabase.from('agenda_projects').insert(rows);
        if (error) throw error;
      }

      // Retornar lista atualizada
      const { data: updatedProjects } = await supabase
        .from('agenda_projects')
        .select('project_id, projects(id, name, comercial_name)')
        .eq('agenda_task_id', agendaTaskId);

      const projects = (updatedProjects || []).map(row => row.projects).filter(Boolean);

      res.json({ success: true, data: projects });
    } catch (error) {
      console.error('❌ Erro ao adicionar projetos:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/agenda/tasks/:id/projects/:projectId
   * Remove um projeto da atividade (apenas se não tiver ToDo's vinculados)
   */
  router.delete('/:id/projects/:projectId', requireAuth, async (req, res) => {
    try {
      const { id, projectId } = req.params;
      const supabase = getSupabaseClient();
      const agendaTaskId = parseInt(id, 10);
      const projId = parseInt(projectId, 10);

      // Verificar se há ToDo's vinculados a esse projeto nessa agenda_task
      const { data: linkedTodos } = await supabase
        .from('tasks')
        .select('id')
        .eq('agenda_task_id', agendaTaskId)
        .eq('project_id', projId)
        .limit(1);

      if (linkedTodos?.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Não é possível remover um projeto que possui ToDo\'s vinculados',
        });
      }

      const { error } = await supabase
        .from('agenda_projects')
        .delete()
        .eq('agenda_task_id', agendaTaskId)
        .eq('project_id', projId);

      if (error) throw error;

      res.json({ success: true });
    } catch (error) {
      console.error('❌ Erro ao remover projeto:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/agenda/tasks/:id
   * Busca uma tarefa pelo ID
   */
  router.get('/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const getTask = new GetAgendaTask(repository);
      const task = await getTask.execute(parseInt(id, 10));

      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Tarefa de agenda não encontrada',
        });
      }

      res.json({ success: true, data: task });
    } catch (error) {
      console.error('❌ Erro ao buscar tarefa de agenda:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/agenda/tasks
   * Cria uma nova tarefa de agenda
   */
  router.post('/', requireAuth, async (req, res) => {
    try {
      const {
        name,
        start_date,
        due_date,
        recurrence,
        standard_agenda_task,
        coompat_task_kind,
        related_discipline_id,
        phase,
        project_ids,
        selected_standard_tasks,
      } = req.body;

      // Gerar nome automático se não informado
      const taskName = (name && name.trim()) ? name.trim() : 'Atividade de agenda';

      if (recurrence && !AgendaRecurrence.isValid(recurrence)) {
        return res.status(400).json({
          success: false,
          error: `Recorrência inválida. Valores permitidos: ${AgendaRecurrence.VALID_VALUES.join(', ')}`,
        });
      }

      const createTask = new CreateAgendaTask(repository);
      const task = await createTask.execute({
        name: taskName,
        startDate: start_date || null,
        dueDate: due_date || null,
        userId: req.user.id,
        recurrence: recurrence || 'nunca',
        standardAgendaTaskId: standard_agenda_task || null,
        compactTaskKind: coompat_task_kind || null,
        relatedDisciplineId: related_discipline_id || null,
        phase: phase || null,
        projectIds: project_ids || [],
        selectedStandardTasks: selected_standard_tasks || [],
      });

      if (logAction) {
        await logAction(req, 'create', 'agenda_task', task.id, 'Tarefa de agenda criada', { name });
      }

      res.status(201).json({ success: true, data: task });
    } catch (error) {
      console.error('❌ Erro ao criar tarefa de agenda:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * PUT /api/agenda/tasks/:id
   * Atualiza uma tarefa (drag & drop, resize, edição de campos)
   * Body pode conter:
   *   - reschedule: { startDate, dueDate } — para mover o evento (drag)
   *   - resize: { dueDate } — para redimensionar (arrastar borda inferior)
   *   - status: string — para alterar status
   *   - start_date / due_date — para edição direta de datas
   */
  router.put('/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { reschedule, resize, status, start_date, due_date, name } = req.body;

      if (status && !AgendaTaskStatus.isValid(status)) {
        return res.status(400).json({
          success: false,
          error: `Status inválido. Valores permitidos: ${AgendaTaskStatus.VALID_VALUES.join(', ')}`,
        });
      }

      const updateTask = new UpdateAgendaTask(repository);
      const task = await updateTask.execute({
        id: parseInt(id, 10),
        name,
        startDate: start_date,
        dueDate: due_date,
        status,
        reschedule,
        resize,
      });

      res.json({ success: true, data: task });
    } catch (error) {
      console.error('❌ Erro ao atualizar tarefa de agenda:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/agenda/tasks/:id
   * Remove uma tarefa de agenda
   */
  router.delete('/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleteTask = new DeleteAgendaTask(repository);
      await deleteTask.execute(parseInt(id, 10));

      if (logAction) {
        await logAction(req, 'delete', 'agenda_task', id, 'Tarefa de agenda excluída');
      }

      res.json({ success: true });
    } catch (error) {
      console.error('❌ Erro ao excluir tarefa de agenda:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  return router;
}

export { createRoutes };
