/**
 * Use Case: UpdateAgendaTask
 * Atualiza uma tarefa de agenda existente
 * Utilizado para: drag & drop (reschedule), resize (resize), edição de campos
 *
 * Quando a tarefa é recorrente, aceita recurrenceScope:
 * - 'this': apenas esta instância
 * - 'future': esta e todas as futuras (aplica delta)
 * - 'all': todas as instâncias do grupo (aplica delta)
 */

class UpdateAgendaTask {
  #agendaRepository;

  constructor(agendaRepository) {
    this.#agendaRepository = agendaRepository;
  }

  async execute({ id, name, startDate, dueDate, status, recurrence, recurrenceUntil, recurrenceCount, recurrenceCopyProjects, reschedule, resize, recurrenceScope, standardAgendaTask, standardAgendaTaskName, compactTaskKind, relatedDisciplineId, phase }) {
    const task = await this.#agendaRepository.findById(id);

    if (!task) {
      throw new Error(`Tarefa de agenda com ID ${id} não encontrada`);
    }

    // --- Mudança de recorrência ---
    if (recurrence !== undefined) {
      return this.#handleRecurrenceChange(task, recurrence, { recurrenceUntil, recurrenceCount, recurrenceCopyProjects });
    }

    // --- Mudança de grupo de atividade ---
    if (standardAgendaTask !== undefined) {
      return this.#handleGroupChange(task, standardAgendaTask, standardAgendaTaskName, recurrenceScope);
    }

    // --- Drag & drop (reschedule) com scope ---
    if (reschedule) {
      return this.#handleReschedule(task, reschedule, recurrenceScope);
    }

    // --- Resize com scope ---
    if (resize) {
      return this.#handleResize(task, resize, recurrenceScope);
    }

    // --- Status (sempre "apenas esta") ---
    if (status !== undefined) {
      if (status === 'feito') {
        task.complete();
      } else {
        task.reopen();
      }
      const updated = await this.#agendaRepository.update(task);
      return updated.toResponse();
    }

    // --- Edição de campos de verificação ---
    if (compactTaskKind !== undefined || relatedDisciplineId !== undefined || phase !== undefined) {
      if (compactTaskKind !== undefined) task.changeVerificationKind(compactTaskKind);
      if (relatedDisciplineId !== undefined) task.changeRelatedDiscipline(relatedDisciplineId);
      if (phase !== undefined) task.changePhase(phase);
      const updated = await this.#agendaRepository.update(task);
      return updated.toResponse();
    }

    // --- Edição de nome ---
    if (name !== undefined) {
      task.changeName(name);
      const updated = await this.#agendaRepository.update(task);
      return updated.toResponse();
    }

    // --- Edição direta de datas com scope ---
    if (startDate !== undefined || dueDate !== undefined) {
      const newStart = startDate !== undefined ? startDate : task.startDate?.toISOString();
      const newDue = dueDate !== undefined ? dueDate : task.dueDate?.toISOString();
      return this.#handleReschedule(task, { startDate: newStart, dueDate: newDue }, recurrenceScope);
    }

    // Sem alteração
    const updated = await this.#agendaRepository.update(task);
    return updated.toResponse();
  }

  /**
   * Muda o tipo de recorrência e campos relacionados, limpa filhas futuras
   */
  async #handleRecurrenceChange(task, newRecurrence, extras = {}) {
    const parentId = task.parentTaskId || task.id;

    task.changeRecurrence(newRecurrence);

    // Aplicar campos extras de recorrência
    if (extras.recurrenceUntil !== undefined) {
      task.setRecurrenceUntil(extras.recurrenceUntil);
    }
    if (extras.recurrenceCount !== undefined) {
      task.setRecurrenceCount(extras.recurrenceCount);
    }
    if (extras.recurrenceCopyProjects !== undefined) {
      task.setCopyProjects(extras.recurrenceCopyProjects);
    }

    const updated = await this.#agendaRepository.update(task);

    // Se mudou para 'nunca', deletar todas as filhas futuras
    // Se mudou para outro tipo, deletar filhas futuras (serão re-materializadas com novo padrão)
    if (task.isRecurring || newRecurrence === 'nunca') {
      const now = new Date().toISOString();
      await this.#agendaRepository.deleteFutureByParent(parentId, now);
    }

    // Atualizar anchor e campos de recorrência do parent
    if (!task.parentTaskId && newRecurrence !== 'nunca') {
      const parentFields = {
        recurrence_anchor_date: task.startDate?.toISOString() || null,
      };
      if (extras.recurrenceUntil !== undefined) {
        parentFields.recurrence_until = extras.recurrenceUntil;
      }
      if (extras.recurrenceCount !== undefined) {
        parentFields.recurrence_count = extras.recurrenceCount;
      }
      if (extras.recurrenceCopyProjects !== undefined) {
        parentFields.recurrence_copy_projects = extras.recurrenceCopyProjects;
      }
      await this.#agendaRepository.updateParentRecurrenceFields(task.id, parentFields);
    }

    return updated.toResponse();
  }

  /**
   * Reschedule (drag & drop) com suporte a scope recorrente
   */
  async #handleReschedule(task, { startDate: newStartDate, dueDate: newDueDate }, scope) {
    const oldStart = task.startDate?.getTime();
    const oldDue = task.dueDate?.getTime();

    // Aplicar nesta instância
    task.reschedule(newStartDate, newDueDate);
    const updated = await this.#agendaRepository.update(task);

    // Se tem scope e é recorrente, aplicar delta a outras instâncias
    if (scope && scope !== 'this' && task.recurrence.isRecurring) {
      const newStart = new Date(newStartDate).getTime();
      const deltaMs = newStart - oldStart;

      if (deltaMs !== 0) {
        await this.#applyDeltaToScope(task, scope, deltaMs, newStartDate);
      }
    }

    return updated.toResponse();
  }

  /**
   * Resize com suporte a scope recorrente
   */
  async #handleResize(task, { dueDate: newDueDate }, scope) {
    const oldDue = task.dueDate?.getTime();

    task.resize(newDueDate);
    const updated = await this.#agendaRepository.update(task);

    // Se tem scope e é recorrente, aplicar delta de duração
    if (scope && scope !== 'this' && task.recurrence.isRecurring) {
      const newDue = new Date(newDueDate).getTime();
      const deltaMs = newDue - oldDue;

      if (deltaMs !== 0) {
        const parentId = task.parentTaskId || task.id;
        const instances = await this.#agendaRepository.findGroupInstances(parentId);

        let targetIds;
        if (scope === 'future') {
          targetIds = instances
            .filter(t => t.id !== task.id && t.startDate >= task.startDate)
            .map(t => t.id);
        } else {
          // 'all'
          targetIds = instances
            .filter(t => t.id !== task.id)
            .map(t => t.id);
        }

        // Para resize, aplicar delta apenas ao due_date
        if (targetIds.length > 0) {
          await this.#applyResizeDelta(targetIds, deltaMs);
        }
      }
    }

    return updated.toResponse();
  }

  /**
   * Aplica delta de tempo a instâncias conforme o scope
   */
  async #applyDeltaToScope(task, scope, deltaMs, newStartDateStr) {
    const parentId = task.parentTaskId || task.id;
    const instances = await this.#agendaRepository.findGroupInstances(parentId);

    let targetIds;
    if (scope === 'future') {
      targetIds = instances
        .filter(t => t.id !== task.id && t.startDate >= task.startDate)
        .map(t => t.id);
    } else {
      // 'all'
      targetIds = instances
        .filter(t => t.id !== task.id)
        .map(t => t.id);
    }

    if (targetIds.length > 0) {
      await this.#agendaRepository.applyDeltaToInstances(targetIds, deltaMs);
    }

    // Atualizar anchor date do parent para o novo horário
    await this.#agendaRepository.updateParentRecurrenceFields(parentId, {
      recurrence_anchor_date: newStartDateStr,
    });

    // Para 'future': deletar filhas que ainda não foram materializadas
    // (serão re-geradas com o novo anchor na próxima carga)
    // Não é necessário aqui pois a materialização usa o anchor
  }

  /**
   * Aplica delta de duração (resize) apenas ao due_date
   */
  async #applyResizeDelta(ids, deltaMs) {
    const { getSupabaseClient } = await import('../../infrastructure/../supabase.js').catch(() => ({ getSupabaseClient: null }));

    // Fallback: buscar e atualizar cada instância
    for (const id of ids) {
      const instance = await this.#agendaRepository.findById(id);
      if (instance && instance.dueDate) {
        const newDue = new Date(instance.dueDate.getTime() + deltaMs);
        try {
          instance.resize(newDue.toISOString());
          await this.#agendaRepository.update(instance);
        } catch {
          // Pular se a validação falhar (duração negativa, etc.)
        }
      }
    }
  }
  /**
   * Muda o grupo de atividade padrão com suporte a scope recorrente
   */
  async #handleGroupChange(task, newGroupId, newGroupName, scope) {
    task.changeStandardTask(newGroupId, newGroupName);
    const updated = await this.#agendaRepository.update(task);

    // Se é tarefa recorrente e tem scope, aplicar a outras instâncias
    if (scope && scope !== 'this' && task.recurrence.isRecurring) {
      const parentId = task.parentTaskId || task.id;
      const instances = await this.#agendaRepository.findGroupInstances(parentId);

      let targetIds;
      if (scope === 'future') {
        targetIds = instances
          .filter(t => t.id !== task.id && t.startDate >= task.startDate)
          .map(t => t.id);
      } else {
        // 'all'
        targetIds = instances
          .filter(t => t.id !== task.id)
          .map(t => t.id);
      }

      if (targetIds.length > 0) {
        await this.#agendaRepository.updateGroupForInstances(targetIds, newGroupId, newGroupName);
      }

      // Atualizar o parent para que futuras materializações usem o novo grupo
      await this.#agendaRepository.updateParentRecurrenceFields(parentId, {
        standard_agenda_task: newGroupId,
        name: newGroupName,
      });
    }

    return updated.toResponse();
  }
}

export { UpdateAgendaTask };
