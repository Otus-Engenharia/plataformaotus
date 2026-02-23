/**
 * Use Case: DeleteRecurringInstance
 * Deleta instância(s) de tarefa recorrente com 3 opções de escopo:
 * - 'this': apenas esta instância
 * - 'future': esta e todas as futuras
 * - 'all': todas as instâncias do grupo
 */

class DeleteRecurringInstance {
  #agendaRepository;

  constructor(agendaRepository) {
    this.#agendaRepository = agendaRepository;
  }

  /**
   * @param {number} id - ID da instância a deletar
   * @param {'this'|'future'|'all'} scope - escopo da deleção
   */
  async execute(id, scope = 'this') {
    const task = await this.#agendaRepository.findById(id);

    if (!task) {
      throw new Error(`Tarefa de agenda com ID ${id} não encontrada`);
    }

    // Determinar o parentId do grupo
    const parentId = task.parentTaskId || task.id;
    const isParent = !task.parentTaskId;

    switch (scope) {
      case 'this':
        await this.#deleteThis(task, parentId, isParent);
        break;

      case 'future':
        await this.#deleteFuture(task, parentId, isParent);
        break;

      case 'all':
        await this.#deleteAll(parentId);
        break;

      default:
        throw new Error(`Escopo inválido: ${scope}. Use 'this', 'future' ou 'all'`);
    }
  }

  /**
   * Deletar apenas esta instância
   * - Adiciona data à excluded_dates do parent para evitar re-materialização
   * - Se for o parent, promove a filha mais antiga como novo parent
   */
  async #deleteThis(task, parentId, isParent) {
    if (task.startDate) {
      const dateStr = this.#toDateStr(task.startDate);

      // Se é o parent, precisamos promover uma filha antes de deletar
      if (isParent) {
        await this.#promoteOldestChild(task);
      } else {
        // Adicionar data à excluded_dates do parent
        const parent = await this.#agendaRepository.findById(parentId);
        if (parent) {
          parent.addExcludedDate(dateStr);
          await this.#agendaRepository.update(parent);
        }
      }
    }

    await this.#agendaRepository.delete(task.id);
  }

  /**
   * Deletar esta e todas as futuras
   * - Seta recurrence_until no parent
   * - Deleta todas as instâncias com start_date >= desta
   */
  async #deleteFuture(task, parentId, isParent) {
    if (isParent) {
      // Se for o próprio parent, deletar tudo
      await this.#deleteAll(parentId);
      return;
    }

    // Setar recurrence_until para o final do dia anterior (UTC)
    // Evita que a materialização re-crie a instância deletada
    const untilDate = new Date(task.startDate);
    untilDate.setUTCDate(untilDate.getUTCDate() - 1);
    untilDate.setUTCHours(23, 59, 59, 999);

    await this.#agendaRepository.updateParentRecurrenceFields(parentId, {
      recurrence_until: untilDate.toISOString(),
    });

    // Deletar esta e todas as futuras
    await this.#agendaRepository.deleteFutureByParent(parentId, task.startDate.toISOString());

    // Deletar esta instância também (se não foi pega pelo deleteFutureByParent)
    await this.#agendaRepository.delete(task.id).catch(() => {});
  }

  /**
   * Deletar todas as instâncias do grupo
   */
  async #deleteAll(parentId) {
    // Deletar filhas primeiro, depois o parent
    await this.#agendaRepository.deleteAllChildren(parentId);
    await this.#agendaRepository.delete(parentId);
  }

  /**
   * Promove a filha mais antiga como novo parent quando o parent original é deletado
   */
  async #promoteOldestChild(parentTask) {
    const instances = await this.#agendaRepository.findGroupInstances(parentTask.id);

    // Filtrar filhas (excluir o parent)
    const children = instances
      .filter(t => t.id !== parentTask.id)
      .sort((a, b) => (a.startDate?.getTime() || 0) - (b.startDate?.getTime() || 0));

    if (children.length === 0) return;

    // A filha mais antiga vira o novo parent
    const newParent = children[0];
    const dateStr = this.#toDateStr(parentTask.startDate);

    // Atualizar a nova parent: remover parent_task_id, copiar campos de recorrência
    await this.#agendaRepository.updateParentRecurrenceFields(newParent.id, {
      recurrence_anchor_date: parentTask.recurrenceAnchorDate?.toISOString() || parentTask.startDate.toISOString(),
      recurrence_until: parentTask.recurrenceUntil?.toISOString() || null,
      recurrence_excluded_dates: [...(parentTask.recurrenceExcludedDates || []), dateStr],
    });

    // Setar parent_task_id = null no novo parent e atualizar filhas para apontar pro novo parent
    const { getSupabaseClient } = await import('../../../supabase.js');
    const supabase = getSupabaseClient();

    // Tornar novo parent
    await supabase
      .from('agenda_tasks')
      .update({ parent_task_id: null })
      .eq('id', newParent.id);

    // Atualizar filhas restantes para apontar pro novo parent
    if (children.length > 1) {
      await supabase
        .from('agenda_tasks')
        .update({ parent_task_id: newParent.id })
        .eq('parent_task_id', parentTask.id)
        .neq('id', newParent.id);
    }
  }

  #toDateStr(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

export { DeleteRecurringInstance };
