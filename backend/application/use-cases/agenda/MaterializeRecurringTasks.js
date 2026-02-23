/**
 * Use Case: MaterializeRecurringTasks
 * Materializa instâncias de tarefas recorrentes para um período de datas.
 * Chamado antes do ListAgendaTasks no GET para garantir que as instâncias existam.
 */

import { AgendaTask } from '../../../domain/agenda/entities/AgendaTask.js';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

class MaterializeRecurringTasks {
  #agendaRepository;

  constructor(agendaRepository) {
    this.#agendaRepository = agendaRepository;
  }

  async execute({ userId, startDate, endDate }) {
    const parents = await this.#agendaRepository.findRecurringParents(userId);

    if (!parents.length) return;

    for (const parent of parents) {
      await this.#materializeForParent(parent, startDate, endDate);
    }
  }

  async #materializeForParent(parent, rangeStart, rangeEnd) {
    if (!parent.startDate || !parent.dueDate) return;

    const anchor = parent.recurrenceAnchorDate || parent.startDate;
    const maxDate = parent.recurrenceUntil
      || new Date(anchor.getTime() + ONE_YEAR_MS);
    const maxCount = parent.recurrenceCount;
    const excluded = parent.recurrenceExcludedDates || [];

    // Calcular a duração do evento original (em ms)
    const durationMs = parent.dueDate.getTime() - parent.startDate.getTime();

    // Horas/minutos do anchor
    const anchorHours = anchor.getHours();
    const anchorMinutes = anchor.getMinutes();

    // Gerar todas as datas de ocorrência que caem no range
    const occurrenceDates = this.#computeOccurrences(
      parent.recurrence.value,
      anchor,
      new Date(rangeStart),
      new Date(rangeEnd),
      maxDate,
    );

    if (!occurrenceDates.length) return;

    // Se há limite por contagem, verificar quantas filhas já existem
    let existingChildCount = 0;
    if (maxCount != null) {
      existingChildCount = await this.#agendaRepository.countChildrenByParent(parent.id);
    }

    // Buscar filhas já existentes no range para evitar duplicação
    const existingDates = await this.#agendaRepository.findChildrenDatesInRange(
      parent.id,
      rangeStart,
      rangeEnd,
    );

    // Converter para set de datas (YYYY-MM-DD) para comparação rápida
    const existingDateSet = new Set(
      existingDates.map(d => this.#toDateStr(new Date(d))),
    );

    // Também incluir a data do parent (não gerar duplicata)
    existingDateSet.add(this.#toDateStr(parent.startDate));

    // Filtrar datas excluídas
    const excludedSet = new Set(excluded);

    // Tarefas a criar
    const tasksToCreate = [];
    let created = 0;

    for (const date of occurrenceDates) {
      const dateStr = this.#toDateStr(date);

      // Pular se já existe, está excluída, ou passou do limite
      if (existingDateSet.has(dateStr)) continue;
      if (excludedSet.has(dateStr)) continue;
      if (maxCount != null && (existingChildCount + created) >= maxCount) break;

      // Criar start e due dates com o horário do anchor
      const instanceStart = new Date(date);
      instanceStart.setHours(anchorHours, anchorMinutes, 0, 0);

      const instanceDue = new Date(instanceStart.getTime() + durationMs);

      const childTask = AgendaTask.create({
        name: parent.name,
        startDate: instanceStart.toISOString(),
        dueDate: instanceDue.toISOString(),
        userId: parent.userId,
        recurrence: parent.recurrence.value,
        standardAgendaTaskId: parent.standardAgendaTaskId,
        compactTaskKind: parent.compactTaskKind,
        relatedDisciplineId: parent.relatedDisciplineId,
        phase: parent.phase,
        parentTaskId: parent.id,
      });

      tasksToCreate.push(childTask);
      created++;
    }

    if (tasksToCreate.length > 0) {
      const savedTasks = await this.#agendaRepository.saveMany(tasksToCreate);

      // Se deve copiar projetos, copiar project links do parent para cada filha
      if (parent.recurrenceCopyProjects) {
        const projectIds = await this.#agendaRepository.findProjectsByTaskId(parent.id);
        if (projectIds.length > 0) {
          for (const saved of savedTasks) {
            await this.#agendaRepository.saveProjectLinks(saved.id, projectIds);
          }
        }
      }
    }
  }

  /**
   * Computa as datas de ocorrência dentro de um range
   */
  #computeOccurrences(recurrenceType, anchor, rangeStart, rangeEnd, maxDate) {
    const dates = [];
    const effectiveEnd = new Date(Math.min(rangeEnd.getTime(), maxDate.getTime()));

    switch (recurrenceType) {
      case 'diária':
        return this.#computeDaily(anchor, rangeStart, effectiveEnd);
      case 'semanal':
        return this.#computeWeekly(anchor, rangeStart, effectiveEnd);
      case 'mensal':
        return this.#computeMonthly(anchor, rangeStart, effectiveEnd);
      default:
        return dates;
    }
  }

  #computeDaily(anchor, rangeStart, rangeEnd) {
    const dates = [];
    // Começar do dia seguinte ao anchor ou do rangeStart (o que for mais tardio)
    const anchorNextDay = new Date(anchor);
    anchorNextDay.setDate(anchorNextDay.getDate() + 1);
    anchorNextDay.setHours(0, 0, 0, 0);

    const start = new Date(Math.max(anchorNextDay.getTime(), new Date(rangeStart).setHours(0, 0, 0, 0)));

    const current = new Date(start);
    const endDate = new Date(rangeEnd);
    endDate.setHours(23, 59, 59, 999);

    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  #computeWeekly(anchor, rangeStart, rangeEnd) {
    const dates = [];
    const dayOfWeek = anchor.getDay();

    // Primeira ocorrência: anchor + 7 dias
    const firstOccurrence = new Date(anchor);
    firstOccurrence.setDate(firstOccurrence.getDate() + 7);

    // Avançar até o rangeStart
    const current = new Date(firstOccurrence);
    while (current < rangeStart) {
      current.setDate(current.getDate() + 7);
    }

    const endDate = new Date(rangeEnd);
    endDate.setHours(23, 59, 59, 999);

    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 7);
    }

    return dates;
  }

  #computeMonthly(anchor, rangeStart, rangeEnd) {
    const dates = [];
    const dayOfMonth = anchor.getDate();

    // Começar do mês seguinte ao anchor
    let year = anchor.getFullYear();
    let month = anchor.getMonth() + 1;

    const endDate = new Date(rangeEnd);
    endDate.setHours(23, 59, 59, 999);

    // Iterar mês a mês
    for (let i = 0; i < 365; i++) {
      if (month > 11) {
        month = 0;
        year++;
      }

      // Ajustar dia para meses com menos dias
      const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
      const adjustedDay = Math.min(dayOfMonth, lastDayOfMonth);

      const date = new Date(year, month, adjustedDay);

      if (date > endDate) break;
      if (date >= rangeStart) {
        dates.push(date);
      }

      month++;
    }

    return dates;
  }

  /**
   * Converte Date para string 'YYYY-MM-DD'
   */
  #toDateStr(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

export { MaterializeRecurringTasks };
