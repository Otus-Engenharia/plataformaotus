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
